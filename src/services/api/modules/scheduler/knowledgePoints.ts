import { request } from "../../client.js";

export interface TaskKnowledgePoint {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  relevance_score: number;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  knowledge_point?: {
    id: string;
    title: string;
    content?: string;
    visibility?: string;
    owner_id?: string;
  };
}

export const knowledgePointsApi = {
  getTaskKnowledgePoints: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points`),

  addTaskKnowledgePoint: (
    taskId: string,
    data: {
      knowledge_point_id: string;
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTaskKnowledgePoint: (
    taskId: string,
    kpId: string,
    data: {
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points/${kpId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  removeTaskKnowledgePoint: (taskId: string, kpId: string) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points/${kpId}`, {
      method: "DELETE",
    }),
};
