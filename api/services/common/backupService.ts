import fs from 'fs/promises';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import type { KnowledgeGraphRow, StudyCardRow, FocusSessionRow, UserAchievementRow } from '@shared/types/database';
import type { Edge } from '@shared/types/graph';
import type { PeriodicTask } from '@shared/types/common';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_AUTO_SNAPSHOTS: Record<string, number> = {
  'auto_30min': 5,
  'auto_5hour': 5,
  'auto_1day': 5,
};

export interface BackupGraphItem {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  is_favorite?: boolean;
  template_type?: string | null;
  settings?: Record<string, unknown> | null;
  is_public?: boolean;
  reference_books?: Record<string, unknown>[] | null;
  external_links?: Record<string, unknown>[] | null;
  learning_guide?: string | null;
  parent_graph_id?: string | null;
  last_used_at?: string | null;
  task_id?: string | null;
  podcast_script?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BackupNodeItem {
  id: string;
  graph_id: string;
  title: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  keywords?: Record<string, unknown>[] | null;
  aliases?: string[] | null;
  mastery_level?: number | null;
  last_study_at?: string | null;
  total_study_duration?: number | null;
  created_at: string;
  updated_at: string;
}

export interface BackupEdgeItem {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  custom_label?: string | null;
  custom_color?: string | null;
  custom_line_style?: string | null;
  show_arrow?: boolean | null;
}

export interface BackupStudyCardItem {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  question: string;
  answer: string;
  explanation?: string | null;
  card_type: string;
  options?: string[] | null;
  difficulty: number;
  last_reviewed?: string | null;
  next_review: string;
  review_count?: number;
  fsrs_state: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_retrievability: number;
  fsrs_last_review?: string | null;
  created_at: string;
}

export interface BackupBackboneModuleItem {
  id: string;
  graph_id: string;
  module_type: string;
  title: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  user: { id: string; email?: string };
  data: {
    graphs: BackupGraphItem[];
    nodes: BackupNodeItem[];
    edges: BackupEdgeItem[];
    study_cards: BackupStudyCardItem[];
    study_progress: StudyProgressRow[];
    focus_sessions: FocusSessionRow[];
    user_achievements: UserAchievementRow[];
    periodic_tasks: PeriodicTask[];
    backbone_modules: BackupBackboneModuleItem[];
  };
}

interface StudyProgressRow {
  id: string;
  user_id: string;
  graph_id: string;
  total_nodes: number;
  mastered_nodes: number;
  progress_percentage: number;
  study_streak: number;
  updated_at: string;
}

interface GraphNodeWithKnowledgePoint {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
  knowledge_points?: {
    id: string;
    title: string;
    content?: string | null;
    learning_material?: string | null;
    properties?: Record<string, unknown> | null;
    visibility?: string;
    owner_id?: string;
    keywords?: Record<string, unknown>[] | null;
    aliases?: string[] | null;
    mastery_level?: number;
    last_study_at?: string | null;
    total_study_duration?: number;
    created_at?: string;
    updated_at?: string;
  } | null;
}

async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create backup directory:', error);
  }
}

