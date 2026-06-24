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
  // --- ISchedulerTasksApi (method names aligned with contract) ---
  create: tasks.createTask,
  list: tasks.getTasks,
  get: tasks.getTask,
  getDetail: tasks.getTaskDetail,
  update: tasks.updateTask,
  delete: tasks.deleteTask,
  start: tasks.startTask,
  pause: tasks.pauseTask,
  complete: tasks.completeTask,
  demote: tasks.demoteTask,
  move: tasks.moveTask,
  reorder: tasks.reorderTasks,
  generateDetails: tasks.generateTaskDetails,
  updateNotes: tasks.updateNotes,
  getSmartRecommendation: tasks.getSmartRecommendation,
  getEfficiencyProfile: notSupported("getEfficiencyProfile"),
  getDynamicPriority: tasks.getDynamicPriority,
  checkDependencies: tasks.checkTaskDependencies,
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

  // --- ISchedulerDependenciesApi (adapter: contract uses (taskId, data), mobile uses single data object) ---
  addTaskDependency: (taskId, data) =>
    dependencies.createDependency({ task_id: taskId, ...data }),
  removeTaskDependency: (_taskId, dependencyId) =>
    dependencies.deleteDependency(dependencyId),
  getTaskDependencies: dependencies.getDependencies,
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

  // --- ISchedulerSchedulesApi (adapter: mobile stubs have different param shapes) ---
  createSchedule: (data) => analytics.createSchedule(data as never),
  updateSchedule: analytics.updateSchedule,
  deleteSchedule: analytics.deleteSchedule,
  getSchedules: analytics.getSchedules,
  createProgressPlan: (taskId, data) =>
    analytics.createProgressPlan(taskId, data as never),
  updateProgressPlan: analytics.updateProgressPlan,
  getProgressPlan: analytics.getProgressPlan,
  updateProgressPlanEntry: notSupported("updateProgressPlanEntry"),

  // --- ISchedulerSettingsApi (adapter: createTimeSlot mobile stub expects different shape) ---
  getSettings: settings.getSettings,
  updateSettings: settings.updateSettings,
  getTimeSlots: analytics.getTimeSlots,
  createTimeSlot: (data) => analytics.createTimeSlot(data as never),
  updateTimeSlot: analytics.updateTimeSlot,
  deleteTimeSlot: analytics.deleteTimeSlot,

  // --- ISchedulerSubtasksApi (adapter: contract uses (taskId, subtaskId, data), mobile uses single id) ---
  getSubtasks: subtasks.getSubtasks,
  createSubtask: (taskId, data) =>
    subtasks.createSubtask({ task_id: taskId, ...data }),
  updateSubtask: (_taskId, subtaskId, data) =>
    subtasks.updateSubtask(subtaskId, data),
  deleteSubtask: (_taskId, subtaskId) =>
    subtasks.deleteSubtask(subtaskId),
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
