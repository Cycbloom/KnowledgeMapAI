import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
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

interface MockQueryChainWithUpsert extends MockQueryChain {
  upsert: ReturnType<typeof vi.fn>;
}

function mockSupabase(data?: unknown): {
  supabase: ReturnType<typeof createMockSupabase>;
  chain: MockQueryChainWithUpsert;
} {
  const supabase = createMockSupabase({ data: data ?? [] });
  const baseChain = (supabase as unknown as MockSupabaseClient)._queryChain;
  const chain = baseChain as MockQueryChainWithUpsert;
  // createMockSupabase 的链方法未包含 upsert，这里补上（返回自身以便 await 链）
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

describe("PathSchedulerService (Phase A 排课引擎)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const glp = learningPathService.getLearningPath as ReturnType<typeof vi.fn>;
    glp.mockReset();
  });

  it("按每日目标切分，节点超出每日额度顺延到次日", async () => {
    const { supabase, chain } = mockSupabase([]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 30 },
        { id: "n2", kp: "kp2", pos: 1, time: 30 },
        { id: "n3", kp: "kp3", pos: 2, time: 30 },
      ]),
    );

    const result = await pathSchedulerService.planPath(
      supabase,
      "user-1",
      "path-1",
      { start_date: "2026-01-01" },
    );

    expect(result.scheduled).toHaveLength(3);
    const rows = upsertRows(chain);
    expect(rows).toHaveLength(3);
    // 每个节点独占一天（30+30>30 每日目标）
    const dates = new Set(rows.map((r) => r.scheduled_date)).size;
    expect(dates).toBe(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ knowledge_point_id: "kp1", scheduled_date: "2026-01-01" }),
        expect.objectContaining({ knowledge_point_id: "kp2", scheduled_date: "2026-01-02" }),
        expect.objectContaining({ knowledge_point_id: "kp3", scheduled_date: "2026-01-03" }),
      ]),
    );
  });

  it("里程碑节点独占一天，且顺延后的普通节点不与其同日", async () => {
    const { supabase, chain } = mockSupabase([]);
    (
      learningPathService.getLearningPath as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      buildPath([
        { id: "n1", kp: "kp1", pos: 0, time: 15 },
        { id: "n2", kp: "kp2", pos: 1, time: 15, milestone: true },
        { id: "n3", kp: "kp3", pos: 2, time: 15 },
      ]),
    );

    await pathSchedulerService.planPath(supabase, "user-1", "path-1", {
      start_date: "2026-01-01",
    });

    const rows = upsertRows(chain);
    const byKp = new Map(rows.map((r) => [r.knowledge_point_id, r.scheduled_date]));
    // n1 当天已有 15 分钟；里程碑 n2 独占次日；n3 在里程碑之后再单独一天
    expect(byKp.get("kp1")).toBe("2026-01-01");
    expect(byKp.get("kp2")).toBe("2026-01-02");
    expect(byKp.get("kp3")).toBe("2026-01-03");
  });

  it("同知识点同日被其它路径占用时，自动合并并入来源路径，不重复排期", async () => {
    const existing = [
      {
        id: "s1",
        knowledge_point_id: "kp1",
        scheduled_date: "2026-01-01",
        source_path_ids: ["other-path"],
      },
    ];
    const { supabase, chain } = mockSupabase(existing);
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

    // kp1 命中已存在排期 → 合并（不新建）；kp2 → 新插入
    const merged = result.scheduled.find((s) => s.knowledgePointId === "kp1");
    expect(merged?.merged).toBe(true);
    expect(upsertRows(chain)).toHaveLength(1);
    // 来源并入 other-path + path-1
    const mergeUpdate = chain.update.mock.calls
      .map((c) => c[0] as { source_path_ids?: string[] })
      .find((u) => !!u.source_path_ids);
    expect(mergeUpdate?.source_path_ids).toEqual(["other-path", "path-1"]);
  });

  it("排课后回写学习窗口 start/end 到 learning_paths", async () => {
    const { supabase, chain } = mockSupabase([]);
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

    const windowUpdates = chain.update.mock.calls.filter(
      (c) => c[0] && "scheduled_start_date" in (c[0] as object),
    );
    expect(windowUpdates).toHaveLength(1);
    const w = windowUpdates[0][0] as { scheduled_start_date?: string; scheduled_end_date?: string };
    expect(w.scheduled_start_date).toBe("2026-01-01");
    expect(w.scheduled_end_date).toBe("2026-01-02");
  });
});