import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExportedData,
  validateExportData,
  getExportStats,
} from './dataConverter.js';

interface ImportOptions {
  input: string;
  dbPath?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}

interface ImportResult {
  success: boolean;
  imported: Record<string, number>;
  errors: string[];
  warnings: string[];
}

async function importToSQLite(options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: {},
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(options.input)) {
    result.success = false;
    result.errors.push(`Input file not found: ${options.input}`);
    return result;
  }

  console.log(`Reading export file: ${options.input}`);
  let data: ExportedData;
  
  try {
    const content = fs.readFileSync(options.input, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to read or parse input file: ${error}`);
    return result;
  }

  const validation = validateExportData(data);
  if (!validation.valid) {
    result.success = false;
    result.errors.push(...validation.errors);
    return result;
  }

  const stats = getExportStats(data);
  console.log('\nData to import:');
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count}`);
  }

  if (options.dryRun) {
    console.log('\nDry run completed. No data was imported.');
    return result;
  }

  const dbPath = options.dbPath || path.join(process.cwd(), 'knowledgemap-import.db');
  console.log(`\nOpening database: ${dbPath}`);

  if (fs.existsSync(dbPath) && !options.overwrite) {
    result.success = false;
    result.errors.push(`Database already exists: ${dbPath}. Use --overwrite to replace it.`);
    return result;
  }

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');
  db.pragma('synchronous = NORMAL');

  try {
    createTables(db);
    
    importUsers(db, data, result, options.batchSize || 100);
    importKnowledgeGraphs(db, data, result, options.batchSize || 100);
    importKnowledgePoints(db, data, result, options.batchSize || 100);
    importGraphNodes(db, data, result, options.batchSize || 100);
    importEdges(db, data, result, options.batchSize || 100);
    importStudyCards(db, data, result, options.batchSize || 100);
    importScheduledTasks(db, data, result, options.batchSize || 100);
    importFocusSessions(db, data, result, options.batchSize || 100);
    importTemplates(db, data, result, options.batchSize || 100);
    importAchievements(db, data, result, options.batchSize || 100);
    importUserAchievements(db, data, result, options.batchSize || 100);
    importQueues(db, data, result, options.batchSize || 100);
    importQuizSets(db, data, result, options.batchSize || 100);
    importLearningPaths(db, data, result, options.batchSize || 100);
    importNotifications(db, data, result, options.batchSize || 100);

    createIndexes(db);

    db.pragma('foreign_keys = ON');

    console.log('\nImport completed successfully!');
    console.log('\nImported records:');
    for (const [table, count] of Object.entries(result.imported)) {
      console.log(`  ${table}: ${count}`);
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(w => console.log(`  - ${w}`));
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Import failed: ${error}`);
    console.error('Import failed:', error);
  } finally {
    db.close();
  }

  return result;
}

function createTables(db: Database.Database): void {
  console.log('\nCreating tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT DEFAULT 'User',
      plan TEXT DEFAULT 'free',
      settings TEXT DEFAULT '{}',
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_graphs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      settings TEXT DEFAULT '{}',
      is_public INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      podcast_script TEXT,
      parent_graph_id TEXT REFERENCES knowledge_graphs(id),
      last_used_at TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      learning_material TEXT,
      properties TEXT DEFAULT '{}',
      visibility TEXT DEFAULT 'private',
      owner_id TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL REFERENCES knowledge_graphs(id),
      knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id),
      x_position REAL DEFAULT 0,
      y_position REAL DEFAULT 0,
      level TEXT DEFAULT 'normal',
      is_accepted INTEGER DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(graph_id, knowledge_point_id)
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      graph_id TEXT REFERENCES knowledge_graphs(id),
      source_knowledge_point_id TEXT REFERENCES knowledge_points(id),
      target_knowledge_point_id TEXT REFERENCES knowledge_points(id),
      relationship_type TEXT DEFAULT 'related',
      weight INTEGER DEFAULT 1,
      custom_label TEXT,
      custom_color TEXT,
      custom_line_style TEXT DEFAULT 'solid',
      show_arrow INTEGER,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type)
    );

    CREATE TABLE IF NOT EXISTS study_cards (
      id TEXT PRIMARY KEY,
      knowledge_point_id TEXT REFERENCES knowledge_points(id),
      user_id TEXT REFERENCES users(id),
      graph_id TEXT REFERENCES knowledge_graphs(id),
      source_graph_id TEXT REFERENCES knowledge_graphs(id),
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      explanation TEXT,
      card_type TEXT DEFAULT 'qa',
      options TEXT,
      difficulty INTEGER DEFAULT 1,
      last_reviewed TEXT,
      next_review TEXT DEFAULT (datetime('now')),
      review_count INTEGER DEFAULT 0,
      fsrs_state INTEGER DEFAULT 0,
      fsrs_stability REAL DEFAULT 0,
      fsrs_difficulty REAL DEFAULT 0,
      fsrs_elapsed_days REAL DEFAULT 0,
      fsrs_scheduled_days REAL DEFAULT 0,
      fsrs_retrievability REAL DEFAULT 0,
      fsrs_last_review TEXT,
      quiz_set_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      queue_id TEXT,
      queue_level INTEGER DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      estimated_duration INTEGER,
      actual_duration INTEGER,
      deadline TEXT,
      status TEXT DEFAULT 'pending',
      tags TEXT DEFAULT '[]',
      knowledge_point_id TEXT,
      priority INTEGER DEFAULT 0,
      task_type TEXT DEFAULT 'one_time',
      total_duration INTEGER,
      progress_mode TEXT,
      progress_percentage INTEGER DEFAULT 0,
      parent_task_id TEXT REFERENCES scheduled_tasks(id),
      context TEXT,
      scheduled_start TEXT,
      scheduled_end TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      start_time TEXT NOT NULL DEFAULT (datetime('now')),
      end_time TEXT NOT NULL DEFAULT (datetime('now')),
      duration INTEGER NOT NULL,
      mode TEXT NOT NULL,
      completed INTEGER DEFAULT 1,
      pomodoro_count INTEGER DEFAULT 0,
      white_noise_type TEXT,
      is_break INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      is_system INTEGER DEFAULT 0,
      nodes TEXT NOT NULL,
      edges TEXT DEFAULT '[]',
      layout TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      icon TEXT,
      color TEXT DEFAULT '#3B82F6',
      xp_reward INTEGER DEFAULT 100,
      condition_type TEXT NOT NULL,
      condition_value INTEGER NOT NULL,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      achievement_id TEXT REFERENCES achievements(id),
      progress INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      unlocked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'blue',
      time_slice INTEGER NOT NULL DEFAULT 30,
      priority INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, priority)
    );

    CREATE TABLE IF NOT EXISTS quiz_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      graph_id TEXT REFERENCES knowledge_graphs(id),
      title TEXT NOT NULL,
      description TEXT,
      config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'draft',
      card_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_paths (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      goal TEXT,
      target_date TEXT,
      source_graph_id TEXT REFERENCES knowledge_graphs(id),
      total_estimated_time INTEGER DEFAULT 0,
      ai_generated INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      daily_minutes_target INTEGER DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data TEXT DEFAULT '{}',
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );
  `);
}

