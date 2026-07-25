import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmptyCard, type Card } from "ts-fsrs";

vi.mock("../semanticInterferenceService", () => ({
  semanticInterferenceService: {
    getSemanticSpacedOrder: vi.fn(
      async <T>(_supabase: unknown, items: T[]): Promise<T[]> => items,
    ),
  },
}));

vi.mock("../topologyScheduler", () => ({
  applyTopologyPriority: vi.fn(
    async <T>(items: T[]): Promise<T[]> => items,
  ),
}));

vi.mock("../../core/eventBus", () => ({
  appEventBus: {
    publish: vi.fn(),
  },
}));

vi.mock("../studyService", () => ({
  studyService: {
    updateProgress: vi.fn(),
  },
}));

import { spacedRepetitionBridge } from "../spacedRepetitionBridge";
import { studyService } from "../studyService";
import {
  createMockSupabase,
  type MockSupabaseClient,
  type MockQueryChain,
} from "../../../../tests/helpers/mockFactories";

function makeChain(data: unknown, error: unknown = null): MockQueryChain {
  const client = createMockSupabase({ data, error }) as unknown as MockSupabaseClient;
  return client._queryChain;
}

function isoOffset(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe("SpacedRepetitionBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getUnifiedReviewQueue", () => {
    beforeEach(() => {
      // 固定时间到上午 10:00，避免 isoOffset(2) 在 22:00 后跨日导致 urgency 计算为 "upcoming"
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T10:00:00Z"));
    });

    it("应该在语义调度禁用时返回按紧急度排序的 FSRS 复习队列", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const cards = [
        { id: "c1", knowledge_point_id: "kp1", next_review: isoOffset(-2), fsrs_retrievability: 0.5 },
        { id: "c2", knowledge_point_id: "kp2", next_review: isoOffset(2), fsrs_retrievability: 0.3 },
      ];
      inner.from
        .mockReturnValueOnce(makeChain(cards))
        .mockReturnValueOnce(makeChain({ settings: { study: { semantic_scheduling: false } } }));
      const result = await spacedRepetitionBridge.getUnifiedReviewQueue(supabase, "user1");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("c1");
      expect(result[0].urgency).toBe("overdue");
      expect(result[1].urgency).toBe("today");
      expect(result[0].algorithm).toBe("fsrs");
    });

    it("应该在无复习卡片时返回空数组", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain({ settings: {} }));
      const result = await spacedRepetitionBridge.getUnifiedReviewQueue(supabase, "user1");
      expect(result).toEqual([]);
    });

    it("应该在数据库查询错误时返回空数组", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));
      const result = await spacedRepetitionBridge.getUnifiedReviewQueue(supabase, "user1");
      expect(result).toEqual([]);
    });

    it("应该在语义调度启用时调用语义排序与拓扑优先级", async () => {
      const { semanticInterferenceService } = await import("../semanticInterferenceService");
      const { applyTopologyPriority } = await import("../topologyScheduler");
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const cards = [
        { id: "c1", knowledge_point_id: "kp1", next_review: isoOffset(-2), fsrs_retrievability: 0.5 },
        { id: "c2", knowledge_point_id: "kp2", next_review: isoOffset(-1), fsrs_retrievability: 0.3 },
      ];
      inner.from
        .mockReturnValueOnce(makeChain(cards))
        .mockReturnValueOnce(makeChain({ settings: {} }));
      await spacedRepetitionBridge.getUnifiedReviewQueue(supabase, "user1");
      expect(semanticInterferenceService.getSemanticSpacedOrder).toHaveBeenCalled();
      expect(applyTopologyPriority).toHaveBeenCalled();
    });

    it("应该正确计算卡片的紧急度等级", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const cards = [
        { id: "overdue-card", knowledge_point_id: "kp1", next_review: isoOffset(-3), fsrs_retrievability: 0.5 },
        { id: "today-card", knowledge_point_id: "kp2", next_review: isoOffset(1), fsrs_retrievability: 0.5 },
      ];
      inner.from
        .mockReturnValueOnce(makeChain(cards))
        .mockReturnValueOnce(makeChain({ settings: { study: { semantic_scheduling: false } } }));
      const result = await spacedRepetitionBridge.getUnifiedReviewQueue(supabase, "user1");
      expect(result[0].id).toBe("overdue-card");
      expect(result[0].urgency).toBe("overdue");
    });
  });

  describe("processReviewCompletion", () => {
    it("应该在复习完成后返回下次复习日期和间隔天数", async () => {
      const dueDate = new Date("2025-12-31T00:00:00Z");
      const scheduledCard: Card = {
        ...createEmptyCard(),
        due: dueDate,
        scheduled_days: 7,
        reps: 1,
        state: 2,
        stability: 1.5,
        difficulty: 0.3,
        elapsed_days: 0,
      };
      vi.mocked(studyService.updateProgress).mockResolvedValue({
        card: { id: "c1", knowledge_point_id: "kp1" },
        scheduledCard,
      } as never);
      const supabase = createMockSupabase();
      const result = await spacedRepetitionBridge.processReviewCompletion(
        supabase, "user1", "card1", "kp1", 3,
      );
      expect(result).not.toBeNull();
      expect(result?.algorithm).toBe("fsrs");
      expect(result?.intervalDays).toBe(7);
      expect(result?.nextReviewDate).toBe(dueDate.toISOString());
    });

    it("应该在 studyService 抛出错误时返回 null", async () => {
      vi.mocked(studyService.updateProgress).mockRejectedValue(new Error("FSRS error") as never);
      const supabase = createMockSupabase();
      const result = await spacedRepetitionBridge.processReviewCompletion(
        supabase, "user1", "card1", "kp1", 3,
      );
      expect(result).toBeNull();
    });

    it("应该在 updateProgress 返回 null 时返回 null", async () => {
      vi.mocked(studyService.updateProgress).mockResolvedValue(null as never);
      const supabase = createMockSupabase();
      const result = await spacedRepetitionBridge.processReviewCompletion(
        supabase, "user1", "card1", "kp1", 3,
      );
      expect(result).toBeNull();
    });

    it("应该在复习成功后发布 review_completed 事件", async () => {
      const { appEventBus } = await import("../../core/eventBus");
      const dueDate = new Date("2025-12-31T00:00:00Z");
      const scheduledCard: Card = {
        ...createEmptyCard(),
        due: dueDate,
        scheduled_days: 7,
        reps: 1,
        state: 2,
        stability: 1.5,
        difficulty: 0.3,
        elapsed_days: 0,
      };
      vi.mocked(studyService.updateProgress).mockResolvedValue({
        card: { id: "c1", knowledge_point_id: "kp1" },
        scheduledCard,
      } as never);
      const supabase = createMockSupabase();
      await spacedRepetitionBridge.processReviewCompletion(
        supabase, "user1", "card1", "kp1", 4,
      );
      expect(appEventBus.publish).toHaveBeenCalledWith(
        "review_completed",
        expect.objectContaining({
          reviewTaskId: "card1",
          knowledgePointId: "kp1",
          qualityScore: 4,
          algorithm: "fsrs",
        }),
        "user1",
        "spaced_repetition_bridge",
      );
    });
  });
});
