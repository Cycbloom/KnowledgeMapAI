import * as tasks from "./tasks";
import * as queues from "./queues";
import * as executions from "./executions";
import * as settings from "./settings";
import * as stats from "./stats";
import * as focus from "./focus";
import * as achievements from "./achievements";
import * as subtasks from "./subtasks";
import * as dependencies from "./dependencies";
import * as links from "./links";
import * as knowledgePoints from "./knowledgePoints";
import * as analytics from "./analytics";
import { NotSupportedError } from "../../api/contracts/types";
import type {
  ISchedulerApi,
  SmartRecommendationResult,
  DynamicPriorityResult,
  DependencyCheckResult,
  TaskRecommendationInfo,
} from "../../api/contracts/ISchedulerApi";
import type {
  UserTask,
  TaskExecution,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
} from "@shared/types";

/** Creates a stub method that throws NotSupportedError for unimplemented scheduler methods */
function notSupported(methodName: string): (...args: unknown[]) => Promise<never> {
  return () => {
    throw new NotSupportedError(`scheduler.${methodName}`);
  };
}

// --- Mobile adapters ---
// Mobile implementations are simplified versions of the web API and don't track
// executions, duration, or full recommendation context. These adapters wrap the
// mobile functions to produce contract-compliant shapes with reasonable defaults.

/** Wraps mobile tasks.start to return { task, execution } per contract. */
async function startAdapter(
  id: string,
): Promise<{ task: UserTask; execution: TaskExecution }> {
  const task = await tasks.start(id);
  const execution: TaskExecution = {
    id: `mobile-exec-${id}-${Date.now()}`,
    task_id: id,
    user_id: task.user_id,
    started_at: new Date().toISOString(),
    queue_level: task.queue_level,
    status: "completed",
  };
  return { task, execution };
}

/** Wraps mobile tasks.pause to return { task, duration } per contract. */
async function pauseAdapter(
  id: string,
): Promise<{ task: UserTask; duration: number }> {
  const task = await tasks.pause(id);
  return { task, duration: 0 };
}

/** Returns the current time slot based on local hour. */
function getCurrentTimeSlot(): {
  start: string;
  end: string;
  label: string;
  type: "morning" | "afternoon" | "evening" | "night";
} {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    return { start: "06:00", end: "12:00", label: "Morning", type: "morning" };
  }
  if (hour >= 12 && hour < 18) {
    return { start: "12:00", end: "18:00", label: "Afternoon", type: "afternoon" };
  }
  if (hour >= 18 && hour < 22) {
    return { start: "18:00", end: "22:00", label: "Evening", type: "evening" };
  }
  return { start: "22:00", end: "06:00", label: "Night", type: "night" };
}

/** Wraps mobile tasks.getSmartRecommendation to return SmartRecommendationResult per contract. */
async function getSmartRecommendationAdapter(): Promise<SmartRecommendationResult> {
  const result = await tasks.getSmartRecommendation();
  const timeSlot = getCurrentTimeSlot();
  const recommendedTask: TaskRecommendationInfo | null = result.task
    ? {
        task: result.task,
        score: 0,
        reasons: [result.reason],
        urgencyLevel: "low",
        suggestedTimeSlot: timeSlot,
      }
    : null;
  return {
    recommendedTask,
    alternativeTasks: [],
    reasons: [result.reason],
    currentContext: {
      timeSlot,
      isPeakHour: false,
      efficiencyLevel: "medium",
    },
  };
}

/** Wraps mobile tasks.getDynamicPriority to return DynamicPriorityResult per contract. */
async function getDynamicPriorityAdapter(
  taskId: string,
): Promise<DynamicPriorityResult> {
  const result = await tasks.getDynamicPriority(taskId);
  return {
    score: result.priority,
    factors: Object.entries(result.factors).map(([name, impact]) => ({
      name,
      impact,
      description: "",
    })),
  };
}

/** Wraps mobile tasks.checkDependencies to return DependencyCheckResult per contract. */
async function checkDependenciesAdapter(
  taskId: string,
): Promise<DependencyCheckResult> {
  const result = await tasks.checkDependencies(taskId);
  return {
    canStart: result.can_start,
    blockedBy: result.blocked_by,
    softBlockedBy: [],
  };
}

