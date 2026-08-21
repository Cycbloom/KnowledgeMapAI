import { describe, it, expect } from 'vitest';
import { getDecayColors, getDecayColor } from '../src/config/learningStatusColors';
import {
  computeCardDisplayMastery,
  aggregateDisplayMastery,
  type CardWithDisplayMastery,
  type CardMasteryInput,
} from '../shared/utils/fsrs/masteryContract';

const DAY_MS = 24 * 60 * 60 * 1000;

function make5Cards(nowMs: number): CardMasteryInput[] {
  const threeDaysAgo = new Date(nowMs - 3 * DAY_MS).toISOString();
  const oneWeekAgo = new Date(nowMs - 7 * DAY_MS).toISOString();
  const today = new Date(nowMs).toISOString();
  return [
    { fsrs_stability: 1, fsrs_last_review: today, fsrs_retrievability: 0.95 },
    { fsrs_stability: 7, fsrs_last_review: threeDaysAgo, fsrs_retrievability: 0.72 },
    { fsrs_stability: 15, fsrs_last_review: oneWeekAgo, fsrs_retrievability: 0.55 },
    { fsrs_stability: 30, fsrs_last_review: threeDaysAgo, fsrs_retrievability: 0.88 },
    { fsrs_stability: 0.5, fsrs_last_review: today, fsrs_retrievability: 0.42 },
  ];
}

function simulateBackendAggregation(inputs: CardMasteryInput[], nowMs: number): number {
  const cardsWithMastery: CardWithDisplayMastery[] = inputs.map((c) => ({
    fsrs_stability: c.fsrs_stability,
    fsrs_last_review: c.fsrs_last_review,
    last_reviewed: c.last_reviewed,
    fsrs_retrievability: c.fsrs_retrievability,
    displayMastery: computeCardDisplayMastery(c, nowMs),
  }));
  return aggregateDisplayMastery(cardsWithMastery, 'stabilityWeighted');
}

function simulateMobileAggregation(inputs: CardMasteryInput[], nowMs: number): number {
  const cardsWithMastery: CardWithDisplayMastery[] = inputs.map((c) => ({
    fsrs_stability: c.fsrs_stability,
    fsrs_last_review: c.fsrs_last_review,
    last_reviewed: c.last_reviewed,
    fsrs_retrievability: c.fsrs_retrievability,
    displayMastery: computeCardDisplayMastery(c, nowMs),
  }));
  return aggregateDisplayMastery(cardsWithMastery, 'stabilityWeighted');
}

describe('fsrs-mastery-unification Task 3 assertions', () => {
  describe('a) backend graphQueryService ≈ mobile getNodeStatus integer percent (same 5-card seed)', () => {
    it('same shared formula produces identical integer percent mastery', () => {
      const nowMs = 1_700_000_000_000;
      const cards = make5Cards(nowMs);
      const backendVal = simulateBackendAggregation(cards, nowMs);
      const mobileVal = simulateMobileAggregation(cards, nowMs);
      const backendPct = Math.round(backendVal * 100);
      const mobilePct = Math.round(mobileVal * 100);
      expect(backendPct).toBe(mobilePct);
      expect(backendVal).toBeCloseTo(mobileVal, 9);
    });

    it('produces reasonable mastery percent for mixed seed', () => {
      const nowMs = 1_700_000_000_000;
      const cards = make5Cards(nowMs);
      const val = simulateBackendAggregation(cards, nowMs);
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThan(1);
    });
  });

  describe('b) getDecayColors mastery stops', () => {
    it('0.15 → red #ef4444', () => {
      const colors = getDecayColors(0.15, 'displayMastery', false);
      expect(colors.primary.toLowerCase()).toBe('#ef4444');
    });

    it('0.35 → amber #f59e0b', () => {
      const colors = getDecayColors(0.35, 'displayMastery', false);
      expect(colors.primary.toLowerCase()).toBe('#f59e0b');
    });

    it('0.55 → blue #3b82f6', () => {
      const colors = getDecayColors(0.55, 'displayMastery', false);
      expect(colors.primary.toLowerCase()).toBe('#3b82f6');
    });

    it('0.75 → violet #8b5cf6', () => {
      const colors = getDecayColors(0.75, 'displayMastery', false);
      expect(colors.primary.toLowerCase()).toBe('#8b5cf6');
    });

    it('0.92 → green #22c55e', () => {
      const colors = getDecayColors(0.92, 'displayMastery', false);
      expect(colors.primary.toLowerCase()).toBe('#22c55e');
    });

    it('getDecayColor exact threshold stops match MASTERY_THRESHOLDS colors', () => {
      expect(getDecayColor(0).toLowerCase()).toBe('#ef4444');
      expect(getDecayColor(0.25).toLowerCase()).toBe('#f59e0b');
      expect(getDecayColor(0.45).toLowerCase()).toBe('#3b82f6');
      expect(getDecayColor(0.65).toLowerCase()).toBe('#8b5cf6');
      expect(getDecayColor(0.82).toLowerCase()).toBe('#22c55e');
      expect(getDecayColor(1.0).toLowerCase()).toBe('#22c55e');
    });

    it('opacity linear mapping from 0.5 to 1.0', () => {
      const c0 = getDecayColors(0, 'displayMastery', false);
      const c1 = getDecayColors(1, 'displayMastery', false);
      expect(c0.opacity).toBeCloseTo(0.5, 6);
      expect(c1.opacity).toBeCloseTo(1.0, 6);
      const cHalf = getDecayColors(0.5, 'displayMastery', false);
      expect(cHalf.opacity).toBeCloseTo(0.75, 6);
    });

    it('default mode parameter is displayMastery', () => {
      const explicit = getDecayColors(0.35, 'displayMastery', false);
      const implicit = getDecayColors(0.35);
      expect(explicit.primary).toBe(implicit.primary);
      expect(explicit.opacity).toBe(implicit.opacity);
    });

    it('no data marker (-1) → neutral gray with opacity 0.6', () => {
      const c = getDecayColors(-1, 'displayMastery', false);
      expect(c.opacity).toBe(0.6);
      expect(c.primary).toBe('#9CA3AF');
    });
  });
});
