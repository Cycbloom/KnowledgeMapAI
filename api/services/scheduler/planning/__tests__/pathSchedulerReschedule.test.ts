import { describe, it, expect, vi } from "vitest";
import {
  createChainedMock,
  type MockSupabaseClient,
} from "../../../../../tests/helpers/mockFactories";

// pathSchedulerService 顶部 import 了 learningPathService，需 mock 掉避免真实依赖
vi.mock("../../../study/learningPathService", () => ({
  learningPathService: {
    getLearningPath: vi.fn(),
  },
}));

import { pathSchedulerService } from "../pathSchedulerService";

type Chain = Record<string, ReturnType<typeof vi.fn>>;

/**
 * 构造「按表分发」的 mock supabase：
 * - learning_path_schedule 链的 maybeSingle 返回 currentRow、await 返回 existingRows
 * - learning_paths 链的 await 返回 windowRows
 */
function buildSupabase(params: {
  currentRow?: unknown;
  existingRows?: unknown[];
  windowRows?: unknown[];
}): {
  supabase: ReturnType<typeof createChainedMock> & MockSupabaseClient;
  scheduleChain: Chain;
  pathChain: Chain;
} {
  const { currentRow = null, existingRows = [], windowRows = [] } = params;

  const scheduleChain = makeChain(
    { data: currentRow, error: null },
    { data: existingRows, error: null },
  );
  const pathChain = makeChain(
    { data: null, error: null },
    { data: windowRows, error: null },
  );

  const supabase = createChainedMock({
    chainMethods: [],
    terminals: [],
  }) as Record<string, unknown> as ReturnType<typeof createChainedMock> &
    MockSupabaseClient;

  (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn(
    (table: string) =>
      table === "learning_paths" ? pathChain : scheduleChain,
  );

  return { supabase, scheduleChain, pathChain };
}

function makeChain(
  maybeSingleValue: unknown,
  thenValue: unknown,
): Chain {
  const chain = createChainedMock({
    chainMethods: ["select", "update", "delete", "eq", "in"],
    terminals: [
      { name: "maybeSingle", value: maybeSingleValue, async: true },
      { name: "single", value: maybeSingleValue, async: true },
    ],
  }) as Chain;
  // await 链（fetchExisting/fetchWindow/update/delete 均触发 then）：必须调用
  // onFulfilled 回调让 await 接收 thenValue，否则 await 永久 pending
  chain.then = vi.fn().mockImplementation((onFulfilled?: (v: unknown) => void) => {
    onFulfilled?.(thenValue);
  });
  return chain;
}

describe("pathSchedulerService.reschedule", () => {
  it("目标日期空闲时直接更新 scheduled_date", async () => {
    const row = {
      id: "s1",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-05",
      path_id: "p1",
      source_path_ids: ["p1"],
    };
    const { supabase, scheduleChain } = buildSupabase({
      currentRow: row,
      existingRows: [], // 目标日期 2026-01-10 无占用
    });

    const result = await pathSchedulerService.reschedule(
      supabase,
      "user-1",
      "s1",
      "2026-01-10",
    );

    expect(scheduleChain.update).toHaveBeenCalledWith({
      scheduled_date: "2026-01-10",
    });
    expect(scheduleChain.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "s1",
      knowledgePointId: "kp-1",
      scheduledDate: "2026-01-10",
      merged: false,
    });
  });

  it("目标日期已被同知识点占用时合并来源并删除当前行", async () => {
    const row = {
      id: "s1",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-05",
      path_id: "p1",
      source_path_ids: ["p1", "p2"],
    };
    const existing = {
      id: "s9",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-10",
      source_path_ids: ["p3"],
    };
    const { supabase, scheduleChain } = buildSupabase({
      currentRow: row,
      existingRows: [existing], // 目标日期已被 p3 占用
    });

    const result = await pathSchedulerService.reschedule(
      supabase,
      "user-1",
      "s1",
      "2026-01-10",
    );

    expect(scheduleChain.update).toHaveBeenCalledWith({
      source_path_ids: ["p3", "p1", "p2"],
    });
    expect(scheduleChain.delete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: "s9",
      knowledgePointId: "kp-1",
      scheduledDate: "2026-01-10",
      merged: true,
    });
  });

  it("移动到窗口外时向外扩展学习窗口端日", async () => {
    const row = {
      id: "s1",
      knowledge_point_id: "kp-1",
      scheduled_date: "2026-01-05",
      path_id: "p1",
      source_path_ids: ["p1"],
    };
    const { supabase, pathChain } = buildSupabase({
      currentRow: row,
      existingRows: [],
      windowRows: [
        {
          id: "p1",
          scheduled_start_date: "2026-01-01",
          scheduled_end_date: "2026-01-30",
        },
      ],
    });

    await pathSchedulerService.reschedule(
      supabase,
      "user-1",
      "s1",
      "2026-01-31", // 超出窗口 end 01-30
    );

    expect(pathChain.update).toHaveBeenCalledWith({
      scheduled_end_date: "2026-01-31",
    });
  });

  it("排期行不存在或不属于当前用户时抛 404", async () => {
    const { supabase } = buildSupabase({
      currentRow: null, // maybeSingle 返回 null → 走 404
      existingRows: [],
    });

    await expect(
      pathSchedulerService.reschedule(supabase, "user-1", "missing", "2026-01-10"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});