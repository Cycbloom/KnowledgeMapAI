import Database from 'better-sqlite3';
import type {
  DatabaseInterface,
  TransactionContext,
  QueryOptions,
  QueryFilter,
  CreateUserInput,
  UpdateUserInput,
  CreateGraphInput,
  UpdateGraphInput,
  CreateKnowledgePointInput,
  UpdateKnowledgePointInput,
  CreateGraphNodeInput,
  UpdateGraphNodeInput,
  CreateEdgeInput,
  UpdateEdgeInput,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  CreateStudyCardInput,
  UpdateStudyCardInput,
  CreateFocusSessionInput,
} from '../interface.js';

import type {
  User,
  Graph,
  GraphNode,
  KnowledgePoint,
  KnowledgePointVisibility,
  Edge,
  Template,
  RelationshipTypeConfig,
  GraphRelation,
  GraphCollaborator,
  CollaboratorRole,
} from '../../../shared/types/index.js';

import type {
  ScheduledTask,
  TaskExecution,
  TaskSettings,
  Queue,
  FocusSession,
  UserFocusStats,
  Achievement,
  UserAchievement,
} from '../../../shared/types/scheduler.js';

import type {
  StudyCard,
  LearningPath,
  LearningPathNodeRef,
  Notification,
  NotificationSettings,
  Task,
} from '../../../shared/types/common.js';

import type { QuizSet } from '../../../shared/types/quiz.js';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function fromJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function now(): string {
  return new Date().toISOString();
}

export class SQLiteAdapter implements DatabaseInterface {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  isConnected(): Promise<boolean> {
    return Promise.resolve(this.db !== null);
  }

  async connect(): Promise<void> {
    if (this.db) return;

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not connected');
    
    const db = this.db;
    return db.transaction(() => fn({
      execute: async <U>(innerFn: () => Promise<U>) => innerFn()
    }))();
  }

