export { taskStatService } from "./taskStatService";
export { taskExecutionService } from "./taskExecutionService";
export { taskSettingService } from "./taskSettingService";

export { taskService, TaskService } from "./taskService";
export { executionService, ExecutionService } from "./executionService";
export { focusService, FocusService } from "./focusService";
export { statsService, StatsService } from "./statsService";
export { taskSettingsService, TaskSettingsService } from "./taskSettingsService";
export {
  periodicTaskService,
  PeriodicTaskService,
} from "./periodicTaskService";
export {
  taskAnalyticsService,
  TaskAnalyticsService,
} from "./taskAnalyticsService";
export {
  taskRecommendationService,
  TaskRecommendationService,
} from "./taskRecommendationService";
export {
  progressSyncService,
  ProgressSyncService,
} from "./progressSyncService";
export { efficiencyService, EfficiencyService } from "./efficiencyService";
export { reviewTaskService, ReviewTaskService } from "./reviewTaskService";
export { progressPlanService } from "./progressPlanService";
export { scheduleService } from "./scheduleService";
export { templateService } from "./templateService";
export { subtaskService, SubtaskService } from "./subtaskService";
export { taskDependencyService } from "./taskDependencyService";
export { taskKnowledgePointService } from "./taskKnowledgePointService";
export { taskLinkService, TaskLinkService } from "./taskLinkService";
export { timeSlotService } from "./timeSlotService";
export { calendarService } from "./calendarService";

export type {
  UserTask,
  TaskSettings,
  CreateTaskData,
  UserTaskFilters,
} from "./taskService";

export type { TaskExecution, ExecutionFilters } from "./executionService";

export type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
  HeatmapData,
} from "@shared/types/scheduler";

export type { UserTaskSchedulerStats } from "./statsService";

export type {
  PeriodicTask,
  PeriodicPass,
  PassReward,
  UserPassProgress,
} from "./periodicTaskService";

export type {
  TaskRecommendation,
  TimeSlot,
  EfficiencyData,
  RecommendationContext,
  PrioritySuggestion,
} from "./taskRecommendationService";

export type {
  ReviewTask,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "./reviewTaskService";

export type {
  SyncStudyDurationParams,
  SyncTaskCompletionParams,
  KnowledgePointProgress,
  ProgressSyncResult,
  TaskKnowledgePointRelation,
} from "./progressSyncService";

export type {
  HourlyEfficiency,
  TagEfficiencyData,
  QueueEfficiencyData,
  UserEfficiencyProfile,
  TaskCompletionData,
} from "./efficiencyService";

export { pathTaskService, PathTaskService } from "./pathTaskService";
export type {
  PathNodeTask,
  LearningPathNode,
  CreatePathNodeTaskData,
  BatchConvertResult,
  PathTaskWithDetails,
} from "./pathTaskService";

export {
  smartSchedulerService,
  SmartSchedulerService,
} from "./smartSchedulerService";
export type {
  TimeSlotRecommendation,
  MasteryBasedPriority,
  DependencyAwareTask,
  TaskTypeTimeMatch,
  SmartRecommendation,
} from "./smartSchedulerService";

export {
  subtaskQuizIntegrationService,
  SubtaskQuizIntegrationService,
} from "./subtaskQuizIntegration";
export type {
  PracticeSession,
  PracticeResult,
  QuizSession,
  QuizResult,
  PracticeCompletionResult,
  QuizCompletionResult,
} from "./subtaskQuizIntegration";

export {
  adaptiveSchedulerService,
  AdaptiveSchedulerService,
} from "./adaptiveSchedulerService";
export type {
  SchedulerWeights,
  TaskTypeTimeMap,
  AdaptiveRecommendation,
  AdaptiveSchedulerResult,
} from "./adaptiveSchedulerService";
export {
  DEFAULT_SCHEDULER_WEIGHTS,
  DEFAULT_TASK_TYPE_TIME_MAP,
} from "./adaptiveSchedulerService";
export { activityService } from "./activityService";
export type { ActivityType, UserActivity, RecordActivityData, DailyActivityStats } from "./activityService";
export { autoTaskGenerator } from "./autoTaskGenerator";
export type { AutoTaskResult } from "./autoTaskGenerator";
export { smartTaskLinker } from "./smartTaskLinker";
export type { LinkedTaskResult, GraphTaskInfo } from "./smartTaskLinker";
export { systemTaskService, SystemTaskService } from "./systemTaskService";
