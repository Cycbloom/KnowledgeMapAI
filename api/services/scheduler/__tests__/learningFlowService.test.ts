import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
  type MockQueryChain,
  type MockSupabaseClient,
} from "../../../../tests/helpers/mockFactories";

vi.mock("../subtaskStateMachine", () => ({
  subtaskStateMachine: {
    getRecommendedNextState: vi.fn((_from, mastery) =>
      mastery < 0.3 ? "review" : mastery < 0.7 ? "practice" : "quiz",
    ),
  },
}));

vi.mock("../subtaskKnowledgeSync", () => ({
  subtaskKnowledgeSyncService: {
    syncSubtaskStateToKnowledgePoint: vi.fn().mockResolvedValue({
      success: true,
      new_mastery: 0.6,
    }),
  },
}));

vi.mock("../subtaskQuizIntegration", () => ({
  subtaskQuizIntegrationService: {
    getRecommendedActivity: vi.fn().mockResolvedValue({
      type: "practice",
      reason: "测试推荐",
      availableCards: 3,
    }),
  },
}));

vi.mock("../reviewTaskService", () => ({
  reviewTaskService: {
    createFirstReviewTask: vi.fn().mockResolvedValue({ id: "review-card-1" }),
  },
}));

vi.mock("../executionService", () => ({
  executionService: {
    createPendingForStage: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../study/masteryCalculationService", () => ({
  masteryCalculationService: {
    updateKnowledgePointMastery: vi.fn().mockResolvedValue(0.35),
  },
}));

import { learningFlowService } from "../learningFlowService";
import { subtaskStateMachine } from "../subtaskStateMachine";
import {
  subtaskKnowledgeSyncService,
} from "../subtaskKnowledgeSync";
import {
  subtaskQuizIntegrationService,
} from "../subtaskQuizIntegration";
import {
  reviewTaskService,
} from "../reviewTaskService";
import { executionService } from "../executionService";
import {
  masteryCalculationService,
} from "../../study/masteryCalculationService";

describe("LearningFlowService (S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("planInitialStage", () => {
    it("低掌握度 → review", () => {
      expect(learningFlowService.planInitialStage(0.1)).toBe("review");
    });

    it("中掌握度 → practice", () => {
      expect(learningFlowService.planInitialStage(0.5)).toBe("practice");
    });

    it("高掌握度 → quiz", () => {
      expect(learningFlowService.planInitialStage(0.8)).toBe("quiz");
    });

    it("复用 subtaskStateMachine.getRecommendedNextState", () => {
      learningFlowService.planInitialStage(0.4);
      expect(subtaskStateMachine.getRecommendedNextState).toHaveBeenCalledWith(
        "learning",
        0.4,
        [],
      );
    });
  });

  describe("completeLearning", () => {
    it("读完后从 learning 推进并创建首次复习卡片", async () => {
      const supabase = createMockSupabase() as unknown as MockSupabaseClient;
      const inner = supabase as unknown as MockSupabaseClient;
      // resolveSubtask 返回一个 learning 状态的子任务
      inner.from.mockReturnValue(
        makeChain({
          id: "subtask-1",
          task_id: "task-1",
          knowledge_point_id: "kp-1",
          learning_state: "learning",
          state_history: [],
        }),
      );

      const result = await learningFlowService.completeLearning(supabase, {
        knowledgePointId: "kp-1",
        userId: "user-1",
        taskId: "task-1",
      });

      expect(result.nextState).toBe("practice");
      expect(result.subtaskId).toBe("subtask-1");
      // 处于 learning 状态时必须同步推进
      expect(
        subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint,
      ).toHaveBeenCalledWith(supabase, "subtask-1", "practice", 0.35);
      // 阶段推进需回写待计时片段（与 subtaskStateMachine 行为一致）
      expect(executionService.createPendingForStage).toHaveBeenCalledWith(
        supabase,
        "user-1",
        {
          taskId: "task-1",
          subtaskId: "subtask-1",
          knowledgePointId: "kp-1",
          stage: "practice",
        },
      );
      // 创建首次复习卡片
      expect(reviewTaskService.createFirstReviewTask).toHaveBeenCalled();
      // 返回下一步推荐活动
      expect(result.nextActivity.type).toBe("practice");
      expect(result.reviewCardCreated).toBe(true);
    });

    it("没有子任务时仍返回掌握度与推荐活动", async () => {
      const supabase = createMockSupabase() as unknown as MockSupabaseClient;
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValue(makeChain(null));

      const result = await learningFlowService.completeLearning(supabase, {
        knowledgePointId: "kp-2",
        userId: "user-1",
      });

      expect(result.subtaskId).toBeUndefined();
      expect(result.mastery).toBe(0.35);
      // 未同步子任务（不存在）
      expect(
        subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint,
      ).not.toHaveBeenCalled();
      // 无子任务 → 不触发阶段 pending 回写
      expect(executionService.createPendingForStage).not.toHaveBeenCalled();
      // 仍应尝试创建首次复习卡片
      expect(reviewTaskService.createFirstReviewTask).toHaveBeenCalled();
    });

    it("掌握度由 masteryCalculationService 计算并写入", async () => {
      const supabase = createMockSupabase() as unknown as MockSupabaseClient;
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValue(makeChain(null));

      await learningFlowService.completeLearning(supabase, {
        knowledgePointId: "kp-3",
        userId: "user-1",
      });

      expect(
        masteryCalculationService.updateKnowledgePointMastery,
      ).toHaveBeenCalledWith(supabase, "kp-3");
      expect(
        subtaskQuizIntegrationService.getRecommendedActivity,
      ).not.toHaveBeenCalled();
    });
  });

  describe("completeReview", () => {
    it("review 完成后推进到 practice", async () => {
      const supabase = createMockSupabase() as unknown as MockSupabaseClient;
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValue(
        makeChain({
          id: "subtask-1",
          task_id: "task-1",
          knowledge_point_id: "kp-1",
          learning_state: "review",
          state_history: [],
        }),
      );

      const result = await learningFlowService.completeReview(supabase, {
        userId: "user-1",
        subtaskId: "subtask-1",
      });

      expect(result.currentState).toBe("review");
      expect(result.nextState).toBe("practice");
      expect(
        subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint,
      ).toHaveBeenCalledWith(supabase, "subtask-1", "practice", 0.35);
      // 复习完成推进阶段也需回写待计时片段
      expect(executionService.createPendingForStage).toHaveBeenCalledWith(
        supabase,
        "user-1",
        {
          taskId: "task-1",
          subtaskId: "subtask-1",
          knowledgePointId: "kp-1",
          stage: "practice",
        },
      );
      expect(result.nextActivity.type).toBe("practice");
    });

    it("learning 状态完成复习时兜底推进到 review", async () => {
      const supabase = createMockSupabase() as unknown as MockSupabaseClient;
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValue(
        makeChain({
          id: "subtask-2",
          task_id: "task-1",
          knowledge_point_id: "kp-2",
          learning_state: "learning",
          state_history: [],
        }),
      );

      const result = await learningFlowService.completeReview(supabase, {
        userId: "user-1",
        subtaskId: "subtask-2",
      });

      expect(result.nextState).toBe("review");
      // 非真实迁移（learning → review 兜底）不触发 pending 回写
      expect(executionService.createPendingForStage).not.toHaveBeenCalled();
    });
  });
});

function makeChain(data: unknown): MockQueryChain {
  const client = createMockSupabase({ data }) as unknown as MockSupabaseClient;
  return client._queryChain;
}