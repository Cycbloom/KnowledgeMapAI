import fs from 'fs/promises';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { cacheService, CacheKeys } from './cacheService';
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

  async cascadeDeleteGraph(supabase: SupabaseClient, userId: string): Promise<void> {
    const { data: existingGraphs } = await supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('user_id', userId);

    if (existingGraphs && existingGraphs.length > 0) {
      const graphIds = existingGraphs.map((g: { id: string }) => g.id);

      await supabase.from('graph_backbone_modules').delete().in('graph_id', graphIds);
      await supabase.from('study_cards').delete().eq('user_id', userId);
      await supabase.from('study_progress').delete().eq('user_id', userId);
      await supabase.from('edges').delete().in('graph_id', graphIds);
      await supabase.from('graph_nodes').delete().in('graph_id', graphIds);
      await supabase.from('knowledge_graphs').delete().eq('user_id', userId);
    }
  }

  async restoreBackupData(
    supabase: SupabaseClient,
    userId: string,
    data: {
      graphs?: Array<{
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
      }>;
      nodes?: Array<{
        id: string;
        graph_id: string;
        title: string;
        content?: string;
        summary?: string;
        learning_material?: string;
        keywords?: Record<string, unknown>[] | null;
        aliases?: string[] | null;
        properties?: Record<string, unknown>;
        mastery_level?: number | null;
        last_study_at?: string | null;
        total_study_duration?: number | null;
        x_position?: number;
        y_position?: number;
        level?: string;
        is_accepted?: boolean;
      }>;
      edges?: Array<{
        graph_id: string;
        source_knowledge_point_id: string;
        target_knowledge_point_id: string;
        relationship_type?: string;
        weight?: number;
        custom_label?: string | null;
        custom_color?: string | null;
        custom_line_style?: string | null;
        show_arrow?: boolean | null;
      }>;
      study_cards?: Array<{
        graph_id: string;
        knowledge_point_id: string;
        question: string;
        answer: string;
        explanation?: string | null;
        card_type?: string;
        options?: string[] | null;
        difficulty?: number;
        last_reviewed?: string | null;
        next_review?: string;
        review_count?: number;
        fsrs_state?: string;
        fsrs_stability?: number;
        fsrs_difficulty?: number;
        fsrs_elapsed_days?: number;
        fsrs_scheduled_days?: number;
        fsrs_retrievability?: number;
        fsrs_last_review?: string | null;
      }>;
      study_progress?: Array<{
        graph_id: string;
        total_nodes?: number;
        mastered_nodes?: number;
        progress_percentage?: number;
        study_streak?: number;
      }>;
      focus_sessions?: Array<{
        task_id?: string | null;
        started_at?: string;
        ended_at?: string | null;
        duration?: number | null;
        mode?: string | null;
        completed?: boolean | null;
        pomodoro_count?: number;
        white_noise_type?: string | null;
        is_break?: boolean;
      }>;
      user_achievements?: Array<{
        achievement_id: string;
        progress?: number;
        metadata?: Record<string, unknown>;
        unlocked_at?: string;
      }>;
      periodic_tasks?: Array<{
        period_type: string;
        period_start: string;
        period_end: string;
        task_type: string;
        target: number;
        progress?: number;
        status?: string;
        xp_reward?: number;
        pass_points?: number;
      }>;
      backbone_modules?: Array<{
        graph_id: string;
        module_type: string;
        title: string;
        icon?: string | null;
        color?: string | null;
        description?: string | null;
        display_order?: number;
      }>;
    },
  ): Promise<{
    graphs: number;
    nodes: number;
    edges: number;
    study_cards: number;
    study_progress: number;
    focus_sessions: number;
    user_achievements: number;
    periodic_tasks: number;
    backbone_modules: number;
  }> {
    const stats = {
      graphs: 0,
      nodes: 0,
      edges: 0,
      study_cards: 0,
      study_progress: 0,
      focus_sessions: 0,
      user_achievements: 0,
      periodic_tasks: 0,
      backbone_modules: 0,
    };

    const oldToNewGraphIds = new Map<string, string>();
    const oldToNewKnowledgePointIds = new Map<string, string>();

    if (data.graphs && data.graphs.length > 0) {
      const graphsToInsert = data.graphs.map((g) => ({
        user_id: userId,
        title: g.title,
        description: g.description,
        domain: g.domain || null,
        is_favorite: g.is_favorite || false,
        template_type: g.template_type || null,
        settings: g.settings || {},
        is_public: g.is_public || false,
        reference_books: g.reference_books || null,
        external_links: g.external_links || null,
        learning_guide: g.learning_guide || null,
        last_used_at: g.last_used_at || null,
        podcast_script: g.podcast_script || null,
      }));

      const { data: insertedGraphs, error: graphsError } = await supabase
        .from('knowledge_graphs')
        .insert(graphsToInsert)
        .select();

      if (graphsError) throw new Error(`导入图谱失败: ${graphsError.message}`);

      insertedGraphs?.forEach((g, i) => {
        oldToNewGraphIds.set(data.graphs![i].id, g.id);
      });
      stats.graphs = insertedGraphs?.length || 0;
    }

    if (data.nodes && data.nodes.length > 0) {
      const nodesWithGraph = data.nodes
        .map((n) => {
          const graphId = oldToNewGraphIds.get(n.graph_id);
          if (!graphId) return null;
          return { node: n, graphId };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (nodesWithGraph.length > 0) {
        const knowledgePointsToInsert = nodesWithGraph.map(({ node: n }) => ({
          title: n.title,
          content: n.content || '',
          summary: n.summary || null,
          learning_material: n.learning_material || null,
          keywords: n.keywords || [],
          aliases: n.aliases || [],
          properties: n.properties || {},
          visibility: 'private',
          owner_id: userId,
          mastery_level: n.mastery_level || 0,
          last_study_at: n.last_study_at || null,
          total_study_duration: n.total_study_duration || 0,
        }));

        const { data: insertedKps, error: kpError } = await supabase
          .from('knowledge_points')
          .insert(knowledgePointsToInsert)
          .select('id');

        if (kpError) {
          logger.warn('Failed to restore knowledge points:', kpError);
        } else {
          const insertedKpsList = insertedKps ?? [];
          const graphNodesToInsert = insertedKpsList.map((kp, i) => {
            const { node: n, graphId } = nodesWithGraph[i];
            return {
              graph_id: graphId,
              knowledge_point_id: kp.id,
              x_position: n.x_position || 0,
              y_position: n.y_position || 0,
              level: n.level || 'normal',
              is_accepted: n.is_accepted !== undefined ? n.is_accepted : true,
            };
          });

          if (graphNodesToInsert.length > 0) {
            const { error: gnError } = await supabase
              .from('graph_nodes')
              .insert(graphNodesToInsert);

            if (gnError) {
              logger.warn('Failed to restore graph nodes:', gnError);
            } else {
              insertedKpsList.forEach((kp, i) => {
                oldToNewKnowledgePointIds.set(nodesWithGraph[i].node.id, kp.id);
              });
              stats.nodes = graphNodesToInsert.length;
            }
          }
        }
      }
    }

    if (data.edges && data.edges.length > 0) {
      const edgesToInsert = data.edges
        .map((e) => {
          const graphId = oldToNewGraphIds.get(e.graph_id);
          const sourceKPId = oldToNewKnowledgePointIds.get(e.source_knowledge_point_id);
          const targetKPId = oldToNewKnowledgePointIds.get(e.target_knowledge_point_id);
          if (!graphId || !sourceKPId || !targetKPId) return null;
          return {
            graph_id: graphId,
            source_knowledge_point_id: sourceKPId,
            target_knowledge_point_id: targetKPId,
            relationship_type: e.relationship_type || 'contains',
            weight: e.weight || 1,
            custom_label: e.custom_label || null,
            custom_color: e.custom_color || null,
            custom_line_style: e.custom_line_style || null,
            show_arrow: e.show_arrow !== undefined ? e.show_arrow : null,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (edgesToInsert.length > 0) {
        const { error: edgesError } = await supabase
          .from('edges')
          .insert(edgesToInsert);

        if (edgesError) {
          logger.warn('Failed to restore edges:', edgesError);
        } else {
          stats.edges = edgesToInsert.length;
        }
      }
    }

    if (data.study_cards && data.study_cards.length > 0) {
      const cardsToInsert = data.study_cards
        .map((c) => {
          const graphId = oldToNewGraphIds.get(c.graph_id);
          const kpId = oldToNewKnowledgePointIds.get(c.knowledge_point_id);
          if (!graphId || !kpId) return null;
          return {
            user_id: userId,
            knowledge_point_id: kpId,
            graph_id: graphId,
            source_graph_id: graphId,
            question: c.question,
            answer: c.answer,
            explanation: c.explanation || null,
            card_type: c.card_type || 'qa',
            options: c.options || null,
            difficulty: c.difficulty || 1,
            last_reviewed: c.last_reviewed || null,
            next_review: c.next_review || new Date().toISOString(),
            review_count: c.review_count || 0,
            fsrs_state: c.fsrs_state || 'New',
            fsrs_stability: c.fsrs_stability || 0,
            fsrs_difficulty: c.fsrs_difficulty || 0,
            fsrs_elapsed_days: c.fsrs_elapsed_days || 0,
            fsrs_scheduled_days: c.fsrs_scheduled_days || 0,
            fsrs_retrievability: c.fsrs_retrievability || 0,
            fsrs_last_review: c.fsrs_last_review || null,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      if (cardsToInsert.length > 0) {
        const { error: cardsError } = await supabase
          .from('study_cards')
          .insert(cardsToInsert);

        if (cardsError) {
          logger.warn('Failed to restore study cards:', cardsError);
        } else {
          stats.study_cards = cardsToInsert.length;
        }
      }
    }

    if (data.study_progress && data.study_progress.length > 0) {
      const progressToInsert = data.study_progress
        .map((sp) => {
          const graphId = oldToNewGraphIds.get(sp.graph_id);
          if (!graphId) return null;
          return {
            user_id: userId,
            graph_id: graphId,
            total_nodes: sp.total_nodes || 0,
            mastered_nodes: sp.mastered_nodes || 0,
            progress_percentage: sp.progress_percentage || 0,
            study_streak: sp.study_streak || 0,
          };
        })
        .filter((sp): sp is NonNullable<typeof sp> => sp !== null);

      if (progressToInsert.length > 0) {
        const { error } = await supabase
          .from('study_progress')
          .insert(progressToInsert);

        if (error) {
          logger.warn('Failed to restore study progress:', error);
        } else {
          stats.study_progress = progressToInsert.length;
        }
      }
    }

    if (data.focus_sessions && data.focus_sessions.length > 0) {
      const sessionsToInsert = data.focus_sessions.map((fs) => ({
        user_id: userId,
        task_id: fs.task_id || null,
        started_at: fs.started_at || new Date().toISOString(),
        ended_at: fs.ended_at || new Date().toISOString(),
        duration: fs.duration || 0,
        mode: fs.mode || 'focus',
        completed: fs.completed !== undefined ? fs.completed : true,
        pomodoro_count: fs.pomodoro_count || 0,
        white_noise_type: fs.white_noise_type || null,
        is_break: fs.is_break || false,
      }));

      if (sessionsToInsert.length > 0) {
        const { error } = await supabase
          .from('focus_sessions')
          .insert(sessionsToInsert);

        if (error) {
          logger.warn('Failed to restore focus sessions:', error);
        } else {
          stats.focus_sessions = sessionsToInsert.length;
        }
      }
    }

    if (data.user_achievements && data.user_achievements.length > 0) {
      const achievementsToInsert = data.user_achievements.map((ua) => ({
        user_id: userId,
        achievement_id: ua.achievement_id,
        progress: ua.progress || 0,
        metadata: ua.metadata || {},
        unlocked_at: ua.unlocked_at || new Date().toISOString(),
      }));

      if (achievementsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_achievements')
          .insert(achievementsToInsert);

        if (error) {
          logger.warn('Failed to restore user achievements:', error);
        } else {
          stats.user_achievements = achievementsToInsert.length;
        }
      }
    }

    if (data.periodic_tasks && data.periodic_tasks.length > 0) {
      const tasksToInsert = data.periodic_tasks.map((pt) => ({
        user_id: userId,
        period_type: pt.period_type,
        period_start: pt.period_start,
        period_end: pt.period_end,
        task_type: pt.task_type,
        target: pt.target,
        progress: pt.progress || 0,
        status: pt.status || 'pending',
        xp_reward: pt.xp_reward || 0,
        pass_points: pt.pass_points || 10,
      }));

      if (tasksToInsert.length > 0) {
        const { error } = await supabase
          .from('periodic_tasks')
          .insert(tasksToInsert);

        if (error) {
          logger.warn('Failed to restore periodic tasks:', error);
        } else {
          stats.periodic_tasks = tasksToInsert.length;
        }
      }
    }

    if (data.backbone_modules && data.backbone_modules.length > 0) {
      const modulesToInsert = data.backbone_modules
        .map((bm) => {
          const graphId = oldToNewGraphIds.get(bm.graph_id);
          if (!graphId) return null;
          return {
            graph_id: graphId,
            module_type: bm.module_type,
            title: bm.title,
            icon: bm.icon || null,
            color: bm.color || null,
            description: bm.description || null,
            display_order: bm.display_order || 0,
          };
        })
        .filter((bm): bm is NonNullable<typeof bm> => bm !== null);

      if (modulesToInsert.length > 0) {
        const { error } = await supabase
          .from('graph_backbone_modules')
          .insert(modulesToInsert);

        if (error) {
          logger.warn('Failed to restore backbone modules:', error);
        } else {
          stats.backbone_modules = modulesToInsert.length;
        }
      }
    }

    return stats;
  }

  async importBackup(
    supabase: SupabaseClient,
    userId: string,
    data: BackupData["data"],
    mode: string = "merge",
  ): Promise<{
    stats: Awaited<ReturnType<BackupService["restoreBackupData"]>>;
    mode: string;
  }> {
    if (mode === "replace") {
      await this.cascadeDeleteGraph(supabase, userId);
    }

    const stats = await this.restoreBackupData(supabase, userId, data);

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));

    return { stats, mode };
  }

  async exportAndRecord(
    supabase: SupabaseClient,
    userId: string,
    type: "auto_30min" | "auto_5hour" | "auto_1day" | "manual",
  ): Promise<{ filePath: string; fileSize: number; graphsCount: number; nodesCount: number }> {
    const result = await createBackup(supabase, userId, type);

    await this.createSnapshotRecord(supabase, userId, {
      type,
      file_path: result.filePath,
      file_size: result.fileSize,
      graphs_count: result.graphsCount,
      nodes_count: result.nodesCount,
    });

    return result;
  }
}

export const backupService = new BackupService();
