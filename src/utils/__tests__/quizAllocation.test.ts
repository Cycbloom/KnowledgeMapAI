import {
  allocateQuotas,
  computeReuseCap,
  pickCardsByMatrix,
  toDifficultyBand,
  DEFAULT_LEVEL_WEIGHTS,
  type QuizAllocInput,
} from "../quizAllocation";
import type { StudyCard } from "@shared/types/common";

const sum = (record: Record<string, number>): number =>
  Object.values(record).reduce((s, v) => s + v, 0);

const makeCard = (overrides: Partial<StudyCard>): StudyCard =>
  ({
    id: "card-1",
    knowledge_point_id: "kp-1",
    user_id: "u-1",
    graph_id: "g-1",
    question: "q",
    answer: "a",
    card_type: "qa",
    next_review: new Date().toISOString(),
    ...overrides,
  }) as StudyCard;

describe("quizAllocation", () => {
  const kps: QuizAllocInput[] = [
    { id: "a", title: "A", level: "core" },
    { id: "b", title: "B", level: "sub" },
    { id: "c", title: "C", level: "leaf" },
  ];

  describe("allocateQuotas", () => {
    it("average: splits total evenly and preserves the total", () => {
      const q = allocateQuotas(kps, 30, "average", DEFAULT_LEVEL_WEIGHTS);
      expect(sum(q)).toBe(30);
      // 30 / 3 = 10 each
      expect(q.a).toBe(10);
      expect(q.b).toBe(10);
      expect(q.c).toBe(10);
    });

    it("average: distributes remainder to leading entries", () => {
      const q = allocateQuotas(kps, 32, "average", DEFAULT_LEVEL_WEIGHTS);
      expect(sum(q)).toBe(32);
      expect(q.a).toBe(11);
      expect(q.b).toBe(11);
      expect(q.c).toBe(10);
    });

    it("by_level: allocates proportional to level weights and preserves total", () => {
      // core=3, sub=2, leaf=1 → 3/6, 2/6, 1/6 of 60 → 30/20/10
      const q = allocateQuotas(kps, 60, "by_level", DEFAULT_LEVEL_WEIGHTS);
      expect(sum(q)).toBe(60);
      expect(q.a).toBe(30);
      expect(q.b).toBe(20);
      expect(q.c).toBe(10);
    });

    it("by_level: ignores zero/negative weights", () => {
      const q = allocateQuotas(
        kps,
        100,
        "by_level",
        { ...DEFAULT_LEVEL_WEIGHTS, core: 0, sub: 0, leaf: 0 },
      );
      expect(sum(q)).toBe(100);
    });
  });

  describe("computeReuseCap", () => {
    it("caps by ratio of quota", () => {
      expect(computeReuseCap(10, 100, 40)).toBe(4);
      expect(computeReuseCap(10, 100, 100)).toBe(10);
      expect(computeReuseCap(10, 100, 0)).toBe(0);
    });

    it("caps by existing count when existing is insufficient", () => {
      expect(computeReuseCap(10, 2, 40)).toBe(2);
    });

    it("clamps ratio out of 0-100", () => {
      expect(computeReuseCap(10, 100, 150)).toBe(10);
      expect(computeReuseCap(10, 100, -10)).toBe(0);
    });
  });

  describe("toDifficultyBand", () => {
    it("maps 1-2 to easy, 3 to medium, 4-5 to hard", () => {
      expect(toDifficultyBand(1)).toBe("easy");
      expect(toDifficultyBand(2)).toBe("easy");
      expect(toDifficultyBand(3)).toBe("medium");
      expect(toDifficultyBand(4)).toBe("hard");
      expect(toDifficultyBand(5)).toBe("hard");
      expect(toDifficultyBand(undefined)).toBeUndefined();
    });
  });

  describe("pickCardsByMatrix", () => {
    const cards: StudyCard[] = [
      makeCard({ id: "qa-easy", card_type: "qa", difficulty: 1 }),
      makeCard({ id: "qa-medium", card_type: "qa", difficulty: 3 }),
      makeCard({ id: "qa-hard", card_type: "qa", difficulty: 5 }),
      makeCard({ id: "choice-easy", card_type: "choice", difficulty: 2 }),
      makeCard({ id: "choice-hard", card_type: "choice", difficulty: 4 }),
      makeCard({ id: "essay-medium", card_type: "essay", difficulty: 3 }),
    ];

    it("picks the requested count", () => {
      expect(pickCardsByMatrix(cards, 2, {})).toHaveLength(2);
      expect(pickCardsByMatrix(cards, 0, {})).toHaveLength(0);
      expect(pickCardsByMatrix(cards, 99, {})).toHaveLength(6);
    });

    it("filters by card type tags", () => {
      const picked = pickCardsByMatrix(cards, 2, { cardTypes: ["qa"] });
      expect(picked).toHaveLength(2);
      for (const c of picked) expect(c.card_type).toBe("qa");
    });

    it("prefers difficulty matching the matrix", () => {
      const picked = pickCardsByMatrix(cards, 3, { cardTypes: ["qa"], difficulty: "medium" });
      expect(picked[0]?.id).toBe("qa-medium");
    });

    it("leniently fills with non-matching difficulty within type pool", () => {
      const picked = pickCardsByMatrix(cards, 2, { cardTypes: ["qa"], difficulty: "medium" });
      expect(picked).toHaveLength(2);
      expect(picked.map((c) => c.id)).toContain("qa-medium");
    });

    it("leniently falls back to all existing cards when type filter matches nothing", () => {
      const picked = pickCardsByMatrix(cards, 2, { cardTypes: ["true_false"], difficulty: "easy" });
      expect(picked).toHaveLength(2);
    });
  });
});
