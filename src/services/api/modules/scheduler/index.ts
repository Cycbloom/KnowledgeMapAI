export { reviewTasksApi } from "./reviewTasks";
export type {
  ReviewTask,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "./reviewTasks";

export { progressSyncApi } from "./progressSync";
export type {
  SyncStudyDurationData,
  SyncTaskCompletionData,
  BatchSyncStudyDurationItem,
  TaskProgressSummary,
} from "./progressSync";
export { pathTasksApi } from "./pathTasks";
export type {
  PathNodeTask,
  LearningPathNode,
  CreatePathNodeTaskData,
  BatchConvertResult,
  PathTaskWithDetails,
} from "./pathTasks";

export { activitiesApi } from "./activities";
export type {
  RecordActivityData,
  GetActivitiesOptions,
  AutoGenerateTaskData,
} from "./activities";

export { orchestratorApi } from "./orchestrator";

export { systemTasksApi } from "./systemTasks";
export type {
  SystemTask,
  CreateSystemTaskData,
  GetSystemTasksOptions,
  SystemTaskStats,
} from "./systemTasks";

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

export type { Queue, CreateQueueData, UpdateQueueData } from "./queues";

export type { TaskSettings, UpdateTaskSettingsData, UserTimeSlot } from "./settings";

export type { TaskStats, HeatmapData } from "./analytics";

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
import { reviewTasksApi } from "./reviewTasks";
import { progressSyncApi } from "./progressSync";
import { pathTasksApi } from "./pathTasks";
import { activitiesApi } from "./activities";
import { orchestratorApi } from "./orchestrator";
import { systemTasksApi } from "./systemTasks";

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
  ...reviewTasksApi,
  ...progressSyncApi,
  ...pathTasksApi,
  ...activitiesApi,
  ...orchestratorApi,
  ...systemTasksApi,
};
