import { describe, it, expect, vi } from "vitest";
import { Rating, State, createEmptyCard, fsrs } from "ts-fsrs";
import { fsrsEngine } from "../../../../services/mobile/study/fsrsEngine";
import {
  buildCard,
  createMockSupabase,
} from "../../../../../tests/helpers/mockFactories";

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

  // ==========================================================================
  // State transition boundary tests
  // ==========================================================================
  describe("state transitions", () => {
    const f = fsrs();
    const now = new Date("2025-06-01T08:00:00Z");

    describe("from New state", () => {
      const makeNew = () =>
        fsrsEngine.dbCardToFSRS(
          buildCard({ fsrs_state: "New", review_count: 0 }),
        );

      it("should transition from New to Learning when quality is 0", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(0));
        expect(result.card.state).toBe(State.Learning);
      });

      it("should transition from New to Learning when quality is 1", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(1));
        expect(result.card.state).toBe(State.Learning);
      });

      it("should transition from New to Learning when quality is 2", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(2));
        expect(result.card.state).toBe(State.Learning);
      });

      it("should transition from New to Learning when quality is 3 (first review, step advances)", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(3));
        expect(result.card.state).toBe(State.Learning);
      });

      it("should transition from New to Review when quality is 4 (skips learning)", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(4));
        expect(result.card.state).toBe(State.Review);
      });

      it("should transition from New to Review when quality is 5", () => {
        const result = f.next(makeNew(), now, fsrsEngine.mapQualityToRating(5));
        expect(result.card.state).toBe(State.Review);
      });
    });

    describe("from Learning state", () => {
      const makeLearning = () =>
        fsrsEngine.dbCardToFSRS(
          buildCard({
            fsrs_state: "Learning",
            review_count: 1,
            fsrs_stability: 0.4,
            fsrs_difficulty: 5.0,
            fsrs_last_review: new Date("2025-05-31T08:00:00Z").toISOString(),
          }),
        );

      it("should stay in Learning when quality is 3 (Good advances step but does not graduate)", () => {
        const result = f.next(makeLearning(), now, fsrsEngine.mapQualityToRating(3));
        expect(result.card.state).toBe(State.Learning);
      });

      it("should transition from Learning to Review when quality is 5 (Easy graduates)", () => {
        const result = f.next(makeLearning(), now, fsrsEngine.mapQualityToRating(5));
        expect(result.card.state).toBe(State.Review);
      });

      it("should transition from Learning to Review after completing all learning steps with Good", () => {
        // Step 0 → Step 1 (Good, stays Learning)
        const step0 = f.next(makeLearning(), now, Rating.Good);
        expect(step0.card.state).toBe(State.Learning);
        // Step 1 → Review (Good, graduates from last step)
        const step1 = f.next(step0.card, now, Rating.Good);
        expect(step1.card.state).toBe(State.Review);
      });
    });

    describe("from Review state", () => {
      const makeReview = () =>
        fsrsEngine.dbCardToFSRS(
          buildCard({
            fsrs_state: "Review",
            review_count: 5,
            fsrs_stability: 10.0,
            fsrs_difficulty: 5.0,
            fsrs_elapsed_days: 7,
            fsrs_scheduled_days: 7,
            fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
          }),
        );

      it("should transition from Review to Relearning when quality is 0 (lapse)", () => {
        const result = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(0));
        expect(result.card.state).toBe(State.Relearning);
      });

      it("should transition from Review to Relearning when quality is 1 (lapse)", () => {
        const result = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(1));
        expect(result.card.state).toBe(State.Relearning);
      });

      it("should stay in Review when quality is 2 (Hard is not a lapse)", () => {
        const result = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(2));
        expect(result.card.state).toBe(State.Review);
      });

      it("should stay in Review when quality is 3 (Good)", () => {
        const result = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(3));
        expect(result.card.state).toBe(State.Review);
      });

      it("should stay in Review when quality is 5 (Easy)", () => {
        const result = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(5));
        expect(result.card.state).toBe(State.Review);
      });
    });

    describe("from Relearning state", () => {
      const makeRelearning = () =>
        fsrsEngine.dbCardToFSRS(
          buildCard({
            fsrs_state: "Relearning",
            review_count: 5,
            fsrs_stability: 1.0,
            fsrs_difficulty: 8.0,
            fsrs_elapsed_days: 0,
            fsrs_scheduled_days: 1,
            fsrs_last_review: new Date("2025-05-31T08:00:00Z").toISOString(),
          }),
        );

      it("should transition from Relearning to Review when quality is 3 (Good graduates)", () => {
        const result = f.next(makeRelearning(), now, fsrsEngine.mapQualityToRating(3));
        expect(result.card.state).toBe(State.Review);
      });

      it("should transition from Relearning to Review when quality is 5 (Easy graduates)", () => {
        const result = f.next(makeRelearning(), now, fsrsEngine.mapQualityToRating(5));
        expect(result.card.state).toBe(State.Review);
      });
    });
  });

  // ==========================================================================
  // Quality boundary value tests
  // ==========================================================================
  describe("quality boundary values", () => {
    const f = fsrs();
    const now = new Date("2025-06-01T08:00:00Z");

    const makeReview = () =>
      fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: 10.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );

    it("quality 0 and quality 1 should both map to Again and produce identical results", () => {
      const r0 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(0));
      const r1 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(1));
      expect(r0.card.state).toBe(r1.card.state);
      expect(r0.card.stability).toBe(r1.card.stability);
      expect(r0.card.difficulty).toBe(r1.card.difficulty);
    });

    it("quality 4 and quality 5 should both map to Easy and produce identical results", () => {
      const r4 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(4));
      const r5 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(5));
      expect(r4.card.state).toBe(r5.card.state);
      expect(r4.card.stability).toBe(r5.card.stability);
      expect(r4.card.difficulty).toBe(r5.card.difficulty);
    });

    it("stability should increase with higher quality on a Review card", () => {
      const preview = f.repeat(makeReview(), now);
      const sAgain = preview[Rating.Again].card.stability;
      const sHard = preview[Rating.Hard].card.stability;
      const sGood = preview[Rating.Good].card.stability;
      const sEasy = preview[Rating.Easy].card.stability;
      // Again (lapse) produces the lowest stability
      expect(sAgain).toBeLessThan(sHard);
      expect(sHard).toBeLessThanOrEqual(sGood);
      expect(sGood).toBeLessThanOrEqual(sEasy);
    });

    it("difficulty should decrease with higher quality on a Review card", () => {
      const preview = f.repeat(makeReview(), now);
      const dAgain = preview[Rating.Again].card.difficulty;
      const dHard = preview[Rating.Hard].card.difficulty;
      const dGood = preview[Rating.Good].card.difficulty;
      const dEasy = preview[Rating.Easy].card.difficulty;
      expect(dAgain).toBeGreaterThanOrEqual(dHard);
      expect(dHard).toBeGreaterThanOrEqual(dGood);
      expect(dGood).toBeGreaterThanOrEqual(dEasy);
    });

    it("quality 0 (complete blackout) vs quality 5 (perfect recall) should produce drastically different stability", () => {
      const r0 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(0));
      const r5 = f.next(makeReview(), now, fsrsEngine.mapQualityToRating(5));
      expect(r5.card.stability).toBeGreaterThan(r0.card.stability);
      // Perfect recall stability should be at least double the blackout stability
      expect(r5.card.stability / r0.card.stability).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // Stability and difficulty calculation boundaries
  // ==========================================================================
  describe("stability and difficulty boundaries", () => {
    const f = fsrs();
    const now = new Date("2025-06-01T08:00:00Z");

    it("first review (New card) should set a positive initial stability", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "New", review_count: 0 }),
      );
      const result = f.next(card, now, Rating.Good);
      expect(result.card.stability).toBeGreaterThan(0);
      expect(result.card.difficulty).toBeGreaterThan(0);
    });

    it("Review card with Good should grow stability", () => {
      const originalStability = 10.0;
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: originalStability,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );
      const result = f.next(card, now, Rating.Good);
      expect(result.card.stability).toBeGreaterThan(originalStability);
    });

    it("Review card with Again should decrease stability (lapse)", () => {
      const originalStability = 10.0;
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: originalStability,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );
      const result = f.next(card, now, Rating.Again);
      expect(result.card.stability).toBeLessThan(originalStability);
    });

    it("difficulty should stay within FSRS bounds [1, 10] after review", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: 10.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );
      const preview = f.repeat(card, now);
      for (const grade of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        const d = preview[grade].card.difficulty;
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(10);
      }
    });

    it("repeated Again reviews should push difficulty toward the upper bound", () => {
      let card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: 10.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );
      // 3 consecutive Again reviews
      for (let i = 0; i < 3; i++) {
        card = f.next(card, now, Rating.Again).card;
      }
      expect(card.difficulty).toBeGreaterThan(5.0);
      expect(card.difficulty).toBeLessThanOrEqual(10);
    });
  });

  // ==========================================================================
  // Reps and lapses counter tests
  // ==========================================================================
  describe("reps and lapses counters", () => {
    const f = fsrs();
    const now = new Date("2025-06-01T08:00:00Z");

    const makeReview = () =>
      fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: 10.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );

    it("new card should have reps=0 and lapses=0", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "New", review_count: 0 }),
      );
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
    });

    it("successful review should increment reps", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "New", review_count: 0 }),
      );
      const result = f.next(card, now, Rating.Good);
      expect(result.card.reps).toBe(1);
    });

    it("failed review should also increment reps", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "New", review_count: 0 }),
      );
      const result = f.next(card, now, Rating.Again);
      expect(result.card.reps).toBe(1);
    });

    it("Review card with Again should increment lapses", () => {
      const card = makeReview();
      expect(card.lapses).toBe(0);
      const result = f.next(card, now, Rating.Again);
      expect(result.card.lapses).toBe(1);
    });

    it("Review card with Good should NOT increment lapses", () => {
      const result = f.next(makeReview(), now, Rating.Good);
      expect(result.card.lapses).toBe(0);
    });
  });

  // ==========================================================================
  // Scheduled interval calculation tests
  // ==========================================================================
  describe("scheduled interval calculation", () => {
    const f = fsrs();
    const now = new Date("2025-06-01T08:00:00Z");

    it("New card with Again should have a short interval (learning step in minutes, scheduled_days=0)", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({ fsrs_state: "New", review_count: 0 }),
      );
      const result = f.next(card, now, Rating.Again);
      expect(result.card.scheduled_days).toBe(0);
      // Due should be within the same day (minutes later)
      const dueDiffMs = result.card.due.getTime() - now.getTime();
      expect(dueDiffMs).toBeGreaterThan(0);
      expect(dueDiffMs).toBeLessThan(60 * 60 * 1000); // < 1 hour
    });

    it("Review card with Good should have a multi-day interval", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 5,
          fsrs_stability: 10.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 7,
          fsrs_scheduled_days: 7,
          fsrs_last_review: new Date("2025-05-25T08:00:00Z").toISOString(),
        }),
      );
      const result = f.next(card, now, Rating.Good);
      expect(result.card.scheduled_days).toBeGreaterThan(0);
    });

    it("Review card with high stability should have a longer interval than with low stability", () => {
      const lowStabilityCard = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 3,
          fsrs_stability: 2.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 1,
          fsrs_scheduled_days: 1,
          fsrs_last_review: new Date("2025-05-31T08:00:00Z").toISOString(),
        }),
      );
      const highStabilityCard = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Review",
          review_count: 10,
          fsrs_stability: 50.0,
          fsrs_difficulty: 5.0,
          fsrs_elapsed_days: 30,
          fsrs_scheduled_days: 30,
          fsrs_last_review: new Date("2025-05-01T08:00:00Z").toISOString(),
        }),
      );
      const lowResult = f.next(lowStabilityCard, now, Rating.Good);
      const highResult = f.next(highStabilityCard, now, Rating.Good);
      expect(highResult.card.scheduled_days).toBeGreaterThan(
        lowResult.card.scheduled_days,
      );
    });

    it("Relearning card with Again should have a short interval (relearning step)", () => {
      const card = fsrsEngine.dbCardToFSRS(
        buildCard({
          fsrs_state: "Relearning",
          review_count: 5,
          fsrs_stability: 1.0,
          fsrs_difficulty: 8.0,
          fsrs_elapsed_days: 0,
          fsrs_scheduled_days: 1,
          fsrs_last_review: new Date("2025-05-31T08:00:00Z").toISOString(),
        }),
      );
      const result = f.next(card, now, Rating.Again);
      expect(result.card.scheduled_days).toBe(0);
      // Due should be within the same day (minutes later)
      const dueDiffMs = result.card.due.getTime() - now.getTime();
      expect(dueDiffMs).toBeGreaterThan(0);
      expect(dueDiffMs).toBeLessThan(60 * 60 * 1000); // < 1 hour
    });
  });
});
