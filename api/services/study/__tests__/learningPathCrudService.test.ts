import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LearningPathCrudService } from "../learningPathCrudService";
import type { LearningPathProgressService } from "../learningPathProgressService";

// 切断循环依赖：crudService → pathSchedulerService → learningPathService → crudService
vi.mock("../learningPathService", () => ({
  learningPathService: {},
}));
vi.mock("../../database/transactionExecutor", () => ({
  transactionExecutor: { isAvailable: () => false },
}));

type Chain = Record<string, ReturnType<typeof vi.fn>>;

function buildChain(methods: string[], rows: unknown[]): Chain {
  const c: Chain = {};
  for (const m of methods) c[m] = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue({
    data: rows.length === 1 ? rows[0] : null,
    error: null,
  });
  c.then = vi
    .fn()
    .mockImplementation((onFulfilled?: (v: unknown) => void) => {
      onFulfilled?.({ data: rows, error: null });
      return undefined;
    });
  return c;
}

function buildDispatch(params: {
  pathRow?: unknown;
  scheduleRows?: unknown[];
}) {
  const pathChain = buildChain(
    ["select", "eq", "delete", "update"],
    params.pathRow ? [params.pathRow] : [],
  );
  const scheduleChain = buildChain(
    ["select", "eq", "contains", "delete", "update"],
    params.scheduleRows ?? [],
  );
  const supabase = {
    from: vi.fn((table: string) =>
      table === "learning_paths" ? pathChain : scheduleChain,
    ),
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    pathChain,
    scheduleChain,
  };
}

describe("LearningPathCrudService.deleteLearningPath 排期清理", () => {
  const service = new LearningPathCrudService(
    {} as unknown as LearningPathProgressService,
  );
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("归档路径时：独占排期行删除、共享排期行移除本路径归属", async () => {
    const { supabase, pathChain, scheduleChain } = buildDispatch({
      pathRow: { id: "path-1" },
      scheduleRows: [
        { id: "s1", source_path_ids: ["path-1"] },
        { id: "s2", source_path_ids: ["path-1", "p2"] },
      ],
    });

    await service.deleteLearningPath(supabase, "path-1", "user-1", false);

    // 独占行 s1 被删除（仅 1 次删除），共享行 s2 走归属更新
    expect(scheduleChain.delete).toHaveBeenCalledTimes(1);
    // 共享行 s2 移除本路径后仅剩 p2
    const sourceUpdates = scheduleChain.update.mock.calls
      .map((c) => c[0] as { source_path_ids?: string[] })
      .filter((u) => !!u.source_path_ids);
    expect(sourceUpdates).toHaveLength(1);
    expect(sourceUpdates[0].source_path_ids).toEqual(["p2"]);
    // 路径归档
    const archiveUpdate = pathChain.update.mock.calls.find(
      (c) => (c[0] as { status?: string })?.status === "archived",
    );
    expect(archiveUpdate).toBeTruthy();
  });

  it("硬删除路径时同样清理其排期归属", async () => {
    const { supabase, pathChain, scheduleChain } = buildDispatch({
      pathRow: { id: "path-1" },
      scheduleRows: [{ id: "s1", source_path_ids: ["path-1"] }],
    });

    await service.deleteLearningPath(supabase, "path-1", "user-1", true);

    // 独占行 s1 被删除
    expect(scheduleChain.delete).toHaveBeenCalledTimes(1);
    const eqTargets = scheduleChain.eq.mock.calls
      .map((c) => c[1] as string)
      .filter((v) => v === "s1");
    expect(eqTargets).toContain("s1");
    // 硬删除 learning_paths 行
    expect(pathChain.delete).toHaveBeenCalled();
  });

  it("路径不存在时抛 404，不执行排期清理", async () => {
    const { supabase, scheduleChain } = buildDispatch({
      pathRow: null,
      scheduleRows: [{ id: "s1", source_path_ids: ["path-1"] }],
    });

    await expect(
      service.deleteLearningPath(supabase, "path-1", "user-1", false),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(scheduleChain.select).not.toHaveBeenCalled();
  });
});
