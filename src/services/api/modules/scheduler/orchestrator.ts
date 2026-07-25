import { requestData } from "../../client";
import type { LearningLoop } from "@shared/types";

export const orchestratorApi = {
  startLearningLoop: async (knowledgePointId?: string, graphId?: string) => {
    return requestData<LearningLoop>("/scheduler/learning-loops", {
      method: "POST",
      body: JSON.stringify({
        knowledge_point_id: knowledgePointId,
        graph_id: graphId,
      }),
    });
  },

  advanceLearningLoop: async (loopId: string) => {
    return requestData<LearningLoop>(`/scheduler/learning-loops/${loopId}/advance`, {
      method: "POST",
    });
  },

  getActiveLearningLoop: async (knowledgePointId?: string) => {
    const params = knowledgePointId ? `?knowledge_point_id=${knowledgePointId}` : "";
    return requestData<LearningLoop | null>(`/scheduler/learning-loops/active${params}`);
  },

  startLearningWithTask: async (knowledgePointId: string, graphId?: string) => {
    return requestData<LearningLoop | null>("/scheduler/learning-loops/start-with-task", {
      method: "POST",
      body: JSON.stringify({
        knowledge_point_id: knowledgePointId,
        graph_id: graphId,
      }),
    });
  },
};
