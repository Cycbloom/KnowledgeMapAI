import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
  createChainedMock,
  type MockQueryChain,
  type MockSupabaseClient,
} from "../../../../../tests/helpers/mockFactories";

vi.mock("../../../study/learningPathService", () => ({
  learningPathService: {
    getLearningPath: vi.fn(),
  },
}));

import { pathSchedulerService } from "../pathSchedulerService";
import { learningPathService } from "../../../study/learningPathService";
import { capacityService } from "../capacityService";

interface MockQueryChainWithUpsert extends MockQueryChain {
  upsert: ReturnType<typeof vi.fn>;
}

function mockSupabase(rows?: unknown[]): {
  supabase: ReturnType<typeof createMockSupabase>;
  chain: MockQueryChainWithUpsert;
} {
  const supabase = createMockSupabase({ data: rows ?? [] });
  const baseChain = (supabase as unknown as MockSupabaseClient)._queryChain;
  const chain = baseChain as MockQueryChainWithUpsert;
  chain.upsert = vi.fn().mockReturnValue(baseChain);
  return { supabase, chain };
}

function buildPath(nodes: Array<{ id: string; kp: string; pos: number; time: number; milestone?: boolean }>) {
  return {
    id: "path-1",
    user_id: "user-1",
    title: "P",
    path_type: "single_graph",
    total_estimated_time: 100,
    ai_generated: false,
    status: "active",
    daily_minutes_target: 30,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    nodes: nodes.map((n) => ({
      id: n.id,
      path_id: "path-1",
      knowledge_point_id: n.kp,
      order_index: n.pos,
      title: n.id,
      estimated_time: n.time,
      is_milestone: !!n.milestone,
      prerequisites: [] as string[],
      status: "pending" as const,
      created_at: "2026-01-01T00:00:00",
      updated_at: "2026-01-01T00:00:00",
    })),
  };
}

function upsertRows(chain: MockQueryChainWithUpsert): Array<Record<string, unknown>> {
  return chain.upsert.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

describe("PathSchedulerService 容量感知装箱（P1 统一计划体系）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 显式固定全局容量默认值（当前产品默认 240），个别用例覆盖为 60 验证顺延
    vi.spyOn(capacityService, "getCapacitySettings").mockResolvedValue({
      dailyCapacityMinutes: 240,
      reviewBufferRatio: 0.2,
    });
  });

  it("当日已被其它路径占用且超出全局预算时，顺延到空闲日", async () => {
    // 2026-01-01 已被其它路径排 45 分钟；预算 60 → 30 分钟节点放不下
    vi.spyOn(capacityService, "getCapacitySettings").mockResolvedValue({
      dailyCapacityMinutes: 60,
      reviewBufferRatio: 0.2,
    });
    const { supabase, chain } = mockSupabase([
      { scheduled_date: "2026-01-01", estimated_time: 45, status: "scheduled" },
    ]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 30 },
        { id: "n2", kp: "kp2", pos: 1, time: 30 },
      ]),
    );

    await pathSchedulerService.planPath(supabase, "user-1", "path-1", {
      start_date: "2026-01-01",
    });

    expect(upsertRows(chain)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ knowledge_point_id: "kp1", scheduled_date: "2026-01-02" }),
        expect.objectContaining({ knowledge_point_id: "kp2", scheduled_date: "2026-01-03" }),
      ]),
    );
  });

  it("复习缓冲压缩路径每日节奏（配额 30 × 0.8 = 24 分钟）", async () => {
    const { supabase, chain } = mockSupabase([]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 15 },
        { id: "n2", kp: "kp2", pos: 1, time: 15 },
        { id: "n3", kp: "kp3", pos: 2, time: 15 },
      ]),
    );

    await pathSchedulerService.planPath(supabase, "user-1", "path-1", {
      start_date: "2026-01-01",
    });

    // 15+15=30 > 24 → 每个节点独占一天（无缓冲时 n1/n2 会同日）
    const rows = upsertRows(chain);
    const dates = new Set(rows.map((r) => r.scheduled_date));
    expect(dates.size).toBe(3);
  });

  it("知识点已被其它路径排期（不同日期）时复用原日期并归并来源，不重复排期", async () => {
    // kp1 已被 p2 排在 2026-01-03，占 50 分钟 → 本路径 kp1 复用该日，
    // kp2 因该日负载 50+30 超预算 60 顺延到 01-04
    vi.spyOn(capacityService, "getCapacitySettings").mockResolvedValue({
      dailyCapacityMinutes: 60,
      reviewBufferRatio: 0.2,
    });
    const { supabase, chain } = mockSupabase([
      {
        id: "s9",
        knowledge_point_id: "kp1",
        scheduled_date: "2026-01-03",
        source_path_ids: ["p2"],
        estimated_time: 50,
        status: "scheduled",
      },
    ]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 30 },
        { id: "n2", kp: "kp2", pos: 1, time: 30 },
      ]),
    );

    const result = await pathSchedulerService.planPath(
      supabase,
      "user-1",
      "path-1",
      { start_date: "2026-01-01" },
    );

    const kp1 = result.scheduled.find((s) => s.knowledgePointId === "kp1");
    expect(kp1?.merged).toBe(true);
    expect(kp1?.scheduledDate).toBe("2026-01-03");

    // kp1 不新建排期，仅 kp2 新插入
    expect(upsertRows(chain)).toEqual([
      expect.objectContaining({ knowledge_point_id: "kp2", scheduled_date: "2026-01-04" }),
    ]);
    // 来源并入 p2 + path-1
    const mergeUpdate = chain.update.mock.calls
      .map((c) => c[0] as { source_path_ids?: string[] })
      .find((u) => !!u.source_path_ids);
    expect(mergeUpdate?.source_path_ids).toEqual(["p2", "path-1"]);
  });

  it("本路径此前已排期的知识点在重排时复用原日期（幂等，不重复并入来源）", async () => {
    const { supabase, chain } = mockSupabase([
      {
        id: "s1",
        knowledge_point_id: "kp1",
        scheduled_date: "2026-01-01",
        source_path_ids: ["path-1"],
        estimated_time: 30,
        status: "scheduled",
      },
    ]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 30 },
        { id: "n2", kp: "kp2", pos: 1, time: 30 },
      ]),
    );

    await pathSchedulerService.planPath(supabase, "user-1", "path-1", {
      start_date: "2026-01-01",
    });

    // kp1 复用原日期（无新 upsert、无重复来源合并）；kp2 新排
    expect(upsertRows(chain)).toEqual([
      expect.objectContaining({ knowledge_point_id: "kp2" }),
    ]);
    const sourceUpdates = chain.update.mock.calls
      .map((c) => c[0] as { source_path_ids?: string[] })
      .filter((u) => !!u.source_path_ids);
    expect(sourceUpdates).toHaveLength(0);
  });

  it("超长节点（≥全局预算）在空日允许溢出安置，不死循环", async () => {
    const { supabase, chain } = mockSupabase([]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([{ id: "n1", kp: "kp1", pos: 0, time: 120 }]),
    );

    const result = await pathSchedulerService.planPath(
      supabase,
      "user-1",
      "path-1",
      { start_date: "2026-01-01" },
    );

    expect(result.scheduled).toEqual([
      expect.objectContaining({ knowledgePointId: "kp1", scheduledDate: "2026-01-01" }),
    ]);
    expect(upsertRows(chain)).toHaveLength(1);
  });
});

