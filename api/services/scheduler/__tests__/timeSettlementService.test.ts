import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
  type MockSupabaseClient,
} from "../../../../tests/helpers/mockFactories";

vi.mock("../../common/softDeleteHelper", () => ({
  notDeleted: (q: unknown) => q,
}));

import { timeSettlementService } from "../timeSettlementService";

/** 构造一个 from 按表名返回数据的 mock */
function buildMockSupabase(dataByFrom: Record<string, unknown>): MockSupabaseClient {
  const inner = createMockSupabase() as unknown as MockSupabaseClient;
  inner.from.mockImplementation((table: string) => {
    const data = dataByFrom[table] ?? null;
    const chainClient = createMockSupabase({ data }) as unknown as MockSupabaseClient;
    const chain = chainClient._queryChain as unknown as Record<string, ReturnType<typeof vi.fn>> & {
      upsert?: ReturnType<typeof vi.fn>;
    };
    // 补充 upsert 终端方法（默认返回 { data, error: null }）
    if (!chain.upsert) {
      chain.upsert = vi.fn().mockResolvedValue({ data, error: null });
    }
    return chain;
  });
  return inner;
}

describe("TimeSettlementService (S4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无 task_id 时直接返回（不结算）", async () => {
    const supabase = buildMockSupabase({});
    const result = await timeSettlementService.settleFocusSession(supabase as never, "user-1", {
      duration: 1500,
    });
    expect(result.settledMinutes).toBe(25);
    expect(result.taskUpdated).toBe(false);
    expect(result.subtaskUpdated).toBe(false);
  });

  it("专注 25 分钟结算到任务 + 子任务 + 路径进度", async () => {
    const supabase = buildMockSupabase({
      user_tasks: {
        id: "task-1",
        actual_duration: 10,
        graph_id: "graph-1",
      },
      task_subtasks: [
        {
          id: "subtask-1",
          actual_duration: 5,
          learning_path_node_id: "pn-1",
          status: "in_progress",
          position: 0,
        },
      ],
      learning_path_nodes: {
        id: "pn-1",
        path_id: "path-1",
      },
      learning_path_progress: null,
    });

    const result = await timeSettlementService.settleFocusSession(supabase as never, "user-1", {
      taskId: "task-1",
      duration: 1500,
    });

    expect(result.settledMinutes).toBe(25);
    expect(result.taskUpdated).toBe(true);
    expect(result.subtaskUpdated).toBe(true);
    expect(result.pathProgressUpdated).toBe(true);
    expect(result.subtaskId).toBe("subtask-1");
    expect(result.pathId).toBe("path-1");
    expect(result.nodeId).toBe("pn-1");
  });

  it("无进行中子任务时仍结算任务时长", async () => {
    const supabase = buildMockSupabase({
      user_tasks: { id: "task-2", actual_duration: 0, graph_id: "graph-2" },
      task_subtasks: [],
    });

    const result = await timeSettlementService.settleFocusSession(supabase as never, "user-1", {
      taskId: "task-2",
      duration: 600,
    });

    expect(result.settledMinutes).toBe(10);
    expect(result.taskUpdated).toBe(true);
    expect(result.subtaskUpdated).toBe(false);
    expect(result.pathProgressUpdated).toBe(false);
  });
});