export const HALF_LIFE_S = 7;

export const MASTERY_THRESHOLDS = {
  beginner: 0.25,
  introductory: 0.45,
  familiar: 0.65,
  proficient: 0.82,
  master: 1.0,
} as const;

export const MASTERY_LABEL_KEYS = {
  beginner: 'scheduler.review.mastery.beginner',
  introductory: 'scheduler.review.mastery.introductory',
  familiar: 'scheduler.review.mastery.familiar',
  proficient: 'scheduler.review.mastery.proficient',
  master: 'scheduler.review.mastery.master',
} as const;

export type MasteryLabelKey = typeof MASTERY_LABEL_KEYS[keyof typeof MASTERY_LABEL_KEYS];

export type AggregationStrategy = 'stabilityWeighted' | 'arithmeticMean';

export interface CardMasteryInput {
  fsrs_stability?: number | null;
  fsrs_last_review?: string | Date | number | null;
  last_reviewed?: string | Date | number | null;
  fsrs_retrievability?: number | null;
}

export interface CardWithDisplayMastery extends CardMasteryInput {
  displayMastery: number;
  fsrs_stability?: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function stabilityToMasteryBaseline(stability: number): number {
  if (stability === Infinity) return 1;
  const s = Number.isFinite(stability) ? Math.max(0, stability) : 0;
  return clamp01(s / (s + HALF_LIFE_S));
}

function resolveTimestamp(value: string | Date | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function timeDecayFactor(
  stability: number,
  lastReview: null | string | Date | number,
  nowMs?: number,
): number {
  const now = Number.isFinite(nowMs as number) ? (nowMs as number) : Date.now();
  const s = Number.isFinite(stability) ? Math.max(0, stability) : 0;
  if (s <= 0) return 1;
  const lastTs = resolveTimestamp(lastReview);
  if (lastTs === null) return 1;
  const diffMs = now - lastTs;
  if (diffMs <= 0) return 1;
  const deltaDays = diffMs / MS_PER_DAY;
  const decay = Math.exp(-deltaDays / s);
  return Number.isFinite(decay) ? decay : 0;
}

export function computeCardDisplayMastery(
  card: CardMasteryInput,
  nowMs?: number,
): number {
  const now = Number.isFinite(nowMs as number) ? (nowMs as number) : Date.now();
  const rawS = Number(card.fsrs_stability);
  if (Number.isFinite(rawS) && rawS > 0) {
    const baseline = stabilityToMasteryBaseline(rawS);
    const lastRaw = card.fsrs_last_review ?? card.last_reviewed;
    const decay = timeDecayFactor(rawS, lastRaw ?? null, now);
    return clamp01(baseline * decay);
  }
  const stored = Number(card.fsrs_retrievability);
  if (Number.isFinite(stored)) return clamp01(stored);
  return 0;
}

/**
 * @internal
 * FSRS 原生遗忘曲线 —— 仅用于调度/复习判定，**禁止用于 UI 展示**。
 *
 * 展示掌握度口径（computeCardDisplayMastery）= baseline(S) × decay(Δt,S)，
 * 其中 baseline 是 S 的半饱和归一化长期水平；两者必须严格分路，避免
 * 「复习调度按 R=exp(-Δt/S) 判定，但 UI 展示按 50% 半饱和 baseline 显示」
 * 之间的口径混淆。
 *
 * @param stability - FSRS stability (天)，必须 > 0
 * @param deltaDays - 距上次复习的时间间隔 (天)，可为任意实数
 */
export function computeFSSRetrievabilityForDecisions(
  stability: number,
  deltaDays: number,
): number {
  const s = Number.isFinite(stability) ? Math.max(0, stability) : 0;
  const t = Number.isFinite(deltaDays) ? deltaDays : 0;
  if (s <= 0) return 0;
  const r = Math.exp(-t / s);
  return Number.isFinite(r) ? clamp01(r) : 0;
}

export function aggregateDisplayMastery(
  cards: CardWithDisplayMastery[],
  strategy: AggregationStrategy = 'stabilityWeighted',
): number {
  if (!Array.isArray(cards) || cards.length === 0) return 0;

  if (strategy === 'arithmeticMean') {
    let sum = 0;
    let count = 0;
    for (const c of cards) {
      const m = Number.isFinite(c.displayMastery) ? c.displayMastery : computeCardDisplayMastery(c);
      sum += clamp01(m);
      count++;
    }
    return count === 0 ? 0 : clamp01(sum / count);
  }

  let weightedSum = 0;
  let weightSum = 0;
  for (const c of cards) {
    const sRaw = Number(c.fsrs_stability);
    const s = Number.isFinite(sRaw) ? Math.max(0, sRaw) : 0;
    const m = Number.isFinite(c.displayMastery) ? c.displayMastery : computeCardDisplayMastery(c);
    const mastery = clamp01(m);
    if (s > 0) {
      weightedSum += mastery * s;
      weightSum += s;
    } else {
      weightedSum += mastery;
      weightSum += 1;
    }
  }
  if (weightSum === 0) return 0;
  return clamp01(weightedSum / weightSum);
}
