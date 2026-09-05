import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChainedMock } from "../../../../../tests/helpers/mockFactories";

vi.mock("../../../study/learningPathService", () => ({
  learningPathService: {
    getLearningPath: vi.fn(),
  },
}));

import { stageWindowPlannerService } from "../stageWindowPlannerService";
import { learningPathService } from "../../../study/learningPathService";

type Chain = Record<string, ReturnType<typeof vi.fn>>;

function buildPath(
  stages: Array<{
    id: string;
    graph: string;
    order: number;
    time: number;
    milestone?: boolean;
  }>,
) {
  return {
    id: "path-1",
    user_id: "user-1",
    title: "跨图路径",
    path_type: "cross_graph",
    status: "active",
    daily_minutes_target: 60,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    nodes: stages.map((s) => ({
      id: s.id,
      path_id: "path-1",
      graph_id: s.graph,
      order_index: s.order,
      title: `图${s.order}`,
      estimated_time: s.time,
      is_milestone: !!s.milestone,
      status: "pending" as const,
      created_at: "2026-01-01T00:00:00",
      updated_at: "2026-01-01T00:00:00",
    })),
  };
}

/** 按表分发的 mock：task_settings / learning_path_stage_windows / learning_paths */
function buildDispatch(params: {
  settings?: unknown;
  windowRows?: unknown[];
  pathRows?: unknown[];
}) {
  const settingsChain = createChainedMock({
    chainMethods: ["select", "eq"],
    terminals: [
      {
        name: "maybeSingle",
        value: { data: params.settings ?? null, error: null },
        async: true,
      },
    ],
  });
  const windowChain = createChainedMock({
    chainMethods: ["select", "eq", "gte", "lte", "delete", "insert", "order"],
  }) as Chain;
  windowChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: params.windowRows ?? [], error: null });
    });
  const pathChain = createChainedMock({
    chainMethods: ["select", "eq", "update"],
  }) as Chain;
  pathChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: params.pathRows ?? [], error: null });
    });

  const supabase = {
    from: vi.fn((table: string) =>
      table === "task_settings"
        ? settingsChain
        : table === "learning_path_stage_windows"
          ? windowChain
          : pathChain,
    ),
  };
  return { supabase, settingsChain, windowChain, pathChain };
}

function insertedRows(windowChain: Chain): Array<Record<string, unknown>> {
  return (windowChain.insert.mock.calls[0]?.[0] ?? []) as Array<
    Record<string, unknown>
  >;
}

