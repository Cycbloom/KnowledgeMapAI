import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExportedData,
  createEmptyExportData,
  convertUserToExport,
  convertGraphToExport,
  convertKnowledgePointToExport,
  convertGraphNodeToExport,
  convertEdgeToExport,
  convertStudyCardToExport,
  convertScheduledTaskToExport,
  convertFocusSessionToExport,
  convertTemplateToExport,
  convertAchievementToExport,
  convertUserAchievementToExport,
  convertQueueToExport,
  convertQuizSetToExport,
  convertLearningPathToExport,
  convertNotificationToExport,
  getExportStats,
} from './dataConverter.js';

interface ExportOptions {
  output: string;
  userId?: string;
  since?: string;
  includeDeleted?: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
}

async function exportFromSupabase(options: ExportOptions): Promise<void> {
  const supabaseUrl = options.supabaseUrl || process.env.VITE_SUPABASE_URL;
  const supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL and key are required.');
    console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.error('or pass them as options.');
    process.exit(1);
  }

  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const data = createEmptyExportData();

  console.log('Exporting data from Supabase...');

  try {
    await exportUsers(supabase, data, options);
    await exportKnowledgeGraphs(supabase, data, options);
    await exportKnowledgePoints(supabase, data, options);
    await exportGraphNodes(supabase, data, options);
    await exportEdges(supabase, data, options);
    await exportStudyCards(supabase, data, options);
    await exportScheduledTasks(supabase, data, options);
    await exportFocusSessions(supabase, data, options);
    await exportTemplates(supabase, data, options);
    await exportAchievements(supabase, data, options);
    await exportUserAchievements(supabase, data, options);
    await exportQueues(supabase, data, options);
    await exportQuizSets(supabase, data, options);
    await exportLearningPaths(supabase, data, options);
    await exportNotifications(supabase, data, options);

    const stats = getExportStats(data);
    console.log('\nExport Statistics:');
    for (const [table, count] of Object.entries(stats)) {
      console.log(`  ${table}: ${count}`);
    }

    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(options.output, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\nData exported successfully to: ${options.output}`);
    console.log(`File size: ${(fs.statSync(options.output).size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

async function exportUsers(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting users...');
  let query = supabase.from('users').select('*');
  
  if (options.userId) {
    query = query.eq('id', options.userId);
  }
  if (options.since) {
    query = query.gte('updated_at', options.since);
  }

  const { data: users, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export users:', error.message);
    return;
  }

  data.users = (users || []).map(convertUserToExport);
  console.log(`  Exported ${data.users.length} users`);
}

async function exportKnowledgeGraphs(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting knowledge_graphs...');
  let query = supabase.from('knowledge_graphs').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (!options.includeDeleted) {
    query = query.is('deleted_at', null);
  }
  if (options.since) {
    query = query.gte('updated_at', options.since);
  }

  const { data: graphs, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export knowledge_graphs:', error.message);
    return;
  }

  data.knowledge_graphs = (graphs || []).map(convertGraphToExport);
  console.log(`  Exported ${data.knowledge_graphs.length} knowledge_graphs`);
}

async function exportKnowledgePoints(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting knowledge_points...');
  let query = supabase.from('knowledge_points').select('*');
  
  if (options.userId) {
    query = query.eq('owner_id', options.userId);
  }
  if (options.since) {
    query = query.gte('updated_at', options.since);
  }

  const { data: kps, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export knowledge_points:', error.message);
    return;
  }

  data.knowledge_points = (kps || []).map(convertKnowledgePointToExport);
  console.log(`  Exported ${data.knowledge_points.length} knowledge_points`);
}

async function exportGraphNodes(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting graph_nodes...');
  
  const graphIds = data.knowledge_graphs.map(g => g.id);
  if (graphIds.length === 0) {
    console.log('  No graphs to export nodes for');
    return;
  }

  const batchSize = 500;
  const allNodes: Record<string, unknown>[] = [];

  for (let i = 0; i < graphIds.length; i += batchSize) {
    const batch = graphIds.slice(i, i + batchSize);
    let query = supabase.from('graph_nodes').select('*').in('graph_id', batch);
    
    if (!options.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data: nodes, error } = await query;
    if (error) {
      console.warn('Warning: Failed to export graph_nodes batch:', error.message);
      continue;
    }
    allNodes.push(...(nodes || []));
  }

  data.graph_nodes = allNodes.map(convertGraphNodeToExport);
  console.log(`  Exported ${data.graph_nodes.length} graph_nodes`);
}

async function exportEdges(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting edges...');
  
  const graphIds = data.knowledge_graphs.map(g => g.id);
  if (graphIds.length === 0) {
    console.log('  No graphs to export edges for');
    return;
  }

  const batchSize = 500;
  const allEdges: Record<string, unknown>[] = [];

  for (let i = 0; i < graphIds.length; i += batchSize) {
    const batch = graphIds.slice(i, i + batchSize);
    let query = supabase.from('edges').select('*').in('graph_id', batch);
    
    if (!options.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data: edges, error } = await query;
    if (error) {
      console.warn('Warning: Failed to export edges batch:', error.message);
      continue;
    }
    allEdges.push(...(edges || []));
  }

  data.edges = allEdges.map(convertEdgeToExport);
  console.log(`  Exported ${data.edges.length} edges`);
}

async function exportStudyCards(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting study_cards...');
  let query = supabase.from('study_cards').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (options.since) {
    query = query.gte('created_at', options.since);
  }

  const { data: cards, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export study_cards:', error.message);
    return;
  }

  data.study_cards = (cards || []).map(convertStudyCardToExport);
  console.log(`  Exported ${data.study_cards.length} study_cards`);
}

async function exportScheduledTasks(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting user_tasks...');
  let query = supabase.from('user_tasks').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (!options.includeDeleted) {
    query = query.is('deleted_at', null);
  }
  if (options.since) {
    query = query.gte('updated_at', options.since);
  }

  const { data: tasks, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export user_tasks:', error.message);
    return;
  }

  data.user_tasks = (tasks || []).map(convertScheduledTaskToExport);
  console.log(`  Exported ${data.user_tasks.length} user_tasks`);
}

async function exportFocusSessions(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting focus_sessions...');
  let query = supabase.from('focus_sessions').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  if (options.since) {
    query = query.gte('created_at', options.since);
  }

  const { data: sessions, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export focus_sessions:', error.message);
    return;
  }

  data.focus_sessions = (sessions || []).map(convertFocusSessionToExport);
  console.log(`  Exported ${data.focus_sessions.length} focus_sessions`);
}

async function exportTemplates(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting templates...');
  let query = supabase.from('templates').select('*');
  
  if (options.userId) {
    query = query.or(`user_id.eq.${options.userId},is_system.eq.true`);
  }

  const { data: templates, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export templates:', error.message);
    return;
  }

  data.templates = (templates || []).map(convertTemplateToExport);
  console.log(`  Exported ${data.templates.length} templates`);
}

async function exportAchievements(supabase: SupabaseClient, data: ExportedData, _options: ExportOptions): Promise<void> {
  console.log('Exporting achievements...');
  
  const { data: achievements, error } = await supabase.from('achievements').select('*');
  if (error) {
    console.warn('Warning: Failed to export achievements:', error.message);
    return;
  }

  data.achievements = (achievements || []).map(convertAchievementToExport);
  console.log(`  Exported ${data.achievements.length} achievements`);
}

async function exportUserAchievements(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting user_achievements...');
  let query = supabase.from('user_achievements').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: userAchievements, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export user_achievements:', error.message);
    return;
  }

  data.user_achievements = (userAchievements || []).map(convertUserAchievementToExport);
  console.log(`  Exported ${data.user_achievements.length} user_achievements`);
}

async function exportQueues(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting queues...');
  let query = supabase.from('queues').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: queues, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export queues:', error.message);
    return;
  }

  data.queues = (queues || []).map(convertQueueToExport);
  console.log(`  Exported ${data.queues.length} queues`);
}

async function exportQuizSets(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting quiz_sets...');
  let query = supabase.from('quiz_sets').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: quizSets, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export quiz_sets:', error.message);
    return;
  }

  data.quiz_sets = (quizSets || []).map(convertQuizSetToExport);
  console.log(`  Exported ${data.quiz_sets.length} quiz_sets`);
}

async function exportLearningPaths(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting learning_paths...');
  let query = supabase.from('learning_paths').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: paths, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export learning_paths:', error.message);
    return;
  }

  data.learning_paths = (paths || []).map(convertLearningPathToExport);
  console.log(`  Exported ${data.learning_paths.length} learning_paths`);
}

