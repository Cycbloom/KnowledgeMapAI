export const MASTERY_THRESHOLDS = {
  LEARNING_REVIEW: 0.3,
  REVIEW_PRACTICE: 0.5,
  PRACTICE_QUIZ: 0.7,
  QUIZ_MASTERY: 0.85,
} as const;

export const MASTERY_STATE_MAPPING: Record<string, { min: number; max: number }> = {
  learning: { min: 0.0, max: MASTERY_THRESHOLDS.LEARNING_REVIEW },
  review: { min: MASTERY_THRESHOLDS.LEARNING_REVIEW, max: MASTERY_THRESHOLDS.REVIEW_PRACTICE },
  practice: { min: MASTERY_THRESHOLDS.REVIEW_PRACTICE, max: MASTERY_THRESHOLDS.PRACTICE_QUIZ },
  quiz: { min: MASTERY_THRESHOLDS.PRACTICE_QUIZ, max: 1.0 },
} as const;

export const DEFAULT_DECAY_CONFIG = {
  reviewThreshold: MASTERY_THRESHOLDS.REVIEW_PRACTICE,
  minMastery: 0,
  decayBaseFactor: 10,
} as const;
