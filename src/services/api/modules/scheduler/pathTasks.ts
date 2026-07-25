import { requestData } from "../../client";
import type {
  PathNodeTask,
  CreatePathNodeTaskData,
  BatchConvertResult,
  PathTaskWithDetails,
} from "@shared/types";

export type {
  PathNodeTask,
  LearningPathNode,
  CreatePathNodeTaskData,
  BatchConvertResult,
  PathTaskWithDetails,
} from "@shared/types";

export const pathTasksApi = {
  convertNodeToTask: (data: CreatePathNodeTaskData) =>
    requestData<PathNodeTask>("/scheduler/path-tasks/convert", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  batchConvertNodesToTasks: (pathId: string, nodeIds?: string[]) =>
    requestData<BatchConvertResult>("/scheduler/path-tasks/batch-convert", {
      method: "POST",
      body: JSON.stringify({ path_id: pathId, node_ids: nodeIds }),
    }),

  getPathTasks: (pathId: string) =>
    requestData<PathTaskWithDetails[]>(`/scheduler/path-tasks/path/${pathId}`),

  getNodeTask: (nodeId: string) =>
    requestData<PathTaskWithDetails | null>(`/scheduler/path-tasks/node/${nodeId}`),

  deletePathTaskAssociation: (nodeId: string, deleteTask: boolean = false) =>
    requestData<void>(`/scheduler/path-tasks/node/${nodeId}?delete_task=${deleteTask}`, {
      method: "DELETE",
    }),

  deleteAllPathTaskAssociations: (pathId: string, deleteTasks: boolean = false) =>
    requestData<{ deleted_count: number }>(`/scheduler/path-tasks/path/${pathId}?delete_tasks=${deleteTasks}`, {
      method: "DELETE",
    }),
};
