import fs from 'fs/promises';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type { Database } from '@shared/types/database.generated';
import { notDeleted } from './softDeleteHelper';
import { backupRestoreService } from './backupRestoreService';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_AUTO_SNAPSHOTS: Record<string, number> = {
  'auto_30min': 5,
  'auto_5hour': 5,
  'auto_1day': 5,
};

const BACKUP_VERSION = '3.0';

type Tables = Database['public']['Tables'];
type RowOf<T extends keyof Tables> = Tables[T]['Row'];

// =====================================================
// 备份条目类型
// =====================================================

/** 图谱：主表全字段 + knowledge_graph_contents 扁平化 */
export interface BackupGraphItem extends RowOf<'knowledge_graphs'> {
  podcast_script?: string | null;
  reference_books?: unknown | null;
  external_links?: unknown | null;
  learning_guide?: string | null;
}

/** 兼容旧版（v2.x）扁平化节点：id 即 knowledge_point id */
export interface BackupLegacyNodeItem {
  id: string;
  graph_id: string;
  title: string;
  content?: string;
  summary?: string;
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

export interface BackupData {
  version: string;
  exportedAt: string;
  user: { id: string; email?: string };
  data: {
    graphs: BackupGraphItem[];
    knowledge_points: RowOf<'knowledge_points'>[];
    graph_nodes: RowOf<'graph_nodes'>[];
    edges: RowOf<'edges'>[];
    knowledge_point_versions: RowOf<'knowledge_point_versions'>[];
    graph_backbone_modules: RowOf<'graph_backbone_modules'>[];
    graph_snapshots: RowOf<'graph_snapshots'>[];
    graph_events: RowOf<'graph_events'>[];
    literature_sources: RowOf<'literature_sources'>[];
    graph_domains: RowOf<'graph_domains'>[];
    graph_relations: RowOf<'graph_relations'>[];
    domains: RowOf<'domains'>[];
    relationship_types: RowOf<'relationship_types'>[];
    study_cards: RowOf<'study_cards'>[];
    study_progress: RowOf<'study_progress'>[];
    quiz_sets: RowOf<'quiz_sets'>[];
    quiz_set_cards: RowOf<'quiz_set_cards'>[];
    learning_sessions: RowOf<'learning_sessions'>[];
    learning_session_results: RowOf<'learning_session_results'>[];
    queues: RowOf<'queues'>[];
    user_tasks: RowOf<'user_tasks'>[];
    task_tags: RowOf<'task_tags'>[];
    task_settings: RowOf<'task_settings'>[];
    task_dependencies: RowOf<'task_dependencies'>[];
    task_schedules: RowOf<'task_schedules'>[];
    task_progress_plans: RowOf<'task_progress_plans'>[];
    user_time_slots: RowOf<'user_time_slots'>[];
    task_subtasks: RowOf<'task_subtasks'>[];
    task_links: RowOf<'task_links'>[];
    task_knowledge_points: RowOf<'task_knowledge_points'>[];
    task_reviews: RowOf<'task_reviews'>[];
    task_templates: RowOf<'task_templates'>[];
    scheduler_weight_profiles: RowOf<'scheduler_weight_profiles'>[];
    learning_paths: RowOf<'learning_paths'>[];
    learning_path_nodes: RowOf<'learning_path_nodes'>[];
    learning_path_prerequisites: RowOf<'learning_path_prerequisites'>[];
    learning_path_progress: RowOf<'learning_path_progress'>[];
    path_node_tasks: RowOf<'path_node_tasks'>[];
    learning_loops: RowOf<'learning_loops'>[];
    note_templates: RowOf<'note_templates'>[];
    notes: RowOf<'notes'>[];
    note_node_links: RowOf<'note_node_links'>[];
    note_block_refs: RowOf<'note_block_refs'>[];
    focus_sessions: RowOf<'focus_sessions'>[];
    user_efficiency_profile: RowOf<'user_efficiency_profile'>[];
    user_achievements: RowOf<'user_achievements'>[];
    periodic_tasks: RowOf<'periodic_tasks'>[];
    periodic_passes: RowOf<'periodic_passes'>[];
    user_pass_progress: RowOf<'user_pass_progress'>[];
    user_focus_stats: RowOf<'user_focus_stats'>[];
    agent_sessions: RowOf<'agent_sessions'>[];
    agent_messages: RowOf<'agent_messages'>[];
    agent_tool_calls: RowOf<'agent_tool_calls'>[];
    agent_pending_actions: RowOf<'agent_pending_actions'>[];
    installed_plugins: RowOf<'installed_plugins'>[];
    learning_material_schemas: RowOf<'learning_material_schemas'>[];
    notification_settings: RowOf<'notification_settings'>[];
    nodes?: BackupLegacyNodeItem[];
  };
}

// =====================================================
// 恢复统计
// =====================================================

export interface RestoreStats {
  graphs: number;
  nodes: number;
  edges: number;
  study_cards: number;
  study_progress: number;
  focus_sessions: number;
  user_achievements: number;
  periodic_tasks: number;
  backbone_modules: number;
  notes: number;
  user_tasks: number;
  learning_paths: number;
  quiz_sets: number;
  agent_sessions: number;
  literature_sources: number;
}

async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create backup directory:', error);
  }
}

