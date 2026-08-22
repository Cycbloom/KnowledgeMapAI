import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown };

interface CapturedUpdate {
  payload: Record<string, unknown>;
  eqFilters: Array<[string, unknown]>;
}

interface CapturedSelect {
  columns: string | null;
  eqFilters: Array<[string, unknown]>;
}

// ---------------------------------------------------------------------------
// Hoisted mock state (must be available before vi.mock factories run)
// ---------------------------------------------------------------------------

const { mockClient, mockState, captured, resetMock } = vi.hoisted(() => {
  const mockState: {
    fetchResult: QueryResult;
    updateResults: QueryResult[];
  } = {
    fetchResult: { data: [], error: null },
    updateResults: [],
  };

  const captured: {
    updates: CapturedUpdate[];
    selects: CapturedSelect[];
  } = {
    updates: [],
    selects: [],
  };

  let updateIdx = 0;

  const resetMock = () => {
    mockState.fetchResult = { data: [], error: null };
    mockState.updateResults = [];
    captured.updates = [];
    captured.selects = [];
    updateIdx = 0;
  };

  /**
   * Minimal chainable query builder mock that is also awaitable (PromiseLike).
   *
   * Records update/select operations on `system_tasks` so tests can assert on
   * the exact payload and eq filters. The awaited result is decided by the
   * operation type:
   *  - select-first  → fetchResult (the stalled-tasks query in initialize)
   *  - update-first  → next entry in updateResults queue (claim)
   */
  interface MockChain {
    select: (cols?: string) => MockChain;
    eq: (col: string, val: unknown) => MockChain;
    lt: (col: string, val: unknown) => MockChain;
    order: (col: string, opts?: unknown) => MockChain;
    limit: (n: number) => MockChain;
    update: (payload: Record<string, unknown>) => MockChain;
    insert: (payload: Record<string, unknown>) => MockChain;
    single: () => Promise<QueryResult>;
    then: (
      onFulfilled?:
        | ((value: QueryResult) => unknown | PromiseLike<unknown>)
        | null
        | undefined,
      onRejected?:
        | ((reason: unknown) => unknown | PromiseLike<unknown>)
        | null
        | undefined,
    ) => Promise<unknown>;
  }

  const createChain = (table: string): MockChain => {
    let isUpdate = false;
    let updatePayload: Record<string, unknown> | null = null;
    let selectColumns: string | null = null;
    let hasSelect = false;
    const eqFilters: Array<[string, unknown]> = [];
    let resolved = false;
    let cachedResult: QueryResult = { data: null, error: null };

    const resolve = (): QueryResult => {
      if (resolved) return cachedResult;
      resolved = true;
      if (table === "system_tasks") {
        if (isUpdate) {
          captured.updates.push({
            payload: updatePayload ?? {},
            eqFilters: [...eqFilters],
          });
          cachedResult =
            mockState.updateResults[updateIdx] ?? { data: null, error: null };
          updateIdx += 1;
        } else if (hasSelect) {
          captured.selects.push({
            columns: selectColumns,
            eqFilters: [...eqFilters],
          });
          cachedResult = mockState.fetchResult;
        }
      }
      return cachedResult;
    };

    const chain: MockChain = {
      select: (cols?: string) => {
        hasSelect = true;
        selectColumns = cols ?? null;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        eqFilters.push([col, val]);
        return chain;
      },
      lt: () => chain,
      order: () => chain,
      limit: () => chain,
      update: (payload: Record<string, unknown>) => {
        isUpdate = true;
        updatePayload = payload;
        return chain;
      },
      insert: () => chain,
      single: async () => resolve(),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(resolve()).then(
          onFulfilled ?? undefined,
          onRejected ?? undefined,
        ),
    };

    return chain;
  };

  const mockClient = {
    from: vi.fn((table: string) => createChain(table)),
  };

  return { mockClient, mockState, captured, resetMock };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
  SupabaseClient: class {},
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../services/core/sseService", () => ({
  sseService: {
    sendToUser: vi.fn(),
  },
}));

vi.mock("../../services/taskProcessors/index", () => ({
  getProcessor: vi.fn(),
  registerProcessor: vi.fn(),
  taskProcessors: {},
}));

