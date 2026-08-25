/** @schedule decision */
// 卡片内存状态与 ts-fsrs 的转换逻辑，桌面端 api 与移动端共用同一实现，
// 避免跨端数据漂移（历史教训：仅单端 clamp 会导致另一端仍抛 Invalid memory state）。
import { State, createEmptyCard, Rating, type Card } from "ts-fsrs";
import type { StudyCard } from "../../types/common";

// FSRS 5 difficulty 范围 [1, 10], stability 下限 S_MIN=1e-3。
// 若数据库遗留老数据或手动插入时偏离合法区间，dbCardToFSRS 需在
// 转换时主动 clamp，否则 FSRS.next_state 会抛 Invalid memory state。
const FSRS_DIFFICULTY_MIN = 1;
const FSRS_DIFFICULTY_MAX = 10;
const FSRS_STABILITY_MIN = 1e-3;
const FSRS_STABILITY_MAX = 36500;

/**
 * 将数据库中的 StudyCard 转换为 ts-fsrs 的 Card 对象。
 * 对 NaN/零值做归一化，非 New 状态 stability/difficulty 必须为正有限值，
 * 否则 ts-fsrs.next_state 会抛 "Invalid memory state"。
 */
export const dbCardToFSRS = (dbCard: StudyCard): Card => {
  const empty = createEmptyCard();
  const rawState = dbCard.fsrs_state
    ? (State[dbCard.fsrs_state as keyof typeof State] as State | undefined)
    : undefined;
  const state = rawState === undefined ? State.New : rawState;

  const reps = Math.max(0, Number.isFinite(dbCard.review_count ?? NaN) ? (dbCard.review_count as number) : 0);
  // stability/difficulty 需严格落在 FSRS 5 的合法区间：
  //   1) New 卡：必须同时满足 stability=0 且 difficulty=0，FSRS.next_state
  //      才会走 init_stability / init_difficulty 分支；否则会进入下面的
  //      "d < 1 || s < S_MIN" 校验并抛 "Invalid memory state"。
  //      因此 New 卡不论数据库遗留了什么非零残留值（如 s=0 但 d=0.3），
  //      一律强制归零，保证 (d,s)===(0,0)。
  //   2) 非 New 卡：difficulty ∈ [1, 10]，stability ≥ S_MIN。
  //      若数据库遗留老数据不在区间内（例如早期 seed 写入
  //      difficulty=0.3/0.5/0.7 或 0、stability=0），先 clamp 兜底。
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : NaN;
  const rawStability = Number(dbCard.fsrs_stability);
  const rawDifficulty = Number(dbCard.fsrs_difficulty);
  let stability: number;
  let difficulty: number;
  if (state === State.New) {
    // 关键修复：New 卡必须 (d,s)===(0,0)，不能出现只有一侧为零的不对称情况。
    // 任何非零残留值都是上一版写入错误，这里强制对齐 FSRS 的约定。
    stability = 0;
    difficulty = empty.difficulty;
  } else {
    const stabilityFinite = clamp(rawStability, FSRS_STABILITY_MIN, FSRS_STABILITY_MAX);
    stability = Math.max(
      Number.isNaN(stabilityFinite) ? empty.stability : stabilityFinite,
      FSRS_STABILITY_MIN,
    );
    const difficultyFinite = clamp(rawDifficulty, FSRS_DIFFICULTY_MIN, FSRS_DIFFICULTY_MAX);
    difficulty = Math.max(
      Number.isNaN(difficultyFinite) ? empty.difficulty : difficultyFinite,
      FSRS_DIFFICULTY_MIN,
    );
  }
  const elapsed = Number(dbCard.fsrs_elapsed_days);
  const scheduled = Number(dbCard.fsrs_scheduled_days);

  return {
    ...empty,
    due: new Date(dbCard.next_review || new Date()),
    stability,
    difficulty,
    elapsed_days: Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0,
    scheduled_days: Number.isFinite(scheduled) && scheduled >= 0 ? scheduled : 0,
    reps,
    state,
    last_review: dbCard.fsrs_last_review
      ? new Date(dbCard.fsrs_last_review)
      : undefined,
  };
};

/**
 * 将 0-5 的 quality 评分映射为 ts-fsrs 的 Rating。
 */
export const mapQualityToRating = (quality: number): Rating => {
  const q = Number.isFinite(quality) ? Math.trunc(quality) : 1;
  if (q <= 1) return Rating.Again;   // 0,1 → Again
  if (q === 2) return Rating.Hard;   // 2   → Hard
  if (q === 3) return Rating.Good;   // 3   → Good
  return Rating.Easy;                // 4,5 → Easy
};