  private buildWhereClause(filters: QueryFilter[]): { sql: string; params: unknown[] } {
    if (filters.length === 0) return { sql: '', params: [] };

    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          conditions.push(`${filter.field} = ?`);
          params.push(filter.value);
          break;
        case 'neq':
          conditions.push(`${filter.field} != ?`);
          params.push(filter.value);
          break;
        case 'gt':
          conditions.push(`${filter.field} > ?`);
          params.push(filter.value);
          break;
        case 'gte':
          conditions.push(`${filter.field} >= ?`);
          params.push(filter.value);
          break;
        case 'lt':
          conditions.push(`${filter.field} < ?`);
          params.push(filter.value);
          break;
        case 'lte':
          conditions.push(`${filter.field} <= ?`);
          params.push(filter.value);
          break;
        case 'in':
          const placeholders = (filter.value as unknown[]).map(() => '?').join(', ');
          conditions.push(`${filter.field} IN (${placeholders})`);
          params.push(...(filter.value as unknown[]));
          break;
        case 'contains':
          conditions.push(`${filter.field} LIKE ?`);
          params.push(`%${filter.value}%`);
          break;
        case 'ilike':
          conditions.push(`${filter.field} LIKE ? COLLATE NOCASE`);
          params.push(`%${filter.value}%`);
          break;
      }
    }

    return { sql: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private buildOrderBy(orderBy: QueryOptions['orderBy']): string {
    if (!orderBy || orderBy.length === 0) return '';
    return `ORDER BY ${orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}`;
  }

  async getUser(id: string): Promise<User | null> {
    const row = this.rawOneSync<{ 
      id: string; 
      email: string; 
      name: string; 
      settings: string;
      xp: number;
      level: number;
      role: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM users WHERE id = ?', [id]);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      user_metadata: fromJson(row.settings) || {},
      profile: {
        xp: row.xp,
        level: row.level,
        role: row.role as 'admin' | 'user',
      },
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = this.rawOneSync<{ 
      id: string; 
      email: string; 
      name: string; 
      settings: string;
      xp: number;
      level: number;
      role: string;
    }>('SELECT * FROM users WHERE email = ?', [email]);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      user_metadata: fromJson(row.settings) || {},
      profile: {
        xp: row.xp,
        level: row.level,
        role: row.role as 'admin' | 'user',
      },
    };
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const id = data.id || generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO users (id, email, password_hash, name, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.email, data.password_hash || null, data.name || 'User', toJson(data.settings) || '{}', timestamp, timestamp]
    );

    const user = await this.getUser(id);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.settings !== undefined) {
      updates.push('settings = ?');
      params.push(toJson(data.settings));
    }
    if (data.xp !== undefined) {
      updates.push('xp = ?');
      params.push(data.xp);
    }
    if (data.level !== undefined) {
      updates.push('level = ?');
      params.push(data.level);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      this.executeSync(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const user = await this.getUser(id);
    if (!user) throw new Error('User not found after update');
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    this.executeSync('DELETE FROM users WHERE id = ?', [id]);
  }

  async getGraphs(userId: string, options?: QueryOptions): Promise<Graph[]> {
    let sql = 'SELECT * FROM knowledge_graphs WHERE user_id = ? AND deleted_at IS NULL';
    const params: unknown[] = [userId];

    if (options?.filters) {
      const { sql: whereSql, params: whereParams } = this.buildWhereClause(options.filters);
      sql = sql.replace('WHERE user_id = ?', `WHERE user_id = ? AND ${whereSql.replace('WHERE ', '')}`);
      params.push(...whereParams);
    }

    if (options?.orderBy) {
      sql += ' ' + this.buildOrderBy(options.orderBy);
    }

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(this.mapGraphRow);
  }

  async getGraph(id: string): Promise<Graph | null> {
    const row = this.rawOneSync<any>('SELECT * FROM knowledge_graphs WHERE id = ? AND deleted_at IS NULL', [id]);
    return row ? this.mapGraphRow(row) : null;
  }

  private mapGraphRow(row: any): Graph {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      user_id: row.user_id,
      settings: fromJson(row.settings) || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_favorite: Boolean(row.is_favorite),
    };
  }

  async createGraph(data: CreateGraphInput): Promise<Graph> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO knowledge_graphs (id, user_id, title, description, settings, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.title, data.description || null, toJson(data.settings) || '{}', data.is_public ? 1 : 0, timestamp, timestamp]
    );

    const graph = await this.getGraph(id);
    if (!graph) throw new Error('Failed to create graph');
    return graph;
  }

  async updateGraph(id: string, data: UpdateGraphInput): Promise<Graph> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.settings !== undefined) {
      updates.push('settings = ?');
      params.push(toJson(data.settings));
    }
    if (data.is_public !== undefined) {
      updates.push('is_public = ?');
      params.push(data.is_public ? 1 : 0);
    }
    if (data.is_favorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(data.is_favorite ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      this.executeSync(
        `UPDATE knowledge_graphs SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const graph = await this.getGraph(id);
    if (!graph) throw new Error('Graph not found after update');
    return graph;
  }

  async deleteGraph(id: string, _userId: string): Promise<void> {
    this.executeSync(
      'UPDATE knowledge_graphs SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now(), now(), id]
    );
  }

  async restoreGraph(id: string, _userId: string): Promise<void> {
    this.executeSync(
      'UPDATE knowledge_graphs SET deleted_at = NULL, updated_at = ? WHERE id = ?',
      [now(), id]
    );
  }

  async permanentDeleteGraph(id: string, _userId: string): Promise<void> {
    this.executeSync('DELETE FROM knowledge_graphs WHERE id = ?', [id]);
  }

  async getGraphsWithCounts(userId: string): Promise<Array<Graph & { nodes_count: number }>> {
    const rows = this.rawSync<any>(`
      SELECT g.*, COUNT(gn.id) as nodes_count
      FROM knowledge_graphs g
      LEFT JOIN graph_nodes gn ON g.id = gn.graph_id AND gn.deleted_at IS NULL
      WHERE g.user_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.is_favorite DESC, g.last_used_at DESC
    `, [userId]);

    return rows.map(row => ({
      ...this.mapGraphRow(row),
      nodes_count: row.nodes_count || 0,
    }));
  }

  async getTrashedGraphs(userId: string): Promise<Array<Graph & { nodes_count: number }>> {
    const rows = this.rawSync<any>(`
      SELECT g.*, COUNT(gn.id) as nodes_count
      FROM knowledge_graphs g
      LEFT JOIN graph_nodes gn ON g.id = gn.graph_id AND gn.deleted_at IS NULL
      WHERE g.user_id = ? AND g.deleted_at IS NOT NULL
      GROUP BY g.id
      ORDER BY g.deleted_at DESC
    `, [userId]);

    return rows.map(row => ({
      ...this.mapGraphRow(row),
      nodes_count: row.nodes_count || 0,
    }));
  }

  async getKnowledgePoints(userId: string, options?: QueryOptions): Promise<KnowledgePoint[]> {
    let sql = 'SELECT * FROM knowledge_points WHERE owner_id = ?';
    const params: unknown[] = [userId];

    if (options?.filters) {
      const { sql: whereSql, params: whereParams } = this.buildWhereClause(options.filters);
      sql += ' AND ' + whereSql.replace('WHERE ', '');
      params.push(...whereParams);
    }

    if (options?.orderBy) {
      sql += ' ' + this.buildOrderBy(options.orderBy);
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(this.mapKnowledgePointRow);
  }

  async getKnowledgePoint(id: string): Promise<KnowledgePoint | null> {
    const row = this.rawOneSync<any>('SELECT * FROM knowledge_points WHERE id = ?', [id]);
    return row ? this.mapKnowledgePointRow(row) : null;
  }

  private mapKnowledgePointRow(row: any): KnowledgePoint {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      learning_material: row.learning_material,
      properties: fromJson(row.properties) || {},
      visibility: row.visibility as KnowledgePointVisibility,
      owner_id: row.owner_id,
      embedding: fromJson(row.embedding) || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createKnowledgePoint(data: CreateKnowledgePointInput): Promise<KnowledgePoint> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO knowledge_points (id, title, content, learning_material, properties, visibility, owner_id, embedding, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.title, data.content || '', data.learning_material || '', toJson(data.properties) || '{}', data.visibility || 'private', data.owner_id, toJson(data.embedding), timestamp, timestamp]
    );

    const kp = await this.getKnowledgePoint(id);
    if (!kp) throw new Error('Failed to create knowledge point');
    return kp;
  }

  async updateKnowledgePoint(id: string, data: UpdateKnowledgePointInput): Promise<KnowledgePoint> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.learning_material !== undefined) {
      updates.push('learning_material = ?');
      params.push(data.learning_material);
    }
    if (data.properties !== undefined) {
      updates.push('properties = ?');
      params.push(toJson(data.properties));
    }
    if (data.visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(data.visibility);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      this.executeSync(
        `UPDATE knowledge_points SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const kp = await this.getKnowledgePoint(id);
    if (!kp) throw new Error('Knowledge point not found after update');
    return kp;
  }

  async deleteKnowledgePoint(id: string, _userId: string): Promise<{
    success: boolean;
    affected_graphs: number;
    deleted_graph_nodes: number;
    deleted_edges: number;
    deleted_cards: number;
  }> {
    return this.transaction(async () => {
      const graphNodes = this.rawSync<{ graph_id: string }>(
        'SELECT graph_id FROM graph_nodes WHERE knowledge_point_id = ?',
        [id]
      );
      const affectedGraphs = new Set(graphNodes.map(gn => gn.graph_id)).size;

      const deletedGraphNodes = this.executeSync(
        'DELETE FROM graph_nodes WHERE knowledge_point_id = ?',
        [id]
      ).changes;

      const deletedEdges = this.executeSync(
        'DELETE FROM edges WHERE source_knowledge_point_id = ? OR target_knowledge_point_id = ?',
        [id, id]
      ).changes;

      const deletedCards = this.executeSync(
        'DELETE FROM study_cards WHERE knowledge_point_id = ?',
        [id]
      ).changes;

      this.executeSync('DELETE FROM knowledge_points WHERE id = ?', [id]);

      return {
        success: true,
        affected_graphs: affectedGraphs,
        deleted_graph_nodes: deletedGraphNodes,
        deleted_edges: deletedEdges,
        deleted_cards: deletedCards,
      };
    });
  }

  async getAccessibleKnowledgePoints(userId: string): Promise<KnowledgePoint[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM knowledge_points WHERE owner_id = ? OR visibility = ? ORDER BY updated_at DESC',
      [userId, 'public']
    );
    return rows.map(this.mapKnowledgePointRow);
  }

  async searchSimilarKnowledgePoints(
    _embedding: number[],
    userId: string,
    _threshold: number,
    limit: number
  ): Promise<Array<{
    id: string;
    title: string;
    content?: string;
    similarity: number;
    visibility: KnowledgePointVisibility;
  }>> {
    const rows = this.rawSync<any>(
      'SELECT id, title, content, visibility FROM knowledge_points WHERE owner_id = ? OR visibility = ? LIMIT ?',
      [userId, 'public', limit]
    );
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      similarity: 0,
      visibility: row.visibility as KnowledgePointVisibility,
    }));
  }

  async getGraphNodes(graphId: string): Promise<GraphNode[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM graph_nodes WHERE graph_id = ? AND deleted_at IS NULL',
      [graphId]
    );
    return rows.map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      knowledge_point_id: row.knowledge_point_id,
      x_position: row.x_position,
      y_position: row.y_position,
      level: row.level,
      is_accepted: Boolean(row.is_accepted),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getGraphNode(id: string): Promise<GraphNode | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM graph_nodes WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!row) return null;
    return {
      id: row.id,
      graph_id: row.graph_id,
      knowledge_point_id: row.knowledge_point_id,
      x_position: row.x_position,
      y_position: row.y_position,
      level: row.level,
      is_accepted: Boolean(row.is_accepted),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createGraphNode(data: CreateGraphNodeInput): Promise<GraphNode> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO graph_nodes (id, graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.graph_id, data.knowledge_point_id, data.x_position, data.y_position, data.level, data.is_accepted ? 1 : 0, timestamp, timestamp]
    );

    const node = await this.getGraphNode(id);
    if (!node) throw new Error('Failed to create graph node');
    return node;
  }

  async updateGraphNode(id: string, data: UpdateGraphNodeInput): Promise<GraphNode> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.x_position !== undefined) {
      updates.push('x_position = ?');
      params.push(data.x_position);
    }
    if (data.y_position !== undefined) {
      updates.push('y_position = ?');
      params.push(data.y_position);
    }
    if (data.level !== undefined) {
      updates.push('level = ?');
      params.push(data.level);
    }
    if (data.is_accepted !== undefined) {
      updates.push('is_accepted = ?');
      params.push(data.is_accepted ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      this.executeSync(
        `UPDATE graph_nodes SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const node = await this.getGraphNode(id);
    if (!node) throw new Error('Graph node not found after update');
    return node;
  }

  async deleteGraphNode(id: string): Promise<void> {
    this.executeSync(
      'UPDATE graph_nodes SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now(), now(), id]
    );
  }

  async getEdges(graphId: string): Promise<Edge[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM edges WHERE graph_id = ? AND deleted_at IS NULL',
      [graphId]
    );
    return rows.map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      source_knowledge_point_id: row.source_knowledge_point_id,
      target_knowledge_point_id: row.target_knowledge_point_id,
      relationship_type: row.relationship_type,
      weight: row.weight,
      custom_label: row.custom_label,
      custom_color: row.custom_color,
      custom_line_style: row.custom_line_style,
      show_arrow: row.show_arrow,
      created_at: row.created_at,
    }));
  }

  async getEdge(id: string): Promise<Edge | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM edges WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!row) return null;
    return {
      id: row.id,
      graph_id: row.graph_id,
      source_knowledge_point_id: row.source_knowledge_point_id,
      target_knowledge_point_id: row.target_knowledge_point_id,
      relationship_type: row.relationship_type,
      weight: row.weight,
      custom_label: row.custom_label,
      custom_color: row.custom_color,
      custom_line_style: row.custom_line_style,
      show_arrow: row.show_arrow,
      created_at: row.created_at,
    };
  }

  async createEdge(data: CreateEdgeInput): Promise<Edge> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO edges (id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.graph_id, data.source_knowledge_point_id, data.target_knowledge_point_id, data.relationship_type || 'related', data.weight || 1, data.custom_label, data.custom_color, data.custom_line_style || 'solid', data.show_arrow ? 1 : 0, timestamp]
    );

    const edge = await this.getEdge(id);
    if (!edge) throw new Error('Failed to create edge');
    return edge;
  }

  async updateEdge(id: string, data: UpdateEdgeInput): Promise<Edge> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.relationship_type !== undefined) {
      updates.push('relationship_type = ?');
      params.push(data.relationship_type);
    }
    if (data.weight !== undefined) {
      updates.push('weight = ?');
      params.push(data.weight);
    }
    if (data.custom_label !== undefined) {
      updates.push('custom_label = ?');
      params.push(data.custom_label);
    }
    if (data.custom_color !== undefined) {
      updates.push('custom_color = ?');
      params.push(data.custom_color);
    }
    if (data.custom_line_style !== undefined) {
      updates.push('custom_line_style = ?');
      params.push(data.custom_line_style);
    }
    if (data.show_arrow !== undefined) {
      updates.push('show_arrow = ?');
      params.push(data.show_arrow ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id);
      this.executeSync(
        `UPDATE edges SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const edge = await this.getEdge(id);
    if (!edge) throw new Error('Edge not found after update');
    return edge;
  }

  async deleteEdge(id: string): Promise<void> {
    this.executeSync(
      'UPDATE edges SET deleted_at = ? WHERE id = ?',
      [now(), id]
    );
  }

  async getScheduledTasks(userId: string, options?: QueryOptions): Promise<ScheduledTask[]> {
    let sql = 'SELECT * FROM scheduled_tasks WHERE user_id = ? AND deleted_at IS NULL';
    const params: unknown[] = [userId];

    if (options?.filters) {
      const { sql: whereSql, params: whereParams } = this.buildWhereClause(options.filters);
      sql += ' AND ' + whereSql.replace('WHERE ', '');
      params.push(...whereParams);
    }

    sql += ' ORDER BY queue_level ASC, position ASC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(this.mapScheduledTaskRow);
  }

  async getScheduledTask(id: string): Promise<ScheduledTask | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapScheduledTaskRow(row) : null;
  }

  private mapScheduledTaskRow(row: any): ScheduledTask {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      queue_level: row.queue_level,
      position: row.position,
      estimated_duration: row.estimated_duration,
      actual_duration: row.actual_duration,
      deadline: row.deadline,
      status: row.status,
      tags: fromJson(row.tags) || [],
      knowledge_point_id: row.knowledge_point_id,
      priority: row.priority,
      queue_id: row.queue_id,
      task_type: row.task_type,
      total_duration: row.total_duration,
      progress_mode: row.progress_mode,
      progress_percentage: row.progress_percentage,
      parent_task_id: row.parent_task_id,
      context: row.context,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      completed_at: row.completed_at,
    };
  }

  async createScheduledTask(data: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const id = generateUUID();
    const timestamp = now();

    const maxPosRow = this.rawOneSync<{ position: number }>(
      'SELECT MAX(position) as position FROM scheduled_tasks WHERE user_id = ? AND queue_level = ? AND deleted_at IS NULL',
      [data.user_id, data.queue_level || 0]
    );
    const position = (maxPosRow?.position ?? -1) + 1;

    this.executeSync(
      `INSERT INTO scheduled_tasks (id, user_id, title, description, queue_level, position, estimated_duration, deadline, tags, knowledge_point_id, priority, task_type, total_duration, progress_mode, parent_task_id, context, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.title, data.description || null, data.queue_level || 0, position, data.estimated_duration, data.deadline, toJson(data.tags) || '[]', data.knowledge_point_id, data.priority || 0, data.task_type || 'one_time', data.total_duration, data.progress_mode, data.parent_task_id, data.context, 'pending', timestamp, timestamp]
    );

    const task = await this.getScheduledTask(id);
    if (!task) throw new Error('Failed to create scheduled task');
    return task;
  }

  async updateScheduledTask(id: string, data: UpdateScheduledTaskInput): Promise<ScheduledTask> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof UpdateScheduledTaskInput)[] = [
      'title', 'description', 'queue_level', 'position', 'estimated_duration',
      'actual_duration', 'deadline', 'status', 'tags', 'priority', 'task_type',
      'total_duration', 'progress_mode', 'progress_percentage', 'parent_task_id',
      'context', 'scheduled_start', 'scheduled_end', 'notes'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'tags') {
          params.push(toJson(data.tags));
        } else {
          params.push(data[field]);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      this.executeSync(
        `UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const task = await this.getScheduledTask(id);
    if (!task) throw new Error('Scheduled task not found after update');
    return task;
  }

  async deleteScheduledTask(id: string, _userId: string): Promise<void> {
    this.executeSync(
      'UPDATE scheduled_tasks SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now(), now(), id]
    );
  }

  async getTasksByQueue(userId: string, queueLevel: number): Promise<ScheduledTask[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM scheduled_tasks WHERE user_id = ? AND queue_level = ? AND deleted_at IS NULL ORDER BY position ASC',
      [userId, queueLevel]
    );
    return rows.map(this.mapScheduledTaskRow);
  }

  async reorderTasks(_userId: string, queueLevel: number, taskIds: string[]): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      this.executeSync(
        'UPDATE scheduled_tasks SET position = ?, queue_level = ?, updated_at = ? WHERE id = ?',
        [i, queueLevel, now(), taskIds[i]]
      );
    }
  }

  async getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC',
      [taskId]
    );
    return rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration: row.duration,
      queue_level: row.queue_level,
      status: row.status,
    }));
  }

  async createTaskExecution(data: {
    task_id: string;
    user_id: string;
    started_at: string;
    queue_level: number;
    status: string;
  }): Promise<TaskExecution> {
    const id = generateUUID();

    this.executeSync(
      `INSERT INTO task_executions (id, task_id, user_id, started_at, queue_level, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.task_id, data.user_id, data.started_at, data.queue_level, data.status]
    );

    const row = this.rawOneSync<any>('SELECT * FROM task_executions WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create task execution');
    return {
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration: row.duration,
      queue_level: row.queue_level,
      status: row.status,
    };
  }

  async updateTaskExecution(id: string, data: {
    ended_at?: string;
    duration?: number;
    status?: string;
  }): Promise<TaskExecution> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.ended_at !== undefined) {
      updates.push('ended_at = ?');
      params.push(data.ended_at);
    }
    if (data.duration !== undefined) {
      updates.push('duration = ?');
      params.push(data.duration);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length > 0) {
      params.push(id);
      this.executeSync(
        `UPDATE task_executions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const row = this.rawOneSync<any>('SELECT * FROM task_executions WHERE id = ?', [id]);
    if (!row) throw new Error('Task execution not found after update');
    return {
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration: row.duration,
      queue_level: row.queue_level,
      status: row.status,
    };
  }

  async getTaskSettings(userId: string): Promise<TaskSettings | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM task_settings WHERE user_id = ?',
      [userId]
    );
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      q0_time_slice: row.q0_time_slice,
      q1_time_slice: row.q1_time_slice,
      q2_time_slice: row.q2_time_slice,
      break_duration: row.break_duration,
      sound_enabled: Boolean(row.sound_enabled),
      notification_enabled: Boolean(row.notification_enabled),
    };
  }

  async updateTaskSettings(userId: string, data: Partial<TaskSettings>): Promise<TaskSettings> {
    const existing = await this.getTaskSettings(userId);

    if (!existing) {
      const id = generateUUID();
      this.executeSync(
        `INSERT INTO task_settings (id, user_id, q0_time_slice, q1_time_slice, q2_time_slice, break_duration, sound_enabled, notification_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, data.q0_time_slice || 25, data.q1_time_slice || 50, data.q2_time_slice || 100, data.break_duration || 5, data.sound_enabled !== false ? 1 : 0, data.notification_enabled !== false ? 1 : 0]
      );
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];

      const fields: (keyof Partial<TaskSettings>)[] = ['q0_time_slice', 'q1_time_slice', 'q2_time_slice', 'break_duration', 'sound_enabled', 'notification_enabled'];
      for (const field of fields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(field === 'sound_enabled' || field === 'notification_enabled' ? (data[field] ? 1 : 0) : data[field]);
        }
      }

      if (updates.length > 0) {
        params.push(userId);
        this.executeSync(
          `UPDATE task_settings SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      }
    }

    const settings = await this.getTaskSettings(userId);
    if (!settings) throw new Error('Failed to update task settings');
    return settings;
  }

  async getStudyCards(userId: string, options?: {
    graphId?: string;
    knowledgePointId?: string;
    dueOnly?: boolean;
  }): Promise<StudyCard[]> {
    let sql = 'SELECT * FROM study_cards WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (options?.graphId) {
      sql += ' AND graph_id = ?';
      params.push(options.graphId);
    }
    if (options?.knowledgePointId) {
      sql += ' AND knowledge_point_id = ?';
      params.push(options.knowledgePointId);
    }
    if (options?.dueOnly) {
      sql += ' AND next_review <= ?';
      params.push(now());
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(this.mapStudyCardRow);
  }

  async getStudyCard(id: string): Promise<StudyCard | null> {
    const row = this.rawOneSync<any>('SELECT * FROM study_cards WHERE id = ?', [id]);
    return row ? this.mapStudyCardRow(row) : null;
  }

  private mapStudyCardRow(row: any): StudyCard {
    return {
      id: row.id,
      knowledge_point_id: row.knowledge_point_id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      source_graph_id: row.source_graph_id,
      question: row.question,
      answer: row.answer,
      explanation: row.explanation,
      card_type: row.card_type,
      options: fromJson<string[]>(row.options) || undefined,
      difficulty: row.difficulty,
      last_reviewed: row.last_reviewed,
      next_review: row.next_review,
      review_count: row.review_count,
      fsrs_state: row.fsrs_state,
      fsrs_stability: row.fsrs_stability,
      fsrs_difficulty: row.fsrs_difficulty,
      fsrs_elapsed_days: row.fsrs_elapsed_days,
      fsrs_scheduled_days: row.fsrs_scheduled_days,
      fsrs_retrievability: row.fsrs_retrievability,
      fsrs_last_review: row.fsrs_last_review,
      created_at: row.created_at,
    };
  }

  async createStudyCard(data: CreateStudyCardInput): Promise<StudyCard> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO study_cards (id, knowledge_point_id, user_id, graph_id, source_graph_id, question, answer, explanation, card_type, options, difficulty, next_review, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_retrievability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.knowledge_point_id, data.user_id, data.graph_id, data.source_graph_id, data.question, data.answer, data.explanation || null, data.card_type || 'qa', toJson(data.options), data.difficulty || 1, timestamp, 0, 0, 0, 0, 0, 0, timestamp]
    );

    const card = await this.getStudyCard(id);
    if (!card) throw new Error('Failed to create study card');
    return card;
  }

  async createStudyCardsBatch(data: CreateStudyCardInput[]): Promise<StudyCard[]> {
    const results: StudyCard[] = [];
    for (const item of data) {
      const card = await this.createStudyCard(item);
      results.push(card);
    }
    return results;
  }

  async updateStudyCard(id: string, data: UpdateStudyCardInput): Promise<StudyCard> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof UpdateStudyCardInput)[] = [
      'question', 'answer', 'explanation', 'card_type', 'options', 'difficulty',
      'last_reviewed', 'next_review', 'review_count', 'fsrs_state', 'fsrs_stability',
      'fsrs_difficulty', 'fsrs_elapsed_days', 'fsrs_scheduled_days', 'fsrs_retrievability', 'fsrs_last_review'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'options') {
          params.push(toJson(data.options));
        } else {
          params.push(data[field]);
        }
      }
    }

    if (updates.length > 0) {
      params.push(id);
      this.executeSync(
        `UPDATE study_cards SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const card = await this.getStudyCard(id);
    if (!card) throw new Error('Study card not found after update');
    return card;
  }

  async deleteStudyCard(id: string): Promise<void> {
    this.executeSync('DELETE FROM study_cards WHERE id = ?', [id]);
  }

  async deleteStudyCardsBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    this.executeSync(`DELETE FROM study_cards WHERE id IN (${placeholders})`, ids);
  }

  async getFocusSessions(userId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<FocusSession[]> {
    let sql = 'SELECT * FROM focus_sessions WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (options?.startDate) {
      sql += ' AND start_time >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ' AND start_time <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY start_time DESC';

    const rows = this.rawSync<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      task_id: row.task_id,
      started_at: row.start_time,
      ended_at: row.end_time,
      duration: row.duration,
      pomodoro_count: row.pomodoro_count,
      white_noise_type: row.white_noise_type,
      is_break: Boolean(row.is_break),
      created_at: row.created_at,
    }));
  }

  async createFocusSession(data: CreateFocusSessionInput): Promise<FocusSession> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO focus_sessions (id, user_id, task_id, start_time, end_time, duration, mode, pomodoro_count, white_noise_type, is_break, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.task_id, data.start_time, data.end_time || data.start_time, data.duration, data.mode, data.pomodoro_count || 0, data.white_noise_type, data.is_break ? 1 : 0, timestamp]
    );

    return {
      id,
      user_id: data.user_id,
      task_id: data.task_id,
      started_at: data.start_time,
      ended_at: data.end_time,
      duration: data.duration,
      pomodoro_count: data.pomodoro_count || 0,
      white_noise_type: data.white_noise_type,
      is_break: data.is_break || false,
      created_at: timestamp,
    };
  }

  async getUserFocusStats(userId: string): Promise<UserFocusStats | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM user_focus_stats WHERE user_id = ?',
      [userId]
    );
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      total_focus_seconds: row.total_focus_seconds,
      total_sessions: row.total_sessions,
      total_pomodoros: row.total_pomodoros,
      total_tasks_completed: row.total_tasks_completed,
      current_streak: row.current_streak,
      longest_streak: row.longest_streak,
      last_focus_date: row.last_focus_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async updateUserFocusStats(userId: string, data: Partial<UserFocusStats>): Promise<UserFocusStats> {
    const existing = await this.getUserFocusStats(userId);

    if (!existing) {
      const id = generateUUID();
      const timestamp = now();
      this.executeSync(
        `INSERT INTO user_focus_stats (id, user_id, total_focus_seconds, total_sessions, total_pomodoros, total_tasks_completed, current_streak, longest_streak, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, data.total_focus_seconds || 0, data.total_sessions || 0, data.total_pomodoros || 0, data.total_tasks_completed || 0, data.current_streak || 0, data.longest_streak || 0, timestamp, timestamp]
      );
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];

      const fields: (keyof Partial<UserFocusStats>)[] = ['total_focus_seconds', 'total_sessions', 'total_pomodoros', 'total_tasks_completed', 'current_streak', 'longest_streak', 'last_focus_date'];
      for (const field of fields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(data[field]);
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now());
        params.push(userId);
        this.executeSync(
          `UPDATE user_focus_stats SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      }
    }

    const stats = await this.getUserFocusStats(userId);
    if (!stats) throw new Error('Failed to update user focus stats');
    return stats;
  }

  async getAchievements(): Promise<Achievement[]> {
    const rows = this.rawSync<any>('SELECT * FROM achievements');
    return rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      color: row.color,
      xp_reward: row.xp_reward,
      condition_type: row.condition_type,
      condition_value: row.condition_value,
      is_hidden: Boolean(row.is_hidden),
      created_at: row.created_at,
    }));
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const rows = this.rawSync<any>(
      'SELECT ua.*, a.code, a.name, a.description, a.category, a.icon, a.color, a.xp_reward FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = ?',
      [userId]
    );
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      achievement_id: row.achievement_id,
      achievement: {
        id: row.achievement_id,
        code: row.code,
        name: row.name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        color: row.color,
        xp_reward: row.xp_reward,
        condition_type: row.condition_type,
        condition_value: row.condition_value,
        is_hidden: Boolean(row.is_hidden),
        created_at: row.created_at,
      },
      unlocked_at: row.unlocked_at,
      progress: row.progress,
      metadata: fromJson(row.metadata) || {},
    }));
  }

  async unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO user_achievements (id, user_id, achievement_id, progress, metadata, unlocked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, achievementId, 100, '{}', timestamp]
    );

    const achievements = await this.getUserAchievements(userId);
    const achievement = achievements.find(a => a.achievement_id === achievementId);
    if (!achievement) throw new Error('Failed to unlock achievement');
    return achievement;
  }

  async getTemplates(userId: string, options?: { isSystem?: boolean }): Promise<Template[]> {
    let sql = 'SELECT * FROM templates WHERE user_id = ? OR is_system = 1';
    const params: unknown[] = [userId];

    if (options?.isSystem === true) {
      sql = 'SELECT * FROM templates WHERE is_system = 1';
      params.length = 0;
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      is_system: Boolean(row.is_system),
      user_id: row.user_id,
      nodes: fromJson(row.nodes) || [],
      edges: fromJson(row.edges) || [],
      layout: fromJson(row.layout) || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const row = this.rawOneSync<any>('SELECT * FROM templates WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      is_system: Boolean(row.is_system),
      user_id: row.user_id,
      nodes: fromJson(row.nodes) || [],
      edges: fromJson(row.edges) || [],
      layout: fromJson(row.layout) || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createTemplate(data: Omit<Template, 'id' | 'created_at' | 'updated_at'>): Promise<Template> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO templates (id, user_id, name, description, category, is_system, nodes, edges, layout, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.name, data.description, data.category, data.is_system ? 1 : 0, toJson(data.nodes), toJson(data.edges), toJson(data.layout), timestamp, timestamp]
    );

    const template = await this.getTemplate(id);
    if (!template) throw new Error('Failed to create template');
    return template;
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof Partial<Template>)[] = ['name', 'description', 'category', 'nodes', 'edges', 'layout'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'nodes' || field === 'edges' || field === 'layout') {
          params.push(toJson(data[field]));
        } else {
          params.push(data[field]);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE templates SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const template = await this.getTemplate(id);
    if (!template) throw new Error('Template not found after update');
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    this.executeSync('DELETE FROM templates WHERE id = ?', [id]);
  }

  async getRelationshipTypes(userId?: string): Promise<RelationshipTypeConfig[]> {
    let sql = 'SELECT * FROM relationship_types WHERE is_builtin = 1';
    const params: unknown[] = [];

    if (userId) {
      sql = 'SELECT * FROM relationship_types WHERE is_builtin = 1 OR user_id = ?';
      params.push(userId);
    }

    const rows = this.rawSync<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      category: row.category,
      color: row.color,
      line_style: row.line_style,
      show_arrow: row.show_arrow === 'true' ? true : row.show_arrow === 'false' ? false : 'auto',
      is_builtin: Boolean(row.is_builtin),
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createRelationshipType(data: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>): Promise<RelationshipTypeConfig> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO relationship_types (id, name, display_name, category, color, line_style, show_arrow, is_builtin, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.display_name, data.category, data.color, data.line_style, typeof data.show_arrow === 'boolean' ? (data.show_arrow ? 'true' : 'false') : 'auto', data.is_builtin ? 1 : 0, data.user_id, timestamp, timestamp]
    );

    const types = await this.getRelationshipTypes(data.user_id);
    const created = types.find(t => t.id === id);
    if (!created) throw new Error('Failed to create relationship type');
    return created;
  }

  async updateRelationshipType(id: string, data: Partial<RelationshipTypeConfig>): Promise<RelationshipTypeConfig> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof Partial<RelationshipTypeConfig>)[] = ['name', 'display_name', 'category', 'color', 'line_style', 'show_arrow'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'show_arrow') {
          params.push(typeof data.show_arrow === 'boolean' ? (data.show_arrow ? 'true' : 'false') : 'auto');
        } else {
          params.push(data[field]);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE relationship_types SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const row = this.rawOneSync<any>('SELECT * FROM relationship_types WHERE id = ?', [id]);
    if (!row) throw new Error('Relationship type not found after update');
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      category: row.category,
      color: row.color,
      line_style: row.line_style,
      show_arrow: row.show_arrow === 'true' ? true : row.show_arrow === 'false' ? false : 'auto',
      is_builtin: Boolean(row.is_builtin),
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteRelationshipType(id: string): Promise<void> {
    this.executeSync('DELETE FROM relationship_types WHERE id = ? AND is_builtin = 0', [id]);
  }

  async getGraphRelations(graphId: string): Promise<GraphRelation[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM graph_relations WHERE source_graph_id = ? OR target_graph_id = ?',
      [graphId, graphId]
    );
    return rows.map(row => ({
      id: row.id,
      source_graph_id: row.source_graph_id,
      target_graph_id: row.target_graph_id,
      relation_type: row.relation_type,
      context: row.context,
      metadata: fromJson(row.metadata) || {},
      created_at: row.created_at,
    }));
  }

  async createGraphRelation(data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: string;
    context?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GraphRelation> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO graph_relations (id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.source_graph_id, data.target_graph_id, data.relation_type, data.context, toJson(data.metadata), timestamp]
    );

    return {
      id,
      source_graph_id: data.source_graph_id,
      target_graph_id: data.target_graph_id,
      relation_type: data.relation_type as any,
      context: data.context,
      metadata: data.metadata || {},
      created_at: timestamp,
    };
  }

  async deleteGraphRelation(id: string): Promise<void> {
    this.executeSync('DELETE FROM graph_relations WHERE id = ?', [id]);
  }

  async getGraphCollaborators(graphId: string): Promise<GraphCollaborator[]> {
    const rows = this.rawSync<any>(
      `SELECT gc.*, u.email, u.name FROM graph_collaborators gc JOIN users u ON gc.user_id = u.id WHERE gc.graph_id = ?`,
      [graphId]
    );
    return rows.map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      user_id: row.user_id,
      role: row.role as CollaboratorRole,
      invited_by: row.invited_by,
      invitation_token: row.invitation_token,
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
      },
    }));
  }

  async addGraphCollaborator(data: {
    graph_id: string;
    user_id: string;
    role: CollaboratorRole;
    invited_by?: string;
  }): Promise<GraphCollaborator> {
    const id = generateUUID();
    const timestamp = now();
    const token = generateUUID().replace(/-/g, '');

    this.executeSync(
      `INSERT INTO graph_collaborators (id, graph_id, user_id, role, invited_by, invitation_token, invited_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.graph_id, data.user_id, data.role, data.invited_by, token, timestamp, timestamp, timestamp]
    );

    const collaborators = await this.getGraphCollaborators(data.graph_id);
    const collaborator = collaborators.find(c => c.id === id);
    if (!collaborator) throw new Error('Failed to add collaborator');
    return collaborator;
  }

  async updateGraphCollaborator(id: string, data: { role: CollaboratorRole }): Promise<GraphCollaborator> {
    this.executeSync(
      'UPDATE graph_collaborators SET role = ?, updated_at = ? WHERE id = ?',
      [data.role, now(), id]
    );

    const row = this.rawOneSync<any>(
      'SELECT gc.*, u.email, u.name FROM graph_collaborators gc JOIN users u ON gc.user_id = u.id WHERE gc.id = ?',
      [id]
    );
    if (!row) throw new Error('Collaborator not found after update');
    return {
      id: row.id,
      graph_id: row.graph_id,
      user_id: row.user_id,
      role: row.role as CollaboratorRole,
      invited_by: row.invited_by,
      invitation_token: row.invitation_token,
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
      },
    };
  }

  async removeGraphCollaborator(id: string): Promise<void> {
    this.executeSync('DELETE FROM graph_collaborators WHERE id = ?', [id]);
  }

  async getQueues(userId: string): Promise<Queue[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM queues WHERE user_id = ? ORDER BY priority ASC',
      [userId]
    );
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      color: row.color,
      time_slice: row.time_slice,
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createQueue(data: {
    user_id: string;
    name: string;
    color: string;
    time_slice: number;
    priority: number;
  }): Promise<Queue> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO queues (id, user_id, name, color, time_slice, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.name, data.color, data.time_slice, data.priority, timestamp, timestamp]
    );

    const queues = await this.getQueues(data.user_id);
    const queue = queues.find(q => q.id === id);
    if (!queue) throw new Error('Failed to create queue');
    return queue;
  }

  async updateQueue(id: string, data: Partial<Queue>): Promise<Queue> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof Partial<Queue>)[] = ['name', 'color', 'time_slice', 'priority'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE queues SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const row = this.rawOneSync<any>('SELECT * FROM queues WHERE id = ?', [id]);
    if (!row) throw new Error('Queue not found after update');
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      color: row.color,
      time_slice: row.time_slice,
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteQueue(id: string): Promise<void> {
    this.executeSync('DELETE FROM queues WHERE id = ?', [id]);
  }

  async getQuizSets(userId: string): Promise<QuizSet[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM quiz_sets WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      title: row.title,
      description: row.description,
      config: fromJson(row.config) || { cardTypes: [], difficulty: 'medium', knowledgePointIds: [] },
      status: row.status,
      card_count: row.card_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getQuizSet(id: string): Promise<QuizSet | null> {
    const row = this.rawOneSync<any>('SELECT * FROM quiz_sets WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      title: row.title,
      description: row.description,
      config: fromJson(row.config) || { cardTypes: [], difficulty: 'medium', knowledgePointIds: [] },
      status: row.status,
      card_count: row.card_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createQuizSet(data: {
    user_id: string;
    title: string;
    description?: string;
    graph_id?: string;
    config: Record<string, unknown>;
  }): Promise<QuizSet> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO quiz_sets (id, user_id, graph_id, title, description, config, status, card_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.graph_id, data.title, data.description, toJson(data.config), 'draft', 0, timestamp, timestamp]
    );

    const quizSet = await this.getQuizSet(id);
    if (!quizSet) throw new Error('Failed to create quiz set');
    return quizSet;
  }

  async updateQuizSet(id: string, data: Partial<QuizSet>): Promise<QuizSet> {
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: (keyof Partial<QuizSet>)[] = ['title', 'description', 'config', 'status', 'card_count'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${String(field)} = ?`);
        if (field === 'config') {
          params.push(toJson(data.config));
        } else {
          params.push(data[field]);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE quiz_sets SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const quizSet = await this.getQuizSet(id);
    if (!quizSet) throw new Error('Quiz set not found after update');
    return quizSet;
  }

  async deleteQuizSet(id: string): Promise<void> {
    this.executeSync('DELETE FROM quiz_sets WHERE id = ?', [id]);
  }

  async getLearningPaths(userId: string): Promise<LearningPath[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM learning_paths WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      goal_type: 'natural_language',
      goal_content: row.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: row.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: row.total_estimated_time ? Math.floor(row.total_estimated_time / 60) : undefined,
      daily_minutes_target: row.daily_minutes_target,
      target_completion_date: row.target_date,
      settings: undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getLearningPath(id: string): Promise<LearningPath | null> {
    const row = this.rawOneSync<any>('SELECT * FROM learning_paths WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      goal_type: 'natural_language',
      goal_content: row.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: row.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: row.total_estimated_time ? Math.floor(row.total_estimated_time / 60) : undefined,
      daily_minutes_target: row.daily_minutes_target,
      target_completion_date: row.target_date,
      settings: undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createLearningPath(data: {
    user_id: string;
    title: string;
    description?: string;
    goal?: string;
    target_date?: string;
    source_graph_id?: string;
    daily_minutes_target?: number;
  }): Promise<LearningPath> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO learning_paths (id, user_id, title, description, goal, target_date, source_graph_id, daily_minutes_target, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.title, data.description, data.goal, data.target_date, data.source_graph_id, data.daily_minutes_target || 30, 'active', timestamp, timestamp]
    );

    const path = await this.getLearningPath(id);
    if (!path) throw new Error('Failed to create learning path');
    return path;
  }

  async updateLearningPath(id: string, data: Partial<LearningPath>): Promise<LearningPath> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.goal_content !== undefined) {
      updates.push('goal = ?');
      params.push(data.goal_content);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.daily_minutes_target !== undefined) {
      updates.push('daily_minutes_target = ?');
      params.push(data.daily_minutes_target);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE learning_paths SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const path = await this.getLearningPath(id);
    if (!path) throw new Error('Learning path not found after update');
    return path;
  }

  async deleteLearningPath(id: string): Promise<void> {
    this.executeSync('DELETE FROM learning_paths WHERE id = ?', [id]);
  }

  async getLearningPathNodes(pathId: string): Promise<LearningPathNodeRef[]> {
    const rows = this.rawSync<any>(
      'SELECT * FROM learning_path_nodes WHERE path_id = ? ORDER BY order_index ASC',
      [pathId]
    );
    return rows.map(row => ({
      id: row.id,
      path_id: row.path_id,
      node_id: row.knowledge_point_id || row.id,
      status: row.status,
      user_notes: row.description,
      estimated_minutes: row.estimated_time,
      difficulty_level: 1,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createLearningPathNode(data: {
    path_id: string;
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
  }): Promise<LearningPathNodeRef> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO learning_path_nodes (id, path_id, knowledge_point_id, order_index, title, description, estimated_time, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.path_id, data.knowledge_point_id, data.order_index, data.title, data.description, data.estimated_time || 30, 'pending', timestamp, timestamp]
    );

    return {
      id,
      path_id: data.path_id,
      node_id: data.knowledge_point_id || id,
      status: 'pending',
      user_notes: data.description,
      estimated_minutes: data.estimated_time || 30,
      difficulty_level: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async updateLearningPathNode(id: string, data: Partial<LearningPathNodeRef>): Promise<LearningPathNodeRef> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.user_notes !== undefined) {
      updates.push('description = ?');
      params.push(data.user_notes);
    }
    if (data.estimated_minutes !== undefined) {
      updates.push('estimated_time = ?');
      params.push(data.estimated_minutes);
    }
    if (data.completed_at !== undefined) {
      updates.push('completed_at = ?');
      params.push(data.completed_at);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE learning_path_nodes SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const row = this.rawOneSync<any>('SELECT * FROM learning_path_nodes WHERE id = ?', [id]);
    if (!row) throw new Error('Learning path node not found after update');
    return {
      id: row.id,
      path_id: row.path_id,
      node_id: row.knowledge_point_id || row.id,
      status: row.status,
      user_notes: row.description,
      estimated_minutes: row.estimated_time,
      difficulty_level: 1,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteLearningPathNode(id: string): Promise<void> {
    this.executeSync('DELETE FROM learning_path_nodes WHERE id = ?', [id]);
  }

  async getNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<Notification[]> {
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (options?.unreadOnly) {
      sql += ' AND read_at IS NULL';
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.rawSync<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: fromJson(row.data) || {},
      read_at: row.read_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
    }));
  }

  async createNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message?: string;
    data?: Record<string, unknown>;
    expires_at?: string;
  }): Promise<Notification> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO notifications (id, user_id, type, title, message, data, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.type, data.title, data.message, toJson(data.data), data.expires_at, timestamp]
    );

    return {
      id,
      user_id: data.user_id,
      type: data.type as any,
      title: data.title,
      message: data.message,
      data: data.data || {},
      expires_at: data.expires_at,
      created_at: timestamp,
    };
  }

  async markNotificationRead(id: string): Promise<void> {
    this.executeSync(
      'UPDATE notifications SET read_at = ? WHERE id = ?',
      [now(), id]
    );
  }

  async deleteNotification(id: string): Promise<void> {
    this.executeSync('DELETE FROM notifications WHERE id = ?', [id]);
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    const row = this.rawOneSync<any>(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [userId]
    );
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      browser_enabled: Boolean(row.browser_enabled),
      sound_enabled: Boolean(row.sound_enabled),
      sound_volume: row.sound_volume,
      task_start_enabled: Boolean(row.task_start_enabled),
      task_complete_enabled: Boolean(row.task_complete_enabled),
      time_slice_end_enabled: Boolean(row.time_slice_end_enabled),
      deadline_enabled: Boolean(row.deadline_enabled),
      break_enabled: Boolean(row.break_enabled),
      daily_summary_enabled: Boolean(row.daily_summary_enabled),
      deadline_reminder_minutes: fromJson(row.deadline_reminder_minutes) || [30, 60],
      do_not_disturb_enabled: Boolean(row.do_not_disturb_enabled),
      do_not_disturb_start: row.do_not_disturb_start,
      do_not_disturb_end: row.do_not_disturb_end,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async updateNotificationSettings(userId: string, data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);

    if (!existing) {
      const id = generateUUID();
      const timestamp = now();
      this.executeSync(
        `INSERT INTO notification_settings (id, user_id, browser_enabled, sound_enabled, sound_volume, task_start_enabled, task_complete_enabled, time_slice_end_enabled, deadline_enabled, break_enabled, daily_summary_enabled, deadline_reminder_minutes, do_not_disturb_enabled, do_not_disturb_start, do_not_disturb_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, data.browser_enabled !== false ? 1 : 0, data.sound_enabled !== false ? 1 : 0, data.sound_volume || 50, data.task_start_enabled !== false ? 1 : 0, data.task_complete_enabled !== false ? 1 : 0, data.time_slice_end_enabled ? 1 : 0, data.deadline_enabled !== false ? 1 : 0, data.break_enabled !== false ? 1 : 0, data.daily_summary_enabled ? 1 : 0, toJson(data.deadline_reminder_minutes || [30, 60]), data.do_not_disturb_enabled ? 1 : 0, data.do_not_disturb_start || '22:00', data.do_not_disturb_end || '08:00', timestamp, timestamp]
      );
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];

      const boolFields: (keyof Partial<NotificationSettings>)[] = ['browser_enabled', 'sound_enabled', 'task_start_enabled', 'task_complete_enabled', 'time_slice_end_enabled', 'deadline_enabled', 'break_enabled', 'daily_summary_enabled', 'do_not_disturb_enabled'];
      for (const field of boolFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(data[field] ? 1 : 0);
        }
      }
      if (data.sound_volume !== undefined) {
        updates.push('sound_volume = ?');
        params.push(data.sound_volume);
      }
      if (data.deadline_reminder_minutes !== undefined) {
        updates.push('deadline_reminder_minutes = ?');
        params.push(toJson(data.deadline_reminder_minutes));
      }
      if (data.do_not_disturb_start !== undefined) {
        updates.push('do_not_disturb_start = ?');
        params.push(data.do_not_disturb_start);
      }
      if (data.do_not_disturb_end !== undefined) {
        updates.push('do_not_disturb_end = ?');
        params.push(data.do_not_disturb_end);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now());
        params.push(userId);
        this.executeSync(
          `UPDATE notification_settings SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      }
    }

    const settings = await this.getNotificationSettings(userId);
    if (!settings) throw new Error('Failed to update notification settings');
    return settings;
  }

  async getAsyncTasks(userId: string, options?: { status?: string }): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (options?.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.rawSync<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      name: row.name,
      status: row.status,
      payload: fromJson(row.payload) || {},
      result: fromJson(row.result) || {},
      error: row.error,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getAsyncTask(id: string): Promise<Task | null> {
    const row = this.rawOneSync<any>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      name: row.name,
      status: row.status,
      payload: fromJson(row.payload) || {},
      result: fromJson(row.result) || {},
      error: row.error,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createAsyncTask(data: {
    user_id: string;
    type: string;
    name?: string;
    payload?: Record<string, unknown>;
  }): Promise<Task> {
    const id = generateUUID();
    const timestamp = now();

    this.executeSync(
      `INSERT INTO tasks (id, user_id, type, name, status, payload, result, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.type, data.name, 'pending', toJson(data.payload) || '{}', '{}', timestamp, timestamp]
    );

    const task = await this.getAsyncTask(id);
    if (!task) throw new Error('Failed to create async task');
    return task;
  }

  async updateAsyncTask(id: string, data: {
    status?: string;
    result?: Record<string, unknown>;
    error?: string;
  }): Promise<Task> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.result !== undefined) {
      updates.push('result = ?');
      params.push(toJson(data.result));
    }
    if (data.error !== undefined) {
      updates.push('error = ?');
      params.push(data.error);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);
      this.executeSync(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const task = await this.getAsyncTask(id);
    if (!task) throw new Error('Async task not found after update');
    return task;
  }

  async deleteAsyncTask(id: string): Promise<void> {
    this.executeSync('DELETE FROM tasks WHERE id = ?', [id]);
  }

  private rawSync<T = unknown>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  private rawOneSync<T = unknown>(sql: string, params: unknown[] = []): T | null {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(sql);
    return (stmt.get(...params) as T) || null;
  }

  private executeSync(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: unknown } {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  raw<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return Promise.resolve(this.rawSync(sql, params));
  }

  rawOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return Promise.resolve(this.rawOneSync(sql, params));
  }

  execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: unknown }> {
    return Promise.resolve(this.executeSync(sql, params));
  }
}