describe("StageWindowPlannerService (P2 两级排课)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("stage 按周容量顺序装箱：超出本周容量的 stage 顺延到下周", async () => {
    // 显式固定日容量 60 → 周容量 420；g1 300 + g2 200 = 500 > 420 → 分两周
    const { supabase } = buildDispatch({
      settings: { daily_capacity_minutes: 60, review_buffer_ratio: 0.2 },
    });
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", graph: "g1", order: 0, time: 300 },
        { id: "n2", graph: "g2", order: 1, time: 200 },
      ]),
    );

    const result = await stageWindowPlannerService.planStageWindows(
      supabase as never,
      "user-1",
      "path-1",
      { start_date: "2026-01-05" }, // 周一
    );

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]).toMatchObject({
      stageIndex: 0,
      graphId: "g1",
      weekStartDate: "2026-01-05",
      weekEndDate: "2026-01-11",
    });
    expect(result.windows[1]).toMatchObject({
      stageIndex: 1,
      graphId: "g2",
      weekStartDate: "2026-01-12",
      weekEndDate: "2026-01-18",
    });
  });

  it("里程碑 stage 独占一周", async () => {
    const { supabase, windowChain } = buildDispatch({});
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", graph: "g1", order: 0, time: 100 },
        { id: "n2", graph: "g2", order: 1, time: 60, milestone: true },
        { id: "n3", graph: "g3", order: 2, time: 100 },
      ]),
    );

    await stageWindowPlannerService.planStageWindows(
      supabase as never,
      "user-1",
      "path-1",
      { start_date: "2026-01-05" },
    );

    const rows = insertedRows(windowChain);
    expect(rows.map((r) => r.week_start_date)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
  });

  it("超长 stage（> 周容量）跨多周，窗口结束日覆盖整个跨度", async () => {
    const { supabase, windowChain } = buildDispatch({
      settings: { daily_capacity_minutes: 60, review_buffer_ratio: 0.2 },
    });
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", graph: "g1", order: 0, time: 900 }, // ceil(900/420) = 3 周
        { id: "n2", graph: "g2", order: 1, time: 100 },
      ]),
    );

    await stageWindowPlannerService.planStageWindows(
      supabase as never,
      "user-1",
      "path-1",
      { start_date: "2026-01-05" },
    );

    const rows = insertedRows(windowChain);
    expect(rows[0]).toMatchObject({
      stage_index: 0,
      week_start_date: "2026-01-05",
      week_end_date: "2026-01-25", // 3 周跨度
    });
    // 下一个 stage 从第 4 周开始
    expect(rows[1]).toMatchObject({
      stage_index: 1,
      week_start_date: "2026-01-26",
    });
  });

  it("重排时清空旧窗口后重建", async () => {
    const { supabase, windowChain } = buildDispatch({});
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([{ id: "n1", graph: "g1", order: 0, time: 60 }]),
    );

    await stageWindowPlannerService.planStageWindows(
      supabase as never,
      "user-1",
      "path-1",
    );

    expect(windowChain.delete).toHaveBeenCalled();
    expect(windowChain.insert).toHaveBeenCalled();
  });

  it("getStageWindows 标记已过期仍未完成的窗口为滞后", async () => {
    const { supabase } = buildDispatch({
      windowRows: [
        {
          id: "w1",
          stage_index: 0,
          graph_id: "g1",
          graph_node_id: "n1",
          week_start_date: "2020-01-06",
          week_end_date: "2020-01-12",
          planned_minutes: 60,
          status: "planned",
        },
        {
          id: "w2",
          stage_index: 1,
          graph_id: "g2",
          graph_node_id: "n2",
          week_start_date: "2999-01-05",
          week_end_date: "2999-01-11",
          planned_minutes: 60,
          status: "planned",
        },
      ],
    });

    const windows = await stageWindowPlannerService.getStageWindows(
      supabase as never,
      "user-1",
      "path-1",
    );

    expect(windows[0]?.isLagging).toBe(true);
    expect(windows[1]?.isLagging).toBe(false);
  });

  it("postponePath 保留已结束窗口，未完成阶段从下周一起重排", async () => {
    const { supabase, windowChain } = buildDispatch({
      windowRows: [
        {
          id: "w1",
          stage_index: 0,
          graph_id: "g1",
          graph_node_id: "n1",
          week_start_date: "2020-01-06",
          week_end_date: "2020-01-12",
          planned_minutes: 60,
          status: "planned",
        },
        {
          id: "w2",
          stage_index: 1,
          graph_id: "g2",
          graph_node_id: "n2",
          week_start_date: "2999-01-05",
          week_end_date: "2999-01-11",
          planned_minutes: 60,
          status: "planned",
        },
      ],
    });
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", graph: "g1", order: 0, time: 60 },
        { id: "n2", graph: "g2", order: 1, time: 60 },
      ]),
    );

    const result = await stageWindowPlannerService.postponePath(
      supabase as never,
      "user-1",
      "path-1",
    );

    // stage 0 保留；stage 1 从下周一起重排（仅 1 行新窗口）
    expect(result.postponedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const rows = insertedRows(windowChain);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stage_index).toBe(1);
    expect(rows[0]?.week_start_date).toBe(result.postponedFrom);
  });

  it("所有窗口都已过期时等价于全量重排（从本周一起）", async () => {
    const { supabase, windowChain } = buildDispatch({
      windowRows: [
        {
          id: "w1",
          stage_index: 0,
          graph_id: "g1",
          graph_node_id: "n1",
          week_start_date: "2020-01-06",
          week_end_date: "2020-01-12",
          planned_minutes: 60,
          status: "planned",
        },
      ],
    });
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([{ id: "n1", graph: "g1", order: 0, time: 60 }]),
    );

    const result = await stageWindowPlannerService.postponePath(
      supabase as never,
      "user-1",
      "path-1",
    );

    // 等价全量重排：窗口从今天起重建（起点 = 当天，非本周一）
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    expect(result.postponedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const rows = insertedRows(windowChain);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.week_start_date).toBe(todayStr);
  });
});