/** 防御路径穿越：仅允许访问 BACKUP_DIR 内的备份文件 */
function assertFilePathWithinBackupDir(filePath: string): void {
  const backupDir = path.resolve(BACKUP_DIR);
  const resolved = path.resolve(filePath);
  if (resolved !== backupDir && !resolved.startsWith(backupDir + path.sep)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, { message: '备份文件路径越界' });
  }
}

// =====================================================
// 导出
// =====================================================

/** 图谱：过滤软删除、剔除向量列、扁平化 contents */
function toBackupGraph(raw: Record<string, unknown>): BackupGraphItem {
  const { embedding: _embedding, knowledge_graph_contents, ...rest } = raw;
  const contents = (knowledge_graph_contents as Record<string, unknown> | null) || null;
  return {
    ...rest,
    podcast_script: (contents?.podcast_script as string | null | undefined) ?? null,
    reference_books: (contents?.reference_books as unknown | null | undefined) ?? null,
    external_links: (contents?.external_links as unknown | null | undefined) ?? null,
    learning_guide: (contents?.learning_guide as string | null | undefined) ?? null,
  } as unknown as BackupGraphItem;
}

/** 知识点：剔除向量列 */
function toBackupKnowledgePoint(raw: Record<string, unknown>): RowOf<'knowledge_points'> {
  const { embedding: _embedding, ...rest } = raw;
  return rest as RowOf<'knowledge_points'>;
}

