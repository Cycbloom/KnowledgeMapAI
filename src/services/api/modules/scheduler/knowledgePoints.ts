import { requestData } from "../../client";
import type { TaskKnowledgePoint } from "@shared/types";

// Re-export for backwards compatibility with existing imports.
export type { TaskKnowledgePoint };

export const knowledgePointsApi = {
  getTaskKnowledgePoints: (taskId: string): Promise<TaskKnowledgePoint[]> =>
    requestData<TaskKnowledgePoint[]>(
      `/scheduler/tasks/${taskId}/knowledge-points`,
    ),

  addTaskKnowledgePoint: (
    taskId: string,
    data: {
      knowledge_point_id: string;
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    },
  ): Promise<TaskKnowledgePoint> =>
    requestData<TaskKnowledgePoint>(
      `/scheduler/tasks/${taskId}/knowledge-points`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  updateTaskKnowledgePoint: (
    taskId: string,
    kpId: string,
    data: {
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    },
  ): Promise<TaskKnowledgePoint> =>
    requestData<TaskKnowledgePoint>(
      `/scheduler/tasks/${taskId}/knowledge-points/${kpId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),

  removeTaskKnowledgePoint: (taskId: string, kpId: string): Promise<void> =>
    requestData<void>(`/scheduler/tasks/${taskId}/knowledge-points/${kpId}`, {
      method: "DELETE",
    }),
};