export async function createBackup(
  supabase: SupabaseClient,
  userId: string,
  type: 'auto_30min' | 'auto_5hour' | 'auto_1day' | 'manual'
): Promise<{ filePath: string; fileSize: number; graphsCount: number; nodesCount: number }> {
  await ensureBackupDir();

  const [graphsResult, studyCardsResult, studyProgressResult, focusSessionsResult, userAchievementsResult, periodicTasksResult] = await Promise.all([
    supabase.from('knowledge_graphs').select('*').eq('user_id', userId),
    supabase.from('study_cards').select('*').eq('user_id', userId),
    supabase.from('study_progress').select('*').eq('user_id', userId),
    supabase.from('focus_sessions').select('*').eq('user_id', userId),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    supabase.from('periodic_tasks').select('*').eq('user_id', userId).eq('period_type', 'daily'),
  ]);

  const graphs = (graphsResult.data as KnowledgeGraphRow[] | null) || [];
  const graphIds = graphs.map((g) => g.id);

  let nodes: BackupNodeItem[] = [];
  let edges: BackupEdgeItem[] = [];
  let backboneModules: BackupBackboneModuleItem[] = [];

  if (graphIds.length > 0) {
    const [graphNodesResult, edgesResult, backboneModulesResult] = await Promise.all([
      supabase.from('graph_nodes').select(`
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        created_at,
        updated_at,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id,
          keywords,
          aliases,
          mastery_level,
          last_study_at,
          total_study_duration,
          created_at,
          updated_at
        )
      `).in('graph_id', graphIds).is('deleted_at', null),
      supabase.from('edges').select('*').in('graph_id', graphIds).is('deleted_at', null),
      supabase.from('graph_backbone_modules').select('*').in('graph_id', graphIds),
    ]);
    
    const graphNodes = (graphNodesResult.data as GraphNodeWithKnowledgePoint[] | null) || [];
    nodes = graphNodes.map((gn) => ({
      id: gn.knowledge_points?.id || gn.knowledge_point_id,
      graph_id: gn.graph_id,
      title: gn.knowledge_points?.title || '',
      content: gn.knowledge_points?.content || '',
      learning_material: gn.knowledge_points?.learning_material || '',
      properties: gn.knowledge_points?.properties || {},
      x_position: gn.x_position,
      y_position: gn.y_position,
      level: gn.level,
      is_accepted: gn.is_accepted,
      keywords: gn.knowledge_points?.keywords,
      aliases: gn.knowledge_points?.aliases,
      mastery_level: gn.knowledge_points?.mastery_level,
      last_study_at: gn.knowledge_points?.last_study_at,
      total_study_duration: gn.knowledge_points?.total_study_duration,
      created_at: gn.created_at,
      updated_at: gn.updated_at,
    }));
    edges = ((edgesResult.data as Edge[] | null) || []).map((e) => ({
      id: e.id,
      graph_id: e.graph_id,
      source_knowledge_point_id: e.source_knowledge_point_id,
      target_knowledge_point_id: e.target_knowledge_point_id,
      relationship_type: e.relationship_type,
      weight: e.weight,
      custom_label: e.custom_label,
      custom_color: e.custom_color,
      custom_line_style: e.custom_line_style,
      show_arrow: e.show_arrow,
    }));
    backboneModules = (backboneModulesResult.data as BackupBackboneModuleItem[] | null) || [];
  }

  const studyCards = (studyCardsResult.data as StudyCardRow[] | null) || [];

  const backupData: BackupData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    user: { id: userId },
    data: {
      graphs: graphs.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        domain: g.domain,
        is_favorite: g.is_favorite,
        template_type: g.template_type,
        settings: g.settings,
        is_public: g.is_public,
        reference_books: g.reference_books,
        external_links: g.external_links,
        learning_guide: g.learning_guide,
        parent_graph_id: g.parent_graph_id,
        last_used_at: g.last_used_at,
        task_id: g.task_id,
        podcast_script: g.podcast_script,
        created_at: g.created_at,
        updated_at: g.updated_at,
      })),
      nodes,
      edges,
      study_cards: studyCards.map((c) => ({
        id: c.id,
        graph_id: c.graph_id,
        knowledge_point_id: c.knowledge_point_id,
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
      study_progress: (studyProgressResult.data as StudyProgressRow[] | null) || [],
      focus_sessions: (focusSessionsResult.data as FocusSessionRow[] | null) || [],
      user_achievements: (userAchievementsResult.data as UserAchievementRow[] | null) || [],
      periodic_tasks: (periodicTasksResult.data as PeriodicTask[] | null) || [],
      backbone_modules: backboneModules,
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
  supabase: SupabaseClient,
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

export interface BackupSnapshot {
  id: string;
  user_id: string;
  type: string;
  file_path: string;
  file_size: number;
  graphs_count: number;
  nodes_count: number;
  created_at: string;
}

export class BackupService {
  async getSnapshots(supabase: SupabaseClient, userId: string): Promise<BackupSnapshot[]> {
    const { data, error } = await supabase
      .from('backup_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as BackupSnapshot[]) || [];
  }

  async createSnapshotRecord(
    supabase: SupabaseClient,
    userId: string,
    data: {
      type: string;
      file_path: string;
      file_size: number;
      graphs_count: number;
      nodes_count: number;
    }
  ): Promise<BackupSnapshot> {
    const { data: snapshot, error } = await supabase
      .from('backup_snapshots')
      .insert({
        user_id: userId,
        ...data,
      })
      .select()
      .single();

    if (error) throw error;
    return snapshot as BackupSnapshot;
  }

  async getSnapshot(supabase: SupabaseClient, snapshotId: string, userId: string): Promise<BackupSnapshot | null> {
    const { data, error } = await supabase
      .from('backup_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as BackupSnapshot | null;
  }

  async deleteSnapshot(supabase: SupabaseClient, snapshotId: string, userId: string): Promise<void> {
    const snapshot = await this.getSnapshot(supabase, snapshotId, userId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await deleteBackupFile(snapshot.file_path);
    
    const { error } = await supabase
      .from('backup_snapshots')
      .delete()
      .eq('id', snapshotId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}

export const backupService = new BackupService();
