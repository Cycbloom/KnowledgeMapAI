export { taskService, TaskService } from "./taskService";
export { executionService, ExecutionService } from "./executionService";
export { focusService, FocusService } from "./focusService";
export { achievementService, AchievementService } from "./achievementService";
export { statsService, StatsService } from "./statsService";
export { settingsService, SettingsService } from "./settingsService";
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

export type {
  ScheduledTask,
  TaskSettings,
  CreateTaskData,
  TaskFilters,
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
} from "./focusService";

export type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "./achievementService";

export type { SchedulerStats } from "./statsService";

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
