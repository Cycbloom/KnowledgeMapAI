import {
  MASTERY_THRESHOLDS,
  MASTERY_LABEL_KEYS,
  type MasteryLabelKey,
} from "@shared/utils/fsrs/masteryContract";

export function formatMasteryPct(mastery01: number): string {
  const m = Number.isFinite(mastery01) ? Math.max(0, Math.min(1, mastery01)) : 0;
  return `${Math.round(m * 100)}%`;
}

export function getMasteryLabelKey(mastery01: number): MasteryLabelKey {
  const m = Number.isFinite(mastery01) ? Math.max(0, Math.min(1, mastery01)) : 0;
  if (m < MASTERY_THRESHOLDS.beginner) return MASTERY_LABEL_KEYS.beginner;
  if (m < MASTERY_THRESHOLDS.introductory) return MASTERY_LABEL_KEYS.introductory;
  if (m < MASTERY_THRESHOLDS.familiar) return MASTERY_LABEL_KEYS.familiar;
  if (m < MASTERY_THRESHOLDS.proficient) return MASTERY_LABEL_KEYS.proficient;
  return MASTERY_LABEL_KEYS.master;
}

export type MasteryTone = 'sky' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate';

export function getMasteryTone(mastery01: number): MasteryTone {
  const m = Number.isFinite(mastery01) ? Math.max(0, Math.min(1, mastery01)) : 0;
  if (m < MASTERY_THRESHOLDS.beginner) return 'rose';
  if (m < MASTERY_THRESHOLDS.introductory) return 'amber';
  if (m < MASTERY_THRESHOLDS.familiar) return 'sky';
  if (m < MASTERY_THRESHOLDS.proficient) return 'violet';
  return 'emerald';
}