export async function createBackup(
  supabase: SupabaseClient,
  userId: string,
  type: 'auto_30min' | 'auto_5hour' | 'auto_1day' | 'manual'
): Promise<{ filePath: string; fileSize: number; graphsCount: number; nodesCount: number }> {
  await ensureBackupDir();

  // ---------- Round 1：按 user_id 可直接过滤的数据 ----------
  const [graphsResult, kpsResult, studyCardsResult, studyProgressResult, focusSessionsResult, userAchievementsResult,
    periodicTasksResult, queuesResult, tasksResult, taskTagsResult, taskSettingsResult,
    taskSchedulesResult, userTimeSlotsResult,
    taskReviewsResult, taskTemplatesResult, schedulerWeightProfilesResult, learningPathsResult, learningLoopsResult,
    quizSetsResult, learningSessionsResult, agentSessionsResult, installedPluginsResult, learningMaterialSchemasResult,
    notificationSettingsResult, domainsResult, relationshipTypesResult, periodicPassesResult, userPassProgressResult,
    userFocusStatsResult, userEfficiencyProfileResult, noteTemplatesResult, notesResult,
    learningPathProgressResult, pathNodeTasksResult] = await Promise.all([
    notDeleted(supabase.from('knowledge_graphs').select('*, knowledge_graph_contents(podcast_script, reference_books, external_links, learning_guide)').eq('user_id', userId)),
    supabase.from('knowledge_points').select('*').eq('owner_id', userId),
    supabase.from('study_cards').select('*').eq('user_id', userId),
    supabase.from('study_progress').select('*').eq('user_id', userId),
    supabase.from('focus_sessions').select('*').eq('user_id', userId),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    supabase.from('periodic_tasks').select('*').eq('user_id', userId),
    supabase.from('queues').select('*').eq('user_id', userId),
    notDeleted(supabase.from('user_tasks').select('*').eq('user_id', userId)),
    supabase.from('task_tags').select('*').eq('user_id', userId),
    supabase.from('task_settings').select('*').eq('user_id', userId),
    supabase.from('task_schedules').select('*').eq('user_id', userId),
    supabase.from('user_time_slots').select('*').eq('user_id', userId),
    supabase.from('task_reviews').select('*').eq('user_id', userId),
    supabase.from('task_templates').select('*').eq('user_id', userId),
    supabase.from('scheduler_weight_profiles').select('*').eq('user_id', userId),
    supabase.from('learning_paths').select('*').eq('user_id', userId),
    supabase.from('learning_loops').select('*').eq('user_id', userId),
    supabase.from('quiz_sets').select('*').eq('user_id', userId),
    supabase.from('learning_sessions').select('*').eq('user_id', userId),
    supabase.from('agent_sessions').select('*').eq('user_id', userId),
    supabase.from('installed_plugins').select('*').eq('user_id', userId),
    supabase.from('learning_material_schemas').select('*').eq('user_id', userId),
    supabase.from('notification_settings').select('*').eq('user_id', userId),
    supabase.from('domains').select('*').eq('user_id', userId),
    supabase.from('relationship_types').select('*').eq('user_id', userId),
    supabase.from('periodic_passes').select('*').eq('user_id', userId),
    supabase.from('user_pass_progress').select('*').eq('user_id', userId),
    supabase.from('user_focus_stats').select('*').eq('user_id', userId),
    supabase.from('user_efficiency_profile').select('*').eq('user_id', userId),
    supabase.from('note_templates').select('*').eq('user_id', userId),
    notDeleted(supabase.from('notes').select('*').eq('user_id', userId)),
    supabase.from('learning_path_progress').select('*').eq('user_id', userId),
    supabase.from('path_node_tasks').select('*').eq('user_id', userId),
  ]);

  const graphs = ((graphsResult.data as Record<string, unknown>[] | null) || []).map(toBackupGraph);
  const graphIds = graphs.map((g) => g.id);
  const kps = ((kpsResult.data as Record<string, unknown>[] | null) || []).map(toBackupKnowledgePoint);
  const kpIds = kps.map((k) => k.id);
  const taskIds = ((tasksResult.data as { id: string }[] | null) || []).map((t) => t.id);
  const pathIds = ((learningPathsResult.data as { id: string }[] | null) || []).map((p) => p.id);
  const noteIds = ((notesResult.data as { id: string }[] | null) || []).map((n) => n.id);
  const quizSetIds = ((quizSetsResult.data as { id: string }[] | null) || []).map((q) => q.id);
  const sessionIds = ((learningSessionsResult.data as { id: string }[] | null) || []).map((s) => s.id);
  const agentSessionIds = ((agentSessionsResult.data as { id: string }[] | null) || []).map((s) => s.id);

  // ---------- Round 2：依赖 Round 1 的 ID 集合（空集合跳过 in 查询，避免 PostgREST 空 in 报错） ----------
  const emptyQuery = Promise.resolve({ data: [], error: null });
  const [graphNodesResult, edgesResult, backboneModulesResult, kpVersionsResult, graphSnapshotsResult,
    graphEventsResult, literatureSourcesResult, graphDomainsResult, graphRelationsResult,
    quizSetCardsResult, learningSessionResultsResult, noteNodeLinksResult, noteBlockRefsResult,
    taskSubtasksResult, taskKnowledgePointsByTaskResult, agentMessagesResult, agentToolCallsResult,
    agentPendingActionsResult, learningPathNodesResult, taskDependenciesResult, taskProgressPlansResult,
    taskLinksResult] = await Promise.all([
    graphIds.length > 0 ? notDeleted(supabase.from('graph_nodes').select('*').in('graph_id', graphIds)) : emptyQuery,
    graphIds.length > 0 ? notDeleted(supabase.from('edges').select('*').in('graph_id', graphIds)) : emptyQuery,
    graphIds.length > 0 ? supabase.from('graph_backbone_modules').select('*').in('graph_id', graphIds) : emptyQuery,
    kpIds.length > 0 ? supabase.from('knowledge_point_versions').select('*').in('knowledge_point_id', kpIds) : emptyQuery,
    graphIds.length > 0 ? supabase.from('graph_snapshots').select('*').in('graph_id', graphIds) : emptyQuery,
    graphIds.length > 0 ? supabase.from('graph_events').select('*').in('graph_id', graphIds) : emptyQuery,
    graphIds.length > 0 ? supabase.from('literature_sources').select('*').in('graph_id', graphIds) : emptyQuery,
    graphIds.length > 0 ? supabase.from('graph_domains').select('*').in('graph_id', graphIds) : emptyQuery,
    graphIds.length > 0 ? supabase.from('graph_relations').select('*').in('source_graph_id', graphIds) : emptyQuery,
    quizSetIds.length > 0 ? supabase.from('quiz_set_cards').select('*').in('quiz_set_id', quizSetIds) : emptyQuery,
    sessionIds.length > 0 ? supabase.from('learning_session_results').select('*').in('session_id', sessionIds) : emptyQuery,
    noteIds.length > 0 ? supabase.from('note_node_links').select('*').in('note_id', noteIds) : emptyQuery,
    noteIds.length > 0 ? supabase.from('note_block_refs').select('*').in('source_note_id', noteIds) : emptyQuery,
    taskIds.length > 0 ? supabase.from('task_subtasks').select('*').in('task_id', taskIds) : emptyQuery,
    taskIds.length > 0 ? supabase.from('task_knowledge_points').select('*').in('task_id', taskIds) : emptyQuery,
    agentSessionIds.length > 0 ? supabase.from('agent_messages').select('*').in('session_id', agentSessionIds) : emptyQuery,
    agentSessionIds.length > 0 ? supabase.from('agent_tool_calls').select('*').in('session_id', agentSessionIds) : emptyQuery,
    agentSessionIds.length > 0 ? supabase.from('agent_pending_actions').select('*').in('session_id', agentSessionIds) : emptyQuery,
    pathIds.length > 0 ? supabase.from('learning_path_nodes').select('*').in('path_id', pathIds) : emptyQuery,
    taskIds.length > 0 ? supabase.from('task_dependencies').select('*').in('task_id', taskIds) : emptyQuery,
    taskIds.length > 0 ? supabase.from('task_progress_plans').select('*').in('task_id', taskIds) : emptyQuery,
    taskIds.length > 0 ? supabase.from('task_links').select('*').in('task_id', taskIds) : emptyQuery,
  ]);

  const pathNodeIds = ((learningPathNodesResult.data as { id: string }[] | null) || []).map((n) => n.id);

  // ---------- Round 3：依赖 Round 2 的 ID 集合 ----------
  const learningPathPrereqsResult = pathNodeIds.length > 0
    ? await supabase.from('learning_path_prerequisites').select('*').in('path_node_id', pathNodeIds)
    : { data: [], error: null };

  const backupData: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: { id: userId },
    data: {
      graphs,
      knowledge_points: kps,
      graph_nodes: (graphNodesResult.data as RowOf<'graph_nodes'>[] | null) || [],
      edges: (edgesResult.data as RowOf<'edges'>[] | null) || [],
      knowledge_point_versions: (kpVersionsResult.data as RowOf<'knowledge_point_versions'>[] | null) || [],
      graph_backbone_modules: (backboneModulesResult.data as RowOf<'graph_backbone_modules'>[] | null) || [],
      graph_snapshots: (graphSnapshotsResult.data as RowOf<'graph_snapshots'>[] | null) || [],
      graph_events: (graphEventsResult.data as RowOf<'graph_events'>[] | null) || [],
      literature_sources: (literatureSourcesResult.data as RowOf<'literature_sources'>[] | null) || [],
      graph_domains: (graphDomainsResult.data as RowOf<'graph_domains'>[] | null) || [],
      graph_relations: (graphRelationsResult.data as RowOf<'graph_relations'>[] | null) || [],
      domains: (domainsResult.data as RowOf<'domains'>[] | null) || [],
      relationship_types: (relationshipTypesResult.data as RowOf<'relationship_types'>[] | null) || [],
      study_cards: (studyCardsResult.data as RowOf<'study_cards'>[] | null) || [],
      study_progress: (studyProgressResult.data as RowOf<'study_progress'>[] | null) || [],
      quiz_sets: (quizSetsResult.data as RowOf<'quiz_sets'>[] | null) || [],
      quiz_set_cards: (quizSetCardsResult.data as RowOf<'quiz_set_cards'>[] | null) || [],
      learning_sessions: (learningSessionsResult.data as RowOf<'learning_sessions'>[] | null) || [],
      learning_session_results: (learningSessionResultsResult.data as RowOf<'learning_session_results'>[] | null) || [],
      queues: (queuesResult.data as RowOf<'queues'>[] | null) || [],
      user_tasks: (tasksResult.data as RowOf<'user_tasks'>[] | null) || [],
      task_tags: (taskTagsResult.data as RowOf<'task_tags'>[] | null) || [],
      task_settings: (taskSettingsResult.data as RowOf<'task_settings'>[] | null) || [],
      task_dependencies: (taskDependenciesResult.data as RowOf<'task_dependencies'>[] | null) || [],
      task_schedules: (taskSchedulesResult.data as RowOf<'task_schedules'>[] | null) || [],
      task_progress_plans: (taskProgressPlansResult.data as RowOf<'task_progress_plans'>[] | null) || [],
      user_time_slots: (userTimeSlotsResult.data as RowOf<'user_time_slots'>[] | null) || [],
      task_subtasks: (taskSubtasksResult.data as RowOf<'task_subtasks'>[] | null) || [],
      task_links: (taskLinksResult.data as RowOf<'task_links'>[] | null) || [],
      task_knowledge_points: (taskKnowledgePointsByTaskResult.data as RowOf<'task_knowledge_points'>[] | null) || [],
      task_reviews: (taskReviewsResult.data as RowOf<'task_reviews'>[] | null) || [],
      task_templates: (taskTemplatesResult.data as RowOf<'task_templates'>[] | null) || [],
      scheduler_weight_profiles: (schedulerWeightProfilesResult.data as RowOf<'scheduler_weight_profiles'>[] | null) || [],
      learning_paths: (learningPathsResult.data as RowOf<'learning_paths'>[] | null) || [],
      learning_path_nodes: (learningPathNodesResult.data as RowOf<'learning_path_nodes'>[] | null) || [],
      learning_path_prerequisites: (learningPathPrereqsResult.data as RowOf<'learning_path_prerequisites'>[] | null) || [],
      learning_path_progress: (learningPathProgressResult.data as RowOf<'learning_path_progress'>[] | null) || [],
      path_node_tasks: (pathNodeTasksResult.data as RowOf<'path_node_tasks'>[] | null) || [],
      learning_loops: (learningLoopsResult.data as RowOf<'learning_loops'>[] | null) || [],
      note_templates: (noteTemplatesResult.data as RowOf<'note_templates'>[] | null) || [],
      notes: (notesResult.data as RowOf<'notes'>[] | null) || [],
      note_node_links: (noteNodeLinksResult.data as RowOf<'note_node_links'>[] | null) || [],
      note_block_refs: (noteBlockRefsResult.data as RowOf<'note_block_refs'>[] | null) || [],
      focus_sessions: (focusSessionsResult.data as RowOf<'focus_sessions'>[] | null) || [],
      user_efficiency_profile: (userEfficiencyProfileResult.data as RowOf<'user_efficiency_profile'>[] | null) || [],
      user_achievements: (userAchievementsResult.data as RowOf<'user_achievements'>[] | null) || [],
      periodic_tasks: (periodicTasksResult.data as RowOf<'periodic_tasks'>[] | null) || [],
      periodic_passes: (periodicPassesResult.data as RowOf<'periodic_passes'>[] | null) || [],
      user_pass_progress: (userPassProgressResult.data as RowOf<'user_pass_progress'>[] | null) || [],
      user_focus_stats: (userFocusStatsResult.data as RowOf<'user_focus_stats'>[] | null) || [],
      agent_sessions: (agentSessionsResult.data as RowOf<'agent_sessions'>[] | null) || [],
      agent_messages: (agentMessagesResult.data as RowOf<'agent_messages'>[] | null) || [],
      agent_tool_calls: (agentToolCallsResult.data as RowOf<'agent_tool_calls'>[] | null) || [],
      agent_pending_actions: (agentPendingActionsResult.data as RowOf<'agent_pending_actions'>[] | null) || [],
      installed_plugins: (installedPluginsResult.data as RowOf<'installed_plugins'>[] | null) || [],
      learning_material_schemas: (learningMaterialSchemasResult.data as RowOf<'learning_material_schemas'>[] | null) || [],
      notification_settings: (notificationSettingsResult.data as RowOf<'notification_settings'>[] | null) || [],
    },
  };

  const userDir = path.join(BACKUP_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });

  // 使用东八区（UTC+8）本地时间格式化时间戳
  const now = new Date();
  const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const isoBeijing = beijingDate.toISOString().replace(/[:.]/g, '-');
  const fileName = `${type}_${isoBeijing}.json`;
  const filePath = path.join(userDir, fileName);

  const content = JSON.stringify(backupData, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');

  const stats = await fs.stat(filePath);

  return {
    filePath,
    fileSize: stats.size,
    graphsCount: graphs.length,
    nodesCount: kps.length,
  };
}