function createIndexes(db: Database.Database): void {
  console.log('Creating indexes...');
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_deleted_at ON knowledge_graphs(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_knowledge_point_id);
    CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_queues_user_id ON queues(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  `);
}

function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function importUsers(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.users.length === 0) return;
  console.log('Importing users...');

  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, plan, settings, xp, level, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((users: typeof data.users) => {
    for (const user of users) {
      try {
        stmt.run(
          user.id,
          user.email,
          user.password_hash,
          user.name,
          'free',
          toJson(user.settings),
          user.xp,
          user.level,
          user.role,
          user.created_at,
          user.updated_at
        );
      } catch (error) {
        result.warnings.push(`users: Failed to import ${user.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.users.length; i += batchSize) {
    insertBatch(data.users.slice(i, i + batchSize));
  }

  result.imported.users = data.users.length;
  console.log(`  Imported ${data.users.length} users`);
}

function importKnowledgeGraphs(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.knowledge_graphs.length === 0) return;
  console.log('Importing knowledge_graphs...');

  const stmt = db.prepare(`
    INSERT INTO knowledge_graphs (id, user_id, title, description, settings, is_public, is_favorite, parent_graph_id, last_used_at, deleted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((graphs: typeof data.knowledge_graphs) => {
    for (const graph of graphs) {
      try {
        stmt.run(
          graph.id,
          graph.user_id,
          graph.title,
          graph.description,
          toJson(graph.settings),
          graph.is_public ? 1 : 0,
          graph.is_favorite ? 1 : 0,
          graph.parent_graph_id,
          graph.last_used_at,
          graph.deleted_at,
          graph.created_at,
          graph.updated_at
        );
      } catch (error) {
        result.warnings.push(`knowledge_graphs: Failed to import ${graph.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.knowledge_graphs.length; i += batchSize) {
    insertBatch(data.knowledge_graphs.slice(i, i + batchSize));
  }

  result.imported.knowledge_graphs = data.knowledge_graphs.length;
  console.log(`  Imported ${data.knowledge_graphs.length} knowledge_graphs`);
}

function importKnowledgePoints(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.knowledge_points.length === 0) return;
  console.log('Importing knowledge_points...');

  const stmt = db.prepare(`
    INSERT INTO knowledge_points (id, title, content, learning_material, properties, visibility, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((kps: typeof data.knowledge_points) => {
    for (const kp of kps) {
      try {
        stmt.run(
          kp.id,
          kp.title,
          kp.content,
          kp.learning_material,
          toJson(kp.properties),
          kp.visibility,
          kp.owner_id,
          kp.created_at,
          kp.updated_at
        );
      } catch (error) {
        result.warnings.push(`knowledge_points: Failed to import ${kp.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.knowledge_points.length; i += batchSize) {
    insertBatch(data.knowledge_points.slice(i, i + batchSize));
  }

  result.imported.knowledge_points = data.knowledge_points.length;
  console.log(`  Imported ${data.knowledge_points.length} knowledge_points`);
}

function importGraphNodes(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.graph_nodes.length === 0) return;
  console.log('Importing graph_nodes...');

  const stmt = db.prepare(`
    INSERT INTO graph_nodes (id, graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, deleted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((nodes: typeof data.graph_nodes) => {
    for (const node of nodes) {
      try {
        stmt.run(
          node.id,
          node.graph_id,
          node.knowledge_point_id,
          node.x_position,
          node.y_position,
          node.level,
          node.is_accepted ? 1 : 0,
          node.deleted_at,
          node.created_at,
          node.updated_at
        );
      } catch (error) {
        result.warnings.push(`graph_nodes: Failed to import ${node.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.graph_nodes.length; i += batchSize) {
    insertBatch(data.graph_nodes.slice(i, i + batchSize));
  }

  result.imported.graph_nodes = data.graph_nodes.length;
  console.log(`  Imported ${data.graph_nodes.length} graph_nodes`);
}

function importEdges(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.edges.length === 0) return;
  console.log('Importing edges...');

  const stmt = db.prepare(`
    INSERT INTO edges (id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow, deleted_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((edges: typeof data.edges) => {
    for (const edge of edges) {
      try {
        stmt.run(
          edge.id,
          edge.graph_id,
          edge.source_knowledge_point_id,
          edge.target_knowledge_point_id,
          edge.relationship_type,
          edge.weight,
          edge.custom_label,
          edge.custom_color,
          edge.custom_line_style,
          edge.show_arrow !== null ? (edge.show_arrow ? 1 : 0) : null,
          edge.deleted_at,
          edge.created_at
        );
      } catch (error) {
        result.warnings.push(`edges: Failed to import ${edge.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.edges.length; i += batchSize) {
    insertBatch(data.edges.slice(i, i + batchSize));
  }

  result.imported.edges = data.edges.length;
  console.log(`  Imported ${data.edges.length} edges`);
}

function importStudyCards(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.study_cards.length === 0) return;
  console.log('Importing study_cards...');

  const stmt = db.prepare(`
    INSERT INTO study_cards (id, knowledge_point_id, user_id, graph_id, source_graph_id, question, answer, explanation, card_type, options, difficulty, last_reviewed, next_review, review_count, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_retrievability, fsrs_last_review, quiz_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((cards: typeof data.study_cards) => {
    for (const card of cards) {
      try {
        stmt.run(
          card.id,
          card.knowledge_point_id,
          card.user_id,
          card.graph_id,
          card.source_graph_id,
          card.question,
          card.answer,
          card.explanation,
          card.card_type,
          toJson(card.options),
          card.difficulty,
          card.last_reviewed,
          card.next_review,
          card.review_count,
          card.fsrs_state,
          card.fsrs_stability,
          card.fsrs_difficulty,
          card.fsrs_elapsed_days,
          card.fsrs_scheduled_days,
          card.fsrs_retrievability,
          card.fsrs_last_review,
          card.quiz_set_id,
          card.created_at
        );
      } catch (error) {
        result.warnings.push(`study_cards: Failed to import ${card.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.study_cards.length; i += batchSize) {
    insertBatch(data.study_cards.slice(i, i + batchSize));
  }

  result.imported.study_cards = data.study_cards.length;
  console.log(`  Imported ${data.study_cards.length} study_cards`);
}

function importScheduledTasks(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.scheduled_tasks.length === 0) return;
  console.log('Importing scheduled_tasks...');

  const stmt = db.prepare(`
    INSERT INTO scheduled_tasks (id, user_id, title, description, queue_id, queue_level, position, estimated_duration, actual_duration, deadline, status, tags, knowledge_point_id, priority, task_type, total_duration, progress_mode, progress_percentage, parent_task_id, context, scheduled_start, scheduled_end, notes, created_at, updated_at, deleted_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((tasks: typeof data.scheduled_tasks) => {
    for (const task of tasks) {
      try {
        stmt.run(
          task.id,
          task.user_id,
          task.title,
          task.description,
          task.queue_id,
          task.queue_level,
          task.position,
          task.estimated_duration,
          task.actual_duration,
          task.deadline,
          task.status,
          toJson(task.tags),
          task.knowledge_point_id,
          task.priority,
          task.task_type,
          task.total_duration,
          task.progress_mode,
          task.progress_percentage,
          task.parent_task_id,
          task.context,
          task.scheduled_start,
          task.scheduled_end,
          task.notes,
          task.created_at,
          task.updated_at,
          task.deleted_at,
          task.completed_at
        );
      } catch (error) {
        result.warnings.push(`scheduled_tasks: Failed to import ${task.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.scheduled_tasks.length; i += batchSize) {
    insertBatch(data.scheduled_tasks.slice(i, i + batchSize));
  }

  result.imported.scheduled_tasks = data.scheduled_tasks.length;
  console.log(`  Imported ${data.scheduled_tasks.length} scheduled_tasks`);
}

function importFocusSessions(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.focus_sessions.length === 0) return;
  console.log('Importing focus_sessions...');

  const stmt = db.prepare(`
    INSERT INTO focus_sessions (id, user_id, task_id, start_time, end_time, duration, mode, completed, pomodoro_count, white_noise_type, is_break, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((sessions: typeof data.focus_sessions) => {
    for (const session of sessions) {
      try {
        stmt.run(
          session.id,
          session.user_id,
          session.task_id,
          session.start_time,
          session.end_time,
          session.duration,
          session.mode,
          session.completed ? 1 : 0,
          session.pomodoro_count,
          session.white_noise_type,
          session.is_break ? 1 : 0,
          session.created_at
        );
      } catch (error) {
        result.warnings.push(`focus_sessions: Failed to import ${session.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.focus_sessions.length; i += batchSize) {
    insertBatch(data.focus_sessions.slice(i, i + batchSize));
  }

  result.imported.focus_sessions = data.focus_sessions.length;
  console.log(`  Imported ${data.focus_sessions.length} focus_sessions`);
}

function importTemplates(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.templates.length === 0) return;
  console.log('Importing templates...');

  const stmt = db.prepare(`
    INSERT INTO templates (id, user_id, name, description, category, is_system, nodes, edges, layout, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((templates: typeof data.templates) => {
    for (const template of templates) {
      try {
        stmt.run(
          template.id,
          template.user_id,
          template.name,
          template.description,
          template.category,
          template.is_system ? 1 : 0,
          toJson(template.nodes),
          toJson(template.edges),
          toJson(template.layout),
          template.created_at,
          template.updated_at
        );
      } catch (error) {
        result.warnings.push(`templates: Failed to import ${template.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.templates.length; i += batchSize) {
    insertBatch(data.templates.slice(i, i + batchSize));
  }

  result.imported.templates = data.templates.length;
  console.log(`  Imported ${data.templates.length} templates`);
}

function importAchievements(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.achievements.length === 0) return;
  console.log('Importing achievements...');

  const stmt = db.prepare(`
    INSERT INTO achievements (id, code, name, description, category, icon, color, xp_reward, condition_type, condition_value, is_hidden, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((achievements: typeof data.achievements) => {
    for (const achievement of achievements) {
      try {
        stmt.run(
          achievement.id,
          achievement.code,
          achievement.name,
          achievement.description,
          achievement.category,
          achievement.icon,
          achievement.color,
          achievement.xp_reward,
          achievement.condition_type,
          achievement.condition_value,
          achievement.is_hidden ? 1 : 0,
          achievement.created_at
        );
      } catch (error) {
        result.warnings.push(`achievements: Failed to import ${achievement.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.achievements.length; i += batchSize) {
    insertBatch(data.achievements.slice(i, i + batchSize));
  }

  result.imported.achievements = data.achievements.length;
  console.log(`  Imported ${data.achievements.length} achievements`);
}

function importUserAchievements(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.user_achievements.length === 0) return;
  console.log('Importing user_achievements...');

  const stmt = db.prepare(`
    INSERT INTO user_achievements (id, user_id, achievement_id, progress, metadata, unlocked_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((uas: typeof data.user_achievements) => {
    for (const ua of uas) {
      try {
        stmt.run(
          ua.id,
          ua.user_id,
          ua.achievement_id,
          ua.progress,
          toJson(ua.metadata),
          ua.unlocked_at
        );
      } catch (error) {
        result.warnings.push(`user_achievements: Failed to import ${ua.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.user_achievements.length; i += batchSize) {
    insertBatch(data.user_achievements.slice(i, i + batchSize));
  }

  result.imported.user_achievements = data.user_achievements.length;
  console.log(`  Imported ${data.user_achievements.length} user_achievements`);
}

function importQueues(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.queues.length === 0) return;
  console.log('Importing queues...');

  const stmt = db.prepare(`
    INSERT INTO queues (id, user_id, name, color, time_slice, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((queues: typeof data.queues) => {
    for (const queue of queues) {
      try {
        stmt.run(
          queue.id,
          queue.user_id,
          queue.name,
          queue.color,
          queue.time_slice,
          queue.priority,
          queue.created_at,
          queue.updated_at
        );
      } catch (error) {
        result.warnings.push(`queues: Failed to import ${queue.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.queues.length; i += batchSize) {
    insertBatch(data.queues.slice(i, i + batchSize));
  }

  result.imported.queues = data.queues.length;
  console.log(`  Imported ${data.queues.length} queues`);
}

function importQuizSets(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.quiz_sets.length === 0) return;
  console.log('Importing quiz_sets...');

  const stmt = db.prepare(`
    INSERT INTO quiz_sets (id, user_id, graph_id, title, description, config, status, card_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((quizSets: typeof data.quiz_sets) => {
    for (const quizSet of quizSets) {
      try {
        stmt.run(
          quizSet.id,
          quizSet.user_id,
          quizSet.graph_id,
          quizSet.title,
          quizSet.description,
          toJson(quizSet.config),
          quizSet.status,
          quizSet.card_count,
          quizSet.created_at,
          quizSet.updated_at
        );
      } catch (error) {
        result.warnings.push(`quiz_sets: Failed to import ${quizSet.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.quiz_sets.length; i += batchSize) {
    insertBatch(data.quiz_sets.slice(i, i + batchSize));
  }

  result.imported.quiz_sets = data.quiz_sets.length;
  console.log(`  Imported ${data.quiz_sets.length} quiz_sets`);
}

function importLearningPaths(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.learning_paths.length === 0) return;
  console.log('Importing learning_paths...');

  const stmt = db.prepare(`
    INSERT INTO learning_paths (id, user_id, title, description, goal, target_date, source_graph_id, total_estimated_time, ai_generated, status, daily_minutes_target, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((paths: typeof data.learning_paths) => {
    for (const path of paths) {
      try {
        stmt.run(
          path.id,
          path.user_id,
          path.title,
          path.description,
          path.goal,
          path.target_date,
          path.source_graph_id,
          path.total_estimated_time,
          path.ai_generated ? 1 : 0,
          path.status,
          path.daily_minutes_target,
          path.created_at,
          path.updated_at
        );
      } catch (error) {
        result.warnings.push(`learning_paths: Failed to import ${path.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.learning_paths.length; i += batchSize) {
    insertBatch(data.learning_paths.slice(i, i + batchSize));
  }

  result.imported.learning_paths = data.learning_paths.length;
  console.log(`  Imported ${data.learning_paths.length} learning_paths`);
}

function importNotifications(db: Database.Database, data: ExportedData, result: ImportResult, batchSize: number): void {
  if (data.notifications.length === 0) return;
  console.log('Importing notifications...');

  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data, read_at, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((notifications: typeof data.notifications) => {
    for (const notification of notifications) {
      try {
        stmt.run(
          notification.id,
          notification.user_id,
          notification.type,
          notification.title,
          notification.message,
          toJson(notification.data),
          notification.read_at,
          notification.created_at,
          notification.expires_at
        );
      } catch (error) {
        result.warnings.push(`notifications: Failed to import ${notification.id}: ${error}`);
      }
    }
  });

  for (let i = 0; i < data.notifications.length; i += batchSize) {
    insertBatch(data.notifications.slice(i, i + batchSize));
  }

  result.imported.notifications = data.notifications.length;
  console.log(`  Imported ${data.notifications.length} notifications`);
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    input: './backup/data.json',
    batchSize: 100,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--input' || arg === '-i') {
      options.input = args[++i];
    } else if (arg === '--db-path' || arg === '-d') {
      options.dbPath = args[++i];
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--batch-size' || arg === '-b') {
      options.batchSize = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run db:import -- [options]

Options:
  --input, -i <path>     Input JSON file path (default: ./backup/data.json)
  --db-path, -d <path>   SQLite database path (default: ./knowledgemap-import.db)
  --overwrite            Overwrite existing database
  --dry-run              Validate data without importing
  --batch-size, -b <n>   Batch size for inserts (default: 100)
  --help, -h             Show this help message

Examples:
  npm run db:import
  npm run db:import -- --input ./my-backup.json
  npm run db:import -- --db-path ./data/mydb.db --overwrite
  npm run db:import -- --dry-run
`);
      process.exit(0);
    }
  }

  return options;
}

const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` 
  || process.argv[1].endsWith('importToSQLite.ts')
  || process.argv[1].endsWith('importToSQLite.js');

if (isMainModule) {
  const options = parseArgs();
  importToSQLite(options).then(result => {
    if (!result.success) {
      process.exit(1);
    }
  });
}

export { importToSQLite };