/** Wraps mobile focus.getUserFocusStats to return UserFocusStats (non-null) per contract. */
async function getUserFocusStatsAdapter(): Promise<UserFocusStats> {
  return (await focus.getUserFocusStats()) ?? ({} as UserFocusStats);
}

/** Wraps mobile focus.getDailyFocusStats to return DailyFocusStats (singular) per contract. */
async function getDailyFocusStatsAdapter(_date?: string): Promise<DailyFocusStats> {
  return (await focus.getDailyFocusStats())[0] ?? ({} as DailyFocusStats);
}

/** Wraps mobile focus.getWeeklyFocusStats to return WeeklyFocusStats (singular) per contract. */
async function getWeeklyFocusStatsAdapter(_weekStart?: string): Promise<WeeklyFocusStats> {
  return (await focus.getWeeklyFocusStats())[0] ?? ({} as WeeklyFocusStats);
}

/** Wraps mobile focus.getMonthlyFocusStats to return MonthlyFocusStats (singular) per contract. */
async function getMonthlyFocusStatsAdapter(_year?: number, _month?: number): Promise<MonthlyFocusStats> {
  return (await focus.getMonthlyFocusStats())[0] ?? ({} as MonthlyFocusStats);
}

export const mobileSchedulerApi: ISchedulerApi = {
  // --- ISchedulerTasksApi ---
  create: tasks.create,
  list: tasks.list,
  get: tasks.get,
  getDetail: tasks.getDetail,
  update: tasks.update,
  delete: tasks.deleteTask, // 'delete' is a reserved keyword, cannot be used as export name
  start: startAdapter,
  pause: pauseAdapter,
  complete: tasks.complete,
  demote: tasks.demote,
  move: tasks.move,
  reorder: tasks.reorder,
  generateDetails: tasks.generateDetails,
  updateNotes: tasks.updateNotes,
  getSmartRecommendation: getSmartRecommendationAdapter,
  getEfficiencyProfile: notSupported("getEfficiencyProfile"),
  getDynamicPriority: getDynamicPriorityAdapter,
  checkDependencies: checkDependenciesAdapter,
  updateProgress: notSupported("updateProgress"),
  tickExecution: notSupported("tickExecution"),

  // --- ISchedulerQueuesApi ---
  // Mobile getQueues returns Queue[] (queue definitions), but contract expects
  // QueueData (tasks grouped by queue level). Use getQueueData which returns the
  // correct shape; options param is accepted but ignored on mobile.
  getQueues: (_options?: { includeCompleted?: boolean; includeCancelled?: boolean }) =>
    queues.getQueueData(),
  createQueue: queues.createQueue,
  updateQueue: queues.updateQueue,
  deleteQueue: queues.deleteQueue,
  reorderQueues: notSupported("reorderQueues"),

  // --- ISchedulerExecutionsApi ---
  getExecutions: executions.getExecutions,
  getTaskExecutions: notSupported("getTaskExecutions"),

  // --- ISchedulerDependenciesApi ---
  addTaskDependency: dependencies.addTaskDependency,
  removeTaskDependency: dependencies.removeTaskDependency,
  getTaskDependencies: dependencies.getTaskDependencies,
  getTaskDependents: notSupported("getTaskDependents"),

  // --- ISchedulerFocusApi ---
  createFocusSession: focus.createFocusSession,
  updateFocusSession: focus.updateFocusSession,
  getFocusSessions: focus.getFocusSessions,
  getUserFocusStats: getUserFocusStatsAdapter,
  getDailyFocusStats: getDailyFocusStatsAdapter,
  getWeeklyFocusStats: getWeeklyFocusStatsAdapter,
  getMonthlyFocusStats: getMonthlyFocusStatsAdapter,
  getYearlyHeatmap: analytics.getYearlyHeatmap,

  // --- ISchedulerSchedulesApi ---
  createSchedule: analytics.createSchedule,
  updateSchedule: analytics.updateSchedule,
  deleteSchedule: analytics.deleteSchedule,
  getSchedules: analytics.getSchedules,
  createProgressPlan: analytics.createProgressPlan,
  updateProgressPlan: analytics.updateProgressPlan,
  getProgressPlan: analytics.getProgressPlan,
  updateProgressPlanEntry: notSupported("updateProgressPlanEntry"),

  // --- ISchedulerSettingsApi ---
  getSettings: settings.getSettings,
  updateSettings: settings.updateSettings,
  getTimeSlots: analytics.getTimeSlots,
  createTimeSlot: analytics.createTimeSlot,
  updateTimeSlot: analytics.updateTimeSlot,
  deleteTimeSlot: analytics.deleteTimeSlot,

  // --- ISchedulerSubtasksApi ---
  getSubtasks: subtasks.getSubtasks,
  createSubtask: subtasks.createSubtask,
  updateSubtask: subtasks.updateSubtask,
  deleteSubtask: subtasks.deleteSubtask,
  transitionSubtask: notSupported("transitionSubtask"),
  updateMastery: notSupported("updateMastery"),
  getValidTransitions: notSupported("getValidTransitions"),

  // --- ISchedulerLinksApi ---
  getLinks: links.getLinks,
  createLink: links.createLink,
  updateLink: links.updateLink,
  deleteLink: links.deleteLink,

  // --- ISchedulerKnowledgePointsApi ---
  getTaskKnowledgePoints: knowledgePoints.getTaskKnowledgePoints,
  addTaskKnowledgePoint: knowledgePoints.addTaskKnowledgePoint,
  updateTaskKnowledgePoint: knowledgePoints.updateTaskKnowledgePoint,
  removeTaskKnowledgePoint: knowledgePoints.removeTaskKnowledgePoint,

  // --- ISchedulerAnalyticsApi ---
  getStats: stats.getStats,
  getHeatmap: stats.getHeatmap,
  getTaskAnalytics: analytics.getTaskAnalytics,
  generateInsights: analytics.generateInsights,

  // --- ISchedulerAchievementsApi ---
  getAllAchievements: achievements.getAllAchievements,
  getUserAchievements: achievements.getUserAchievements,

  // --- ISchedulerStudyReviewApi (entirely not supported on mobile) ---
  createFirstReviewTask: notSupported("createFirstReviewTask"),
  updateReviewTask: notSupported("updateReviewTask"),
  getPendingReviewTasks: notSupported("getPendingReviewTasks"),
  getReviewTaskStats: notSupported("getReviewTaskStats"),
  getReviewTaskByKnowledgePoint: notSupported("getReviewTaskByKnowledgePoint"),
  deleteReviewTask: notSupported("deleteReviewTask"),

  // --- ISchedulerProgressSyncApi (entirely not supported on mobile) ---
  syncStudyDuration: notSupported("syncStudyDuration"),
  syncTaskCompletion: notSupported("syncTaskCompletion"),
  getTaskProgressSummary: notSupported("getTaskProgressSummary"),
  batchSyncStudyDuration: notSupported("batchSyncStudyDuration"),

  // --- ISchedulerPathTasksApi (entirely not supported on mobile) ---
  convertNodeToTask: notSupported("convertNodeToTask"),
  batchConvertNodesToTasks: notSupported("batchConvertNodesToTasks"),
  getPathTasks: notSupported("getPathTasks"),
  getNodeTask: notSupported("getNodeTask"),
  deletePathTaskAssociation: notSupported("deletePathTaskAssociation"),
  deleteAllPathTaskAssociations: notSupported("deleteAllPathTaskAssociations"),

  // --- ISchedulerActivitiesApi (entirely not supported on mobile) ---
  recordActivity: notSupported("recordActivity"),
  getActivities: notSupported("getActivities"),
  getDailyActivities: notSupported("getDailyActivities"),
  getActivityStats: notSupported("getActivityStats"),
  endActivity: notSupported("endActivity"),
  autoGenerateTask: notSupported("autoGenerateTask"),
  linkTask: notSupported("linkTask"),
  linkTaskForGraph: notSupported("linkTaskForGraph"),

  // --- ISchedulerOrchestratorApi (entirely not supported on mobile) ---
  startLearningLoop: notSupported("startLearningLoop"),
  advanceLearningLoop: notSupported("advanceLearningLoop"),
  getActiveLearningLoop: notSupported("getActiveLearningLoop"),
  startLearningWithTask: notSupported("startLearningWithTask"),

  // --- ISchedulerSystemTasksApi (entirely not supported on mobile) ---
  getSystemTasks: notSupported("getSystemTasks"),
  createSystemTask: notSupported("createSystemTask"),
  retrySystemTask: notSupported("retrySystemTask"),
  cancelSystemTask: notSupported("cancelSystemTask"),
  getSystemTaskStats: notSupported("getSystemTaskStats"),
};
