/* eslint-disable @typescript-eslint/no-explicit-any */
// R31: Public API contract file. The actual `schedulerApi` export has inferred
// return types; this contract is only used for compile-time satisfaction check.
import type {
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  ExecutionFilters,
  CreateQueueData,
  UpdateQueueData,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  SystemTask,
  CreateSystemTaskData,
  ProgressMode,
  CreateSubtaskData,
  UpdateSubtaskData,
  TransitionSubtaskData,
  FocusSession,
  CreateFocusSessionData,
  UpdateTaskSettingsData,
  LearningState,
} from "@shared/types";

// --- Module-local types (not in @shared/types) ---

export interface ValidTransitionsResult {
  current_state: LearningState;
  mastery_level: number;
  valid_transitions: LearningState[];
  recommended_next: LearningState;
}

export interface SyncStudyDurationData {
  taskId: string;
  duration: number;
  date?: string;
}

export interface SyncTaskCompletionData {
  taskId: string;
  completed: boolean;
  completedAt?: string;
}

export interface BatchSyncStudyDurationItem {
  taskId: string;
  duration: number;
  date?: string;
}

export interface CreatePathNodeTaskData {
  path_id: string;
  node_id: string;
  title?: string;
  description?: string;
  estimated_duration?: number;
  knowledge_point_id?: string;
  priority?: number;
}

export type ActivityEventType = "focus_study" | "review" | "path_progress";

export interface RecordActivityData {
  activity_type: ActivityEventType;
  title: string;
  description?: string;
  started_at?: string;
  ended_at?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  knowledge_point_id?: string;
  graph_id?: string;
  task_id?: string;
}

export interface GetActivitiesOptions {
  from_date?: string;
  to_date?: string;
  activity_type?: ActivityEventType;
  knowledge_point_id?: string;
  graph_id?: string;
  limit?: number;
  offset?: number;
}

export interface AutoGenerateTaskData {
  type: "focus_study" | "review" | "path_progress";
  knowledge_point_id: string;
  graph_id?: string;
  path_node_id?: string;
  parent_task_id?: string;
  title?: string;
  interval_days?: number;
  estimated_time?: number;
}

export interface SystemTaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// --- Sub-API interfaces ---

export interface ISchedulerTasksApi {
  create: (data: CreateUserTaskData) => Promise<any>;
  list: (filters?: UserTaskFilters) => Promise<any>;
  get: (id: string) => Promise<any>;
  getDetail: (id: string) => Promise<any>;
  update: (id: string, data: UpdateUserTaskData) => Promise<any>;
  delete: (id: string) => Promise<any>;
  start: (id: string) => Promise<any>;
  pause: (id: string) => Promise<any>;
  complete: (id: string) => Promise<any>;
  demote: (id: string) => Promise<any>;
  move: (id: string, targetQueue: number | string) => Promise<any>;
  reorder: (queueLevel: number, taskIds: string[]) => Promise<any>;
  generateDetails: (title: string, context?: string) => Promise<any>;
  updateNotes: (id: string, notes: string) => Promise<any>;
  getSmartRecommendation: () => Promise<any>;
  getEfficiencyProfile: (days?: number) => Promise<any>;
  getDynamicPriority: (id: string) => Promise<any>;
  checkDependencies: (id: string) => Promise<any>;
  updateProgress: (id: string, data: { progress_percentage?: number; actual_duration_add?: number }) => Promise<any>;
  tickExecution: (taskId: string, durationSeconds: number) => Promise<any>;
}

export interface ISchedulerQueuesApi {
  getQueues: (options?: { includeCompleted?: boolean; includeCancelled?: boolean }) => Promise<any>;
  createQueue: (data: CreateQueueData) => Promise<any>;
  updateQueue: (id: string, data: UpdateQueueData) => Promise<any>;
  deleteQueue: (id: string, targetQueueId?: string) => Promise<any>;
  reorderQueues: (queueIds: string[]) => Promise<any>;
}

export interface ISchedulerExecutionsApi {
  getExecutions: (filters?: ExecutionFilters) => Promise<any>;
  getTaskExecutions: (taskId: string) => Promise<any>;
}

