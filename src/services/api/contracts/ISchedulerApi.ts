// R31: Public API contract file. The actual `schedulerApi` export has inferred
// return types; this contract is only used for compile-time satisfaction check.
import type {
  LoopsDecision,
  NextStepDecision,
  SmallLoopDecision,
} from "../modules/scheduler/orchestrator";
import type { CalendarScheduleEvent } from "../modules/scheduler/calendarSchedule";
import type {
  StartActivityData,
  AppendActivityData,
} from "../modules/scheduler/executions";
import type {
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  ExecutionFilters,
  CreateQueueData,
  UpdateQueueData,
  CreateReviewTaskData,
  SystemTask,
  CreateSystemTaskData,
  ProgressMode,
  CreateSubtaskData,
  UpdateSubtaskData,
  TransitionSubtaskData,
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
  TaskSchedule,
  TaskProgressPlan,
  TaskSettings,
  UpdateTaskSettingsData,
  UserTimeSlot,
  HeatmapData,
  LearningState,
  UserTask,
  UserTaskDetail,
  TaskExecution,
  TaskDependency,
  Queue,
  QueueData,
  GenerateTaskDetailsResult,
  TaskSubtask,
  TaskLink,
  TaskKnowledgePoint,
  UserTaskStats,
  TaskAnalytics,
  TaskInsightsResult,
  Achievement,
  UserAchievement,
  ReviewTask,
  ReviewTaskStats,
  PendingReviewTask,
  SyncStudyDurationData,
  SyncTaskCompletionData,
  BatchSyncStudyDurationItem,
  ProgressSyncResult,
  TaskProgressSummary,
  BatchSyncStudyDurationResult,
  PathNodeTask,
  CreatePathNodeTaskData,
  BatchConvertResult,
  PathTaskWithDetails,
  ActivityRecord,
  DailyActivityStats,
  RecordActivityData,
  GetActivitiesOptions,
  AutoGenerateTaskData,
  AutoTaskResult,
  LinkedTaskResult,
  GraphTaskInfo,
  LearningLoop,
} from "@shared/types";

// --- Module-local types (not in @shared/types) ---

export interface ValidTransitionsResult {
  current_state: LearningState;
  mastery_level: number;
  valid_transitions: LearningState[];
  recommended_next: LearningState;
}

export interface SystemTaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface TaskRecommendationInfo {
  task: UserTask;
  score: number;
  reasons: string[];
  urgencyLevel: "low" | "medium" | "high" | "critical";
  suggestedTimeSlot?: {
    start: string;
    end: string;
    label: string;
    type: "morning" | "afternoon" | "evening" | "night";
  };
}

export interface SmartRecommendationResult {
  recommendedTask: TaskRecommendationInfo | null;
  alternativeTasks: TaskRecommendationInfo[];
  reasons: string[];
  currentContext: {
    timeSlot: {
      start: string;
      end: string;
      label: string;
      type: "morning" | "afternoon" | "evening" | "night";
    };
    isPeakHour: boolean;
    efficiencyLevel: "high" | "medium" | "low";
  };
}

export interface EfficiencyDataResult {
  hourlyEfficiency: Record<number, number>;
  tagEfficiency: Record<string, { avgDuration: number; completionRate: number }>;
  queueEfficiency: Record<number, { avgDuration: number; completionRate: number }>;
  peakHours: number[];
  lowHours: number[];
}

export interface DynamicPriorityResult {
  score: number;
  factors: Array<{ name: string; impact: number; description: string }>;
}

export interface DependencyCheckResult {
  canStart: boolean;
  blockedBy: Array<{ id: string; title: string; status: string }>;
  softBlockedBy: Array<{ id: string; title: string; status: string }>;
}

// --- Sub-API interfaces ---

