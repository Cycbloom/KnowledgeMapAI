/**
 * P5 小路径×日历排课扩展测试：
 * - planPath 与跨图大路径周窗口的强联动（起始日对齐 + 节奏限速）
 * - replanFromToday 滞后恢复（清本路径归属 → 从今天重装箱）
 * - backfillGraphPathSchedule 拓扑补排（未入路径知识点追加 + 补排）
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChainedMock } from "../../../../../tests/helpers/mockFactories";

vi.mock("../../../study/learningPathService", () => ({
  learningPathService: {
    getLearningPath: vi.fn(),
  },
}));

import { pathSchedulerService } from "../pathSchedulerService";
import { learningPathService } from "../../../study/learningPathService";
import { capacityService } from "../capacityService";

type Chain = Record<string, ReturnType<typeof vi.fn>>;

/** 按表分发的可 await 链（与 scheduleSyncService.test 同款模式） */
function makeChain(data: unknown = []): Chain {
  const chain = createChainedMock({
    chainMethods: [
      "select",
      "insert",
      "update",
      "delete",
      "upsert",
      "eq",
      "neq",
      "in",
      "or",
      "gte",
      "gt",
      "lt",
      "lte",
      "contains",
      "is",
      "not",
      "order",
      "range",
      "limit",
      "single",
      "maybeSingle",
    ],
  }) as Chain;
  const result = { data, error: null };
  chain.then = vi.fn().mockImplementation(
    (onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.(result);
    },
  ) as unknown as Chain["then"];
  return chain;
}

function buildDispatch(params: {
  scheduleRows?: unknown[];
  windowRows?: unknown[];
  pathRow?: unknown;
  graphNodeRows?: unknown[];
  pathNodeRows?: unknown[];
}) {
  const scheduleChain = makeChain(params.scheduleRows ?? []);
  const windowsChain = makeChain(params.windowRows ?? []);
  const pathChain = makeChain(params.pathRow ?? null);
  const graphNodesChain = makeChain(params.graphNodeRows ?? []);
  const nodesChain = makeChain(params.pathNodeRows ?? []);

  const supabase = {
    from: vi.fn((table: string) =>
      table === "learning_path_schedule"
        ? scheduleChain
        : table === "learning_path_stage_windows"
          ? windowsChain
          : table === "learning_paths"
            ? pathChain
            : table === "graph_nodes"
              ? graphNodesChain
              : nodesChain,
    ),
  };
  return { supabase, scheduleChain, windowsChain, pathChain, graphNodesChain, nodesChain };
}

/** 与服务端一致的本地日期串（避免 UTC 偏移导致的断言错位） */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function addDaysStr(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function buildPath(
  nodes: Array<{ id: string; kp: string; pos: number; time: number; status?: string }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "path-1",
    user_id: "user-1",
    title: "P",
    path_type: "single_graph",
    source_graph_id: "graph-1",
    total_estimated_time: 100,
    ai_generated: false,
    status: "active",
    daily_minutes_target: 180,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    nodes: nodes.map((n) => ({
      id: n.id,
      path_id: "path-1",
      knowledge_point_id: n.kp,
      order_index: n.pos,
      title: n.id,
      estimated_time: n.time,
      is_milestone: false,
      prerequisites: [] as string[],
      status: n.status ?? "pending",
      created_at: "2026-01-01T00:00:00",
      updated_at: "2026-01-01T00:00:00",
    })),
    ...overrides,
  };
}

