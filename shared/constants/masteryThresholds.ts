/**
 * 掌握度阈值
 *
 * mastery_level 基于 FSRS retrievability 的加权聚合值，具有概率语义：
 * 值为 0.7 表示"有 70% 的概率能成功回忆该知识点"。
 *
 * 阈值含义：
 * - < 0.3：学习阶段（回忆概率低于 30%，需要重点学习）
 * - 0.3~0.5：复习阶段（回忆概率 30%~50%，需要定期复习）
 * - 0.5~0.7：练习阶段（回忆概率 50%~70%，需要巩固练习）
 * - 0.7~0.85：测验阶段（回忆概率 70%~85%，可以通过测验验证）
 * - >= 0.85：掌握阶段（回忆概率 85%+，已牢固掌握）
 */
export const MASTERY_THRESHOLDS = {
  LEARNING_REVIEW: 0.3,
  REVIEW_PRACTICE: 0.5,
  PRACTICE_QUIZ: 0.7,
  QUIZ_MASTERY: 0.85,
} as const;

/**
 * 学习状态与掌握度范围的映射
 *
 * 掌握度值基于 FSRS retrievability 聚合，具有概率语义。
 */
export const MASTERY_STATE_MAPPING: Record<string, { min: number; max: number }> = {
  learning: { min: 0.0, max: MASTERY_THRESHOLDS.LEARNING_REVIEW },
  review: { min: MASTERY_THRESHOLDS.LEARNING_REVIEW, max: MASTERY_THRESHOLDS.REVIEW_PRACTICE },
  practice: { min: MASTERY_THRESHOLDS.REVIEW_PRACTICE, max: MASTERY_THRESHOLDS.PRACTICE_QUIZ },
  quiz: { min: MASTERY_THRESHOLDS.PRACTICE_QUIZ, max: 1.0 },
} as const;
