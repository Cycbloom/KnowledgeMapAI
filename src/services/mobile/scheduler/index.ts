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
import type { ISchedulerApi } from "../../api/contracts/ISchedulerApi";

/** Creates a stub method that throws NotSupportedError for unimplemented scheduler methods */
function notSupported(methodName: string): (...args: unknown[]) => Promise<never> {
  return () => {
    throw new NotSupportedError(`scheduler.${methodName}`);
  };
}

export const mobileSchedulerApi: ISchedulerApi = {
  // --- ISchedulerTasksApi ---
  create: tasks.create,
  list: tasks.list,
  get: tasks.get,
  getDetail: tasks.getDetail,
  update: tasks.update,
  delete: tasks.deleteTask, // 'delete' is a reserved keyword, cannot be used as export name
  start: tasks.start,
  pause: tasks.pause,
  complete: tasks.complete,
  demote: tasks.demote,
  move: tasks.move,
  reorder: tasks.reorder,
  generateDetails: tasks.generateDetails,
  updateNotes: tasks.updateNotes,
  getSmartRecommendation: tasks.getSmartRecommendation,
  getEfficiencyProfile: notSupported("getEfficiencyProfile"),
  getDynamicPriority: tasks.getDynamicPriority,
  checkDependencies: tasks.checkDependencies,
  updateProgress: notSupported("updateProgress"),
  tickExecution: notSupported("tickExecution"),

  // --- ISchedulerQueuesApi ---
  getQueues: queues.getQueues,
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
  getUserFocusStats: focus.getUserFocusStats,
  getDailyFocusStats: focus.getDailyFocusStats,
  getWeeklyFocusStats: focus.getWeeklyFocusStats,
  getMonthlyFocusStats: focus.getMonthlyFocusStats,
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
  checkAchievements: achievements.checkAchievements,

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
