export { tasksApi } from "./tasks";
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
} from "./tasks";

export { queuesApi } from "./queues";
export type { Queue, CreateQueueData, UpdateQueueData } from "./queues";

export { executionsApi } from "./executions";

export { dependenciesApi } from "./dependencies";

export { focusApi } from "./focus";
export type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
} from "./focus";

export { schedulesApi } from "./schedules";
export type { TaskSchedule, TaskProgressPlan } from "./schedules";

export { settingsApi } from "./settings";
export type {
  TaskSettings,
  UpdateTaskSettingsData,
  UserTimeSlot,
} from "./settings";

export { subtasksApi } from "./subtasks";
export type { TaskSubtask } from "./subtasks";

export { linksApi } from "./links";
export type { TaskLink, LinkType } from "./links";

export { knowledgePointsApi } from "./knowledgePoints";
export type { TaskKnowledgePoint } from "./knowledgePoints";

export { analyticsApi } from "./analytics";
export type { TaskStats, HeatmapData } from "./analytics";

export { achievementsApi } from "./achievements";
export type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "./achievements";

import { tasksApi } from "./tasks";
import { queuesApi } from "./queues";
import { executionsApi } from "./executions";
import { dependenciesApi } from "./dependencies";
import { focusApi } from "./focus";
import { schedulesApi } from "./schedules";
import { settingsApi } from "./settings";
import { subtasksApi } from "./subtasks";
import { linksApi } from "./links";
import { knowledgePointsApi } from "./knowledgePoints";
import { analyticsApi } from "./analytics";
import { achievementsApi } from "./achievements";

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