export interface ISchedulerTasksApi {
  create: (data: CreateUserTaskData) => Promise<UserTask>;
  list: (filters?: UserTaskFilters) => Promise<UserTask[]>;
  get: (id: string) => Promise<UserTask>;
  getDetail: (id: string) => Promise<UserTaskDetail>;
  update: (id: string, data: UpdateUserTaskData) => Promise<UserTask>;
  delete: (id: string) => Promise<void>;
  start: (id: string) => Promise<{ task: UserTask; execution: TaskExecution }>;
  pause: (id: string) => Promise<{ task: UserTask; duration: number }>;
  complete: (id: string) => Promise<UserTask>;
  demote: (id: string) => Promise<UserTask>;
  move: (id: string, targetQueue: number | string) => Promise<UserTask>;
  reorder: (queueLevel: number, taskIds: string[]) => Promise<void>;
  generateDetails: (title: string, context?: string) => Promise<GenerateTaskDetailsResult>;
  updateNotes: (id: string, notes: string) => Promise<UserTask>;
  getSmartRecommendation: () => Promise<SmartRecommendationResult>;
  getEfficiencyProfile: (days?: number) => Promise<EfficiencyDataResult>;
  getDynamicPriority: (id: string) => Promise<DynamicPriorityResult>;
  checkDependencies: (id: string) => Promise<DependencyCheckResult>;
  updateProgress: (id: string, data: { progress_percentage?: number; actual_duration_add?: number }) => Promise<UserTask>;
  tickExecution: (taskId: string, durationSeconds: number) => Promise<TaskExecution>;
}

export interface ISchedulerQueuesApi {
  getQueues: (options?: { includeCompleted?: boolean; includeCancelled?: boolean }) => Promise<QueueData>;
  createQueue: (data: CreateQueueData) => Promise<Queue>;
  updateQueue: (id: string, data: UpdateQueueData) => Promise<Queue>;
  deleteQueue: (id: string, targetQueueId?: string) => Promise<void>;
  reorderQueues: (queueIds: string[]) => Promise<void>;
}

export interface ISchedulerExecutionsApi {
  getExecutions: (filters?: ExecutionFilters) => Promise<TaskExecution[]>;
  getTaskExecutions: (taskId: string) => Promise<TaskExecution[]>;
  startSession: (data: StartActivityData) => Promise<TaskExecution | null>;
  appendSessionActivity: (data: AppendActivityData) => Promise<TaskExecution>;
  endSession: (executionId: string) => Promise<TaskExecution>;
}

