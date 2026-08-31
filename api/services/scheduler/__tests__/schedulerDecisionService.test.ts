import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
  type MockSupabaseClient,
} from "../../../../tests/helpers/mockFactories";

vi.mock("../../study/spacedRepetitionBridge", () => ({
  spacedRepetitionBridge: {
    getUnifiedReviewQueue: vi.fn(),
  },
}));

vi.mock("../taskRecommendationService", () => ({
  taskRecommendationService: {
    getTaskRecommendations: vi.fn(),
  },
}));

vi.mock("../learningFlowService", () => ({
  learningFlowService: {
    reconcileToPractice: vi.fn().mockResolvedValue("practice"),
  },
}));

import { schedulerDecisionService } from "../schedulerDecisionService";
import { spacedRepetitionBridge } from "../../study/spacedRepetitionBridge";
import { taskRecommendationService } from "../taskRecommendationService";

// 从多个表各自返回数据的 supabase mock
function buildMockSupabase(dataByFrom: Record<string, unknown>): MockSupabaseClient {
  const inner = createMockSupabase() as unknown as MockSupabaseClient;
  inner.from.mockImplementation((table: string) => {
    const data = dataByFrom[table] ?? null;
    const chainClient = createMockSupabase({ data }) as unknown as MockSupabaseClient;
    return chainClient._queryChain;
  });
  return inner;
}

function dueReviewItem(p: {
  id: string;
  knowledgePointId: string;
  nextReviewDate: string;
  urgency: "overdue" | "today";
  masteryLevel: number;
}): unknown {
  return {
    id: p.id,
    knowledgePointId: p.knowledgePointId,
    nextReviewDate: p.nextReviewDate,
    urgency: p.urgency,
    algorithm: "fsrs",
    masteryLevel: p.masteryLevel,
  };
}

describe("SchedulerDecisionService (S3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("到期复习达到阈值时中断，返回 review 决策", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const overdue = new Date("2025-12-01T00:00:00Z").toISOString();

    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue([
      dueReviewItem({
        id: "c1",
        knowledgePointId: "kp-1",
        nextReviewDate: overdue,
        urgency: "overdue",
        masteryLevel: 0.1,
      }),
      dueReviewItem({
        id: "c2",
        knowledgePointId: "kp-2",
        nextReviewDate: overdue,
        urgency: "overdue",
        masteryLevel: 0.2,
      }),
      dueReviewItem({
        id: "c3",
        knowledgePointId: "kp-3",
        nextReviewDate: overdue,
        urgency: "overdue",
        masteryLevel: 0.3,
      }),
    ] as never);

    const supabase = buildMockSupabase({
      graph_nodes: [],
      knowledge_points: [
        { id: "kp-1", title: "知识点一" },
        { id: "kp-2", title: "知识点二" },
        { id: "kp-3", title: "知识点三" },
      ],
    });

    const decision = await schedulerDecisionService.getNextStep(supabase as never, "user-1", { now });

    expect(decision.type).toBe("review");
    expect(decision.interrupted).toBe(true);
    expect(decision.overdueReviewCount).toBe(3);
    expect(decision.review?.knowledgePointId).toBe("kp-1");
    // 未调用队列推荐
    expect(taskRecommendationService.getTaskRecommendations).not.toHaveBeenCalled();
  });

  it("到期复习未达阈值时，返回队列推进决策", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const today = new Date("2026-01-01T18:00:00Z").toISOString();

    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue([
      dueReviewItem({
        id: "c1",
        knowledgePointId: "kp-1",
        nextReviewDate: today,
        urgency: "today",
        masteryLevel: 0.2,
      }),
    ] as never);

    vi.mocked(taskRecommendationService.getTaskRecommendations).mockResolvedValue([
      {
        task: {
          id: "task-1",
          title: "学习图谱A",
          task_type: "graph_learning",
          queue_level: 1,
          priority: 5,
          graph_id: "graph-1",
          user_id: "user-1",
          status: "in_progress",
        },
        score: 80,
        urgencyLevel: "high",
        reasons: [],
      },
    ] as never);

    const supabase = buildMockSupabase({
      graph_nodes: [],
      knowledge_points: [{ id: "kp-1", title: "知识点一" }],
      task_subtasks: [
        {
          id: "st-1",
          title: "子任务一",
          knowledge_point_id: "kp-1",
          learning_path_node_id: "pn-1",
          learning_state: "practice",
          position: 0,
          knowledge_points: { mastery_level: 0.4 },
        },
      ],
    });

    const decision = await schedulerDecisionService.getNextStep(supabase as never, "user-1", { now });

    expect(decision.type).toBe("progress");
    expect(decision.interrupted).toBe(false);
    expect(decision.progress?.taskId).toBe("task-1");
    expect(decision.progress?.nextSubtask?.learningState).toBe("practice");
  });

  it("无到期复习也无队列任务时返回 empty", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue([] as never);
    vi.mocked(taskRecommendationService.getTaskRecommendations).mockResolvedValue([] as never);

    const supabase = buildMockSupabase({ graph_nodes: [], task_subtasks: [] });

    const decision = await schedulerDecisionService.getNextStep(supabase as never, "user-1", { now });

    expect(decision.type).toBe("empty");
    expect(decision.interrupted).toBe(false);
  });
});