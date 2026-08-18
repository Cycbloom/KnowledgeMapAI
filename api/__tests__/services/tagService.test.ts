import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";

/**
 * TagService 单元测试
 *
 * 覆盖:
 * 1. list: 三表（graphs/notes/tasks）标签聚合、同行去重、total 降序排序
 * 2. rename: 名称校验（trim/长度/相同名短路）、rpc 参数透传、缓存失效
 * 3. merge: sources 去重、数量上限、target 不得同时为 source、rpc 参数透传
 * 4. remove: rpc 参数透传、缓存失效
 * 5. rpc 错误 → AppError 500
 *
 * Mock 策略: cacheService 全量 mock 绕过缓存；supabase client 为
 * per-table chainable mock（select().eq().is() 可 await），rpc 单独记录。
 */

// Mock cacheService：getOrSet 直通 fetchFn，写操作后的失效仅记录调用
// vi.hoisted 保证 vi.mock 工厂（会被提升）中可引用这些 mock
const { delByTagsMock, delMock } = vi.hoisted(() => ({
  delByTagsMock: vi.fn(async () => 1),
  delMock: vi.fn(async () => 1),
}));
vi.mock("../../services/common/cacheService", () => ({
  cacheService: {
    getOrSet: vi.fn(
      async (_key: string, fetchFn: () => Promise<unknown>) => fetchFn(),
    ),
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => true),
    del: delMock,
    delByTags: delByTagsMock,
    invalidateGraphCache: vi.fn(async () => undefined),
  },
  CacheKeys: {
    USER_TAGS: (userId: string) => `user_tags_${userId}`,
    GRAPH_TAGS: (userId: string) => `graph_tags_${userId}`,
  },
  CacheTTL: { DYNAMIC: 30 },
}));

import { tagService } from "../../services/tags/tagService";

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

interface TableConfig {
  /** select 查询 resolve 的 data */
  data?: unknown[] | null;
}

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

interface MockClient {
  from: (table: string) => unknown;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
  _rpcCalls: RpcCall[];
  _tables: string[];
}

function createTagMockClient(config: {
  tables?: Record<string, TableConfig>;
  rpcResult?: { data?: unknown; error?: unknown } | null;
}): MockClient {
  const rpcCalls: RpcCall[] = [];
  const tables: string[] = [];

  const createChain = (tableData: unknown[] | null) => {
    const chain: Record<string, unknown> = {};
    const chainMethods = ["select", "eq", "is", "order", "limit", "range"];
    for (const method of chainMethods) {
      chain[method] = vi.fn(() => chain);
    }
    // await chain → Promise<{data, error}>
    chain.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({ data: tableData, error: null }).then(
        onFulfilled,
        onRejected,
      );
    return chain;
  };

  const client: MockClient = {
    from: (table: string) => {
      tables.push(table);
      return createChain(config.tables?.[table]?.data ?? null);
    },
    rpc: (fn: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ fn, args });
      if (config.rpcResult) {
        return Promise.resolve(config.rpcResult);
      }
      return Promise.resolve({
        data: { graphs: 1, notes: 2, tasks: 3 },
        error: null,
      });
    },
    _rpcCalls: rpcCalls,
    _tables: tables,
  };
  return client;
}

const USER_ID = "user-1";

const asClient = (mock: MockClient) => mock as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagService.list", () => {
  it("聚合三表标签计数并按 total 降序返回", async () => {
    const mock = createTagMockClient({
      tables: {
        knowledge_graphs: {
          data: [{ tags: ["a", "b"] }, { tags: ["a"] }],
        },
        notes: { data: [{ tags: ["b", "c"] }] },
        user_tasks: { data: [{ tags: ["c"] }, { tags: null }] },
      },
    });

    const { tags } = await tagService.list(asClient(mock), USER_ID);

    expect(tags).toHaveLength(3);
    // a: graphs 2；b: graphs 1 + notes 1 = 2；c: notes 1 + tasks 1 = 2
    // total 相同时按名称字母序：a, b, c
    expect(tags[0]).toEqual({
      name: "a",
      counts: { graphs: 2, notes: 0, tasks: 0 },
      total: 2,
    });
    expect(tags[1]).toEqual({
      name: "b",
      counts: { graphs: 1, notes: 1, tasks: 0 },
      total: 2,
    });
    expect(tags[2]).toEqual({
      name: "c",
      counts: { graphs: 0, notes: 1, tasks: 1 },
      total: 2,
    });
  });

  it("total 不同时按 total 降序", async () => {
    const mock = createTagMockClient({
      tables: {
        knowledge_graphs: { data: [{ tags: ["minor"] }] },
        notes: {
          data: [{ tags: ["major"] }, { tags: ["major"] }, { tags: ["major"] }],
        },
        user_tasks: { data: [] },
      },
    });

    const { tags } = await tagService.list(asClient(mock), USER_ID);

    expect(tags.map((t) => t.name)).toEqual(["major", "minor"]);
  });

  it("同一行内重复标签只计一次", async () => {
    const mock = createTagMockClient({
      tables: {
        knowledge_graphs: { data: [{ tags: ["a", "a", "a"] }] },
        notes: { data: [] },
        user_tasks: { data: [] },
      },
    });

    const { tags } = await tagService.list(asClient(mock), USER_ID);

    expect(tags).toEqual([
      {
        name: "a",
        counts: { graphs: 1, notes: 0, tasks: 0 },
        total: 1,
      },
    ]);
  });

  it("三表均无数据时返回空数组", async () => {
    const mock = createTagMockClient({
      tables: {
        knowledge_graphs: { data: [] },
        notes: { data: null },
        user_tasks: { data: [] },
      },
    });

    const { tags } = await tagService.list(asClient(mock), USER_ID);

    expect(tags).toEqual([]);
  });
});

