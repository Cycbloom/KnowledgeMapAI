// Core types
export type {
  TimerMode,
  TaskType,
  ProgressMode,
  UserTaskStatus,
  ExecutionStatus,
  DependencyType,
  ScheduleType,
  SubtaskStatus,
  LearningState,
  LinkType,
  TaskSource,
  SystemTaskType,
  SystemTaskStatus,
} from "./scheduler-core";

// Task types
export type {
  UserTask,
  SystemTask,
  CreateSystemTaskData,
  Queue,
  CreateQueueData,
  UpdateQueueData,
  TaskDependency,
  TaskSchedule,
  TaskProgressPlan,
  TaskExecution,
  StateHistoryEntry,
  TaskSubtask,
  TaskLink,
  TaskKnowledgePoint,
  UserTaskDetail,
  TaskSettings,
  UpdateTaskSettingsData,
  UserTaskStats,
  HeatmapData,
  UserTimeSlot,
  CreateTaskData,
  UserTaskFilters,
  ExecutionFilters,
  UserTaskSchedulerStats,
  CreateUserTaskData,
  UpdateUserTaskData,
  QueueData,
  GenerateTaskDetailsResult,
} from "./scheduler-task";

// Focus session types
export type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
} from "./scheduler-focus";

// Achievement types
export type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "./scheduler-achievement";

// Legacy (deprecated) types
export type {
  ReviewTask,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "./scheduler-legacy";

// Study types
export type {
  StateTransition,
  LearningStateConfig,
  CreateSubtaskData,
  UpdateSubtaskData,
  TransitionSubtaskData,
  StudyMode,
  StudyWorkflowStage,
  RatingMode,
  StudyWorkflowTransition,
  StudyWorkflowConfig,
  FsrsParamOverride,
  StudyModePreset,
} from "./scheduler-study";

export { LEARNING_STATE_CONFIGS } from "./scheduler-study";

// Re-exports from events
export type {
  SchedulerEventType,
  SchedulerEvent,
  SchedulerEventHandler,
  SchedulerEventPayload,
} from "./events";

export type {
  AppEventType,
  AppEvent,
  AppEventHandler,
  AppEventPayload,
  GraphEventType,
  GraphCreatedPayload,
  GraphUpdatedPayload,
  GraphDeletedPayload,
  NodeCreatedPayload,
  NodeUpdatedPayload,
  NodeDeletedPayload,
  EdgeCreatedPayload,
  EdgeDeletedPayload,
  AIEventType,
  AITaskCompletedPayload,
  AITaskFailedPayload,
  StudyEventType,
  StudySessionCompletedPayload,
  SystemEventType,
  CacheInvalidationNeededPayload,
  NotificationNeededPayload,
} from "./events";

export type {
  TaskStartedPayload,
  TaskPausedPayload,
  TaskResumedPayload,
  TaskCompletedPayload,
  TaskDemotedPayload,
  TaskMovedPayload,
  FocusSessionStartedPayload,
  FocusSessionEndedPayload,
  ReviewCompletedPayload,
  ScheduleExecutedPayload,
  LearningProgressUpdatedPayload,
} from "./events";

// SchedulerEventLog depends on SchedulerEventType from events
import type { SchedulerEventType as SchedulerEventTypeLocal } from "./events";

export interface SchedulerEventLog {
  id: string;
  event_type: SchedulerEventTypeLocal;
  payload: Record<string, unknown>;
  source?: string;
  status: "pending" | "processed" | "failed";
  error_message?: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
}