async function exportNotifications(supabase: SupabaseClient, data: ExportedData, options: ExportOptions): Promise<void> {
  console.log('Exporting notifications...');
  let query = supabase.from('notifications').select('*');
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: notifications, error } = await query;
  if (error) {
    console.warn('Warning: Failed to export notifications:', error.message);
    return;
  }

  data.notifications = (notifications || []).map(convertNotificationToExport);
  console.log(`  Exported ${data.notifications.length} notifications`);
}

function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options: ExportOptions = {
    output: './backup/data.json',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--user' || arg === '-u') {
      options.userId = args[++i];
    } else if (arg === '--since' || arg === '-s') {
      options.since = args[++i];
    } else if (arg === '--include-deleted') {
      options.includeDeleted = true;
    } else if (arg === '--url') {
      options.supabaseUrl = args[++i];
    } else if (arg === '--key') {
      options.supabaseKey = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run db:export -- [options]

Options:
  --output, -o <path>    Output file path (default: ./backup/data.json)
  --user, -u <id>        Export data for specific user only
  --since, -s <date>     Export data updated since date (ISO format)
  --include-deleted      Include soft-deleted records
  --url <url>            Supabase URL (or set VITE_SUPABASE_URL)
  --key <key>            Supabase service role key (or set SUPABASE_SERVICE_ROLE_KEY)
  --help, -h             Show this help message

Examples:
  npm run db:export
  npm run db:export -- --output ./my-backup.json
  npm run db:export -- --user 123e4567-e89b-12d3-a456-426614174000
  npm run db:export -- --since 2024-01-01T00:00:00Z
`);
      process.exit(0);
    }
  }

  return options;
}

const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` 
  || process.argv[1].endsWith('exportFromSupabase.ts')
  || process.argv[1].endsWith('exportFromSupabase.js');

if (isMainModule) {
  const options = parseArgs();
  exportFromSupabase(options);
}

export { exportFromSupabase };
