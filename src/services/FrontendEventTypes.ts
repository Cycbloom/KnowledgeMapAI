import type {
  TimerStartedPayload,
  TimerTickPayload,
  TimerPausedPayload,
  TimerResumedPayload,
  TimerCompletedPayload,
  TimerModeChangedPayload,
  TimerSkipToBreakPayload,
  TimerResetPayload,
  TaskStartedPayload,
} from "../../shared/types/events";

export interface SSEStatusChangedPayload {
  status: "connecting" | "connected" | "disconnected" | "error";
  error?: string | null;
}

export interface SSEMessagePayload {
  type: string;
  [key: string]: unknown;
}

export interface SSETaskUpdatePayload {
  taskId: string;
  status: string;
  [key: string]: unknown;
}

export interface SyncStartedPayload {
  timestamp: number;
}

export interface SyncCompletedPayload {
  success: number;
  failed: number;
  conflicts: Array<{
    id: string;
    entity: string;
    localData: Record<string, unknown>;
    remoteData: Record<string, unknown>;
    timestamp: number;
  }>;
}

export interface SyncQueueUpdatedPayload {
  pendingCount: number;
  isOnline?: boolean;
}

export interface SyncErrorPayload {
  error: string;
  timestamp: number;
}

export interface SyncConflictDetectedPayload {
  id: string;
  entity: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  timestamp: number;
}

export interface NotificationNewPayload {
  type: string;
  data?: Record<string, unknown>;
}

export interface SchedulerTaskStatusChangedPayload {
  taskId: string;
  oldStatus: string;
  newStatus: string;
  taskType?: string;
}

export interface SchedulerTaskChangedPayload {
  taskId: string;
  action: "created" | "updated" | "deleted";
}

export interface SchedulerTaskCompletedPayload {
  taskId: string;
  queueLevel?: number;
}

export interface SchedulerStatsChangedPayload {
  reason: string;
}

export interface SchedulerDeadlineApproachingPayload {
  taskId: string;
  taskTitle?: string;
  minutesLeft: number;
}

export interface GraphDataChangedPayload {
  graphId?: string;
  changeType: "node_created" | "node_updated" | "node_deleted" | "edge_created" | "edge_deleted" | "ai_action_executed";
}

export interface GraphListChangedPayload {
  graphId?: string;
  changeType: "graph_created" | "graph_updated" | "graph_deleted" | "graph_restored" | "graph_permanently_deleted" | "graphs_batch_deleted" | "graphs_batch_restored" | "graphs_batch_permanently_deleted";
}

export interface FocusEnterPayload {
  nodeId?: string;
  taskId?: string;
}

export interface FocusExitPayload {
  nodeId?: string;
}

export interface MessageShowPayload {
  id?: string;
  type: "success" | "error" | "warning" | "info" | "loading";
  content: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface MessageHidePayload {
  id?: string;
}

export interface AchievementUnlockedPayload {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface FrontendEventMap extends Record<string, unknown> {
  timer_started: TimerStartedPayload;
  timer_tick: TimerTickPayload;
  timer_paused: TimerPausedPayload;
  timer_resumed: TimerResumedPayload;
  timer_completed: TimerCompletedPayload;
  timer_mode_changed: TimerModeChangedPayload;
  timer_skip_to_break: TimerSkipToBreakPayload;
  timer_reset: TimerResetPayload;
  task_started: TaskStartedPayload;
  sse_status_changed: SSEStatusChangedPayload;
  sse_message: SSEMessagePayload;
  sse_task_update: SSETaskUpdatePayload;
  sse_task_completed: SSEMessagePayload;
  sse_focus_session_ended: SSEMessagePayload;
  sse_review_completed: SSEMessagePayload;
  sse_notification_needed: SSEMessagePayload;
  sync_started: SyncStartedPayload;
  sync_completed: SyncCompletedPayload;
  sync_queue_updated: SyncQueueUpdatedPayload;
  sync_error: SyncErrorPayload;
  sync_conflict_detected: SyncConflictDetectedPayload;
  notification_new: NotificationNewPayload;
  scheduler_task_status_changed: SchedulerTaskStatusChangedPayload;
  scheduler_task_changed: SchedulerTaskChangedPayload;
  scheduler_task_completed: SchedulerTaskCompletedPayload;
  scheduler_stats_changed: SchedulerStatsChangedPayload;
  scheduler_deadline_approaching: SchedulerDeadlineApproachingPayload;
  graph_data_changed: GraphDataChangedPayload;
  graph_list_changed: GraphListChangedPayload;
  focus_enter: FocusEnterPayload;
  focus_exit: FocusExitPayload;
  message_show: MessageShowPayload;
  message_hide: MessageHidePayload;
  achievement_unlocked: AchievementUnlockedPayload;
}