// Mock side-effect processor imports to avoid loading heavy dependencies
vi.mock("../../services/taskProcessors/batchGenerateCardsProcessor.js", () => ({}));
vi.mock("../../services/taskProcessors/recursiveGraphProcessor.js", () => ({}));
vi.mock("../../services/taskProcessors/infiniteExpansionProcessor.js", () => ({}));
vi.mock("../../services/taskProcessors/embeddingGenerationProcessor.js", () => ({}));
vi.mock("../../services/taskProcessors/quizGenerationProcessor.js", () => ({}));
vi.mock("../../services/taskProcessors/generateQuestionsProcessor.js", () => ({}));

// Import AFTER mocks so the module picks up the mocked dependencies.
import { AsyncTaskService } from "../../services/asyncTaskService";
import { getProcessor } from "../../services/taskProcessors/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createStalledTask = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: "task-1",
  user_id: "user-1",
  task_type: "ai_generation",
  title: "Test task",
  status: "pending",
  input_data: { topic: "test" },
  created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  ...overrides,
});

const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AsyncTaskService - initialize (启动恢复 + 并发控制)", () => {
  let service: AsyncTaskService;
  let processTaskSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
    service = new AsyncTaskService();
    processTaskSpy = vi
      .spyOn(service, "processTask")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("启动恢复", () => {
    it("查询返回 2 个滞留任务 → 调用 processTaskAsync 恢复", async () => {
      const task1 = createStalledTask({ id: "task-1" });
      const task2 = createStalledTask({ id: "task-2" });
      mockState.fetchResult = { data: [task1, task2], error: null };
      mockState.updateResults = [
        { data: [task1], error: null }, // claim task-1 成功
        { data: [task2], error: null }, // claim task-2 成功
      ];

      await service.initialize();

      await vi.waitFor(() => {
        expect(processTaskSpy).toHaveBeenCalledTimes(2);
      });

      // 验证 fetch 查询包含 status='pending' 和 created_at 过滤
      expect(captured.selects).toHaveLength(1);
      expect(captured.selects[0].eqFilters).toContainEqual([
        "status",
        "pending",
      ]);

      // 验证两个任务都被 claim（status='running' + claimed_at）
      expect(captured.updates).toHaveLength(2);
      const claim1 = captured.updates[0];
      const claim2 = captured.updates[1];
      expect(claim1.eqFilters).toContainEqual(["id", "task-1"]);
      expect(claim1.eqFilters).toContainEqual(["status", "pending"]);
      expect(claim1.payload.status).toBe("running");
      expect(claim1.payload.claimed_at).toBeDefined();
      expect(claim2.eqFilters).toContainEqual(["id", "task-2"]);
      expect(claim2.payload.status).toBe("running");
    });

    it("无滞留任务时不调用 processTask", async () => {
      mockState.fetchResult = { data: [], error: null };

      await service.initialize();

      await flushMicrotasks();
      expect(processTaskSpy).not.toHaveBeenCalled();
      expect(captured.updates).toHaveLength(0);
    });

    it("恢复滞留的 generate_quiz 任务时还原为 generate_quiz processor", async () => {
      vi.mocked(getProcessor).mockImplementation((type: string) =>
        type === "generate_quiz" ? ({} as never) : undefined,
      );
      const task = createStalledTask({
        id: "task-quiz",
        task_type: "ai_generation",
        title: "generate_quiz",
        input_data: { quizSetId: "qs-1", knowledgePointIds: ["kp-1"], config: {} },
      });
      mockState.fetchResult = { data: [task], error: null };
      mockState.updateResults = [{ data: [task], error: null }];

      await service.initialize();

      await vi.waitFor(() => {
        expect(processTaskSpy).toHaveBeenCalledWith(
          "task-quiz",
          "user-1",
          "generate_quiz",
          expect.objectContaining({ quizSetId: "qs-1" }),
        );
      });
    });

    it("fetch 返回错误时不执行恢复且不抛出", async () => {
      mockState.fetchResult = {
        data: null,
        error: { message: "DB error" },
      };

      await expect(service.initialize()).resolves.toBeUndefined();

      await flushMicrotasks();
      expect(processTaskSpy).not.toHaveBeenCalled();
      expect(captured.updates).toHaveLength(0);
    });
  });

  describe("claim 失败跳过", () => {
    it("claim 返回空数组时不调用 processTask", async () => {
      const task = createStalledTask({ id: "task-1" });
      mockState.fetchResult = { data: [task], error: null };
      mockState.updateResults = [{ data: [], error: null }]; // claim 返回空数组

      await service.initialize();

      await vi.waitFor(() => {
        expect(captured.updates).toHaveLength(1);
      });

      // claim 尝试了一次，但 processTask 不应被调用
      expect(processTaskSpy).not.toHaveBeenCalled();
    });

    it("claim 返回 null data 时不调用 processTask", async () => {
      const task = createStalledTask({ id: "task-1" });
      mockState.fetchResult = { data: [task], error: null };
      mockState.updateResults = [{ data: null, error: null }];

      await service.initialize();

      await vi.waitFor(() => {
        expect(captured.updates).toHaveLength(1);
      });

      expect(processTaskSpy).not.toHaveBeenCalled();
    });

    it("claim 返回错误时不调用 processTask", async () => {
      const task = createStalledTask({ id: "task-1" });
      mockState.fetchResult = { data: [task], error: null };
      mockState.updateResults = [
        { data: null, error: { message: "claim failed" } },
      ];

      await service.initialize();

      await vi.waitFor(() => {
        expect(captured.updates).toHaveLength(1);
      });

      expect(processTaskSpy).not.toHaveBeenCalled();
    });
  });

  describe("并发上限", () => {
    it("3 个任务并发，第 4 个被跳过（保留 pending）", async () => {
      const tasks = [
        createStalledTask({ id: "task-1" }),
        createStalledTask({ id: "task-2" }),
        createStalledTask({ id: "task-3" }),
        createStalledTask({ id: "task-4" }),
      ];
      mockState.fetchResult = { data: tasks, error: null };
      mockState.updateResults = [
        { data: [tasks[0]], error: null }, // claim task-1
        { data: [tasks[1]], error: null }, // claim task-2
        { data: [tasks[2]], error: null }, // claim task-3
        // task-4 因并发上限不会到达 claim
      ];

      // 让 processTask 返回不立即 resolve 的 deferred promise，
      // 保持 activeCount=3 使第 4 个任务被跳过
      let resolveProcessTask: () => void = () => {};
      const deferred = new Promise<void>((resolve) => {
        resolveProcessTask = resolve;
      });
      processTaskSpy.mockReturnValue(deferred);

      await service.initialize();

      // 等待 3 个 processTask 调用完成
      await vi.waitFor(() => {
        expect(processTaskSpy).toHaveBeenCalledTimes(3);
      });

      // 只有 3 次 claim（第 4 个任务未到达 claim）
      expect(captured.updates).toHaveLength(3);

      // 验证第 4 个任务未被 claim
      const claimedIds = captured.updates.map(
        (u) => u.eqFilters.find(([col]) => col === "id")?.[1],
      );
      expect(claimedIds).toContain("task-1");
      expect(claimedIds).toContain("task-2");
      expect(claimedIds).toContain("task-3");
      expect(claimedIds).not.toContain("task-4");

      // 清理：resolve deferred 让 finally 块执行
      resolveProcessTask();
      await flushMicrotasks();
    });

    it("并发任务完成后 activeCount 归零，后续 initialize 可继续处理", async () => {
      // 第一批：4 个任务，第 4 个被跳过
      const batch1 = [
        createStalledTask({ id: "task-1" }),
        createStalledTask({ id: "task-2" }),
        createStalledTask({ id: "task-3" }),
        createStalledTask({ id: "task-4" }),
      ];
      const batch2Task = createStalledTask({ id: "task-4" });
      mockState.fetchResult = { data: batch1, error: null };
      // 提供 4 个 claim 结果：前 3 个给第一批，第 4 个给第二批
      mockState.updateResults = [
        { data: [batch1[0]], error: null },
        { data: [batch1[1]], error: null },
        { data: [batch1[2]], error: null },
        { data: [batch2Task], error: null },
      ];

      // processTask 立即 resolve（模拟快速完成任务）
      processTaskSpy.mockResolvedValue(undefined);

      await service.initialize();

      // 第一批：只有 3 个被处理（第 4 个因并发上限被跳过）
      await vi.waitFor(() => {
        expect(processTaskSpy).toHaveBeenCalledTimes(3);
      });

      // 第二批：再次轮询，第 4 个任务现在可以处理
      mockState.fetchResult = { data: [batch2Task], error: null };

      await service.initialize();

      await vi.waitFor(() => {
        expect(processTaskSpy).toHaveBeenCalledTimes(4);
      });
    });
  });
});

