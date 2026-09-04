import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../learningPathService", () => ({
  learningPathService: {
    updateLearningPath: vi.fn(),
    createLearningPath: vi.fn(),
  },
}));

vi.mock("../crossGraphLearningPathService", () => ({
  crossGraphLearningPathService: {
    findActiveCrossGraphPath: vi.fn(),
    computeGraphCompletions: vi.fn(async () => new Map()),
  },
}));

vi.mock("../../graph/graphCrudService", () => ({
  graphCrudService: {
    getGraphMap: vi.fn(),
  },
}));

vi.mock("../../ai/factory", () => ({
  getAIProvider: vi.fn(),
  getAIProviderForTask: vi.fn(),
}));

import {
  normalizeVariants,
  rulePathToVariant,
  goalDrivenPathService,
} from "../goalDrivenPathService";
import { learningPathService } from "../learningPathService";
import { crossGraphLearningPathService } from "../crossGraphLearningPathService";
import { graphCrudService } from "../../graph/graphCrudService";
import { getAIProviderForTask } from "../../ai/factory";
import {
  generateCrossGraphRulePath,
  type CrossGraphNodeInput,
} from "../crossGraphPathAlgorithms";

function graph(
  graphId: string,
  title: string,
  completion: number,
  nodeCount = 3,
): CrossGraphNodeInput {
  return { graphId, title, nodeCount, completion, domainIds: [] };
}

describe("normalizeVariants（AI 变体归一化）", () => {
  const graphs = [
    graph("g1", "机器学习基础", 0.2, 5),
    graph("g2", "深度学习", 0.95, 4),
    graph("g3", "自然语言处理", 0, 3),
  ];

  it("精确标题匹配，严格子图只保留 AI 选中的图谱", () => {
    const variants = normalizeVariants(
      [
        {
          id: "systematic",
          name: "系统全面",
          emphasis: "systematic",
          path: [
            { nodeTitle: "机器学习基础", priority: "high", reason: "基础", estimatedTime: 40 },
            { nodeTitle: "深度学习", priority: "medium", reason: "扩展", estimatedTime: 30 },
          ],
        },
      ],
      graphs,
    );

    expect(variants).toHaveLength(1);
    // 未在 path 中列出的 g3 不再自动补到末尾 → 子图仅含 g1/g2
    expect(variants[0].stages.map((s) => s.graphId)).toEqual(["g1", "g2"]);
    expect(variants[0].stages[0].estimatedTime).toBe(40);
    expect(variants[0].stages[1].priority).toBe("medium");
  });

  it("模糊标题匹配 + 同一变体内重复图谱去重（严格子图）", () => {
    const variants = normalizeVariants(
      [
        {
          id: "goal",
          name: "目标导向",
          emphasis: "goal_oriented",
          path: [
            { nodeTitle: "机器学习基础", priority: "high", estimatedTime: 30 },
            // 模糊命中 g1（"机器学习" 是 "机器学习基础" 的子串）→ 去重
            { nodeTitle: "机器学习", priority: "high", estimatedTime: 30 },
          ],
        },
      ],
      graphs,
    );

    expect(variants[0].stages.map((s) => s.graphId)).toEqual(["g1"]);
    expect(variants[0].stages.filter((s) => s.graphId === "g1")).toHaveLength(1);
  });

  it("priority 非法值回退 high，estimatedTime 钳制到 [5,240]", () => {
    const variants = normalizeVariants(
      [
        {
          id: "x",
          name: "X",
          path: [{ nodeTitle: "机器学习基础", priority: "weird", estimatedTime: 999 }],
        },
      ],
      graphs,
    );

    expect(variants[0].stages[0].priority).toBe("high");
    expect(variants[0].stages[0].estimatedTime).toBe(240);
  });

  it("只列出 g1 时，严格子图不含未命中的 g2/g3", () => {
    const variants = normalizeVariants(
      [{ id: "x", name: "X", path: [{ nodeTitle: "机器学习基础", priority: "high", estimatedTime: 30 }] }],
      graphs,
    );

    expect(variants[0].stages.map((s) => s.graphId)).toEqual(["g1"]);
  });
});

