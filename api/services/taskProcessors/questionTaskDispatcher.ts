export type QuestionTaskDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionTaskMode = QuestionTaskDifficulty | 'mixed';

export interface QuestionTaskDispatchInput {
  types?: string[];
  count?: number;
  cardsPerType?: Record<string, number>;
  countPerDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  /** 题型×难度二维矩阵（权威配置）：每个非零格子=一次独立 AI 调用 */
  countMatrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
  difficulty?: QuestionTaskMode;
}

export interface QuestionTask {
  type: string;
  count: number;
  difficulty?: QuestionTaskDifficulty;
}

const VALID_TYPES = new Set([
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
]);

const VALID_DIFFS: readonly QuestionTaskDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * 题目生成任务分派策略（优先级从高到低）：
 * 0) countMatrix：题型×难度二维矩阵，每个非零格子 = 一个独立任务（单题型+单难度，
 *    每个任务一次独立 AI 调用）——UI 矩阵的权威语义，精确落地用户配置
 * 1) cardsPerType：按题型独立分配数量（若用户在 UI 填了题型数量矩阵的行合计）
 * 2) countPerDifficulty：按难度分配（每个难度的总数按题型均分，最大余数法分摊误差）
 * 3) 回退：totalCount（count）按 types 均分
 */
export function buildTasksToRun(
  input: QuestionTaskDispatchInput,
): {
  tasks: QuestionTask[];
  totalCount: number;
  effectiveDifficulty: QuestionTaskMode;
} {
  const types =
    input.types && Array.isArray(input.types) && input.types.length > 0
      ? input.types
      : ['qa', 'choice'];
  const totalCountFallback = input.count ?? 5;

  // 0) countMatrix：每个非零格子 = 一个独立任务（单题型+单难度）
  // 关键：用户显式传了 matrix 即便全零也必须早退，不能回退到默认 5 张
  // （否则当 UI 想表达「就生成这些矩阵格子指定的，不想要额外 fallback」时，
  //  会多出一堆默认卡片，造成数量对不上）
  if (input.countMatrix && typeof input.countMatrix === 'object') {
    const tasks: Array<QuestionTask & { difficulty: QuestionTaskDifficulty }> = [];
    for (const [type, cell] of Object.entries(input.countMatrix)) {
      if (!VALID_TYPES.has(type) || !cell || typeof cell !== 'object') continue;
      for (const diff of VALID_DIFFS) {
        const v = cell[diff];
        if (typeof v === 'number' && v > 0) {
          tasks.push({ type, count: v, difficulty: diff });
        }
      }
    }
    const total = tasks.reduce((s, t) => s + t.count, 0);
    return { tasks, totalCount: total, effectiveDifficulty: 'mixed' };
  }

  // 1) cardsPerType：直接以该映射为准（只保留选中的 types，数量≥1）
  // 同上：用户显式传了 cpt 即便全零也早退
  if (input.cardsPerType && typeof input.cardsPerType === 'object') {
    const entries: Array<[string, number]> = [];
    for (const t of types) {
      const v = input.cardsPerType[t];
      if (typeof v === 'number' && v > 0) entries.push([t, v]);
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return {
      tasks: entries.map(([type, count]) => ({
        type,
        count,
        difficulty: input.difficulty === 'mixed' ? undefined : input.difficulty,
      })),
      totalCount: total,
      effectiveDifficulty: input.difficulty ?? 'medium',
    };
  }

  // 2) countPerDifficulty：每个难度的总数按题型均分（最大余数法），总数不膨胀
  // 同上：用户显式传了 cpd 即便全零也早退
  if (
    input.countPerDifficulty &&
    typeof input.countPerDifficulty === 'object'
  ) {
    const diffs: Array<[QuestionTaskDifficulty, number]> = [];
    VALID_DIFFS.forEach((k) => {
      const v = input.countPerDifficulty?.[k];
      if (typeof v === 'number' && v > 0) diffs.push([k, v]);
    });
    const tasks: Array<QuestionTask & { difficulty: QuestionTaskDifficulty }> = [];
    for (const [diff, cnt] of diffs) {
      // cnt 是该难度的总题数：均分到所有选中题型，余数给前面的题型
      const base = Math.floor(cnt / types.length);
      const remainder = cnt - base * types.length;
      types.forEach((type, idx) => {
        const c = base + (idx < remainder ? 1 : 0);
        if (c > 0) tasks.push({ type, count: c, difficulty: diff });
      });
    }
    const total = tasks.reduce((s, t) => s + t.count, 0);
    return {
      tasks,
      totalCount: total,
      effectiveDifficulty: 'mixed',
    };
  }

  // 3) 回退：types × totalCount 均分
  let remaining = totalCountFallback;
  const tasks: QuestionTask[] = [];
  for (let i = 0; i < types.length; i++) {
    const countPerType = Math.ceil(remaining / (types.length - i));
    remaining -= countPerType;
    if (countPerType > 0) {
      tasks.push({
        type: types[i],
        count: countPerType,
        difficulty: input.difficulty === 'mixed' ? undefined : input.difficulty,
      });
    }
  }
  return {
    tasks,
    totalCount: totalCountFallback,
    effectiveDifficulty: input.difficulty ?? 'medium',
  };
}

/**
 * 把目标数量按给定任务列表的权重（type×difficulty 构成）折算成一组具体任务，
 * 使折算后的任务数量之和恰好等于 target（最大余数法分摊误差）。
 * 用于「总数配额制」下按知识点缺口生成：matrix/cardsPerType 仅作为构成权重，
 * 实际生成量以每个知识点的缺口为准。
 */
export function allocateTasksByCount(
  tasks: QuestionTask[],
  target: number,
  fallbackTypes: string[] = ['qa', 'choice'],
  fallbackDifficulty: QuestionTaskMode = 'medium',
): QuestionTask[] {
  const safeTarget = Number.isFinite(target) && target > 0 ? Math.floor(target) : 0;
  if (safeTarget <= 0) return [];

  const weighted = tasks.filter((t) => t.count > 0);
  const totalWeight = weighted.reduce((s, t) => s + t.count, 0);

  if (totalWeight <= 0) {
    // 无有效权重：在 fallback 题型间均分
    const items = fallbackTypes.length > 0 ? fallbackTypes : ['qa', 'choice'];
    let remaining = safeTarget;
    const out: QuestionTask[] = [];
    for (let i = 0; i < items.length; i++) {
      const c = Math.ceil(remaining / (items.length - i));
      remaining -= c;
      if (c > 0) {
        out.push({
          type: items[i],
          count: c,
          difficulty: fallbackDifficulty === 'mixed' ? undefined : fallbackDifficulty,
        });
      }
    }
    return out;
  }

  type Cell = { type: string; difficulty?: QuestionTaskDifficulty; floor: number; frac: number };
  const cells: Cell[] = weighted.map((t) => {
    const raw = (t.count / totalWeight) * safeTarget;
    const floor = Math.floor(raw);
    return { type: t.type, difficulty: t.difficulty, floor, frac: raw - floor };
  });

  let remainder = safeTarget - cells.reduce((s, c) => s + c.floor, 0);
  cells.sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0 && idx < cells.length) {
    cells[idx].floor += 1;
    remainder -= 1;
    idx += 1;
  }

  return cells
    .filter((c) => c.floor > 0)
    .map((c) => ({ type: c.type, count: c.floor, ...(c.difficulty ? { difficulty: c.difficulty } : {}) }));
}
