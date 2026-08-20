import type { BadgeTone } from "./quizBadgeMeta";

/** 难度徽章元信息 */
export interface DifficultyBadgeMeta {
  /** i18n 键名，对应 study.quiz.difficulty* */
  labelKey: string;
  /** 配色主题（复用 quizBadgeMeta 的 tone 体系） */
  tone: BadgeTone;
}

/** 难度数值 → 徽章元信息映射（StudyCard.difficulty 语义：1=易 / 2=中 / 3=难） */
const DIFFICULTY_BADGE_MAP: Readonly<Record<number, DifficultyBadgeMeta>> = {
  1: { labelKey: "study.quiz.difficultyEasy", tone: "emerald" },
  2: { labelKey: "study.quiz.difficultyMedium", tone: "amber" },
  3: { labelKey: "study.quiz.difficultyHard", tone: "rose" },
};

/**
 * 根据难度数值获取徽章元信息（图标、i18n 键、配色主题）。
 * 未设置（0 / undefined / NaN）返回 null，调用方不渲染难度标识。
 */
export function getDifficultyBadgeMeta(
  difficulty: number | undefined | null,
): DifficultyBadgeMeta | null {
  if (typeof difficulty !== "number" || !Number.isFinite(difficulty)) {
    return null;
  }
  const level = Math.round(difficulty);
  return DIFFICULTY_BADGE_MAP[level] ?? null;
}