describe("rulePathToVariant（规则算法保底变体）", () => {
  it("把规则路径阶段转换为变体结构", () => {
    const { stages } = generateCrossGraphRulePath(
      [graph("A", "图A", 0.2), graph("B", "图B", 0.9)],
      [],
    );

    const variant = rulePathToVariant("systematic", stages, ["建议"]);
    expect(variant.emphasis).toBe("systematic");
    expect(variant.stages).toHaveLength(2);
    expect(variant.stages.every((s) => s.estimatedTime === 30)).toBe(true);
    expect(variant.stages[0].graphId).toBe("A"); // 未完成优先
    expect(variant.suggestions).toEqual(["建议"]);
  });
});

describe("goalDrivenPathService.suggestGoals（学习目标建议）", () => {
  // 最小 supabase mock：from("domains") 返回 d1 → AI 领域
  const mockSupabase = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [{ id: "d1", name: "AI" }], error: null }),
      }),
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAIProviderForTask).mockResolvedValue({ hasKey: false } as never);
    vi.mocked(graphCrudService.getGraphMap).mockResolvedValue({
      graphs: [
        { id: "g1", title: "机器学习基础", node_count: 5, domainIds: ["d1"] },
        { id: "g2", title: "深度学习", node_count: 4, domainIds: ["d1"] },
        { id: "g3", title: "前端基础", node_count: 3 },
      ],
      relations: [],
    } as never);
  });

  it("无 AI key 时返回覆盖领域/多图谱的规则建议", async () => {
    const result = await goalDrivenPathService.suggestGoals(
      mockSupabase as never,
      "user-1",
    );

    expect(result.suggestedGoals.length).toBeGreaterThan(0);
    expect(result.suggestedGoals.length).toBeLessThanOrEqual(6);
    // 目标体现领域维度（AI），而非只围绕单个图谱
    expect(result.suggestedGoals.some((g) => g.includes("AI"))).toBe(true);
    // 至少一个目标引用多个图谱标题（机器学习基础 + 深度学习）
    expect(
      result.suggestedGoals.some(
        (g) => g.includes("机器学习基础") && g.includes("深度学习"),
      ),
    ).toBe(true);
  });

  it("图谱地图为空时抛出校验错误", async () => {
    vi.mocked(graphCrudService.getGraphMap).mockResolvedValue({
      graphs: [],
      relations: [],
    } as never);

    await expect(
      goalDrivenPathService.suggestGoals({} as never, "user-1"),
    ).rejects.toThrow();
  });

  it("无 AI key 且选中图谱时，规则建议围绕选中的图谱展开", async () => {
    vi.mocked(graphCrudService.getGraphMap).mockResolvedValue({
      graphs: [
        { id: "g1", title: "机器学习基础", node_count: 5, domainIds: ["d1"] },
        { id: "g2", title: "深度学习", node_count: 4, domainIds: ["d1"] },
        { id: "g3", title: "前端基础", node_count: 3 },
      ],
      relations: [],
    } as never);

    const result = await goalDrivenPathService.suggestGoals(
      mockSupabase as never,
      "user-1",
      { selectedGraphIds: ["g1", "g3"] },
    );

    expect(result.suggestedGoals.length).toBeGreaterThan(0);
    expect(result.suggestedGoals.length).toBeLessThanOrEqual(6);
    // 选中的图谱标题必须出现在建议中
    expect(
      result.suggestedGoals.some((g) => g.includes("机器学习基础")),
    ).toBe(true);
    expect(result.suggestedGoals.some((g) => g.includes("前端基础"))).toBe(
      true,
    );
  });

  it("无 AI key 且选中图谱时，一跳邻居也进入规则建议（次优先）", async () => {
    vi.mocked(graphCrudService.getGraphMap).mockResolvedValue({
      graphs: [
        { id: "g1", title: "机器学习基础", node_count: 5, domainIds: ["d1"] },
        { id: "g2", title: "深度学习", node_count: 4, domainIds: ["d1"] },
        { id: "g3", title: "前端基础", node_count: 3 },
      ],
      relations: [
        {
          source_graph_id: "g1",
          target_graph_id: "g2",
          relation_type: "extension",
        },
      ],
    } as never);

    const result = await goalDrivenPathService.suggestGoals(
      mockSupabase as never,
      "user-1",
      { selectedGraphIds: ["g1"] },
    );

    expect(result.suggestedGoals.length).toBeGreaterThan(0);
    expect(result.suggestedGoals.length).toBeLessThanOrEqual(6);
    // 选中图 g1 与其一跳邻居 g2 都出现在建议中
    expect(
      result.suggestedGoals.some((g) => g.includes("机器学习基础")),
    ).toBe(true);
    expect(result.suggestedGoals.some((g) => g.includes("深度学习"))).toBe(
      true,
    );
    // 二跳范围外的前端基础不应出现
    expect(
      result.suggestedGoals.some((g) => g.includes("前端基础")),
    ).toBe(false);
  });
});

