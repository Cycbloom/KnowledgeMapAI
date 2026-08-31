import { requestData } from "../../client";
import type { LearningLoop } from "@shared/types";

export interface CompleteLearningResult {
  subtaskId?: string;
  nextState: "learning" | "review" | "practice" | "quiz";
  mastery: number;
  nextActivity: {
    type: "practice" | "quiz" | "review";
    reason: string;
    availableCards: number;
  };
  reviewCardCreated: boolean;
}

export interface StartLearningForGraphResult {
  graphTaskId: string;
  pathId: string;
  pathTitle?: string;
  totalSubtaskIds: string[];
  totalTasks: number;
  graphTotalNodes: number;
  nextSubtask: {
    id: string;
    title?: string;
    knowledge_point_id?: string;
    learning_path_node_id?: string;
    learning_state?: string;
    position?: number;
  } | null;
  pathReused: boolean;
  reordered: boolean;
}

export interface NextStepDecision {
  type: "review" | "progress" | "empty";
  interrupted: boolean;
  review?: {
    cardId: string;
    knowledgePointId: string;
    graphId?: string;
    nextReviewDate?: string;
    urgency: "overdue" | "today" | "upcoming" | "future";
    masteryLevel: number;
    title?: string;
  };
  progress?: {
    taskId: string;
    taskTitle: string;
    graphId?: string;
    queueLevel: number;
    priority: number;
    deadline?: string;
    score: number;
    nextSubtask?: {
      id: string;
      title?: string;
      knowledgePointId?: string;
      learningState?: string;
      position?: number;
      masteryLevel?: number;
    };
    subtaskProgress?: { total: number; completed: number };
  };
  reason: string;
  overdueReviewCount: number;
}

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

  /** 学习完成统一推进：重算掌握度 → 推进状态机 → 创建首次复习卡片 → 返回下一步 */
  completeLearning: async (input: {
    knowledge_point_id: string;
    task_id?: string;
    graph_id?: string;
    material_duration_seconds?: number;
  }) => {
    return requestData<CompleteLearningResult>("/scheduler/learning-flow/complete-learning", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** 统一「开始学习图谱」入口：图谱大任务 → 学习路径 → 按路径重排子任务 */
  startLearningForGraph: async (graphId: string, dailyMinutes?: number) => {
    return requestData<StartLearningForGraphResult>(
      `/scheduler/graph-learning/${graphId}/start`,
      {
        method: "POST",
        body: JSON.stringify(
          dailyMinutes ? { daily_minutes: dailyMinutes } : {},
        ),
      },
    );
  },

  /** 调度决策：返回「现在最该做的下一步」（复习打断 / 队列推进） */
  getNextStep: async (overdueThreshold?: number) => {
    const params = overdueThreshold
      ? `?overdue_threshold=${overdueThreshold}`
      : "";
    return requestData<NextStepDecision>(`/scheduler/next-step${params}`);
  },

  /** 是否需要记忆打断（供 UI 提示） */
  getReviewInterrupt: async () => {
    return requestData<{ overdueCount: number; shouldInterrupt: boolean }>(
      "/scheduler/review-interrupt",
    );
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