describe("PathSchedulerService.reschedule 全局容量校验", () => {
  /** 按表分发的 mock：task_settings / learning_path_schedule / learning_paths */
  function buildDispatch(params: {
    settings?: unknown;
    scheduleMaybe?: unknown;
    scheduleRows?: unknown[];
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
    const scheduleChain = createChainedMock({
      chainMethods: ["select", "eq", "in", "gte", "update", "delete", "upsert"],
      terminals: [
        {
          name: "maybeSingle",
          value: { data: params.scheduleMaybe ?? null, error: null },
          async: true,
        },
      ],
    }) as Record<string, ReturnType<typeof vi.fn>>;
    scheduleChain.then = vi
      .fn()
      .mockImplementation((onFulfilled?: (v: unknown) => void) => {
        onFulfilled?.({ data: params.scheduleRows ?? [], error: null });
      });
    const pathChain = createChainedMock({
      chainMethods: ["select", "eq", "in", "update"],
    }) as Record<string, ReturnType<typeof vi.fn>>;
    pathChain.then = vi
      .fn()
      .mockImplementation((onFulfilled?: (v: unknown) => void) => {
        onFulfilled?.({ data: params.pathRows ?? [], error: null });
      });

    const supabase = {
      from: vi.fn((table: string) =>
        table === "task_settings"
          ? settingsChain
          : table === "learning_paths"
            ? pathChain
            : scheduleChain,
      ),
    };
    return { supabase, settingsChain, scheduleChain, pathChain };
  }

  it("目标日已排负载 + 本行时长超出全局预算时抛 409", async () => {
    // reschedule 走模块层 capacityService，需显式覆盖全局预算为 60
    vi.spyOn(capacityService, "getCapacitySettings").mockResolvedValue({
      dailyCapacityMinutes: 60,
      reviewBufferRatio: 0.2,
    });
    const currentRow = {
      id: "s1",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-05",
      estimated_time: 50,
      path_id: "p1",
      source_path_ids: ["p1"],
    };
    const { supabase } = buildDispatch({
      settings: { daily_capacity_minutes: 60, review_buffer_ratio: 0.2 },
      scheduleMaybe: currentRow,
      // 2026-01-10 已被其它知识点占 30 分钟；50 + 30 = 80 > 60
      scheduleRows: [
        {
          id: "s2",
          knowledge_point_id: "kp-other",
          scheduled_date: "2026-01-10",
          estimated_time: 30,
          source_path_ids: ["p9"],
        },
      ],
    });

    await expect(
      pathSchedulerService.reschedule(supabase, "user-1", "s1", "2026-01-10"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("预算内改期正常更新", async () => {
    const currentRow = {
      id: "s1",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-05",
      estimated_time: 50,
      path_id: "p1",
      source_path_ids: ["p1"],
    };
    const { supabase, scheduleChain } = buildDispatch({
      settings: { daily_capacity_minutes: 60, review_buffer_ratio: 0.2 },
      scheduleMaybe: currentRow,
      scheduleRows: [
        {
          id: "s2",
          knowledge_point_id: "kp-other",
          scheduled_date: "2026-01-10",
          estimated_time: 5,
          source_path_ids: ["p9"],
        },
      ],
    });

    const result = await pathSchedulerService.reschedule(
      supabase,
      "user-1",
      "s1",
      "2026-01-10",
    );

    expect(scheduleChain.update).toHaveBeenCalledWith({ scheduled_date: "2026-01-10" });
    expect(result.merged).toBe(false);
  });
});