describe("goalDrivenPathService.saveVariant（保存选中候选）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crossGraphLearningPathService.findActiveCrossGraphPath).mockResolvedValue(
      null,
    );
    vi.mocked(learningPathService.createLearningPath).mockResolvedValue({
      id: "new-path-1",
      title: "系统全面",
    } as never);
    vi.mocked(learningPathService.updateLearningPath).mockResolvedValue({
      id: "old-path-1",
    } as never);
  });

  it("无旧路径时直接创建，archivedOld=false", async () => {
    const result = await goalDrivenPathService.saveVariant(
      {} as never,
      "user-1",
      {
        variant: {
          id: "systematic",
          name: "系统全面",
          stages: [
            { graph_id: "g1", graph_title: "机器学习基础", order: 0, priority: "high", reason: "基础", estimated_time: 30 },
          ],
        },
        targetGoal: "掌握机器学习",
        dailyMinutes: 30,
      },
    );

    expect(learningPathService.updateLearningPath).not.toHaveBeenCalled();
    expect(learningPathService.createLearningPath).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        path_type: "cross_graph",
        ai_generated: true,
        goal: "掌握机器学习",
        nodes: [
          expect.objectContaining({
            graph_id: "g1",
            order_index: 0,
            is_milestone: true,
          }),
        ],
      }),
    );
    expect(result.archivedOld).toBe(false);
    expect(result.pathId).toBe("new-path-1");
  });

  it("存在旧 active 路径时不再归档，允许多条按目标并存", async () => {
    vi.mocked(crossGraphLearningPathService.findActiveCrossGraphPath).mockResolvedValue(
      { id: "old-path-1", title: "旧路径" },
    );

    const result = await goalDrivenPathService.saveVariant({} as never, "user-1", {
      variant: {
        id: "goal",
        name: "目标导向",
        stages: [
          { graph_id: "g1", graph_title: "机器学习基础", order: 0, priority: "high", estimated_time: 30 },
        ],
      },
    });

    // 不归档旧 active 路径（多条目标路径并存）
    expect(learningPathService.updateLearningPath).not.toHaveBeenCalled();
    // 直接创建新路径
    expect(learningPathService.createLearningPath).toHaveBeenCalled();
    expect(result.archivedOld).toBe(false);
  });

  it("空 stages 抛出校验错误", async () => {
    await expect(
      goalDrivenPathService.saveVariant({} as never, "user-1", {
        variant: { id: "x", name: "空", stages: [] },
      }),
    ).rejects.toThrow();
  });
});
