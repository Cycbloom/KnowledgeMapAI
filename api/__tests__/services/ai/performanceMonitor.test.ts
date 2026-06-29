import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown;
  count?: number | null;
  error: unknown;
};

interface CapturedQuery {
  table: string;
  selectColumns: string | null;
  selectOptions: { count?: string; head?: boolean } | null;
  eqFilters: Array<[string, unknown]>;
  gtFilters: Array<[string, unknown]>;
  gteFilters: Array<[string, unknown]>;
  ltFilters: Array<[string, unknown]>;
  lteFilters: Array<[string, unknown]>;
  orders: Array<{ column: string; ascending: boolean }>;
  limits: number[];
  ranges: Array<[number, number]>;
  inserts: Array<Record<string, unknown>>;
  isDelete: boolean;
  isSingle: boolean;
}

// ---------------------------------------------------------------------------
// Hoisted mock state (must be available before vi.mock factories run)
// ---------------------------------------------------------------------------

const { mockClient, mockState, captured, resetMock } = vi.hoisted(() => {
  const mockState: { queryResult: QueryResult } = {
    queryResult: { data: [], count: 0, error: null },
  };

  const captured: {
    queries: CapturedQuery[];
  } = { queries: [] };

  const resetMock = () => {
    mockState.queryResult = { data: [], count: 0, error: null };
    captured.queries = [];
  };

  /**
   * Minimal chainable query builder mock that is also awaitable (PromiseLike).
   *
   * Records select/eq/gt/gte/lt/lte/order/limit/range/insert/delete/single
   * operations so tests can assert on the exact payload and filters.
   * The awaited result is decided by `mockState.queryResult`.
   */
  interface MockChain {
    select: (
      cols?: string,
      options?: { count?: string; head?: boolean },
    ) => MockChain;
    eq: (col: string, val: unknown) => MockChain;
    gt: (col: string, val: unknown) => MockChain;
    gte: (col: string, val: unknown) => MockChain;
    lt: (col: string, val: unknown) => MockChain;
    lte: (col: string, val: unknown) => MockChain;
    order: (col: string, opts: { ascending: boolean }) => MockChain;
    limit: (n: number) => MockChain;
    range: (from: number, to: number) => MockChain;
    insert: (payload: Record<string, unknown>) => MockChain;
    delete: () => MockChain;
    single: () => Promise<QueryResult>;
    then: <T1, T2>(
      onFulfilled?:
        | ((value: QueryResult) => T1 | PromiseLike<T1>)
        | null
        | undefined,
      onRejected?:
        | ((reason: unknown) => T2 | PromiseLike<T2>)
        | null
        | undefined,
    ) => Promise<T1 | T2>;
  }

  const createChain = (table: string): MockChain => {
    const capturedQuery: CapturedQuery = {
      table,
      selectColumns: null,
      selectOptions: null,
      eqFilters: [],
      gtFilters: [],
      gteFilters: [],
      ltFilters: [],
      lteFilters: [],
      orders: [],
      limits: [],
      ranges: [],
      inserts: [],
      isDelete: false,
      isSingle: false,
    };
    captured.queries.push(capturedQuery);

    const chain: MockChain = {
      select: (cols, options) => {
        capturedQuery.selectColumns = cols ?? null;
        capturedQuery.selectOptions = options ?? null;
        return chain;
      },
      eq: (col, val) => {
        capturedQuery.eqFilters.push([col, val]);
        return chain;
      },
      gt: (col, val) => {
        capturedQuery.gtFilters.push([col, val]);
        return chain;
      },
      gte: (col, val) => {
        capturedQuery.gteFilters.push([col, val]);
        return chain;
      },
      lt: (col, val) => {
        capturedQuery.ltFilters.push([col, val]);
        return chain;
      },
      lte: (col, val) => {
        capturedQuery.lteFilters.push([col, val]);
        return chain;
      },
      order: (col, opts) => {
        capturedQuery.orders.push({
          column: col,
          ascending: opts.ascending,
        });
        return chain;
      },
      limit: (n) => {
        capturedQuery.limits.push(n);
        return chain;
      },
      range: (from, to) => {
        capturedQuery.ranges.push([from, to]);
        return chain;
      },
      insert: (payload) => {
        capturedQuery.inserts.push(payload);
        return chain;
      },
      delete: () => {
        capturedQuery.isDelete = true;
        return chain;
      },
      single: async () => {
        capturedQuery.isSingle = true;
        return mockState.queryResult;
      },
      then: (onFulfilled, onRejected) =>
        Promise.resolve(mockState.queryResult).then(
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

vi.mock("../../../utils/logger", () => ({
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
import { performanceMonitor } from "../../../services/ai/performanceMonitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 构造一个 DB 行（snake_case）。
 * 字段对齐 ai_performance_logs 表结构。
 */
const createDbRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: "log-1",
  timestamp: 1700000000000,
  operation: "chat",
  session_id: null,
  model: "test-model",
  provider: "openai",
  input_tokens: 100,
  output_tokens: 50,
  total_tokens: 150,
  cached_input_tokens: null,
  uncached_input_tokens: null,
  reasoning_tokens: null,
  cache_hit_rate: null,
  estimated_cost: "0.005",
  duration: 1200,
  success: true,
  error_message: null,
  cost_breakdown: null,
  metadata: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PerformanceMonitor - 多实例化（DB-backed）", () => {
  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize()", () => {
    it("不再调用 loadFromDatabase / from('ai_performance_logs')", async () => {
      await performanceMonitor.initialize();

      // initialize 仅设置 initialized 标志，不应触发任何 DB 查询
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("幂等：多次调用不重复初始化", async () => {
      await performanceMonitor.initialize();
      await performanceMonitor.initialize();

      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  describe("getLogs(query) - 直接查 DB", () => {
    it("调用 from('ai_performance_logs') 并按 timestamp DESC 排序", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      await performanceMonitor.getLogs();

      expect(mockClient.from).toHaveBeenCalledWith("ai_performance_logs");
      expect(captured.queries).toHaveLength(1);
      const q = captured.queries[0];
      expect(q.selectColumns).toBe("*");
      expect(q.selectOptions).toEqual({ count: "exact" });
      expect(q.orders).toContainEqual({
        column: "timestamp",
        ascending: false,
      });
    });

    it("应用 operation / provider / success / startTime / endTime 过滤", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      await performanceMonitor.getLogs({
        operation: "chat",
        provider: "openai",
        success: true,
        startTime: 1000,
        endTime: 2000,
      });

      const q = captured.queries[0];
      expect(q.eqFilters).toContainEqual(["operation", "chat"]);
      expect(q.eqFilters).toContainEqual(["provider", "openai"]);
      expect(q.eqFilters).toContainEqual(["success", true]);
      expect(q.gteFilters).toContainEqual(["timestamp", 1000]);
      expect(q.lteFilters).toContainEqual(["timestamp", 2000]);
    });

    it("使用 limit/offset 通过 range 分页", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      await performanceMonitor.getLogs({ limit: 10, offset: 20 });

      const q = captured.queries[0];
      expect(q.ranges).toContainEqual([20, 29]);
    });

    it("默认 limit=50, offset=0 → range(0, 49)", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      await performanceMonitor.getLogs();

      const q = captured.queries[0];
      expect(q.ranges).toContainEqual([0, 49]);
    });

    it("DB 返回数据时正确映射 snake_case → camelCase", async () => {
      const row = createDbRow({
        id: "log-abc",
        operation: "chat",
        input_tokens: 200,
        cached_input_tokens: 50,
        estimated_cost: "0.0123",
        cache_hit_rate: "25.5",
      });
      mockState.queryResult = { data: [row], count: 1, error: null };

      const result = await performanceMonitor.getLogs();

      expect(result.logs).toHaveLength(1);
      const log = result.logs[0];
      expect(log.id).toBe("log-abc");
      expect(log.operation).toBe("chat");
      expect(log.inputTokens).toBe(200);
      expect(log.cachedInputTokens).toBe(50);
      expect(log.estimatedCost).toBeCloseTo(0.0123);
      expect(log.cacheHitRate).toBeCloseTo(25.5);
      expect(result.total).toBe(1);
    });

    it("DB 返回 error 时返回空数组与 0 total（不抛出）", async () => {
      mockState.queryResult = {
        data: null,
        count: 0,
        error: { message: "DB error" },
      };

      const result = await performanceMonitor.getLogs();

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getStats(query) - 走 DB 聚合", () => {
    it("通过 getLogs 从 DB 拉取数据后内存聚合", async () => {
      const rows = [
        createDbRow({
          id: "log-1",
          operation: "chat",
          provider: "openai",
          model: "gpt-4",
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          estimated_cost: "0.01",
          duration: 1000,
          success: true,
        }),
        createDbRow({
          id: "log-2",
          operation: "chat",
          provider: "openai",
          model: "gpt-4",
          input_tokens: 200,
          output_tokens: 100,
          total_tokens: 300,
          estimated_cost: "0.02",
          duration: 2000,
          success: false,
          error_message: "timeout",
        }),
      ];
      mockState.queryResult = { data: rows, count: 2, error: null };

      const stats = await performanceMonitor.getStats();

      // 走 DB：from('ai_performance_logs') 被调用
      expect(mockClient.from).toHaveBeenCalledWith("ai_performance_logs");
      // getStats 内部用 limit=MAX_LOGS(1000) 调 getLogs
      const q = captured.queries[0];
      expect(q.ranges).toContainEqual([0, 999]);

      // 聚合断言
      expect(stats.totalRequests).toBe(2);
      expect(stats.successRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
      expect(stats.totalTokens).toBe(450);
      expect(stats.totalCost).toBeCloseTo(0.03);
      // byOperation
      expect(stats.byOperation["chat"].count).toBe(2);
      expect(stats.byOperation["chat"].tokens).toBe(450);
      // byModel
      expect(stats.byModel["openai/gpt-4"].count).toBe(2);
    });

    it("传递 query 过滤条件到 getLogs", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      await performanceMonitor.getStats({
        operation: "embedding",
        startTime: 5000,
      });

      const q = captured.queries[0];
      expect(q.eqFilters).toContainEqual(["operation", "embedding"]);
      expect(q.gteFilters).toContainEqual(["timestamp", 5000]);
    });

    it("DB 返回空时返回零值 stats（不抛出）", async () => {
      mockState.queryResult = { data: [], count: 0, error: null };

      const stats = await performanceMonitor.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.byOperation).toEqual({});
      expect(stats.byModel).toEqual({});
    });
  });

  describe("recordLog(log) - 写入 DB", () => {
    it("调用 from('ai_performance_logs').insert(payload) 持久化", async () => {
      mockState.queryResult = { data: null, error: null };

      await performanceMonitor.recordLog({
        operation: "chat",
        provider: "openai",
        model: "gpt-4",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
        duration: 1200,
        success: true,
        sessionId: "session-1",
        metadata: { graphId: "graph-1", userId: "user-1" },
      });

      expect(mockClient.from).toHaveBeenCalledWith("ai_performance_logs");
      const q = captured.queries[0];
      expect(q.inserts).toHaveLength(1);
      const payload = q.inserts[0];
      // 验证 snake_case 字段映射
      expect(payload.operation).toBe("chat");
      expect(payload.provider).toBe("openai");
      expect(payload.model).toBe("gpt-4");
      expect(payload.input_tokens).toBe(100);
      expect(payload.output_tokens).toBe(50);
      expect(payload.total_tokens).toBe(150);
      expect(payload.estimated_cost).toBe(0.01);
      expect(payload.duration).toBe(1200);
      expect(payload.success).toBe(true);
      expect(payload.session_id).toBe("session-1");
      expect(payload.user_id).toBe("user-1");
      expect(payload.metadata).toEqual({ graphId: "graph-1", userId: "user-1" });
      // 自动生成 id 与 timestamp
      expect(typeof payload.id).toBe("string");
      expect(typeof payload.timestamp).toBe("number");
    });

    it("不再写入内存 buffer（无 this.logs 数组）", async () => {
      // 此测试通过反射验证：performanceMonitor 实例上不应有 logs 私有字段。
      // 多实例化改造的核心契约：状态不应保存在内存中。
      const instance = performanceMonitor as unknown as {
        logs?: unknown;
      };
      expect(instance.logs).toBeUndefined();
    });

    it("DB 写入失败时不抛出（错误被捕获并记录 warn）", async () => {
      mockState.queryResult = {
        data: null,
        error: { message: "insert failed" },
      };

      await expect(
        performanceMonitor.recordLog({
          operation: "chat",
          provider: "openai",
          model: "gpt-4",
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          estimatedCost: 0.001,
          duration: 100,
          success: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("getLogsBySession(sessionId) - 走 DB 查询", () => {
    it("调用 from('ai_performance_logs').eq('session_id', ...)", async () => {
      mockState.queryResult = { data: [], error: null };

      await performanceMonitor.getLogsBySession("session-xyz");

      expect(mockClient.from).toHaveBeenCalledWith("ai_performance_logs");
      const q = captured.queries[0];
      expect(q.eqFilters).toContainEqual(["session_id", "session-xyz"]);
      expect(q.orders).toContainEqual({
        column: "timestamp",
        ascending: false,
      });
    });

    it("DB 返回数据时正确映射", async () => {
      const row = createDbRow({
        id: "log-sess",
        session_id: "session-xyz",
        operation: "chat",
      });
      mockState.queryResult = { data: [row], error: null };

      const logs = await performanceMonitor.getLogsBySession("session-xyz");

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("log-sess");
      expect(logs[0].sessionId).toBe("session-xyz");
    });

    it("DB 返回 error 时返回空数组（不抛出）", async () => {
      mockState.queryResult = {
        data: null,
        error: { message: "DB error" },
      };

      const logs = await performanceMonitor.getLogsBySession("session-xyz");

      expect(logs).toEqual([]);
    });
  });

  describe("clearLogs() - 基于 DB 删除", () => {
    it("传 beforeTimestamp：调用 delete().lt('timestamp', before) 并返回删除条数", async () => {
      mockState.queryResult = {
        data: [{ id: "a" }, { id: "b" }, { id: "c" }],
        error: null,
      };

      const deleted = await performanceMonitor.clearLogs(1700000000000);

      expect(mockClient.from).toHaveBeenCalledWith("ai_performance_logs");
      const q = captured.queries[0];
      expect(q.isDelete).toBe(true);
      expect(q.ltFilters).toContainEqual(["timestamp", 1700000000000]);
      expect(q.selectColumns).toBe("id");
      expect(deleted).toBe(3);
    });

    it("不传 beforeTimestamp：默认删除 30 天前的日志", async () => {
      mockState.queryResult = { data: [], error: null };

      const before = Date.now();
      const deleted = await performanceMonitor.clearLogs();
      const after = Date.now();

      expect(deleted).toBe(0);
      const q = captured.queries[0];
      expect(q.isDelete).toBe(true);
      // 验证 cutoff 在 [before-30d, after-30d] 范围内
      expect(q.ltFilters).toHaveLength(1);
      const cutoff = q.ltFilters[0][1] as number;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(cutoff).toBeGreaterThanOrEqual(before - thirtyDaysMs);
      expect(cutoff).toBeLessThanOrEqual(after - thirtyDaysMs);
    });

    it("DB 返回 error 时返回 0（不抛出）", async () => {
      mockState.queryResult = {
        data: null,
        error: { message: "delete failed" },
      };

      const deleted = await performanceMonitor.clearLogs(1700000000000);

      expect(deleted).toBe(0);
    });
  });
});