function upsertRows(chain: Chain): Array<Record<string, unknown>> {
  return chain.upsert.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

describe("PathSchedulerService P5 扩展（窗口联动 / replan / backfill）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(capacityService, "getCapacitySettings").mockResolvedValue({
      dailyCapacityMinutes: 60,
      reviewBufferRatio: 0.2,
    });
  });

  describe("planPath 周窗口强联动", () => {
    it("图谱有未来周窗口时，起始日对齐窗口周且节奏按窗口预算限速", async () => {
      // 基础节奏 = min(180, 60) × 0.8 = 48；窗口日节奏 = ceil(140 / 7) = 20
      // 3×15min 节点：无限联动时三个同日；联动后逐日顺延且起始日为窗口周一
      const { supabase, scheduleChain } = buildDispatch({
        windowRows: [
          {
            week_start_date: "2026-09-07",
            week_end_date: "2026-09-13",
            planned_minutes: 140,
            status: "planned",
            learning_paths: { status: "active" },
          },
        ],
      });
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([
          { id: "n1", kp: "kp1", pos: 0, time: 15 },
          { id: "n2", kp: "kp2", pos: 1, time: 15 },
          { id: "n3", kp: "kp3", pos: 2, time: 15 },
        ]),
      );

      const result = await pathSchedulerService.planPath(supabase as never, "user-1", "path-1", {
        start_date: "2026-09-01",
      });

      const byKp = new Map(
        upsertRows(scheduleChain).map((r) => [r.knowledge_point_id, r.scheduled_date]),
      );
      expect(byKp.get("kp1")).toBe("2026-09-07");
      expect(byKp.get("kp2")).toBe("2026-09-08");
      expect(byKp.get("kp3")).toBe("2026-09-09");
      expect(result.startDate).toBe("2026-09-07");
      expect(result.endDate).toBe("2026-09-09");
    });

    it("窗口所属大路径非 active 时视为无窗口，按原样从起始日排课", async () => {
      const { supabase, scheduleChain } = buildDispatch({
        windowRows: [
          {
            week_start_date: "2026-09-07",
            week_end_date: "2026-09-13",
            planned_minutes: 140,
            status: "planned",
            learning_paths: { status: "archived" },
          },
        ],
      });
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([
          { id: "n1", kp: "kp1", pos: 0, time: 15 },
          { id: "n2", kp: "kp2", pos: 1, time: 15 },
        ]),
      );

      await pathSchedulerService.planPath(supabase as never, "user-1", "path-1", {
        start_date: "2026-09-01",
      });

      const rows = upsertRows(scheduleChain);
      expect(rows).toHaveLength(2);
      // 无窗口限速：基础节奏 48 → 两节点同日，且不被推到窗口周
      expect(new Set(rows.map((r) => r.scheduled_date))).toEqual(new Set(["2026-09-01"]));
    });

    it("cross_graph 路径调用 planPath 直接 400（走 stage-windows）", async () => {
      const { supabase } = buildDispatch({});
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([{ id: "n1", kp: "kp1", pos: 0, time: 30 }], { path_type: "cross_graph" }),
      );

      await expect(
        pathSchedulerService.planPath(supabase as never, "user-1", "path-1"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("replanFromToday 滞后恢复", () => {
    it("独占未来排期行删除、共享行仅移除本路径，未完成节点从今天重排，已完成节点不动", async () => {
      const { supabase, scheduleChain } = buildDispatch({
        scheduleRows: [
          { id: "r1", source_path_ids: ["path-1"] },
          { id: "r2", source_path_ids: ["path-1", "p2"] },
        ],
      });
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([
          { id: "n1", kp: "kp1", pos: 0, time: 30 },
          { id: "n2", kp: "kp2", pos: 1, time: 30, status: "completed" },
        ]),
      );

      const result = await pathSchedulerService.replanFromToday(supabase as never, "user-1", "path-1");

      // 独占行 r1 删除；共享行 r2 只移除本路径归属
      const deletedIds = scheduleChain.delete.mock.results.length;
      expect(deletedIds).toBe(1);
      expect(scheduleChain.eq).toHaveBeenCalledWith("id", "r1");
      const detachUpdate = scheduleChain.update.mock.calls
        .map((c) => c[0] as { source_path_ids?: string[] })
        .find((u) => Array.isArray(u.source_path_ids));
      expect(detachUpdate?.source_path_ids).toEqual(["p2"]);
      expect(result.clearedRows).toBe(2);

      // 重排：只排 pending 的 kp1（从今天起），completed 的 kp2 不出现
      const rows = upsertRows(scheduleChain);
      expect(rows).toEqual([
        expect.objectContaining({ knowledge_point_id: "kp1", scheduled_date: todayStr() }),
      ]);
      expect(result.startDate).toBe(todayStr());
      expect(result.clearedRows + result.scheduled.length).toBeGreaterThan(0);
    });

    it("start_date 晚于今天时从指定日起排（不允许早于今天）", async () => {
      const { supabase, scheduleChain } = buildDispatch({ scheduleRows: [] });
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([{ id: "n1", kp: "kp1", pos: 0, time: 30 }]),
      );

      const result = await pathSchedulerService.replanFromToday(supabase as never, "user-1", "path-1", {
        start_date: addDaysStr(todayStr(), 3),
      });

      expect(upsertRows(scheduleChain)).toEqual([
        expect.objectContaining({ knowledge_point_id: "kp1", scheduled_date: addDaysStr(todayStr(), 3) }),
      ]);
      expect(result.startDate).toBe(addDaysStr(todayStr(), 3));
    });
  });

  describe("backfillGraphPathSchedule 拓扑补排", () => {
    it("无 active 小路径时 no-op", async () => {
      const { supabase, graphNodesChain, nodesChain } = buildDispatch({ pathRow: null });

      const result = await pathSchedulerService.backfillGraphPathSchedule(
        supabase as never,
        "user-1",
        "graph-1",
      );

      expect(result).toEqual({ pathId: null, addedNodes: 0, scheduled: 0 });
      expect(graphNodesChain.select).not.toHaveBeenCalled();
      expect(nodesChain.select).not.toHaveBeenCalled();
    });

    it("把图谱中未入路径的知识点追加为路径节点并补排；已有知识点不重复追加", async () => {
      const { supabase, nodesChain, scheduleChain } = buildDispatch({
        pathRow: { id: "path-1" },
        graphNodeRows: [
          { knowledge_point_id: "kp1", knowledge_points: { title: { "zh-CN": "已有知识点" } } },
          { knowledge_point_id: "kp2", knowledge_points: { title: { "zh-CN": "新增知识点" } } },
        ],
        pathNodeRows: [{ id: "n1", knowledge_point_id: "kp1", order_index: 0 }],
      });
      (learningPathService.getLearningPath as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildPath([
          { id: "n1", kp: "kp1", pos: 0, time: 30 },
          { id: "n2", kp: "kp2", pos: 1, time: 30 },
        ]),
      );

      const result = await pathSchedulerService.backfillGraphPathSchedule(
        supabase as never,
        "user-1",
        "graph-1",
      );

      expect(result).toMatchObject({ pathId: "path-1", addedNodes: 1 });
      // 追加节点：order 接在末尾（max 0 → 1），标题取本地化文本
      const inserted = nodesChain.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        knowledge_point_id: "kp2",
        order_index: 1,
        title: "新增知识点",
        status: "pending",
      });
      // 补排：两个知识点都进排期（kp1 落今天；kp2 30+30 超基础节奏 48 顺延到明天）
      const rows = upsertRows(scheduleChain);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ knowledge_point_id: "kp1", scheduled_date: todayStr() }),
          expect.objectContaining({ knowledge_point_id: "kp2", scheduled_date: addDaysStr(todayStr(), 1) }),
        ]),
      );
    });
  });
});
