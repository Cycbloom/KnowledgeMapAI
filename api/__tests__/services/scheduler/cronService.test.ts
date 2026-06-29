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
   * Records update/select operations on `task_schedules` so tests can assert
   * on the exact payload and eq filters. The awaited result is decided by the
   * operation type:
   *  - select-first  → fetchResult (the due-schedules query)
   *  - update-first  → next entry in updateResults queue (claim or rollback)
   */
  interface MockChain {
    select: (cols?: string) => MockChain;
    eq: (col: string, val: unknown) => MockChain;
    lte: (col: string, val: unknown) => MockChain;
    limit: (n: number) => MockChain;
    is: (col: string, val: unknown) => MockChain;
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
      if (table === "task_schedules") {
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
      lte: () => chain,
      limit: () => chain,
      is: () => chain,
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

const { mockPublish } = vi.hoisted(() => ({
  mockPublish: vi.fn(),
}));

vi.mock("../../../services/core/eventBus", () => ({
  appEventBus: {
    publish: mockPublish,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getHandlerCount: vi.fn().mockReturnValue(0),
    clear: vi.fn(),
  },
}));

vi.mock("../../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../supabase", () => ({
  getSupabaseAdmin: () => mockClient,
}));

// Import AFTER mocks so the module picks up the mocked dependencies.
import { SchedulerCronService } from "../../../services/scheduler/core/cronService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Private-method surface used to drive `executeDueSchedules` and spy on
 * `executeSchedule` without exercising its internal DB calls.
 */
interface SchedulerInternals {
  executeDueSchedules: () => Promise<void>;
  executeSchedule: (
    client: unknown,
    schedule: unknown,
  ) => Promise<string | undefined>;
}

const createSchedule = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: "sched-1",
  user_id: "user-1",
  schedule_type: "daily",
  schedule_config: { time: "09:00" },
  task_template_id: "tpl-1",
  next_run_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const asInternals = (service: SchedulerCronService): SchedulerInternals =>
  service as unknown as SchedulerInternals;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SchedulerCronService - executeDueSchedules (atomic claim)", () => {
  let service: SchedulerCronService;
  let internals: SchedulerInternals;
  let executeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
    service = new SchedulerCronService();
    internals = asInternals(service);
    executeSpy = vi
      .spyOn(internals, "executeSchedule")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("单实例正常执行", () => {
    it("claim 成功 → executeSchedule → 不再二次 updateNextRun", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [{ data: [schedule], error: null }];
      executeSpy.mockResolvedValue("task-1");

      await internals.executeDueSchedules();

      // 验证 fetch 查询包含 next_run_at（claim 需要原值作为乐观锁）
      expect(captured.selects).toHaveLength(1);
      expect(captured.selects[0].columns).toContain("next_run_at");

      // 验证 claim UPDATE 包含正确的 WHERE 条件与 payload
      expect(captured.updates).toHaveLength(1);
      const claim = captured.updates[0];
      expect(claim.eqFilters).toContainEqual(["id", "sched-1"]);
      expect(claim.eqFilters).toContainEqual([
        "next_run_at",
        "2024-01-01T00:00:00.000Z",
      ]);
      expect(claim.eqFilters).toContainEqual(["is_active", true]);
      expect(claim.payload.next_run_at).toBeDefined();
      expect(claim.payload.last_run_at).toBeDefined();
      // next_run_at 应为计算后的新值，不等于原值
      expect(claim.payload.next_run_at).not.toBe("2024-01-01T00:00:00.000Z");

      // 验证 executeSchedule 被调用一次
      expect(executeSpy).toHaveBeenCalledTimes(1);

      // 验证事件发布
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(
        "schedule_executed",
        expect.objectContaining({
          scheduleId: "sched-1",
          taskCreated: "task-1",
        }),
        "user-1",
        "cron_service",
      );
    });

    it("无 due schedule 时不执行任何操作", async () => {
      mockState.fetchResult = { data: [], error: null };

      await internals.executeDueSchedules();

      expect(executeSpy).not.toHaveBeenCalled();
      expect(captured.updates).toHaveLength(0);
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("fetch 返回错误时不执行", async () => {
      mockState.fetchResult = {
        data: null,
        error: { message: "DB error" },
      };

      await internals.executeDueSchedules();

      expect(executeSpy).not.toHaveBeenCalled();
      expect(captured.updates).toHaveLength(0);
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe("claim 失败跳过", () => {
    it("claim RETURNING 空（已被其他实例处理）→ 跳过 executeSchedule", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [{ data: [], error: null }];

      await internals.executeDueSchedules();

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
      // 只有 claim 尝试，无 rollback
      expect(captured.updates).toHaveLength(1);
    });

    it("claim 返回 null data → 跳过 executeSchedule", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [{ data: null, error: null }];

      await internals.executeDueSchedules();

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("claim 返回错误 → 跳过 executeSchedule", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [
        { data: null, error: { message: "claim failed" } },
      ];

      await internals.executeDueSchedules();

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
      // claim 尝试了一次，但不执行 schedule
      expect(captured.updates).toHaveLength(1);
    });
  });

  describe("双实例并发", () => {
    it("仅一者 claim 成功：第二个实例 claim 返回空，跳过", async () => {
      const schedule = createSchedule();

      // 实例 1: claim 成功
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [{ data: [schedule], error: null }];
      const service1 = new SchedulerCronService();
      const internals1 = asInternals(service1);
      const spy1 = vi
        .spyOn(internals1, "executeSchedule")
        .mockResolvedValue("task-1");

      await internals1.executeDueSchedules();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(captured.updates).toHaveLength(1); // 只有 claim，无 rollback

      // 实例 2: 同一 schedule，claim 返回空（已被实例 1 处理）
      resetMock();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [{ data: [], error: null }];
      const service2 = new SchedulerCronService();
      const internals2 = asInternals(service2);
      const spy2 = vi
        .spyOn(internals2, "executeSchedule")
        .mockResolvedValue("task-2");

      await internals2.executeDueSchedules();

      // 实例 2 未执行 schedule（claim 失败）
      expect(spy2).not.toHaveBeenCalled();
      expect(captured.updates).toHaveLength(1); // 只有失败的 claim，无 execute
    });

    it("两个 schedule 串行：各 claim 各的（互不干扰）", async () => {
      const schedule1 = createSchedule({ id: "sched-1" });
      const schedule2 = createSchedule({
        id: "sched-2",
        next_run_at: "2024-01-01T01:00:00.000Z",
      });

      mockState.fetchResult = { data: [schedule1, schedule2], error: null };
      mockState.updateResults = [
        { data: [schedule1], error: null }, // sched-1 claim 成功
        { data: [schedule2], error: null }, // sched-2 claim 成功
      ];
      executeSpy.mockResolvedValue("task-1");

      await internals.executeDueSchedules();

      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(mockPublish).toHaveBeenCalledTimes(2);

      // 两次 claim，无 rollback
      expect(captured.updates).toHaveLength(2);
      expect(captured.updates[0].eqFilters).toContainEqual(["id", "sched-1"]);
      expect(captured.updates[1].eqFilters).toContainEqual(["id", "sched-2"]);
    });
  });

  describe("executeSchedule 失败回滚", () => {
    it("executeSchedule 抛出异常 → 回滚 next_run_at 为原值", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [
        { data: [schedule], error: null }, // claim 成功
        { data: null, error: null }, // rollback 结果
      ];
      executeSpy.mockRejectedValue(new Error("execute failed"));

      await internals.executeDueSchedules();

      // executeSchedule 被调用但抛出
      expect(executeSpy).toHaveBeenCalledTimes(1);

      // 事件未发布
      expect(mockPublish).not.toHaveBeenCalled();

      // 两次 update：claim + rollback
      expect(captured.updates).toHaveLength(2);

      // claim: next_run_at 为新值，含 is_active 条件
      const claim = captured.updates[0];
      expect(claim.payload.next_run_at).not.toBe("2024-01-01T00:00:00.000Z");
      expect(claim.eqFilters).toContainEqual(["is_active", true]);

      // rollback: next_run_at 恢复为原值
      const rollback = captured.updates[1];
      expect(rollback.payload.next_run_at).toBe("2024-01-01T00:00:00.000Z");
      expect(rollback.eqFilters).toContainEqual(["id", "sched-1"]);
      // rollback 仅按 id 回滚，不含 is_active 条件
      expect(rollback.eqFilters).not.toContainEqual(["is_active", true]);
    });

    it("rollback 自身失败时不影响主流程（错误被捕获）", async () => {
      const schedule = createSchedule();
      mockState.fetchResult = { data: [schedule], error: null };
      mockState.updateResults = [
        { data: [schedule], error: null },
        { data: null, error: null },
      ];
      executeSpy.mockRejectedValue(new Error("execute failed"));

      // 即使 rollback 失败也不应抛出（rollbackScheduleNextRun 内部 try-catch）
      await expect(internals.executeDueSchedules()).resolves.toBeUndefined();
    });
  });
});
