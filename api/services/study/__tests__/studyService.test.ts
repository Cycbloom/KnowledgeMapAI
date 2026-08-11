import { describe, it, expect, vi, beforeEach } from "vitest";
import { Rating } from "ts-fsrs";
import { MASTERY_THRESHOLDS } from "../../../../shared/constants/masteryThresholds";

// Mock cacheService 以绕过缓存（始终调用 fetchFn），避免测试间缓存状态泄露
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
  CacheKeys: {
    STUDY_CARDS: (graphId: string) => `study_cards_${graphId}`,
  },
}));

vi.mock("../masteryCalculationService", () => ({
  masteryCalculationService: {
    updateKnowledgePointMastery: vi.fn(async () => undefined),
  },
}));

vi.mock("../../core", () => ({
  appEventBus: {
    publish: vi.fn(),
  },
}));

import {
  studyService,
  mapBinaryRating,
  selectStrategyForNode,
  handlePreviewMode,
} from "../studyService";
import {
  createMockSupabase,
  type MockSupabaseClient,
  type MockQueryChain,
} from "../../../../tests/helpers/mockFactories";

function makeChain(data: unknown, error: unknown = null): MockQueryChain {
  const client = createMockSupabase({ data, error }) as unknown as MockSupabaseClient;
  return client._queryChain;
}

