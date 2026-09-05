import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChainedMock } from "../../../../../tests/helpers/mockFactories";

import { scheduleSyncService } from "../scheduleSyncService";

type Chain = Record<string, ReturnType<typeof vi.fn>>;

/** 按表分发 + 按调用序次返回的 mock（scheduleSyncService 全部走原始表查询） */
function buildDispatch(params: {
  scheduleRows?: unknown[];
  /** learning_path_nodes 的 select 结果按 await 次序：第 1 次为候选节点，第 2 次为完成度重算 */
  nodeSelectResults?: unknown[][];
  ownedPaths?: unknown[];
  pathNodes?: unknown[];
}) {
  const scheduleChain = createChainedMock({
    chainMethods: ["select", "eq", "update", "lte", "gt"],
  }) as Chain;
  scheduleChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: params.scheduleRows ?? [], error: null });
    });

  const nodeChain = createChainedMock({
    chainMethods: ["select", "eq", "in", "update"],
  }) as Chain;
  let nodeAwaitCount = 0;
  nodeChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      const result =
        params.nodeSelectResults?.[nodeAwaitCount] ?? [];
      nodeAwaitCount += 1;
      onFulfilled?.({ data: result, error: null });
    });

  const pathChain = createChainedMock({
    chainMethods: ["select", "eq", "in", "update"],
  }) as Chain;
  pathChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: params.ownedPaths ?? [], error: null });
    });

  const progressChain = createChainedMock({
    chainMethods: ["upsert"],
  }) as Chain;
  progressChain.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: [], error: null });
    });

  const supabase = {
    from: vi.fn((table: string) =>
      table === "learning_path_schedule"
        ? scheduleChain
        : table === "learning_path_progress"
          ? progressChain
          : table === "learning_paths"
            ? pathChain
            : nodeChain,
    ),
  };
  return { supabase, scheduleChain, nodeChain, pathChain, progressChain };
}

describe("ScheduleSyncService (P4 完成闭环)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("知识点完成后：今日及以前排期置 completed，未来排期置 skipped", async () => {
    const { supabase, scheduleChain } = buildDispatch({});

    await scheduleSyncService.syncKnowledgePointCompleted(
      supabase as never,
      "user-1",
      "kp-1",
      { now: new Date("2026-01-10T10:00:00") },
    );

    const updateCalls = scheduleChain.update.mock.calls.map(
      (c) => c[0] as { status: string },
    );
    expect(updateCalls).toEqual([
      { status: "completed" },
      { status: "skipped" },
    ]);
    // completed 只作用于今日及以前；skipped 只作用于未来
    expect(scheduleChain.lte).toHaveBeenCalledWith("scheduled_date", "2026-01-10");
    expect(scheduleChain.gt).toHaveBeenCalledWith("scheduled_date", "2026-01-10");
  });

  it("其他路径的同知识点节点被标记完成，写入进度并重算路径整体完成", async () => {
    const { supabase, nodeChain, progressChain, pathChain } = buildDispatch({
      nodeSelectResults: [
        // 第 1 次 await：候选节点（同 KP、未完成）
        [
          { id: "n-keep", path_id: "path-self" },
          { id: "n-other", path_id: "path-other" },
        ],
        // 第 2 次 await：节点 update 的返回（占位）
        [],
        // 第 3 次 await：受影响路径的节点完成度重算 → 全部完成
        [{ status: "completed" }, { status: "completed" }],
      ],
      ownedPaths: [{ id: "path-other" }],
    });

    await scheduleSyncService.syncKnowledgePointCompleted(
      supabase as never,
      "user-1",
      "kp-1",
      { excludePathId: "path-self", now: new Date("2026-01-10T10:00:00") },
    );

    // 排除当前路径 + 非本用户的路径被过滤，只同步 path-other 的节点
    expect(nodeChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(progressChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        path_id: "path-other",
        node_id: "n-other",
        status: "completed",
        progress_percentage: 100,
      }),
      expect.objectContaining({ onConflict: "user_id,path_id,node_id" }),
    );
    // 全部节点完成 → 路径整体置 completed
    expect(pathChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("无其他路径包含该知识点时只收口排期行", async () => {
    const { supabase, scheduleChain, nodeChain, progressChain } =
      buildDispatch({
        nodeSelectResults: [[]],
      });

    await scheduleSyncService.syncKnowledgePointCompleted(
      supabase as never,
      "user-1",
      "kp-2",
    );

    expect(scheduleChain.update).toHaveBeenCalledTimes(2);
    expect(nodeChain.update).not.toHaveBeenCalled();
    expect(progressChain.upsert).not.toHaveBeenCalled();
  });

  it("受影响路径未全部完成时不改路径状态", async () => {
    const { supabase, pathChain } = buildDispatch({
      nodeSelectResults: [
        [{ id: "n-other", path_id: "path-other" }],
        [{ status: "completed" }, { status: "pending" }],
      ],
      ownedPaths: [{ id: "path-other" }],
    });

    await scheduleSyncService.syncKnowledgePointCompleted(
      supabase as never,
      "user-1",
      "kp-1",
      { excludePathId: "path-self" },
    );

    expect(pathChain.update).not.toHaveBeenCalled();
  });
});