export async function deleteBackupFile(filePath: string): Promise<void> {
  try {
    assertFilePathWithinBackupDir(filePath);
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn('Failed to delete backup file:', error);
  }
}

export async function readBackupFile(filePath: string): Promise<BackupData> {
  assertFilePathWithinBackupDir(filePath);
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
    // 文件删除保留串行（IO 顺序性），DB 删除合并为单次批量（N 次 → 1 次）
    for (const snapshot of toDelete) {
      await deleteBackupFile(snapshot.file_path);
    }
    await supabase
      .from('backup_snapshots')
      .delete()
      .in('id', toDelete.map((s) => s.id));
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
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: 'Snapshot not found' });
    }

    await deleteBackupFile(snapshot.file_path);

    const { error } = await supabase
      .from('backup_snapshots')
      .delete()
      .eq('id', snapshotId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /** replace 模式：按 FK 依赖顺序（子表在前）清空当前用户的全部个人数据（委托 backupRestoreService） */
  async deleteAllUserData(supabase: SupabaseClient, userId: string): Promise<void> {
    return backupRestoreService.deleteAllUserData(supabase, userId);
  }

  /** 恢复备份数据到当前用户（委托 backupRestoreService） */
  async restoreBackupData(
    supabase: SupabaseClient,
    userId: string,
    data: BackupData["data"],
  ): Promise<RestoreStats> {
    return backupRestoreService.restoreBackupData(supabase, userId, data);
  }

  /** 导入备份：replace 模式先清空用户数据，再整体恢复（委托 backupRestoreService） */
  async importBackup(
    supabase: SupabaseClient,
    userId: string,
    data: BackupData["data"],
    mode: string = "merge",
  ): Promise<{ stats: Awaited<ReturnType<BackupService["restoreBackupData"]>>; mode: string }> {
    return backupRestoreService.importBackup(supabase, userId, data, mode);
  }

  async exportAndRecord(
    supabase: SupabaseClient,
    userId: string,
    type: "auto_30min" | "auto_5hour" | "auto_1day" | "manual",
  ): Promise<{ filePath: string; fileSize: number; graphsCount: number; nodesCount: number }> {
    const result = await createBackup(supabase, userId, type);

    try {
      await this.createSnapshotRecord(supabase, userId, {
        type,
        file_path: result.filePath,
        file_size: result.fileSize,
        graphs_count: result.graphsCount,
        nodes_count: result.nodesCount,
      });
    } catch (error) {
      // 记录写入失败时补偿清理已落盘的文件，避免产生孤儿文件
      await deleteBackupFile(result.filePath);
      throw error;
    }

    return result;
  }
}

export const backupService = new BackupService();
