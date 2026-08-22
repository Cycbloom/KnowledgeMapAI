import type { StudyCard } from '@shared/types/common';

export type AllocationStrategy = 'average' | 'by_level';

export interface QuizAllocInput {
  id: string;
  title: string;
  level: string;
}

/** 默认等级权重：核心/子主题/普通/叶子 按比例分配 */
export const DEFAULT_LEVEL_WEIGHTS: Record<string, number> = {
  root: 1,
  core: 3,
  sub: 2,
  normal: 2,
  leaf: 1,
};

export const KNOWN_LEVELS = ['root', 'core', 'sub', 'normal', 'leaf'] as const;

/**
 * 把测验总数分配到各个知识点。
 * - average：平均分，余数按最大余数法分摊（先到先得）
 * - by_level：按知识点等级的权重比例分配
 */
export function allocateQuotas(
  kps: QuizAllocInput[],
  total: number,
  strategy: AllocationStrategy,
  levelWeights: Record<string, number>,
): Record<string, number> {
  const quotas: Record<string, number> = {};
  const n = kps.length;
  if (n === 0) return quotas;
  const safeTotal = Math.max(0, Math.floor(total));

  if (strategy === 'average') {
    const base = Math.floor(safeTotal / n);
    const remainder = safeTotal - base * n;
    kps.forEach((kp, idx) => {
      quotas[kp.id] = base + (idx < remainder ? 1 : 0);
    });
    return quotas;
  }

  // by_level
  const weightOf = (level: string): number => {
    const w = levelWeights[level];
    return Number.isFinite(w) && w > 0 ? w : 1;
  };
  let totalWeight = 0;
  const weights: Array<{ id: string; w: number }> = kps.map((kp) => {
    const w = weightOf(kp.level);
    totalWeight += w;
    return { id: kp.id, w };
  });

  if (totalWeight <= 0) {
    kps.forEach((kp) => {
      quotas[kp.id] = 0;
    });
    return quotas;
  }

  type Cell = { id: string; floor: number; frac: number };
  const cells: Cell[] = weights.map(({ id, w }) => {
    const raw = (w / totalWeight) * safeTotal;
    return { id, floor: Math.floor(raw), frac: raw - Math.floor(raw) };
  });

  let remainder = safeTotal - cells.reduce((s, c) => s + c.floor, 0);
  cells.sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0 && idx < cells.length) {
    cells[idx].floor += 1;
    remainder -= 1;
    idx += 1;
  }
  cells.forEach((c) => {
    quotas[c.id] = c.floor;
  });
  return quotas;
}

/**
 * 复用上限：复用比例（0-100，表示配额中最多可复用的百分比）与已有题目数量取小。
 * 已有题不足则该知识点最多复用全部已有题。
 */
export function computeReuseCap(quota: number, existing: number, reuseRatio: number): number {
  const byRatio = Math.floor((quota * Math.max(0, Math.min(100, reuseRatio))) / 100);
  return Math.max(0, Math.min(byRatio, Math.max(0, existing)));
}

export type DifficultyBand = 'easy' | 'medium' | 'hard';

/**
 * StudyCard.difficulty（1-5）映射到难度带；缺省返回 undefined。
 * 1-2 → easy，3 → medium，4-5 → hard。
 */
export function toDifficultyBand(difficulty?: number): DifficultyBand | undefined {
  if (difficulty == null) return undefined;
  if (difficulty <= 2) return 'easy';
  if (difficulty === 3) return 'medium';
  return 'hard';
}

export interface QuizPickMatrix {
  cardTypes?: string[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 按题目矩阵（题型标签 + 难度）从某个知识点的已有题目中随机挑选 count 道：
 * 1) 先按题型过滤（cardTypes），在匹配池内做难度加权随机：优先贴近矩阵难度带，同难度内随机；
 * 2) 数量不足时宽松兜底：题型池不足 → 用该知识点其余已有题随机补足。
 * 选择结果对用户透明（不展示具体题目）。
 */
export function pickCardsByMatrix(
  cards: StudyCard[],
  count: number,
  matrix: QuizPickMatrix,
): StudyCard[] {
  if (count <= 0) return [];
  const typeSet = new Set(matrix.cardTypes ?? []);
  const hasTypeFilter = typeSet.size > 0;
  const target = matrix.difficulty === 'mixed' ? undefined : matrix.difficulty;

  const typeMatched = hasTypeFilter
    ? cards.filter((c) => typeSet.has(c.card_type))
    : cards;

  if (typeMatched.length === 0) {
    return shuffle(cards).slice(0, count);
  }

  const sameDiff = target
    ? typeMatched.filter((c) => toDifficultyBand(c.difficulty) === target)
    : [];
  const rest = target
    ? typeMatched.filter((c) => toDifficultyBand(c.difficulty) !== target)
    : typeMatched;

  let picked = shuffle(sameDiff).slice(0, count);
  if (picked.length < count) {
    const need = count - picked.length;
    const extra = shuffle(rest).slice(0, need);
    picked = [...picked, ...extra];
  }

  if (picked.length < count) {
    const have = new Set(picked.map((c) => c.id));
    const fill = shuffle(cards.filter((c) => !have.has(c.id))).slice(0, count - picked.length);
    picked = [...picked, ...fill];
  }

  return picked;
}
