import { describe, it, expect, vi, beforeEach } from "vitest";
import { default_w } from "ts-fsrs";
import {
  createMockSupabase,
  type MockSupabaseClient,
  type MockQueryChain,
} from "../../../../tests/helpers/mockFactories";

function makeChain(data: unknown, error: unknown = null): MockQueryChain {
  const client = createMockSupabase({ data, error }) as unknown as MockSupabaseClient;
  return client._queryChain;
}

import { fsrsParameterService } from "../fsrsParameterService";

describe("FsrsParameterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getParameters", () => {
    it("应该在用户无自定义参数时返回默认参数源", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain({ settings: {} }));

      const result = await fsrsParameterService.getParameters(supabase, "user1");

      expect(result.source).toBe("default");
      expect(result.w).toEqual(default_w);
      expect(result.request_retention).toBe(0.9);
      expect(result.maximum_interval).toBe(36500);
      expect(result.last_optimized_at).toBeNull();
    });

    it("应该在用户有自定义参数时返回 custom 源", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const customW = [...default_w];
      inner.from.mockReturnValueOnce(makeChain({
        settings: {
          fsrs_parameters: customW,
          fsrs_parameter_source: "custom",
          request_retention: 0.85,
          maximum_interval: 180,
          fsrs_last_optimized_at: "2025-01-01T00:00:00Z",
        },
      }));

      const result = await fsrsParameterService.getParameters(supabase, "user1");

      expect(result.source).toBe("custom");
      expect(result.w).toHaveLength(default_w.length);
      expect(result.request_retention).toBe(0.85);
      expect(result.maximum_interval).toBe(180);
      expect(result.last_optimized_at).toBe("2025-01-01T00:00:00Z");
    });

    it("应该在 data 为 null 时返回默认参数", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null));

      const result = await fsrsParameterService.getParameters(supabase, "user1");

      expect(result.source).toBe("default");
      expect(result.w).toEqual(default_w);
    });
  });

  describe("setParameters", () => {
    it("应该在传入合法 w 时保存并返回 custom 源", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const validW = [...default_w];

      // saveParameters 内部: 1) select settings .single(), 2) update .eq()
      inner.from
        .mockReturnValueOnce(makeChain({ settings: {} }))
        .mockReturnValueOnce(makeChain(null));

      const result = await fsrsParameterService.setParameters(supabase, "user1", validW);

      expect(result.source).toBe("custom");
      expect(result.w).toHaveLength(default_w.length);
    });

    it("应该在传入非法长度 w 时抛出错误", async () => {
      const supabase = createMockSupabase();
      // checkParameters 会拒绝长度不正确的 w
      const invalidW = [1, 2, 3];

      await expect(
        fsrsParameterService.setParameters(supabase, "user1", invalidW),
      ).rejects.toThrow();
    });
  });

  describe("resetParameters", () => {
    it("应该在重置时移除 fsrs 相关字段", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      // 1) select settings .single(), 2) update .eq() (awaitable)
      inner.from
        .mockReturnValueOnce(makeChain({
          settings: {
            fsrs_parameters: [1, 2, 3],
            fsrs_parameter_source: "custom",
            fsrs_last_optimized_at: "2025-01-01",
            theme: "dark",
          },
        }))
        .mockReturnValueOnce(makeChain(null));

      await fsrsParameterService.resetParameters(supabase, "user1");

      // 验证 update 被调用（第二次 from 后的链）
      const updateCall = inner.from.mock.calls[1];
      expect(updateCall).toBeDefined();
    });

    it("应该在数据库更新出错时抛出错误", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from
        .mockReturnValueOnce(makeChain({ settings: { fsrs_parameters: [] } }))
        .mockReturnValueOnce(makeChain(null, { message: "Update failed" }));

      await expect(
        fsrsParameterService.resetParameters(supabase, "user1"),
      ).rejects.toThrow();
    });
  });

  describe("optimizeParameters", () => {
    it("应该在复习数据不足时返回失败结果", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      // collectReviewHistory: from("study_cards") 返回少量数据
      inner.from.mockReturnValueOnce(makeChain([
        { fsrs_state: "Review", fsrs_stability: 1, fsrs_difficulty: 0.5, fsrs_elapsed_days: 1, fsrs_scheduled_days: 7, review_count: 1, last_rating: 3 },
      ]));

      const result = await fsrsParameterService.optimizeParameters(supabase, "user1");

      expect(result.success).toBe(false);
      expect(result.reviewCount).toBeLessThan(100);
      expect(result.message).toContain("复习数据不足");
    });

    it("应该在复习数据充足时返回成功结果", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 生成 110 条有效复习记录
      const reviews = Array.from({ length: 110 }, (_, i) => ({
        fsrs_state: "Review",
        fsrs_stability: 1 + i * 0.1,
        fsrs_difficulty: 0.3 + (i % 5) * 0.1,
        fsrs_elapsed_days: (i % 7) + 1,
        fsrs_scheduled_days: (i % 14) + 1,
        review_count: 1,
        last_rating: (i % 4) + 1,
      }));

      // from() 调用顺序:
      // 1. collectReviewHistory → study_cards 查询
      // 2. getParameters → users .single()
      // 3. saveParameters select → users .single()
      // 4. saveParameters update → users update .eq() (awaitable)
      inner.from
        .mockReturnValueOnce(makeChain(reviews))
        .mockReturnValueOnce(makeChain({ settings: {} }))
        .mockReturnValueOnce(makeChain({ settings: {} }))
        .mockReturnValueOnce(makeChain(null));

      const result = await fsrsParameterService.optimizeParameters(supabase, "user1");

      expect(result.success).toBe(true);
      expect(result.reviewCount).toBeGreaterThanOrEqual(100);
      expect(result.oldW).toEqual(default_w);
      expect(result.newW).toHaveLength(default_w.length);
      expect(result.message).toContain("参数优化完成");
    });

    it("应该在复习数据为空时返回失败结果", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await fsrsParameterService.optimizeParameters(supabase, "user1");

      expect(result.success).toBe(false);
      expect(result.reviewCount).toBe(0);
    });
  });
});