export interface ISchedulerDependenciesApi {
  addTaskDependency: (taskId: string, data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" }) => Promise<any>;
  removeTaskDependency: (taskId: string, dependencyId: string) => Promise<any>;
  getTaskDependencies: (taskId: string) => Promise<any>;
  getTaskDependents: (taskId: string) => Promise<any>;
}

export interface ISchedulerFocusApi {
  createFocusSession: (data: CreateFocusSessionData) => Promise<any>;
  updateFocusSession: (id: string, data: Partial<FocusSession>) => Promise<any>;
  getFocusSessions: (options?: { from_date?: string; to_date?: string; task_id?: string; is_break?: boolean; limit?: number }) => Promise<any>;
  getUserFocusStats: () => Promise<any>;
  getDailyFocusStats: (date?: string) => Promise<any>;
  getWeeklyFocusStats: (weekStart?: string) => Promise<any>;
  getMonthlyFocusStats: (year?: number, month?: number) => Promise<any>;
  getYearlyHeatmap: (year?: number) => Promise<any>;
}

export interface ISchedulerSchedulesApi {
  createSchedule: (data: { task_template_id: string; schedule_type: "daily" | "weekly" | "custom" | "smart"; schedule_config?: Record<string, unknown>; is_active?: boolean }) => Promise<any>;
  updateSchedule: (id: string, data: { schedule_config?: Record<string, unknown>; is_active?: boolean }) => Promise<any>;
  deleteSchedule: (id: string) => Promise<any>;
  getSchedules: () => Promise<any>;
  createProgressPlan: (taskId: string, data: { start_date: string; end_date: string; progress_mode: ProgressMode; custom_allocations?: Array<{ date: string; percentage: number }> }) => Promise<any>;
  updateProgressPlan: (taskId: string, data: { planId?: string; date?: string; planned_percentage?: number; actual_percentage?: number; status?: "pending" | "completed" | "skipped"; notes?: string }) => Promise<any>;
  getProgressPlan: (taskId: string) => Promise<any>;
  updateProgressPlanEntry: (taskId: string, data: { date?: string; percentage: number; notes?: string }) => Promise<any>;
}

export interface ISchedulerSettingsApi {
  getSettings: () => Promise<any>;
  updateSettings: (data: UpdateTaskSettingsData) => Promise<any>;
  getTimeSlots: () => Promise<any>;
  createTimeSlot: (data: { day_of_week?: number; start_time: string; end_time: string; is_available?: boolean; label?: string }) => Promise<any>;
  updateTimeSlot: (id: string, data: { start_time?: string; end_time?: string; is_available?: boolean; label?: string }) => Promise<any>;
  deleteTimeSlot: (id: string) => Promise<any>;
}

export interface ISchedulerSubtasksApi {
  getSubtasks: (taskId: string) => Promise<any>;
  createSubtask: (taskId: string, data: CreateSubtaskData) => Promise<any>;
  updateSubtask: (taskId: string, subtaskId: string, data: UpdateSubtaskData) => Promise<any>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<any>;
  transitionSubtask: (taskId: string, subtaskId: string, data: TransitionSubtaskData) => Promise<any>;
  updateMastery: (taskId: string, subtaskId: string, masteryLevel: number) => Promise<any>;
  getValidTransitions: (taskId: string, subtaskId: string) => Promise<{ success: boolean; data: ValidTransitionsResult }>;
}

export interface ISchedulerLinksApi {
  getLinks: (taskId: string) => Promise<any>;
  createLink: (taskId: string, data: { link_type?: "web" | "file" | "api"; title?: string; url: string; description?: string; icon?: string; metadata?: Record<string, unknown> }) => Promise<any>;
  updateLink: (taskId: string, linkId: string, data: { title?: string; description?: string; icon?: string; metadata?: Record<string, unknown> }) => Promise<any>;
  deleteLink: (taskId: string, linkId: string) => Promise<any>;
}

export interface ISchedulerKnowledgePointsApi {
  getTaskKnowledgePoints: (taskId: string) => Promise<any>;
  addTaskKnowledgePoint: (taskId: string, data: { knowledge_point_id: string; relevance_score?: number; is_primary?: boolean; notes?: string }) => Promise<any>;
  updateTaskKnowledgePoint: (taskId: string, kpId: string, data: { relevance_score?: number; is_primary?: boolean; notes?: string }) => Promise<any>;
  removeTaskKnowledgePoint: (taskId: string, kpId: string) => Promise<any>;
}

export interface ISchedulerAnalyticsApi {
  getStats: (period?: "day" | "week" | "month" | "year") => Promise<any>;
  getHeatmap: (year?: number, month?: number) => Promise<any>;
  getTaskAnalytics: () => Promise<any>;
  generateInsights: () => Promise<any>;
}

export interface ISchedulerAchievementsApi {
  getAllAchievements: () => Promise<any>;
  getUserAchievements: () => Promise<any>;
  checkAchievements: () => Promise<any>;
}

export interface ISchedulerStudyReviewApi {
  createFirstReviewTask: (data: CreateReviewTaskData) => Promise<any>;
  updateReviewTask: (knowledgePointId: string, data: UpdateReviewTaskData) => Promise<any>;
  getPendingReviewTasks: (limit?: number) => Promise<any>;
  getReviewTaskStats: () => Promise<any>;
  getReviewTaskByKnowledgePoint: (knowledgePointId: string) => Promise<any>;
  deleteReviewTask: (knowledgePointId: string) => Promise<any>;
}

export interface ISchedulerProgressSyncApi {
  syncStudyDuration: (data: SyncStudyDurationData) => Promise<any>;
  syncTaskCompletion: (data: SyncTaskCompletionData) => Promise<any>;
  getTaskProgressSummary: (taskId: string) => Promise<any>;
  batchSyncStudyDuration: (items: BatchSyncStudyDurationItem[]) => Promise<any>;
}

export interface ISchedulerPathTasksApi {
  convertNodeToTask: (data: CreatePathNodeTaskData) => Promise<any>;
  batchConvertNodesToTasks: (pathId: string, nodeIds?: string[]) => Promise<any>;
  getPathTasks: (pathId: string) => Promise<any>;
  getNodeTask: (nodeId: string) => Promise<any>;
  deletePathTaskAssociation: (nodeId: string, deleteTask?: boolean) => Promise<any>;
  deleteAllPathTaskAssociations: (pathId: string, deleteTasks?: boolean) => Promise<any>;
}

export interface ISchedulerActivitiesApi {
  recordActivity: (data: RecordActivityData) => Promise<any>;
  getActivities: (options?: GetActivitiesOptions) => Promise<any>;
  getDailyActivities: (date: string) => Promise<any>;
  getActivityStats: (startDate: string, endDate: string) => Promise<any>;
  endActivity: (id: string, endedAt?: string, duration?: number) => Promise<any>;
  autoGenerateTask: (data: AutoGenerateTaskData) => Promise<any>;
  linkTask: (knowledgePointId: string, title?: string, graphId?: string) => Promise<any>;
  linkTaskForGraph: (graphId: string) => Promise<any>;
}

export interface ISchedulerOrchestratorApi {
  startLearningLoop: (knowledgePointId?: string, graphId?: string) => Promise<any>;
  advanceLearningLoop: (loopId: string) => Promise<any>;
  getActiveLearningLoop: (knowledgePointId?: string) => Promise<any>;
  startLearningWithTask: (knowledgePointId: string, graphId?: string) => Promise<any>;
}

export interface ISchedulerSystemTasksApi {
  getSystemTasks: (options?: { status?: string; limit?: number }) => Promise<SystemTask[]>;
  createSystemTask: (data: CreateSystemTaskData) => Promise<SystemTask>;
  retrySystemTask: (id: string) => Promise<SystemTask>;
  cancelSystemTask: (id: string) => Promise<SystemTask>;
  getSystemTaskStats: () => Promise<SystemTaskStats>;
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
  ISchedulerSystemTasksApi;