describe("StudyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mapBinaryRating", () => {
    it("应该在 correct 为 true 时返回 Rating.Good", () => {
      expect(mapBinaryRating(true)).toBe(Rating.Good);
    });

    it("应该在 correct 为 false 时返回 Rating.Again", () => {
      expect(mapBinaryRating(false)).toBe(Rating.Again);
    });
  });

  describe("selectStrategyForNode", () => {
    it("应该在 fsrsState 为 null 时返回 deep", () => {
      expect(selectStrategyForNode(0.5, null, null)).toBe("deep");
    });

    it("应该在 fsrsState 为 New 时返回 deep", () => {
      expect(selectStrategyForNode(0.5, "New", 1)).toBe("deep");
    });

    it("应该在距离上次复习超过 14 天时返回 drill", () => {
      expect(selectStrategyForNode(0.5, "Review", 15)).toBe("drill");
    });

    it("应该在掌握度达到 PRACTICE_QUIZ 阈值时返回 review", () => {
      expect(
        selectStrategyForNode(MASTERY_THRESHOLDS.PRACTICE_QUIZ, "Review", 5),
      ).toBe("review");
    });

    it("应该在低掌握度且近期复习时返回 deep", () => {
      expect(selectStrategyForNode(0.3, "Review", 5)).toBe("deep");
    });
  });

  describe("handlePreviewMode", () => {
    it("应该更新知识点的最后学习时间", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      // from("knowledge_points").update().eq() → awaitable
      inner.from.mockReturnValueOnce(makeChain(null));

      await handlePreviewMode(supabase, "user1", "kp1");

      expect(inner.from).toHaveBeenCalledWith("knowledge_points");
    });
  });

  describe("getCards", () => {
    it("应该根据 knowledgePointId 返回卡片列表", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const cards = [
        { id: "c1", user_id: "user1", knowledge_point_id: "kp1", question: "q1", answer: "a1" },
        { id: "c2", user_id: "user1", knowledge_point_id: "kp1", question: "q2", answer: "a2" },
      ];
      inner.from.mockReturnValueOnce(makeChain(cards));

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("c1");
    });

    it("应该根据 graphId 通过缓存返回卡片列表", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const cards = [{ id: "c1", user_id: "user1", graph_id: "g1" }];
      inner.from.mockReturnValueOnce(makeChain(cards));

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        graphId: "g1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("应该在 dueOnly 为 true 时仅返回到期卡片", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const cards = [
        { id: "c1", user_id: "user1", graph_id: "g1", next_review: pastDate },
        { id: "c2", user_id: "user1", graph_id: "g1", next_review: futureDate },
      ];
      // 走 graphId 路径，dueOnly 在客户端进行 filter（studyService.ts:182-185）
      inner.from.mockReturnValueOnce(makeChain(cards));

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        graphId: "g1",
        dueOnly: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));

      await expect(
        studyService.getCards(supabase, { userId: "user1", knowledgePointId: "kp1" }),
      ).rejects.toThrow();
    });

    it("应该在无匹配卡片时返回空数组", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp-nonexistent",
      });

      expect(result).toEqual([]);
    });
  });

  describe("getCards (pagination & filtering)", () => {
    it("应该返回分页结构 items/total/page/pageSize 并对结果应用 range", async () => {
      const cardItems = [
        { id: "c1", user_id: "user1", question: "q1", answer: "a1" },
        { id: "c2", user_id: "user1", question: "q2", answer: "a2" },
      ];
      const supabase = createMockSupabase({
        data: cardItems,
        error: null,
        count: 25,
      });
      const inner = supabase as unknown as MockSupabaseClient;

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        page: 1,
        pageSize: 20,
      });

      expect(Array.isArray(result)).toBe(false);
      if (Array.isArray(result)) return;
      expect(result.items).toEqual(cardItems);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(inner._queryChain.range).toHaveBeenCalledWith(0, 19);
    });

    it("应该对非法 page=0 回退到第一页", async () => {
      const cardItems = [{ id: "c1", user_id: "user1", question: "q1", answer: "a1" }];
      const supabase = createMockSupabase({
        data: cardItems,
        error: null,
        count: 25,
      });
      const inner = supabase as unknown as MockSupabaseClient;

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        page: 0,
        pageSize: 20,
      });

      if (Array.isArray(result)) return;
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(inner._queryChain.range).toHaveBeenCalledWith(0, 19);
    });

    it("应该对非法 pageSize=0 回退到 pageSize=1", async () => {
      const cardItems = [{ id: "c1", user_id: "user1", question: "q1", answer: "a1" }];
      const supabase = createMockSupabase({
        data: cardItems,
        error: null,
        count: 25,
      });

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        page: 1,
        pageSize: 0,
      });

      if (Array.isArray(result)) return;
      expect(result.pageSize).toBe(1);
    });

    it("应该在不传分页参数时返回全量 StudyCard 数组", async () => {
      const cardItems = [
        { id: "c1", user_id: "user1", knowledge_point_id: "kp1", question: "q1", answer: "a1" },
        { id: "c2", user_id: "user1", knowledge_point_id: "kp1", question: "q2", answer: "a2" },
      ];
      const supabase = createMockSupabase({ data: cardItems, error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      const result = await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(inner._queryChain.range).not.toHaveBeenCalled();
    });

    it("应该通过 or 应用 search 过滤（question/answer ilike）", async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
        search: "abc",
      });

      expect(inner._queryChain.or).toHaveBeenCalledWith(
        "question.ilike.%abc%,answer.ilike.%abc%",
      );
    });

    it("应该叠加 card_type/review_count/next_review 过滤", async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
        cardType: "choice",
        reviewCountMin: 3,
        reviewCountMax: 10,
        nextReviewStart: "2026-01-01",
        nextReviewEnd: "2026-12-31",
      });

      expect(inner._queryChain.eq).toHaveBeenCalledWith("card_type", "choice");
      expect(inner._queryChain.gte).toHaveBeenCalledWith("review_count", 3);
      expect(inner._queryChain.lte).toHaveBeenCalledWith("review_count", 10);
      expect(inner._queryChain.gte).toHaveBeenCalledWith("next_review", "2026-01-01");
      expect(inner._queryChain.lte).toHaveBeenCalledWith("next_review", "2026-12-31");
    });

    it("应该在 fsrs_state 为单值时使用 eq 过滤", async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
        fsrsState: "Review",
      });

      expect(inner._queryChain.eq).toHaveBeenCalledWith("fsrs_state", "Review");
    });

    it("应该在 fsrs_state 为多值逗号分隔时使用 in 过滤", async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
        fsrsState: "New,Learning",
      });

      expect(inner._queryChain.in).toHaveBeenCalledWith("fsrs_state", ["New", "Learning"]);
    });

    it("应该在传入 knowledge_point_ids 时使用 in 过滤", async () => {
      const supabase = createMockSupabase({ data: [], error: null });
      const inner = supabase as unknown as MockSupabaseClient;

      await studyService.getCards(supabase, {
        userId: "user1",
        knowledgePointIds: ["kp1", "kp2"],
      });

      expect(inner._queryChain.in).toHaveBeenCalledWith("knowledge_point_id", ["kp1", "kp2"]);
    });
  });

  describe("createCard", () => {
    it("应该成功创建卡片并返回结果", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const createdCard = { id: "new-card", user_id: "user1", question: "q", answer: "a" };
      // insert().select().single() → returns created card
      inner.from.mockReturnValueOnce(makeChain(createdCard));

      const result = await studyService.createCard(supabase, {
        userId: "user1",
        knowledgePointId: "kp1",
        sourceGraphId: "g1",
        question: "q",
        answer: "a",
      });

      expect(result.id).toBe("new-card");
    });

    it("应该在数据库插入错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Insert failed" }));

      await expect(
        studyService.createCard(supabase, {
          userId: "user1",
          knowledgePointId: "kp1",
          sourceGraphId: "g1",
          question: "q",
          answer: "a",
        }),
      ).rejects.toThrow();
    });
  });

  describe("createCardsBatch", () => {
    it("应该在传入空数组时返回空数组", async () => {
      const supabase = createMockSupabase();
      const result = await studyService.createCardsBatch(supabase, [], "user1");
      expect(result).toEqual([]);
    });

    it("应该成功批量创建卡片", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const createdCards = [
        { id: "c1", user_id: "user1", question: "q1" },
        { id: "c2", user_id: "user1", question: "q2" },
      ];
      inner.from.mockReturnValueOnce(makeChain(createdCards));

      const result = await studyService.createCardsBatch(
        supabase,
        [
          { knowledgePointId: "kp1", sourceGraphId: "g1", question: "q1", answer: "a1" },
          { knowledgePointId: "kp2", sourceGraphId: "g1", question: "q2", answer: "a2" },
        ],
        "user1",
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("updateProgress", () => {
    it("应该在卡片不存在时抛出 AppError", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Not found" }));

      await expect(
        studyService.updateProgress(supabase, "nonexistent", 3, "user1"),
      ).rejects.toThrow();
    });

    it("应该在 data 为 null 时抛出 AppError", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null));

      await expect(
        studyService.updateProgress(supabase, "card1", 3, "user1"),
      ).rejects.toThrow();
    });

    it("应该在正常复习时返回更新后的卡片与调度结果", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 使用与 createCard 一致的空 New 卡片（全零），确保 ts-fsrs repeat 可正常计算
      const existingCard = {
        id: "card1", user_id: "user1", knowledge_point_id: "kp1", graph_id: "g1",
        next_review: new Date().toISOString(),
        fsrs_stability: 0, fsrs_difficulty: 0, fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0, review_count: 0, fsrs_state: "New",
        fsrs_last_review: null, fsrs_retrievability: 0,
      };
      const updatedCard = { ...existingCard, review_count: 1, fsrs_state: "Learning", fsrs_stability: 2 };

      inner.from
        .mockReturnValueOnce(makeChain(existingCard))
        .mockReturnValueOnce(makeChain({ settings: {} }))
        .mockReturnValueOnce(makeChain(updatedCard));

      const result = await studyService.updateProgress(supabase, "card1", 3, "user1");

      expect(result.card).toBeDefined();
      expect(result.scheduledCard).toBeDefined();
      expect(result.scheduledCard.due).toBeInstanceOf(Date);
      expect(result.scheduledCard.reps).toBeGreaterThanOrEqual(1);
    });

    it("应该在 quality 为 4（Easy）时正确调度", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 使用与 createCard 一致的空 New 卡片（全零），确保 ts-fsrs repeat 可正常计算
      const existingCard = {
        id: "card1", user_id: "user1", knowledge_point_id: "kp1", graph_id: "g1",
        next_review: new Date().toISOString(),
        fsrs_stability: 0, fsrs_difficulty: 0, fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0, review_count: 0, fsrs_state: "New",
        fsrs_last_review: null, fsrs_retrievability: 0,
      };

      inner.from
        .mockReturnValueOnce(makeChain(existingCard))
        .mockReturnValueOnce(makeChain({ settings: {} }))
        .mockReturnValueOnce(makeChain({ ...existingCard, review_count: 1 }));

      const result = await studyService.updateProgress(supabase, "card1", 4, "user1");

      expect(result.scheduledCard).toBeDefined();
      expect(result.scheduledCard.scheduled_days).toBeGreaterThanOrEqual(1);
    });
  });

  describe("deleteCard", () => {
    it("应该成功删除卡片", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from
        .mockReturnValueOnce(makeChain({ graph_id: "g1" }))
        .mockReturnValueOnce(makeChain(null));

      await studyService.deleteCard(supabase, "card1");

      expect(inner.from).toHaveBeenCalledWith("study_cards");
    });

    it("应该在获取卡片信息出错时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Fetch error" }));

      await expect(studyService.deleteCard(supabase, "card1")).rejects.toThrow();
    });

    it("应该在删除操作出错时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from
        .mockReturnValueOnce(makeChain({ graph_id: "g1" }))
        .mockReturnValueOnce(makeChain(null, { message: "Delete failed" }));

      await expect(studyService.deleteCard(supabase, "card1")).rejects.toThrow();
    });
  });

  describe("getStudyStats", () => {
    it("应该正确计算学习统计指标", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const cards = [
        { fsrs_state: "New", fsrs_retrievability: 0.5, fsrs_stability: 1, fsrs_difficulty: 0.3, next_review: pastDate },
        { fsrs_state: "Review", fsrs_retrievability: 0.8, fsrs_stability: 3, fsrs_difficulty: 0.5, next_review: futureDate },
        { fsrs_state: "Learning", fsrs_retrievability: 0.3, fsrs_stability: 0.5, fsrs_difficulty: 0.7, next_review: pastDate },
      ];
      inner.from.mockReturnValueOnce(makeChain(cards));

      const result = await studyService.getStudyStats(supabase, "user1");

      expect(result.totalCards).toBe(3);
      expect(result.dueCards).toBe(2);
      expect(result.newCards).toBe(1);
      expect(result.reviewCards).toBe(1);
      expect(result.learningCards).toBe(1);
    });

    it("应该在无卡片时返回全部为零的统计", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await studyService.getStudyStats(supabase, "user1");

      expect(result.totalCards).toBe(0);
      expect(result.dueCards).toBe(0);
      expect(result.averageRetrievability).toBe(0);
      expect(result.averageStability).toBe(0);
    });

    it("应该在数据库查询错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Stats error" }));

      await expect(studyService.getStudyStats(supabase, "user1")).rejects.toThrow();
    });
  });

  describe("insertCards", () => {
    it("应该成功插入卡片并返回 success: true", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null));

      const result = await studyService.insertCards(supabase, [
        {
          user_id: "user1", knowledge_point_id: "kp1", graph_id: "g1",
          question: "q", answer: "a",
          next_review: new Date().toISOString(), difficulty: 1,
          fsrs_state: "New", fsrs_stability: 0, fsrs_difficulty: 0,
          fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_retrievability: 0,
        },
      ]);

      expect(result.success).toBe(true);
    });

    it("应该在插入错误时返回 success: false 和错误信息", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Insert constraint violated" }));

      const result = await studyService.insertCards(supabase, [
        {
          user_id: "user1", knowledge_point_id: "kp1", graph_id: "g1",
          question: "q", answer: "a",
          next_review: new Date().toISOString(), difficulty: 1,
          fsrs_state: "New", fsrs_stability: 0, fsrs_difficulty: 0,
          fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_retrievability: 0,
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insert constraint violated");
    });
  });

  describe("getUserStudyStats", () => {
    it("应该通过 RPC 调用获取用户学习统计", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const rpcResult = {
        metrics: { totalCards: 10, dueToday: 3, learning: 2, avgStability: 1.5 },
      };
      inner.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

      const result = await studyService.getUserStudyStats(supabase, "user1");

      expect(result.metrics.totalCards).toBe(10);
      expect(result.metrics.dueToday).toBe(3);
      expect(inner.rpc).toHaveBeenCalledWith("get_user_study_stats", { p_user_id: "user1" });
    });

    it("应该在 RPC 调用出错时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC failed" } });

      await expect(studyService.getUserStudyStats(supabase, "user1")).rejects.toThrow();
    });
  });
});
