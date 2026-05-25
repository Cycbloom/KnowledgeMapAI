import type { Graph, Domain, GraphDomain } from './graph';
import type { User } from './user';
import type { UserTask } from './scheduler';

export interface KnowledgeGraphRow {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  user_id?: string | null;
  settings?: Record<string, unknown> | null;
  tags?: string[] | null;
  is_favorite?: boolean;
  is_public?: boolean;
  template_type?: string | null;
  podcast_script?: string | null;
  reference_books?: Record<string, unknown>[] | null;
  external_links?: Record<string, unknown>[] | null;
  learning_guide?: string | null;
  parent_graph_id?: string | null;
  last_used_at?: string | null;
  task_id?: string | null;
  nodes_count?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GraphNodeRow {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyCardRow {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  source_graph_id?: string;
  question: string;
  answer: string;
  explanation?: string | null;
  card_type: string;
  options?: string[] | null;
  correct_indices?: number[] | null;
  last_reviewed?: string | null;
  next_review: string;
  difficulty: number;
  fsrs_state: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_retrievability: number;
  fsrs_last_review?: string | null;
  review_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GraphRelationRow {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: string;
  context?: string | null;
  metadata?: Record<string, unknown> | null;
  confidence?: number;
  source?: string | null;
  shared_concepts?: string[] | null;
  created_at: string;
}

export interface DomainRow {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  parent_id?: string | null;
  sort_order: number;
  user_id?: string | null;
  is_system: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GraphDomainRow {
  id: string;
  graph_id: string;
  domain_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface UserTaskRow {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  queue_id?: string | null;
  queue_level: number;
  position: number;
  estimated_duration?: number | null;
  actual_duration?: number | null;
  deadline?: string | null;
  status: string;
  tags: string[];
  knowledge_point_id?: string | null;
  priority: number;
  task_type: string;
  total_duration?: number | null;
  progress_mode?: string | null;
  progress_percentage: number;
  parent_task_id?: string | null;
  context?: Record<string, unknown> | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  completed_at?: string | null;
}

export interface TaskDependencyRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_at: string;
}

export interface TaskExecutionRow {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string | null;
  duration?: number | null;
  queue_level?: number | null;
  status: string;
}

export interface TaskSubtaskRow {
  id: string;
  task_id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: number;
  position: number;
  estimated_duration?: number | null;
  actual_duration?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  learning_path_node_id?: string | null;
  knowledge_point_id: string;
  learning_state: string;
  mastery_level: number;
  last_state_change_at: string;
  state_history: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export function toGraph(row: KnowledgeGraphRow): Graph {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    domain: row.domain ?? undefined,
    user_id: row.user_id ?? undefined,
    settings: row.settings as Graph['settings'] ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    nodes_count: row.nodes_count ?? undefined,
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
    color: row.color,
    icon: row.icon ?? undefined,
    parent_id: row.parent_id ?? undefined,
    sort_order: row.sort_order,
    user_id: row.user_id ?? undefined,
    is_system: row.is_system,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

export function toGraphDomain(row: GraphDomainRow): GraphDomain {
  return {
    id: row.id,
    graph_id: row.graph_id,
    domain_id: row.domain_id,
    is_primary: row.is_primary,
    created_at: row.created_at,
  };
}

export interface AchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'focus' | 'tasks' | 'streak' | 'special' | 'study' | 'creation';
  icon: string;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  trigger_events: string[];
  created_at: string;
}

export interface UserAchievementRow {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FocusSessionRow {
  id: string;
  user_id: string;
  task_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration?: number | null;
  mode?: string | null;
  completed?: boolean | null;
  pomodoro_count: number;
  white_noise_type?: string | null;
  is_break: boolean;
  created_at: string;
}

export interface PeriodicTaskRow {
  id: string;
  user_id: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  task_type: string;
  target: number;
  progress: number;
  status: 'pending' | 'completed';
  xp_reward: number;
  pass_points: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface UserFocusStatsRow {
  id: string;
  user_id: string;
  total_focus_seconds: number;
  total_sessions: number;
  total_pomodoros: number;
  total_tasks_completed: number;
  current_streak: number;
  longest_streak: number;
  last_focus_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskKnowledgePointRow {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  relevance_score: number;
  is_primary: boolean;
  notes?: string | null;
  created_at: string;
}

export interface TaskLinkRow {
  id: string;
  task_id: string;
  link_type: string;
  title?: string | null;
  url: string;
  description?: string | null;
  icon?: string | null;
  metadata?: Record<string, unknown> | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface QueueRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  time_slice: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface TaskSettingsRow {
  id: string;
  user_id: string;
  q0_time_slice: number;
  q1_time_slice: number;
  q2_time_slice: number;
  break_duration: number;
  sound_enabled: boolean;
  notification_enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserTimeSlotRow {
  id: string;
  user_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  label?: string | null;
  created_at: string;
}

export interface TaskScheduleRow {
  id: string;
  user_id: string;
  task_template_id: string;
  schedule_type: string;
  schedule_config: Record<string, unknown>;
  next_run_at?: string | null;
  last_run_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskProgressPlanRow {
  id: string;
  task_id: string;
  plan_date: string;
  planned_percentage: number;
  actual_percentage: number;
  status: string;
  notes?: string | null;
  created_at: string;
}

export function toUserTask(row: UserTaskRow): UserTask {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    queue_level: row.queue_level,
    position: row.position,
    estimated_duration: row.estimated_duration ?? undefined,
    actual_duration: row.actual_duration ?? undefined,
    deadline: row.deadline ?? undefined,
    status: row.status as UserTask["status"],
    tags: row.tags,
    knowledge_point_id: row.knowledge_point_id ?? undefined,
    priority: row.priority,
    queue_id: row.queue_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    task_type: row.task_type as UserTask["task_type"],
    total_duration: row.total_duration ?? undefined,
    progress_mode: row.progress_mode as UserTask["progress_mode"],
    progress_percentage: row.progress_percentage,
    parent_task_id: row.parent_task_id ?? undefined,
    context: row.context ? JSON.stringify(row.context) : undefined,
  };
}
