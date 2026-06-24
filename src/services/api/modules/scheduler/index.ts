export { studyReviewApi } from "./reviewTasks";
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
  UserTask,
  TaskType,
  ProgressMode,
  UserTaskStatus,
  TaskDependency,
  TaskExecution,
  UserTaskDetail,
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  ExecutionFilters,
  QueueData,
  GenerateTaskDetailsResult,
} from "./tasks";

export type { Queue, CreateQueueData, UpdateQueueData } from "./queues";

export type {
  TaskSettings,
  UpdateTaskSettingsData,
  UserTimeSlot,
} from "./settings";

export type { UserTaskStats, HeatmapData } from "./analytics";

import type { ISchedulerApi } from "../../contracts/ISchedulerApi";
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
import { studyReviewApi } from "./reviewTasks";
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
  ...studyReviewApi,
  ...progressSyncApi,
  ...pathTasksApi,
  ...activitiesApi,
  ...orchestratorApi,
  ...systemTasksApi,
};

// Type assertion to ensure schedulerApi satisfies ISchedulerApi at compile time
export const _schedulerApiTypeCheck: ISchedulerApi = schedulerApi;
