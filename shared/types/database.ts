import type { Graph, Domain, GraphDomain } from './graph';
import type { User } from './user';
import type { UserTask, UserTaskStatus, TaskType, ProgressMode, Achievement } from './scheduler';
import type { Database, Json } from './database.generated';

// ===== Row 类型全部引用 supabase 自动生成的类型 =====
// 保留原类型名作为别名以保持下游引用兼容

export type KnowledgeGraphRow = Database['public']['Tables']['knowledge_graphs']['Row'];
export type GraphNodeRow = Database['public']['Tables']['graph_nodes']['Row'];
export type StudyCardRow = Database['public']['Tables']['study_cards']['Row'];
export type GraphRelationRow = Database['public']['Tables']['graph_relations']['Row'];
export type DomainRow = Database['public']['Tables']['domains']['Row'];
export type GraphDomainRow = Database['public']['Tables']['graph_domains']['Row'];
export type UserTaskRow = Database['public']['Tables']['user_tasks']['Row'];
export type TaskDependencyRow = Database['public']['Tables']['task_dependencies']['Row'];
export type TaskExecutionRow = Database['public']['Tables']['task_executions']['Row'];
export type TaskSubtaskRow = Database['public']['Tables']['task_subtasks']['Row'];
export type AchievementRow = Database['public']['Tables']['achievements']['Row'];
export type UserAchievementRow = Database['public']['Tables']['user_achievements']['Row'];
export type FocusSessionRow = Database['public']['Tables']['focus_sessions']['Row'];
export type PeriodicTaskRow = Database['public']['Tables']['periodic_tasks']['Row'];
export type UserFocusStatsRow = Database['public']['Tables']['user_focus_stats']['Row'];
export type TaskKnowledgePointRow = Database['public']['Tables']['task_knowledge_points']['Row'];
export type TaskLinkRow = Database['public']['Tables']['task_links']['Row'];
export type QueueRow = Database['public']['Tables']['queues']['Row'];
export type TaskSettingsRow = Database['public']['Tables']['task_settings']['Row'];
export type UserTimeSlotRow = Database['public']['Tables']['user_time_slots']['Row'];
export type TaskScheduleRow = Database['public']['Tables']['task_schedules']['Row'];
export type TaskProgressPlanRow = Database['public']['Tables']['task_progress_plans']['Row'];

// ===== 类型守卫：替代 `as` 断言 =====

const USER_TASK_STATUSES: readonly string[] = [
  'pending', 'in_progress', 'paused', 'completed', 'cancelled',
] as const;

const TASK_TYPES: readonly string[] = [
  'one_time', 'long_term', 'periodic', 'learning', 'graph_learning',
] as const;

const PROGRESS_MODES: readonly string[] = [
  'average', 'decreasing', 'increasing', 'custom',
] as const;

function isStringIn<T extends string>(value: string | null | undefined, list: readonly string[]): value is T {
  return value !== null && value !== undefined && list.includes(value);
}

export function isUserTaskStatus(value: string | null | undefined): value is UserTaskStatus {
  return isStringIn(value, USER_TASK_STATUSES);
}

export function isTaskType(value: string | null | undefined): value is TaskType {
  return isStringIn(value, TASK_TYPES);
}

export function isProgressMode(value: string | null | undefined): value is ProgressMode {
  return isStringIn(value, PROGRESS_MODES);
}

/** 将数据库 Row 的 status 转为联合类型，非法值回退为 'pending' */
export function toUserTaskStatus(value: string | null | undefined): UserTaskStatus {
  return isUserTaskStatus(value) ? value : 'pending';
}

/** 将数据库 Row 的 task_type 转为联合类型，非法值回退为 'one_time' */
export function toTaskType(value: string | null | undefined): TaskType {
  return isTaskType(value) ? value : 'one_time';
}

/** 将数据库 Row 的 progress_mode 转为联合类型，非法值回退为 'average' */
export function toProgressMode(value: string | null | undefined): ProgressMode {
  return isProgressMode(value) ? value : 'average';
}

// ===== 转换函数 =====

export function toGraph(row: KnowledgeGraphRow): Graph {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    domain: row.domain ?? undefined,
    user_id: row.user_id ?? undefined,
    settings: validateGraphSettings(row.settings),
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? undefined,
    podcast_script: row.podcast_script ?? undefined,
    is_favorite: row.is_favorite ?? undefined,
  };
}

export function toUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name as string | undefined,
    user_metadata: supabaseUser.user_metadata ? {
      name: supabaseUser.user_metadata.name as string | undefined,
      avatar_url: supabaseUser.user_metadata.avatar_url as string | undefined,
      theme: supabaseUser.user_metadata.theme as string | undefined,
      ...supabaseUser.user_metadata,
    } : undefined,
  };
}

export function toDomain(row: DomainRow): Domain {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color ?? '',
    icon: row.icon ?? undefined,
    parent_id: row.parent_id ?? undefined,
    sort_order: row.sort_order ?? 0,
    user_id: row.user_id ?? undefined,
    is_system: row.is_system ?? false,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? row.created_at ?? '',
  };
}

export function toGraphDomain(row: GraphDomainRow): GraphDomain {
  return {
    id: row.id,
    graph_id: row.graph_id,
    domain_id: row.domain_id,
    is_primary: row.is_primary ?? false,
    created_at: row.created_at ?? '',
  };
}

export function toUserTask(row: UserTaskRow): UserTask {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    queue_level: row.queue_level ?? 0,
    position: row.position,
    estimated_duration: row.estimated_duration ?? undefined,
    actual_duration: row.actual_duration ?? undefined,
    deadline: row.deadline ?? undefined,
    status: toUserTaskStatus(row.status),
    tags: row.tags ?? [],
    knowledge_point_id: row.knowledge_point_id ?? undefined,
    priority: row.priority ?? 0,
    queue_id: row.queue_id ?? undefined,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
    deleted_at: row.deleted_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    task_type: toTaskType(row.task_type),
    total_duration: row.total_duration ?? undefined,
    progress_mode: toProgressMode(row.progress_mode),
    progress_percentage: row.progress_percentage ?? undefined,
    parent_task_id: row.parent_task_id ?? undefined,
    context: row.context ? JSON.stringify(row.context) : undefined,
  };
}

// ===== Graph settings 校验 =====

function validateGraphSettings(raw: Json | null | undefined): Graph['settings'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  // 保守校验：只要满足 settings 的形状即通过，未知字段保留
  return raw as Record<string, unknown> as Graph['settings'];
}

export function toAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    category: row.category as Achievement['category'],
    icon: row.icon ?? '',
    color: row.color ?? '#3B82F6',
    xp_reward: row.xp_reward ?? 0,
    condition_type: row.condition_type,
    condition_value: row.condition_value,
    is_hidden: row.is_hidden ?? false,
    trigger_events: row.trigger_events ?? [],
    created_at: row.created_at ?? '',
  };
}
