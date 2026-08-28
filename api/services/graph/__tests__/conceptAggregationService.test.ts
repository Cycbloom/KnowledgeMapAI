import { describe, it, expect, vi, beforeEach } from "vitest";

// 最小化 mock：只保留 import 依赖，测试仅覆盖 addAliases 的 JSONB title 解码路径
vi.mock("../../ai/aiService", () => ({
  aiService: { generateEmbedding: vi.fn(async () => undefined) },
}));

vi.mock("../../common/cacheService", () => ({
  cacheService: {
    getOrSet: vi.fn(
      async (_key: string, fetchFn: () => Promise<unknown>) => fetchFn(),
    ),
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => true),
    del: vi.fn(async () => 1),
    delByTags: vi.fn(async () => 1),
    invalidateGraphCache: vi.fn(async () => undefined),
  },
  CacheKeys: {},
}));

vi.mock("./conceptSimilarityService", () => ({
  conceptSimilarityService: {},
}));

vi.mock("./conceptEmbeddingService", () => ({
  conceptEmbeddingService: {},
}));

import { conceptAggregationService } from "../conceptAggregationService";

describe("conceptAggregationService.addAliases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应解析 locale-keyed JSONB title（对象形状）后再做别名去重，不触发崩溃", async () => {
    const kpRow = {
      id: "kp-1",
      // title 在 JSONB 迁移后由 PostgREST 反序列化为对象（{ "zh-CN": "标题" }）
      title: { "zh-CN": "量子计算" },
      properties: {},
    };

    let updatePayload: unknown = undefined;

    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: kpRow, error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updatePayload = payload;
          return { eq: async () => ({ error: null }) };
        },
      })),
    } as unknown as Parameters<typeof conceptAggregationService.addAliases>[0];

    await expect(
      conceptAggregationService.addAliases(supabase, "kp-1", ["量子计算", "别名A"]),
    ).resolves.toBeUndefined();

    // 去重后仅新增"别名A"，且 properties.aliases 写入的是字符串而非 JSONB 对象
    const properties = (updatePayload as { properties: { aliases: string[] } })
      .properties;
    expect(properties.aliases).toEqual(["别名A"]);
  });
});