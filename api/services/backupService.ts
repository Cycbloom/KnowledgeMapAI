import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_AUTO_SNAPSHOTS: Record<string, number> = {
  'auto_30min': 5,
  'auto_5hour': 5,
  'auto_1day': 5,
};

interface BackupData {
  version: string;
  exportedAt: string;
  user: { id: string; email?: string };
  data: {
    graphs: any[];
    nodes: any[];
    edges: any[];
    study_cards: any[];
    study_progress: any[];
    focus_sessions: any[];
    user_achievements: any[];
    daily_tasks: any[];
  };
}

async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create backup directory:', error);
  }
}

export async function createBackup(
  supabase: any,
  userId: string,
  type: 'auto_30min' | 'auto_5hour' | 'auto_1day' | 'manual'
): Promise<{ filePath: string; fileSize: number; graphsCount: number; nodesCount: number }> {
  await ensureBackupDir();

  const [graphsResult, studyCardsResult, studyProgressResult, focusSessionsResult, userAchievementsResult, dailyTasksResult] = await Promise.all([
    supabase.from('knowledge_graphs').select('*').eq('user_id', userId),
    supabase.from('study_cards').select('*').eq('user_id', userId),
    supabase.from('study_progress').select('*').eq('user_id', userId),
    supabase.from('focus_sessions').select('*').eq('user_id', userId),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    supabase.from('daily_tasks').select('*').eq('user_id', userId),
  ]);

  const graphs = graphsResult.data || [];
  const graphIds = graphs.map((g: any) => g.id);

  let nodes: any[] = [];
  let edges: any[] = [];

  if (graphIds.length > 0) {
    const [nodesResult, edgesResult] = await Promise.all([
      supabase.from('nodes').select('*').in('graph_id', graphIds),
      supabase.from('edges').select('*').in('graph_id', graphIds),
    ]);
    nodes = nodesResult.data || [];
    edges = edgesResult.data || [];
  }

  const backupData: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    user: { id: userId },
    data: {
      graphs: graphs.map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        settings: g.settings,
        is_public: g.is_public,
        created_at: g.created_at,
        updated_at: g.updated_at,
      })),
      nodes: nodes.map((n: any) => ({
        id: n.id,
        graph_id: n.graph_id,
        title: n.title,
        content: n.content,
        learning_material: n.learning_material,
        properties: n.properties,
        x_position: n.x_position,
        y_position: n.y_position,
        level: n.level,
        is_accepted: n.is_accepted,
        created_at: n.created_at,
        updated_at: n.updated_at,
      })),
      edges: edges.map((e: any) => ({
        id: e.id,
        graph_id: e.graph_id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        relationship_type: e.relationship_type,
        weight: e.weight,
      })),
      study_cards: (studyCardsResult.data || []).map((c: any) => ({
        id: c.id,
        graph_id: c.graph_id,
        node_id: c.node_id,
        question: c.question,
        answer: c.answer,
        explanation: c.explanation,
        card_type: c.card_type,
        options: c.options,
        difficulty: c.difficulty,
        last_reviewed: c.last_reviewed,
        next_review: c.next_review,
        review_count: c.review_count,
        fsrs_state: c.fsrs_state,
        fsrs_stability: c.fsrs_stability,
        fsrs_difficulty: c.fsrs_difficulty,
        fsrs_elapsed_days: c.fsrs_elapsed_days,
        fsrs_scheduled_days: c.fsrs_scheduled_days,
        fsrs_retrievability: c.fsrs_retrievability,
        fsrs_last_review: c.fsrs_last_review,
        created_at: c.created_at,
      })),
      study_progress: studyProgressResult.data || [],
      focus_sessions: focusSessionsResult.data || [],
      user_achievements: userAchievementsResult.data || [],
      daily_tasks: dailyTasksResult.data || [],
    },
  };

  const userDir = path.join(BACKUP_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${type}_${timestamp}.json`;
  const filePath = path.join(userDir, fileName);

  const content = JSON.stringify(backupData, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');

  const stats = await fs.stat(filePath);

  return {
    filePath,
    fileSize: stats.size,
    graphsCount: graphs.length,
    nodesCount: nodes.length,
  };
}

export async function deleteBackupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn('Failed to delete backup file:', error);
  }
}

export async function readBackupFile(filePath: string): Promise<BackupData> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function cleanupOldSnapshots(
  supabase: any,
  userId: string,
  type: string
): Promise<void> {
  const maxSnapshots = MAX_AUTO_SNAPSHOTS[type] || 5;
  
  const { data: snapshots } = await supabase
    .from('backup_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false });

  if (snapshots && snapshots.length >= maxSnapshots) {
    const toDelete = snapshots.slice(maxSnapshots - 1);
    for (const snapshot of toDelete) {
      await deleteBackupFile(snapshot.file_path);
      await supabase.from('backup_snapshots').delete().eq('id', snapshot.id);
    }
  }
}

export async function runAutoBackup(
  supabaseUrl: string,
  supabaseKey: string,
  type: 'auto_30min' | 'auto_5hour' | 'auto_1day'
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: users } = await supabase
    .from('users')
    .select('id');

  if (!users) return;

  for (const user of users) {
    try {
      const result = await createBackup(supabase, user.id, type);
      
      await cleanupOldSnapshots(supabase, user.id, type);
      
      await supabase.from('backup_snapshots').insert({
        user_id: user.id,
        type,
        file_path: result.filePath,
        file_size: result.fileSize,
        graphs_count: result.graphsCount,
        nodes_count: result.nodesCount,
      });
      
      logger.info(`Auto backup created for user ${user.id}: ${type}`);
    } catch (error) {
      logger.error(`Failed to create auto backup for user ${user.id}:`, error);
    }
  }
}
