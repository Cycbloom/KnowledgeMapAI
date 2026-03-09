export { tasksApi } from "./tasks.js";
export type {
  ScheduledTask,
  TaskType,
  ProgressMode,
  TaskStatus,
  TaskDependency,
  TaskExecution,
  TaskDetail,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
  TaskFilters,
  ExecutionFilters,
  QueueData,
  GenerateTaskDetailsResult,
} from "./tasks.js";

export { queuesApi } from "./queues.js";
export type { Queue, CreateQueueData, UpdateQueueData } from "./queues.js";

export { executionsApi } from "./executions.js";

export { dependenciesApi } from "./dependencies.js";

export { focusApi } from "./focus.js";
export type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
} from "./focus.js";

export { schedulesApi } from "./schedules.js";
export type { TaskSchedule, TaskProgressPlan } from "./schedules.js";

export { settingsApi } from "./settings.js";
export type {
  TaskSettings,
  UpdateTaskSettingsData,
  UserTimeSlot,
} from "./settings.js";

export { subtasksApi } from "./subtasks.js";
export type { TaskSubtask } from "./subtasks.js";

export { linksApi } from "./links.js";
export type { TaskLink, LinkType } from "./links.js";

export { knowledgePointsApi } from "./knowledgePoints.js";
export type { TaskKnowledgePoint } from "./knowledgePoints.js";

export { analyticsApi } from "./analytics.js";
export type { TaskStats, HeatmapData } from "./analytics.js";

export { achievementsApi } from "./achievements.js";
export type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "./achievements.js";

import { tasksApi } from "./tasks.js";
import { queuesApi } from "./queues.js";
import { executionsApi } from "./executions.js";
import { dependenciesApi } from "./dependencies.js";
import { focusApi } from "./focus.js";
import { schedulesApi } from "./schedules.js";
import { settingsApi } from "./settings.js";
import { subtasksApi } from "./subtasks.js";
import { linksApi } from "./links.js";
import { knowledgePointsApi } from "./knowledgePoints.js";
import { analyticsApi } from "./analytics.js";
import { achievementsApi } from "./achievements.js";

export const schedulerApi = {
  ...tasksApi,
  ...queuesApi,
  ...executionsApi,
  ...dependenciesApi,
  ...focusApi,
  ...schedulesApi,
  ...settingsApi,
  ...subtasksApi,
  ...linksApi,
  ...knowledgePointsApi,
  ...analyticsApi,
  ...achievementsApi,
};