describe("TagService.rename", () => {
  it("调用 rename_user_tag 并透传 trim 后的参数", async () => {
    const mock = createTagMockClient({});

    const result = await tagService.rename(
      asClient(mock),
      USER_ID,
      "  old  ",
      " new ",
    );

    expect(mock._rpcCalls).toEqual([
      { fn: "rename_user_tag", args: { p_user_id: USER_ID, p_from: "old", p_to: "new" } },
    ]);
    expect(result).toEqual({ graphs: 1, notes: 2, tasks: 3 });
    // 写操作后失效用户级 + 图谱标签缓存
    expect(delByTagsMock).toHaveBeenCalledWith([`user:${USER_ID}`]);
    expect(delMock).toHaveBeenCalled();
  });

  it("from 与 to 相同时短路返回零计数且不调用 rpc", async () => {
    const mock = createTagMockClient({});

    const result = await tagService.rename(asClient(mock), USER_ID, "same", "same");

    expect(result).toEqual({ graphs: 0, notes: 0, tasks: 0 });
    expect(mock._rpcCalls).toHaveLength(0);
  });

  it.each(["", "   ", "x".repeat(31)])(
    "非法名称 %j 抛出 400 AppError",
    async (invalid) => {
      const mock = createTagMockClient({});

      await expect(
        tagService.rename(asClient(mock), USER_ID, invalid, "to"),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        tagService.rename(asClient(mock), USER_ID, "from", invalid),
      ).rejects.toBeInstanceOf(AppError);
    },
  );

  it("rpc 返回错误时抛出 500 AppError", async () => {
    const mock = createTagMockClient({
      rpcResult: { data: null, error: { message: "boom" } },
    });

    await expect(
      tagService.rename(asClient(mock), USER_ID, "a", "b"),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("TagService.merge", () => {
  it("sources 去重后透传 merge_user_tags", async () => {
    const mock = createTagMockClient({});

    const result = await tagService.merge(
      asClient(mock),
      USER_ID,
      ["s1", "s2", "s1"],
      "target",
    );

    expect(mock._rpcCalls).toEqual([
      {
        fn: "merge_user_tags",
        args: { p_user_id: USER_ID, p_sources: ["s1", "s2"], p_target: "target" },
      },
    ]);
    expect(result).toEqual({ graphs: 1, notes: 2, tasks: 3 });
  });

  it("target 在 sources 中时抛出 400", async () => {
    const mock = createTagMockClient({});

    await expect(
      tagService.merge(asClient(mock), USER_ID, ["a", "b"], "a"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mock._rpcCalls).toHaveLength(0);
  });

  it("sources 去重后超过 10 个抛出 400", async () => {
    const mock = createTagMockClient({});
    const sources = Array.from({ length: 11 }, (_, i) => `s${i}`);

    await expect(
      tagService.merge(asClient(mock), USER_ID, sources, "target"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rpc 返回错误时抛出 500", async () => {
    const mock = createTagMockClient({
      rpcResult: { data: null, error: { message: "boom" } },
    });

    await expect(
      tagService.merge(asClient(mock), USER_ID, ["a"], "b"),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("TagService.remove", () => {
  it("调用 remove_user_tag 并失效缓存", async () => {
    const mock = createTagMockClient({});

    const result = await tagService.remove(asClient(mock), USER_ID, " old ");

    expect(mock._rpcCalls).toEqual([
      { fn: "remove_user_tag", args: { p_user_id: USER_ID, p_name: "old" } },
    ]);
    expect(result).toEqual({ graphs: 1, notes: 2, tasks: 3 });
    expect(delByTagsMock).toHaveBeenCalledWith([`user:${USER_ID}`]);
  });

  it("空名称抛出 400", async () => {
    const mock = createTagMockClient({});

    await expect(
      tagService.remove(asClient(mock), USER_ID, "  "),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
