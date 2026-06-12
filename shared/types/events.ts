export type SchedulerEventType =
  | "task_started"
  | "task_paused"
  | "task_resumed"
  | "task_completed"
  | "task_demoted"
  | "task_moved"
  | "focus_session_started"
  | "focus_session_ended"
  | "review_completed"
  | "schedule_executed"
  | "learning_progress_updated";

export type GraphEventType =
  | "graph_created"
  | "graph_updated"
  | "graph_deleted"
  | "node_created"
  | "node_updated"
  | "node_deleted"
  | "edge_created"
  | "edge_updated"
  | "edge_deleted"
  | "graph_rollback"
  | "graph_branch_created"
  | "graph_merged";

export type AIEventType =
  | "ai_task_completed"
  | "ai_task_failed";

export type StudyEventType =
  | "study_session_completed";

export type SystemEventType =
  | "cache_invalidation_needed"
  | "notification_needed";

export type AppEventType =
  | SchedulerEventType
  | GraphEventType
  | AIEventType
  | StudyEventType
  | SystemEventType;

export interface AppEvent<T = unknown> {
  id: string;
  type: AppEventType;
  payload: T;
  userId: string;
  timestamp: string;
  source?: string;
}

export type AppEventHandler = (event: AppEvent) => Promise<void> | void;

export interface TaskStartedPayload {
  taskId: string;
  queueLevel: number;
  knowledgePointId?: string;
}

export interface TaskPausedPayload {
  taskId: string;
  duration: number;
}

export interface TaskResumedPayload {
  taskId: string;
}

export interface TaskCompletedPayload {
  taskId: string;
  queueLevel: number;
  actualDuration?: number;
  knowledgePointId?: string;
  tags: string[];
}

export interface TaskDemotedPayload {
  taskId: string;
  fromQueueLevel: number;
  toQueueLevel: number;
}

export interface TaskMovedPayload {
  taskId: string;
  fromQueueLevel: number;
  toQueueLevel: number;
}

export interface FocusSessionStartedPayload {
  sessionId: string;
  taskId?: string;
}

export interface FocusSessionEndedPayload {
  sessionId: string;
  taskId?: string;
  duration: number;
  pomodoroCount: number;
  isBreak: boolean;
}

export interface ReviewCompletedPayload {
  reviewTaskId: string;
  knowledgePointId: string;
  qualityScore: number;
  nextReviewDate: string;
  algorithm: "sm2" | "fsrs";
}

export interface ScheduleExecutedPayload {
  scheduleId: string;
  scheduleType: string;
  taskCreated?: string;
}

export interface LearningProgressUpdatedPayload {
  knowledgePointId: string;
  masteryLevel: number;
  studyDuration: number;
  source: "task_completion" | "focus_session" | "review";
}

export interface GraphCreatedPayload {
  graphId: string;
  title: string;
  userId: string;
}

export interface GraphUpdatedPayload {
  graphId: string;
  userId: string;
  changes?: Record<string, unknown>;
}

export interface GraphDeletedPayload {
  graphId: string;
  userId: string;
}

export interface NodeCreatedPayload {
  nodeId: string;
  graphId: string;
  userId: string;
  title?: string;
}

export interface NodeUpdatedPayload {
  nodeId: string;
  graphId: string;
  userId: string;
  changes?: Record<string, unknown>;
}

export interface NodeDeletedPayload {
  nodeId: string;
  graphId: string;
  userId: string;
}

export interface EdgeCreatedPayload {
  edgeId: string;
  graphId: string;
  userId: string;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface EdgeUpdatedPayload {
  edgeId: string;
  graphId: string;
  userId: string;
  changes?: Record<string, unknown>;
}

export interface EdgeDeletedPayload {
  edgeId: string;
  graphId: string;
  userId: string;
}

export interface GraphRollbackPayload {
  graphId: string;
  userId: string;
  snapshotId: string;
}

export interface GraphBranchCreatedPayload {
  graphId: string;
  userId: string;
  branchGraphId: string;
  branchName: string;
}

export interface GraphMergedPayload {
  graphId: string;
  userId: string;
  branchGraphId: string;
  conflictCount: number;
}

export interface AITaskCompletedPayload {
  taskId: string;
  taskType: string;
  userId: string;
  graphId?: string;
  result?: unknown;
}

export interface AITaskFailedPayload {
  taskId: string;
  taskType: string;
  userId: string;
  graphId?: string;
  error?: string;
}

export interface StudySessionCompletedPayload {
  userId: string;
  graphId: string;
  duration: number;
  cardsReviewed: number;
}

export interface CacheInvalidationNeededPayload {
  keys: string[];
  tags?: string[];
  userId?: string;
}

export interface NotificationNeededPayload {
  userId: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  cacheKeys?: string[][];
}

export type AppEventPayload =
  | TaskStartedPayload
  | TaskPausedPayload
  | TaskResumedPayload
  | TaskCompletedPayload
  | TaskDemotedPayload
  | TaskMovedPayload
  | FocusSessionStartedPayload
  | FocusSessionEndedPayload
  | ReviewCompletedPayload
  | ScheduleExecutedPayload
  | LearningProgressUpdatedPayload
  | GraphCreatedPayload
  | GraphUpdatedPayload
  | GraphDeletedPayload
  | NodeCreatedPayload
  | NodeUpdatedPayload
  | NodeDeletedPayload
  | EdgeCreatedPayload
  | EdgeUpdatedPayload
  | EdgeDeletedPayload
  | GraphRollbackPayload
  | GraphBranchCreatedPayload
  | GraphMergedPayload
  | AITaskCompletedPayload
  | AITaskFailedPayload
  | StudySessionCompletedPayload
  | CacheInvalidationNeededPayload
  | NotificationNeededPayload;

export type SchedulerEvent<T = unknown> = AppEvent<T>;
export type SchedulerEventHandler = AppEventHandler;
export type SchedulerEventPayload = AppEventPayload;
