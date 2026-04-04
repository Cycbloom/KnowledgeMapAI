import { request } from "../../client";

export interface PathNodeTask {
  id: string;
  path_id: string;
  node_id: string;
  task_id: string;
  user_id: string;
  created_at: string;
}

export interface LearningPathNode {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time?: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: string;
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

export interface BatchConvertResult {
  success: boolean;
  converted_count: number;
  failed_count: number;
  tasks: PathNodeTask[];
  errors: Array<{ node_id: string; error: string }>;
}

export interface PathTaskWithDetails extends PathNodeTask {
  task?: {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    queue_level: number;
    position: number;
    estimated_duration?: number;
    actual_duration?: number;
    deadline?: string;
    status: string;
    tags: string[];
    knowledge_point_id?: string;
    priority: number;
    created_at: string;
    updated_at: string;
  };
  node?: LearningPathNode;
}

export const pathTasksApi = {
  convertNodeToTask: (data: CreatePathNodeTaskData) =>
    request("/scheduler/path-tasks/convert", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  batchConvertNodesToTasks: (pathId: string, nodeIds?: string[]) =>
    request("/scheduler/path-tasks/batch-convert", {
      method: "POST",
      body: JSON.stringify({ path_id: pathId, node_ids: nodeIds }),
    }),

  getPathTasks: (pathId: string) =>
    request(`/scheduler/path-tasks/path/${pathId}`),

  getNodeTask: (nodeId: string) =>
    request(`/scheduler/path-tasks/node/${nodeId}`),

  deletePathTaskAssociation: (nodeId: string, deleteTask: boolean = false) =>
    request(`/scheduler/path-tasks/node/${nodeId}?delete_task=${deleteTask}`, {
      method: "DELETE",
    }),

  deleteAllPathTaskAssociations: (pathId: string, deleteTasks: boolean = false) =>
    request(`/scheduler/path-tasks/path/${pathId}?delete_tasks=${deleteTasks}`, {
      method: "DELETE",
    }),
};
