import { describe, it, expect } from 'vitest';
import {
  HALF_LIFE_S,
  MASTERY_THRESHOLDS,
  MASTERY_LABEL_KEYS,
  stabilityToMasteryBaseline,
  timeDecayFactor,
  computeCardDisplayMastery,
  computeFSSRetrievabilityForDecisions,
  aggregateDisplayMastery,
  type CardMasteryInput,
  type CardWithDisplayMastery,
} from '../utils/fsrs/masteryContract';

const _TOL = 1e-6;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base: number, days: number): number {
  return base + days * DAY_MS;
}

describe('masteryContract', () => {
  describe('常量', () => {
    it('HALF_LIFE_S = 7 天（半饱和点）', () => {
      expect(HALF_LIFE_S).toBe(7);
    });

    it('MASTERY_THRESHOLDS 五档阈值与 CardStatsStrip 对齐', () => {
      expect(MASTERY_THRESHOLDS.beginner).toBeCloseTo(0.25, 6);
      expect(MASTERY_THRESHOLDS.introductory).toBeCloseTo(0.45, 6);
      expect(MASTERY_THRESHOLDS.familiar).toBeCloseTo(0.65, 6);
      expect(MASTERY_THRESHOLDS.proficient).toBeCloseTo(0.82, 6);
      expect(MASTERY_THRESHOLDS.master).toBeCloseTo(1.0, 6);
    });

    it('MASTERY_LABEL_KEYS i18n key 与 CardStatsStrip getMasteryInfo 完全一致', () => {
      expect(MASTERY_LABEL_KEYS.beginner).toBe('scheduler.review.mastery.beginner');
      expect(MASTERY_LABEL_KEYS.introductory).toBe('scheduler.review.mastery.introductory');
      expect(MASTERY_LABEL_KEYS.familiar).toBe('scheduler.review.mastery.familiar');
      expect(MASTERY_LABEL_KEYS.proficient).toBe('scheduler.review.mastery.proficient');
      expect(MASTERY_LABEL_KEYS.master).toBe('scheduler.review.mastery.master');
    });
  });

  describe('stabilityToMasteryBaseline', () => {
    const cases: Array<{ S: number; expected: number; label: string }> = [
      { S: 0, expected: 0, label: 'S=0 新卡 baseline=0' },
      { S: 7, expected: 0.5, label: 'S=7 半饱和点 baseline=0.5' },
      { S: 30, expected: 30 / 37, label: 'S=30 天 baseline≈0.8108' },
      { S: 1, expected: 1 / 8, label: 'S=1 Hard 档 baseline=0.125' },
      { S: 15, expected: 15 / 22, label: 'S=15 Easy 档 baseline≈0.6818' },
      { S: 365, expected: 365 / 372, label: 'S=365 天接近精通 ceiling' },
      { S: -1, expected: 0, label: '负数 S clamp 到 0' },
      { S: NaN, expected: 0, label: 'NaN S 当作 0' },
      { S: Infinity, expected: 1, label: 'S→∞ 渐近 1' },
    ];

    for (const tc of cases) {
      it(tc.label, () => {
        expect(stabilityToMasteryBaseline(tc.S)).toBeCloseTo(tc.expected, 6);
      });
    }
  });

  describe('timeDecayFactor', () => {
    const now = Date.now();

    it('lastReview=null → decay=1（无衰减信息按刚复习处理）', () => {
      expect(timeDecayFactor(7, null, now)).toBeCloseTo(1, 6);
    });

    it('lastReview=undefined → decay=1', () => {
      expect(timeDecayFactor(7, undefined as unknown as null, now)).toBeCloseTo(1, 6);
    });

    it('lastReview 在未来 → Δt<0 clamp 为 0，decay=1', () => {
      const future = addDays(now, 3);
      expect(timeDecayFactor(7, future, now)).toBeCloseTo(1, 6);
    });

    it('lastReview === now (刚复习完) → Δt=0 → decay=1', () => {
      expect(timeDecayFactor(7, now, now)).toBeCloseTo(1, 6);
    });

    it('S=7, Δt=7 天 → decay=exp(-1)≈0.367879', () => {
      const last = addDays(now, -7);
      expect(timeDecayFactor(7, last, now)).toBeCloseTo(Math.exp(-1), 6);
    });

    it('S=30, Δt=30 天 → decay=exp(-1)', () => {
      const last = addDays(now, -30);
      expect(timeDecayFactor(30, last, now)).toBeCloseTo(Math.exp(-1), 6);
    });

    it('S=0（无论 Δt）→ decay=1', () => {
      const last = addDays(now, -999);
      expect(timeDecayFactor(0, last, now)).toBeCloseTo(1, 6);
    });

    it('Date 实例与 number ms、ISO string 等价', () => {
      const last = addDays(now, -7);
      const d = timeDecayFactor(7, last, now);
      expect(timeDecayFactor(7, new Date(last), now)).toBeCloseTo(d, 6);
      expect(timeDecayFactor(7, new Date(last).toISOString(), now)).toBeCloseTo(d, 6);
    });
  });

  describe('computeCardDisplayMastery', () => {
    const now = Date.now();

    it('S=7, lastReview=now → display=baseline×1=0.5（刚复习完 Good 档）', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 7,
        fsrs_last_review: now,
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0.5, 6);
    });

    it('S=7, Δt=7 天 → display=0.5 × exp(-1)≈0.1839397', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 7,
        fsrs_last_review: addDays(now, -7),
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0.5 * Math.exp(-1), 6);
    });

    it('S=1 Good 档 vs S=15 Easy 档 Δt=0：Easy 明显 > Good', () => {
      const goodCard: CardMasteryInput = { fsrs_stability: 1, fsrs_last_review: now };
      const easyCard: CardMasteryInput = { fsrs_stability: 15, fsrs_last_review: now };
      const goodM = computeCardDisplayMastery(goodCard, now);
      const easyM = computeCardDisplayMastery(easyCard, now);
      expect(goodM).toBeCloseTo(1 / 8, 6);
      expect(easyM).toBeCloseTo(15 / 22, 6);
      expect(easyM).toBeGreaterThan(goodM);
    });

    it('S=0, lastReview=null → fallback 到 fsrs_retrievability=0 → 0', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 0,
        fsrs_last_review: null,
        fsrs_retrievability: 0,
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0, 6);
    });

    it('S=null/undefined, fsrs_retrievability=0.42 → fallback 直接使用', () => {
      const card: CardMasteryInput = {
        fsrs_stability: null,
        fsrs_retrievability: 0.42,
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0.42, 6);
    });

    it('S=NaN, 无 retrievability → fallback 到 0', () => {
      const card: CardMasteryInput = { fsrs_stability: NaN };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0, 6);
    });

    it('lastReview 使用 last_reviewed 别名', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 7,
        last_reviewed: addDays(now, -7),
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0.5 * Math.exp(-1), 6);
    });

    it('future lastReview → decay=1 → display=baseline（时光倒流不加分）', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 7,
        fsrs_last_review: addDays(now, 5),
      };
      expect(computeCardDisplayMastery(card, now)).toBeCloseTo(0.5, 6);
    });

    it('nowMs 缺省时使用 Date.now()，结果不依赖固定时间（只验证输出区间合法）', () => {
      const card: CardMasteryInput = {
        fsrs_stability: 7,
        fsrs_last_review: addDays(Date.now(), -1),
      };
      const m = computeCardDisplayMastery(card);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    });
  });

  describe('computeFSSRetrievabilityForDecisions vs display 严格分路', () => {
    it('R_decision(7, 7天) = exp(-7/7) = exp(-1) ≈ 0.367879', () => {
      expect(computeFSSRetrievabilityForDecisions(7, 7)).toBeCloseTo(Math.exp(-1), 6);
    });

    it('【TR-1.2】决策口径 ≠ 展示口径：R_decision(7,7)≈0.3679，同 S=7 且 Δt=0 的展示值=0.5，两者必须严格不同', () => {
      const now = Date.now();
      const decisionR = computeFSSRetrievabilityForDecisions(7, 7);
      const card: CardMasteryInput = { fsrs_stability: 7, fsrs_last_review: now };
      const displayM = computeCardDisplayMastery(card, now);
      expect(decisionR).toBeCloseTo(Math.exp(-1), 6);
      expect(displayM).toBeCloseTo(0.5, 6);
      expect(Math.abs(decisionR - displayM)).toBeGreaterThan(0.1);
    });

    it('Δt=0 时 R_decision(S,0) = 1（刚复习完可回忆概率=100%），display=baseline<1', () => {
      const rDecision = computeFSSRetrievabilityForDecisions(30, 0);
      const now = Date.now();
      const card: CardMasteryInput = { fsrs_stability: 30, fsrs_last_review: now };
      const display = computeCardDisplayMastery(card, now);
      expect(rDecision).toBeCloseTo(1, 6);
      expect(display).toBeCloseTo(30 / 37, 6);
      expect(display).toBeLessThan(1);
    });

    it('S<=0 时决策 R 返回 0（无稳定性=不可靠）', () => {
      expect(computeFSSRetrievabilityForDecisions(0, 1)).toBeCloseTo(0, 6);
      expect(computeFSSRetrievabilityForDecisions(-5, 1)).toBeCloseTo(0, 6);
    });
  });

  describe('aggregateDisplayMastery', () => {
    const now = Date.now();

    function makeCard(S: number, deltaDaysAgo: number, retrievability = 0): CardWithDisplayMastery {
      const card: CardMasteryInput = {
        fsrs_stability: S,
        fsrs_last_review: addDays(now, -deltaDaysAgo),
        fsrs_retrievability: retrievability,
      };
      return {
        ...card,
        displayMastery: computeCardDisplayMastery(card, now),
      };
    }

    it('空数组 → 0', () => {
      expect(aggregateDisplayMastery([], 'stabilityWeighted')).toBeCloseTo(0, 6);
      expect(aggregateDisplayMastery([], 'arithmeticMean')).toBeCloseTo(0, 6);
    });

    it('单卡：两种策略都等于该卡 displayMastery', () => {
      const c = makeCard(7, 0);
      expect(aggregateDisplayMastery([c], 'stabilityWeighted')).toBeCloseTo(c.displayMastery, 6);
      expect(aggregateDisplayMastery([c], 'arithmeticMean')).toBeCloseTo(c.displayMastery, 6);
    });

    it('stabilityWeighted：S=7(0.5) 与 S=21(≈0.75) Δt=0，权重分别为 7 和 21', () => {
      const c7 = makeCard(7, 0);
      const c21 = makeCard(21, 0);
      const expected = (c7.displayMastery * 7 + c21.displayMastery * 21) / (7 + 21);
      expect(c7.displayMastery).toBeCloseTo(0.5, 6);
      expect(c21.displayMastery).toBeCloseTo(21 / 28, 6);
      expect(aggregateDisplayMastery([c7, c21], 'stabilityWeighted')).toBeCloseTo(expected, 6);
    });

    it('arithmeticMean：两张卡 Δt=0，简单平均值', () => {
      const c1 = makeCard(1, 0);
      const c15 = makeCard(15, 0);
      const expected = (c1.displayMastery + c15.displayMastery) / 2;
      expect(aggregateDisplayMastery([c1, c15], 'arithmeticMean')).toBeCloseTo(expected, 6);
    });

    it('新卡 S=0 stabilityWeighted：等权处理（每张新卡权重=1）', () => {
      const newCard1: CardWithDisplayMastery = {
        fsrs_stability: 0,
        fsrs_retrievability: 0,
        displayMastery: 0,
      };
      const newCard2: CardWithDisplayMastery = {
        fsrs_stability: 0,
        fsrs_retrievability: 0.6,
        displayMastery: 0.6,
      };
      const mature = makeCard(7, 0);
      const result = aggregateDisplayMastery([newCard1, newCard2, mature], 'stabilityWeighted');
      const expected = (0 * 1 + 0.6 * 1 + 0.5 * 7) / (1 + 1 + 7);
      expect(result).toBeCloseTo(expected, 6);
    });

    it('全部为新卡（S=0）时 stabilityWeighted 退化为算术平均', () => {
      const cards: CardWithDisplayMastery[] = [
        { fsrs_stability: 0, displayMastery: 0.1 },
        { fsrs_stability: 0, displayMastery: 0.3 },
        { fsrs_stability: 0, displayMastery: 0.5 },
      ];
      const sw = aggregateDisplayMastery(cards, 'stabilityWeighted');
      const am = aggregateDisplayMastery(cards, 'arithmeticMean');
      expect(sw).toBeCloseTo(am, 6);
      expect(sw).toBeCloseTo((0.1 + 0.3 + 0.5) / 3, 6);
    });

    it('入参 displayMastery 缺省时自动回退 computeCardDisplayMastery 计算', () => {
      const card: CardMasteryInput = { fsrs_stability: 7, fsrs_last_review: now };
      const raw = card as CardWithDisplayMastery;
      expect(aggregateDisplayMastery([raw], 'stabilityWeighted')).toBeCloseTo(0.5, 6);
    });
  });

  describe('综合打表（S×Δt 矩阵）', () => {
    const now = Date.now();
    const matrix: Array<{
      S: number;
      deltaDays: number;
      expected: number;
      label: string;
    }> = [
      { S: 0, deltaDays: 0, expected: 0, label: 'S=0 Δt=0 新卡=0' },
      { S: 0, deltaDays: 100, expected: 0, label: 'S=0 任意 Δt=0（新卡无衰减）' },
      { S: 7, deltaDays: 0, expected: 0.5, label: 'S=7 Δt=0 Good 刚复习完=0.5' },
      { S: 7, deltaDays: 7, expected: 0.5 * Math.exp(-1), label: 'S=7 Δt=7 → 0.5·exp(-1)≈0.1839' },
      { S: 30, deltaDays: 0, expected: 30 / 37, label: 'S=30 Δt=0 → 30/37≈0.8108' },
      { S: 30, deltaDays: 30, expected: (30 / 37) * Math.exp(-1), label: 'S=30 Δt=30 → 0.8108·exp(-1)≈0.2984' },
      { S: 1, deltaDays: 0, expected: 1 / 8, label: 'S=1 Δt=0 Hard=0.125' },
      { S: 15, deltaDays: 0, expected: 15 / 22, label: 'S=15 Δt=0 Easy≈0.6818' },
      { S: 90, deltaDays: 0, expected: 90 / 97, label: 'S=90 Δt=0 熟练→≈0.9278' },
      { S: 7, deltaDays: -3, expected: 0.5, label: 'S=7 Δt=-3 未来时间不衰减=0.5' },
    ];

    for (const tc of matrix) {
      it(tc.label, () => {
        const card: CardMasteryInput = {
          fsrs_stability: tc.S,
          fsrs_last_review: tc.S > 0 ? addDays(now, -tc.deltaDays) : null,
          fsrs_retrievability: 0,
        };
        expect(computeCardDisplayMastery(card, now)).toBeCloseTo(tc.expected, 6);
      });
    }
  });
});
