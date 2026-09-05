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

vi.mock("../smartTaskLinker", () => ({
  smartTaskLinker: {
    getOrCreateTaskForGraph: vi.fn(),
  },
}));

vi.mock("../../study/crossGraphLearningPathService", () => ({
  crossGraphLearningPathService: {
    getNextGraphInPath: vi.fn(),
    computeGraphCompletions: vi.fn(),
  },
}));

import { schedulerDecisionService } from "../schedulerDecisionService";
import { spacedRepetitionBridge } from "../../study/spacedRepetitionBridge";
import { taskRecommendationService } from "../taskRecommendationService";
import { smartTaskLinker } from "../smartTaskLinker";
import { crossGraphLearningPathService } from "../../study/crossGraphLearningPathService";

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
    // 需 reset（而非 clear）：跨图路径 mock 的 mockResolvedValue 若不重置，
    // 会泄漏到后续「empty」用例导致误命中 progress
    vi.resetAllMocks();
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

  it("存在跨图谱学习路径时，大循环按路径推进该图的学习任务", async () => {
    const now = new Date("2026-01-01T12:00:00Z");

    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue(
      [] as never,
    );
    vi.mocked(crossGraphLearningPathService.getNextGraphInPath).mockResolvedValue(
      {
        graphId: "graph-cross-1",
        graphTitle: "跨图路径下一图",
        order: 0,
        completion: 0.2,
        nodeCount: 10,
      },
    );
    vi.mocked(smartTaskLinker.getOrCreateTaskForGraph).mockResolvedValue({
      mainTaskId: "task-cross-1",
      graphId: "graph-cross-1",
      graphName: "跨图路径下一图",
      totalNodes: 10,
      completedNodes: 2,
      subtasks: [],
    } as never);

    const supabase = buildMockSupabase({
      graph_nodes: [],
      task_subtasks: [
        {
          id: "st-c",
          title: "子任务",
          knowledge_point_id: "kp-1",
          learning_path_node_id: "pn-1",
          learning_state: "learning",
          position: 0,
          knowledge_points: { mastery_level: 0.1 },
        },
      ],
    });

    const decision = await schedulerDecisionService.getNextStep(
      supabase as never,
      "user-1",
      { now },
    );

    expect(decision.type).toBe("progress");
    expect(decision.progress?.taskId).toBe("task-cross-1");
    expect(decision.progress?.graphId).toBe("graph-cross-1");
    // 跨图路径命中后不再走推荐队列
    expect(taskRecommendationService.getTaskRecommendations).not.toHaveBeenCalled();
  });

  it("本周有 stage 周窗口时，大循环优先推进窗口对应的图（P2 两级排课）", async () => {
    const now = new Date("2026-01-01T12:00:00Z"); // 周四，落在窗口内

    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue(
      [] as never,
    );
    vi.mocked(
      crossGraphLearningPathService.computeGraphCompletions,
    ).mockResolvedValue(new Map([["graph-week", 0.1]]));
    vi.mocked(smartTaskLinker.getOrCreateTaskForGraph).mockResolvedValue({
      mainTaskId: "task-week",
      graphId: "graph-week",
      graphName: "本周窗口图",
      totalNodes: 5,
      completedNodes: 0,
      subtasks: [],
    } as never);

    const supabase = buildMockSupabase({
      graph_nodes: [],
      learning_path_stage_windows: [
        {
          id: "w1",
          stage_index: 1,
          graph_id: "graph-week",
          graph_node_id: "pn-1",
          week_start_date: "2025-12-29",
          week_end_date: "2026-01-04",
          planned_minutes: 120,
          status: "planned",
          learning_paths: { status: "active", priority: 0, target_date: null },
        },
      ],
    });

    const decision = await schedulerDecisionService.getNextStep(
      supabase as never,
      "user-1",
      { now },
    );

    expect(decision.type).toBe("progress");
    expect(decision.progress?.graphId).toBe("graph-week");
    // 窗口命中且未达标时，不再按路径顺序取下一图
    expect(
      crossGraphLearningPathService.getNextGraphInPath,
    ).not.toHaveBeenCalled();
  });

  it("窗口对应图已达完成阈值时，回退到路径顺序的下一个未完成图", async () => {
    const now = new Date("2026-01-01T12:00:00Z");

    vi.mocked(spacedRepetitionBridge.getUnifiedReviewQueue).mockResolvedValue(
      [] as never,
    );
    vi.mocked(
      crossGraphLearningPathService.computeGraphCompletions,
    ).mockResolvedValue(new Map([["graph-week", 0.95]]));
    vi.mocked(crossGraphLearningPathService.getNextGraphInPath).mockResolvedValue(
      {
        graphId: "graph-next",
        graphTitle: "下一图",
        order: 2,
        completion: 0,
        nodeCount: 8,
      },
    );
    vi.mocked(smartTaskLinker.getOrCreateTaskForGraph).mockResolvedValue({
      mainTaskId: "task-next",
      graphId: "graph-next",
      graphName: "下一图",
      totalNodes: 8,
      completedNodes: 0,
      subtasks: [],
    } as never);

    const supabase = buildMockSupabase({
      graph_nodes: [],
      learning_path_stage_windows: [
        {
          id: "w1",
          stage_index: 1,
          graph_id: "graph-week",
          graph_node_id: "pn-1",
          week_start_date: "2025-12-29",
          week_end_date: "2026-01-04",
          planned_minutes: 120,
          status: "planned",
          learning_paths: { status: "active", priority: 0, target_date: null },
        },
      ],
    });

    const decision = await schedulerDecisionService.getNextStep(
      supabase as never,
      "user-1",
      { now },
    );

    expect(decision.progress?.graphId).toBe("graph-next");
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