export interface ISchedulerDependenciesApi {
  addTaskDependency: (taskId: string, data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" }) => Promise<TaskDependency>;
  removeTaskDependency: (taskId: string, dependencyId: string) => Promise<void>;
  getTaskDependencies: (taskId: string) => Promise<TaskDependency[]>;
  getTaskDependents: (taskId: string) => Promise<TaskDependency[]>;
}

export interface ISchedulerFocusApi {
  createFocusSession: (data: CreateFocusSessionData) => Promise<FocusSession>;
  updateFocusSession: (id: string, data: Partial<FocusSession>) => Promise<FocusSession>;
  getFocusSessions: (options?: { from_date?: string; to_date?: string; task_id?: string; is_break?: boolean; limit?: number }) => Promise<FocusSession[]>;
  getUserFocusStats: () => Promise<UserFocusStats>;
  getDailyFocusStats: (date?: string) => Promise<DailyFocusStats>;
  getWeeklyFocusStats: (weekStart?: string) => Promise<WeeklyFocusStats>;
  getMonthlyFocusStats: (year?: number, month?: number) => Promise<MonthlyFocusStats>;
  getYearlyHeatmap: (year?: number) => Promise<HeatmapData[]>;
}

export interface ISchedulerSchedulesApi {
  createSchedule: (data: { task_template_id: string; schedule_type: "daily" | "weekly" | "custom" | "smart"; schedule_config?: Record<string, unknown>; is_active?: boolean }) => Promise<TaskSchedule>;
  updateSchedule: (id: string, data: { schedule_config?: Record<string, unknown>; is_active?: boolean }) => Promise<TaskSchedule>;
  deleteSchedule: (id: string) => Promise<void>;
  getSchedules: () => Promise<TaskSchedule[]>;
  createProgressPlan: (taskId: string, data: { start_date: string; end_date: string; progress_mode: ProgressMode; custom_allocations?: Array<{ date: string; percentage: number }> }) => Promise<TaskProgressPlan>;
  updateProgressPlan: (taskId: string, data: { planId?: string; date?: string; planned_percentage?: number; actual_percentage?: number; status?: "pending" | "completed" | "skipped"; notes?: string }) => Promise<TaskProgressPlan>;
  getProgressPlan: (taskId: string) => Promise<TaskProgressPlan[]>;
  updateProgressPlanEntry: (taskId: string, data: { date?: string; percentage: number; notes?: string }) => Promise<TaskProgressPlan>;
}

export interface ISchedulerSettingsApi {
  getSettings: () => Promise<TaskSettings>;
  updateSettings: (data: UpdateTaskSettingsData) => Promise<TaskSettings>;
  getTimeSlots: () => Promise<UserTimeSlot[]>;
  createTimeSlot: (data: { day_of_week?: number; start_time: string; end_time: string; is_available?: boolean; label?: string }) => Promise<UserTimeSlot>;
  updateTimeSlot: (id: string, data: { start_time?: string; end_time?: string; is_available?: boolean; label?: string }) => Promise<UserTimeSlot>;
  deleteTimeSlot: (id: string) => Promise<void>;
}

export interface ISchedulerSubtasksApi {
  getSubtasks: (taskId: string) => Promise<TaskSubtask[]>;
  createSubtask: (taskId: string, data: CreateSubtaskData) => Promise<TaskSubtask>;
  updateSubtask: (taskId: string, subtaskId: string, data: UpdateSubtaskData) => Promise<TaskSubtask>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  transitionSubtask: (taskId: string, subtaskId: string, data: TransitionSubtaskData) => Promise<TaskSubtask>;
  updateMastery: (taskId: string, subtaskId: string, masteryLevel: number) => Promise<TaskSubtask>;
  getValidTransitions: (taskId: string, subtaskId: string) => Promise<ValidTransitionsResult>;
}

export interface ISchedulerLinksApi {
  getLinks: (taskId: string) => Promise<TaskLink[]>;
  createLink: (taskId: string, data: { link_type?: "web" | "file" | "api"; title?: string; url: string; description?: string; icon?: string; metadata?: Record<string, unknown> }) => Promise<TaskLink>;
  getLinkMetadata: (url: string) => Promise<{ title: string; description: string }>;
  updateLink: (taskId: string, linkId: string, data: { title?: string; description?: string; icon?: string; metadata?: Record<string, unknown> }) => Promise<TaskLink>;
  deleteLink: (taskId: string, linkId: string) => Promise<void>;
}

export interface ISchedulerKnowledgePointsApi {
  getTaskKnowledgePoints: (taskId: string) => Promise<TaskKnowledgePoint[]>;
  addTaskKnowledgePoint: (taskId: string, data: { knowledge_point_id: string; relevance_score?: number; is_primary?: boolean; notes?: string }) => Promise<TaskKnowledgePoint>;
  updateTaskKnowledgePoint: (taskId: string, kpId: string, data: { relevance_score?: number; is_primary?: boolean; notes?: string }) => Promise<TaskKnowledgePoint>;
  removeTaskKnowledgePoint: (taskId: string, kpId: string) => Promise<void>;
}

export interface ISchedulerAnalyticsApi {
  getStats: (period?: "day" | "week" | "month" | "year") => Promise<UserTaskStats>;
  getHeatmap: (year?: number, month?: number) => Promise<HeatmapData[]>;
  getTaskAnalytics: () => Promise<TaskAnalytics>;
  generateInsights: () => Promise<TaskInsightsResult>;
}

export interface ISchedulerAchievementsApi {
  getAllAchievements: () => Promise<Achievement[]>;
  getUserAchievements: () => Promise<UserAchievement[]>;
}

export interface ISchedulerStudyReviewApi {
  createFirstReviewTask: (data: CreateReviewTaskData) => Promise<ReviewTask>;
  updateReviewTask: (knowledgePointId: string, data: { quality: number }) => Promise<ReviewTask>;
  getPendingReviewTasks: (limit?: number) => Promise<PendingReviewTask[]>;
  getReviewTaskStats: () => Promise<ReviewTaskStats>;
  getReviewTaskByKnowledgePoint: (knowledgePointId: string) => Promise<ReviewTask | null>;
  deleteReviewTask: (knowledgePointId: string) => Promise<void>;
}

export interface ISchedulerProgressSyncApi {
  syncStudyDuration: (data: SyncStudyDurationData) => Promise<ProgressSyncResult>;
  syncTaskCompletion: (data: SyncTaskCompletionData) => Promise<ProgressSyncResult>;
  getTaskProgressSummary: (taskId: string) => Promise<TaskProgressSummary>;
  batchSyncStudyDuration: (items: BatchSyncStudyDurationItem[]) => Promise<BatchSyncStudyDurationResult>;
}

export interface ISchedulerPathTasksApi {
  convertNodeToTask: (data: CreatePathNodeTaskData) => Promise<PathNodeTask>;
  batchConvertNodesToTasks: (pathId: string, nodeIds?: string[]) => Promise<BatchConvertResult>;
  getPathTasks: (pathId: string) => Promise<PathTaskWithDetails[]>;
  getNodeTask: (nodeId: string) => Promise<PathTaskWithDetails | null>;
  deletePathTaskAssociation: (nodeId: string, deleteTask?: boolean) => Promise<void>;
  deleteAllPathTaskAssociations: (pathId: string, deleteTasks?: boolean) => Promise<{ deleted_count: number }>;
}

export interface ISchedulerActivitiesApi {
  recordActivity: (data: RecordActivityData) => Promise<ActivityRecord>;
  getActivities: (options?: GetActivitiesOptions) => Promise<ActivityRecord[]>;
  getDailyActivities: (date: string) => Promise<ActivityRecord[]>;
  getActivityStats: (startDate: string, endDate: string) => Promise<DailyActivityStats[]>;
  endActivity: (id: string, endedAt?: string, duration?: number) => Promise<ActivityRecord>;
  autoGenerateTask: (data: AutoGenerateTaskData) => Promise<AutoTaskResult>;
  linkTask: (knowledgePointId: string, title?: string, graphId?: string) => Promise<LinkedTaskResult | GraphTaskInfo>;
  linkTaskForGraph: (graphId: string) => Promise<GraphTaskInfo>;
}

export interface ISchedulerOrchestratorApi {
  startLearningLoop: (knowledgePointId?: string, graphId?: string) => Promise<LearningLoop>;
  advanceLearningLoop: (loopId: string) => Promise<LearningLoop>;
  getActiveLearningLoop: (knowledgePointId?: string) => Promise<LearningLoop | null>;
  startLearningWithTask: (knowledgePointId: string, graphId?: string) => Promise<LearningLoop | null>;
  getNextStep: (overdueThreshold?: number) => Promise<NextStepDecision>;
  getLoops: (overdueThreshold?: number) => Promise<LoopsDecision>;
  getReviewInterrupt: () => Promise<{ overdueCount: number; shouldInterrupt: boolean }>;
  getNextActionForTask: (taskId: string) => Promise<{ action: (SmallLoopDecision["nextAction"] & { graphId?: string; url?: string; taskTitle?: string }) | null }>;
}

export interface ISchedulerSystemTasksApi {
  getSystemTasks: (options?: { status?: string; limit?: number }) => Promise<SystemTask[]>;
  createSystemTask: (data: CreateSystemTaskData) => Promise<SystemTask>;
  retrySystemTask: (id: string) => Promise<SystemTask>;
  cancelSystemTask: (id: string) => Promise<SystemTask>;
  getSystemTaskStats: () => Promise<SystemTaskStats>;
}

export interface ISchedulerCalendarScheduleApi {
  getScheduleEvents: (
    start?: string,
    end?: string,
  ) => Promise<CalendarScheduleEvent[]>;
}

// --- Combined type ---

export type ISchedulerApi = ISchedulerTasksApi &
  ISchedulerQueuesApi &
  ISchedulerExecutionsApi &
  ISchedulerDependenciesApi &
  ISchedulerFocusApi &
  ISchedulerSchedulesApi &
  ISchedulerSettingsApi &
  ISchedulerSubtasksApi &
  ISchedulerLinksApi &
  ISchedulerKnowledgePointsApi &
  ISchedulerAnalyticsApi &
  ISchedulerAchievementsApi &
  ISchedulerStudyReviewApi &
  ISchedulerProgressSyncApi &
  ISchedulerPathTasksApi &
  ISchedulerActivitiesApi &
  ISchedulerOrchestratorApi &
  ISchedulerSystemTasksApi &
  ISchedulerCalendarScheduleApi;
