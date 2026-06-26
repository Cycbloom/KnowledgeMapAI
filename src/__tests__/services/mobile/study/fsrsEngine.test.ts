import { describe, it, expect, vi } from "vitest";
import { Rating, State, createEmptyCard } from "ts-fsrs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyCard } from "../../../../../shared/types/common";
import { fsrsEngine } from "../../../../services/mobile/study/fsrsEngine";

const buildCard = (overrides: Partial<StudyCard> = {}): StudyCard => ({
  id: "card-1",
  knowledge_point_id: "kp-1",
  user_id: "user-1",
  graph_id: "graph-1",
  card_type: "qa",
  question: "q",
  answer: "a",
  next_review: new Date("2025-01-01T00:00:00Z").toISOString(),
  ...overrides,
});

const createMockSupabase = (opts: {
  data?: unknown;
  reject?: boolean;
} = {}): SupabaseClient => {
  const { data = null, reject = false } = opts;
  const single = reject
    ? vi.fn().mockRejectedValue(new Error("network error"))
    : vi.fn().mockResolvedValue({ data, error: null });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single,
  };
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
};

describe("fsrsEngine", () => {
  describe("dbCardToFSRS", () => {
    it("converts a new card with minimal fields to FSRS defaults", () => {
      const card = fsrsEngine.dbCardToFSRS(buildCard());

      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.elapsed_days).toBe(0);
      expect(card.scheduled_days).toBe(0);
      expect(card.state).toBe(State.New);
      expect(card.last_review).toBeUndefined();
      expect(card.due).toBeInstanceOf(Date);
    });

    it("maps existing FSRS fields from a reviewed card", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          review_count: 5,
          fsrs_state: "Review",
          fsrs_stability: 7.5,
          fsrs_difficulty: 5.2,
          fsrs_elapsed_days: 3,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T00:00:00Z").toISOString(),
        }),
      );

      expect(card.reps).toBe(5);
      expect(card.state).toBe(State.Review);
      expect(card.stability).toBe(7.5);
      expect(card.difficulty).toBe(5.2);
      expect(card.elapsed_days).toBe(3);
      expect(card.scheduled_days).toBe(7);
      expect(card.last_review).toBeInstanceOf(Date);
    });

    it("falls back to New state for unknown fsrs_state string", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "Bogus" }),
      );

      expect(card.state).toBe(State.New);
    });

    it("uses next_review as due date when present", () => {
      const due = "2025-06-01T00:00:00Z";
      const card = fsrsEngine.dbCardToFSRS(buildCard({ next_review: due }));

      expect(card.due).toEqual(new Date(due));
    });
  });

  describe("mapQualityToRating", () => {
    it.each([
      [0, Rating.Again],
      [1, Rating.Again],
      [2, Rating.Hard],
      [3, Rating.Good],
      [4, Rating.Easy],
      [5, Rating.Easy],
    ])("maps quality %i to Rating %i", (quality, expected) => {
      expect(fsrsEngine.mapQualityToRating(quality)).toBe(expected);
    });
  });

  describe("getFSRSForUser", () => {
    it("falls back to default fsrs when user settings are null", async () => {
      const supabase = createMockSupabase({ data: null });
      const f = await fsrsEngine.getFSRSForUser("user-1", supabase);

      expect(typeof f.repeat).toBe("function");
      const result = f.repeat(createEmptyCard(), new Date());
      expect(result[Rating.Again]).toBeDefined();
      expect(result[Rating.Hard]).toBeDefined();
      expect(result[Rating.Good]).toBeDefined();
      expect(result[Rating.Easy]).toBeDefined();
    });

    it("falls back to default fsrs when supabase call rejects", async () => {
      const supabase = createMockSupabase({ reject: true });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const f = await fsrsEngine.getFSRSForUser("user-1", supabase);

      expect(typeof f.repeat).toBe("function");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("loads custom request_retention and maximum_interval from settings", async () => {
      const supabase = createMockSupabase({
        data: { settings: { request_retention: 0.85, maximum_interval: 1000 } },
      });

      const f = await fsrsEngine.getFSRSForUser("user-1", supabase);

      expect(typeof f.repeat).toBe("function");
    });

    it("migrates legacy 17-element fsrs_parameters", async () => {
      const legacyW = Array.from({ length: 17 }, (_, i) => i + 1);
      const supabase = createMockSupabase({
        data: { settings: { fsrs_parameters: legacyW } },
      });

      const f = await fsrsEngine.getFSRSForUser("user-1", supabase);

      expect(typeof f.repeat).toBe("function");
      const result = f.repeat(createEmptyCard(), new Date());
      expect(result[Rating.Good].card).toBeDefined();
    });
  });
});
