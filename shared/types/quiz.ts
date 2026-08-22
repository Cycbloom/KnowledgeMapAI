import type { StudyCard } from './common';

export type QuizSetStatus = 'draft' | 'generating' | 'ready' | 'error';

export const CARD_TYPES = [
  'qa',
  'choice',
  'true_false',
  'multi_choice',
  'fill_in_the_blank',
  'essay',
  'cloze',
  'select_from_options',
  'matching',
  'ordering',
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export type CardDifficulty = 'easy' | 'medium' | 'hard';

export const CARD_DIFFICULTIES: readonly CardDifficulty[] = ['easy', 'medium', 'hard'];

/** 判断 AI 自评的难度是否属于合法集合（sanity check 用） */
export function isValidCardDifficulty(value: unknown): value is CardDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

/** 归一化 AI 自评难度：非法值回退到 fallback（避免把脏数据写库） */
export function normalizeCardDifficulty(
  value: unknown,
  fallback: CardDifficulty | string = 'medium',
): CardDifficulty {
  if (isValidCardDifficulty(value)) return value;
  // fallback 可能是 'mixed' 或任意字符串：只接受合法集合，否则兜底 medium
  return isValidCardDifficulty(fallback) ? fallback : 'medium';
}

/** 难度转数值（1=易 / 2=中 / 3=难），入库用 */
export function cardDifficultyToNumber(
  value: unknown,
  fallback: CardDifficulty | string = 'medium',
): number {
  const d = normalizeCardDifficulty(value, fallback);
  return d === 'easy' ? 1 : d === 'hard' ? 3 : 2;
}

/**
 * 方案B：把 AI 自评难度映射为 FSRS 的 difficulty 初始种子（FSRS 难度域 ~0-10，5≈中等）。
 * 生成时给一个合理起点（易=3 / 中=5 / 难=7），后续每轮复习由 FSRS 自适应更新真实难度。
 */
export function cardDifficultyToFsrsInitial(
  value: unknown,
  fallback: CardDifficulty | string = 'medium',
): number {
  const d = normalizeCardDifficulty(value, fallback);
  return d === 'easy' ? 3 : d === 'hard' ? 7 : 5;
}

export interface QuizSetConfig {
  cardTypes: CardType[];
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  knowledgePointIds: string[];
  cardsPerType?: Record<CardType, number>;
  customPrompt?: string;
  aiProvider?: string;
  /**
   * 题目生成的知识覆盖策略。作为「快捷选择」由前端转换为最终的
   * knowledgePointIds；后端只以 knowledgePointIds 为准，coverage
   * 仅携带供 prompt 模板复用。
   */
  coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
  /**
   * 题型×难度二维数量矩阵（UI 的权威配置）。
   * 后端收到后每个非零格子 = 一次独立的 AI 调用（单题型+单难度），
   * 精确落地用户配置；优先级高于 cardsPerType / countPerDifficulty。
   */
  countMatrix?: Partial<Record<CardType, Partial<Record<CardDifficulty, number>>>>;
}

export interface QuizSet {
  id: string;
  user_id: string;
  graph_id?: string;
  title: string;
  description?: string;
  config: QuizSetConfig;
  status: QuizSetStatus;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuizSetData {
  title: string;
  description?: string;
  graph_id?: string;
  config: QuizSetConfig;
}

export interface UpdateQuizSetData {
  title?: string;
  description?: string;
  config?: QuizSetConfig;
  status?: QuizSetStatus;
}

export interface QuizSetCard {
  id: string;
  quiz_set_id: string;
  card_id: string;
  display_order: number;
  created_at: string;
}

export interface QuizSetWithCards extends QuizSet {
  cards: StudyCard[];
}

export interface GenerateQuizData {
  quiz_set_id: string;
  node_ids: string[];
  config: QuizSetConfig;
}

export interface QuizGenerationProgress {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total: number;
  completed: number;
  current?: string;
  error?: string;
}

export interface RegenerateCardData {
  card_type?: CardType;
  custom_prompt?: string;
}