describe("AsyncTaskService - 暂停/终止/恢复 (pause/cancel/resume)", () => {
  let service: AsyncTaskService;
  let processTaskSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
    service = new AsyncTaskService();
    processTaskSpy = vi
      .spyOn(service, "processTask")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cancelTask：pending 任务直接置 cancelled", async () => {
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "pending" }),
      error: null,
    };
    mockState.updateResults = [{ data: null, error: null }];

    const result = await service.cancelTask("task-1", "user-1");

    expect(result).toEqual({ success: true });
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0].payload.status).toBe("cancelled");
    expect(captured.updates[0].eqFilters).toContainEqual(["id", "task-1"]);
  });

  it("cancelTask：已终止任务抛错且不落库", async () => {
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "completed" }),
      error: null,
    };

    await expect(service.cancelTask("task-1", "user-1")).rejects.toThrow();
    expect(captured.updates).toHaveLength(0);
  });

  it("cancelTask：运行中任务写入取消信号而非直接落库", async () => {
    // 通过 createTask 触发处理流程，claim 成功后建立进程内控制条目
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "pending" }),
      error: null,
    };
    mockState.updateResults = [
      { data: [createStalledTask({ id: "task-1" })], error: null }, // claim 成功
    ];
    let resolveProcessTask: () => void = () => {};
    const deferred = new Promise<void>((resolve) => {
      resolveProcessTask = resolve;
    });
    processTaskSpy.mockReturnValue(deferred);

    await service.createTask("user-1", "embedding_generation", {});

    // 等待 claim + 控制条目建立 + processTask 被调用
    await vi.waitFor(() => {
      expect(processTaskSpy).toHaveBeenCalledTimes(1);
    });

    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "running" }),
      error: null,
    };
    const updatesBefore = captured.updates.length;

    const result = await service.cancelTask("task-1", "user-1");

    expect(result).toEqual({ success: true, pending: true });
    // 未新增落库（信号由 processor 在批次检查点响应）
    expect(captured.updates.length).toBe(updatesBefore);

    resolveProcessTask();
    await flushMicrotasks();
  });

  it("pauseTask：pending 任务直接置 paused", async () => {
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "pending" }),
      error: null,
    };
    mockState.updateResults = [{ data: null, error: null }];

    const result = await service.pauseTask("task-1", "user-1");

    expect(result).toEqual({ success: true });
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0].payload.status).toBe("paused");
  });

  it("pauseTask：已暂停任务抛错且不落库", async () => {
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "paused" }),
      error: null,
    };

    await expect(service.pauseTask("task-1", "user-1")).rejects.toThrow();
    expect(captured.updates).toHaveLength(0);
  });

  it("resumeTask：paused 任务置 pending 并触发重新处理", async () => {
    const task = createStalledTask({ id: "task-1", status: "paused" });
    mockState.fetchResult = { data: task, error: null };
    mockState.updateResults = [
      { data: null, error: null }, // updateTaskStatus → pending
      { data: [task], error: null }, // claimTask → 成功
    ];

    await service.resumeTask("task-1", "user-1");

    expect(captured.updates[0].payload.status).toBe("pending");
    expect(captured.updates[0].eqFilters).toContainEqual(["id", "task-1"]);

    await vi.waitFor(() => {
      expect(processTaskSpy).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        "generate_questions",
        { topic: "test" },
      );
    });
  });

  it("resumeTask：非 paused 任务抛错且不落库", async () => {
    mockState.fetchResult = {
      data: createStalledTask({ id: "task-1", status: "running" }),
      error: null,
    };

    await expect(service.resumeTask("task-1", "user-1")).rejects.toThrow();
    expect(captured.updates).toHaveLength(0);
  });
});
