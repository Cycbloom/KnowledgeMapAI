import {
  fsrs,
  Card,
  Rating,
  State,
  createEmptyCard,
  migrateParameters,
  type FSRS,
  type FSRSParameters,
} from "ts-fsrs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyCard } from "@/types";
import { logger } from "@/utils/logger";

/**
 * 将数据库中的 StudyCard 转换为 ts-fsrs 的 Card 对象。
 * 与桌面端 studyService.dbCardToFSRS 保持一致，避免跨端数据漂移。
 * 关键修复：对 NaN/零值做归一化，非 New 状态 stability/difficulty 必须为正有限值，
 *          否则 ts-fsrs.next_state 会抛错。
 */
export const dbCardToFSRS = (dbCard: StudyCard): Card => {
  const empty = createEmptyCard();
  const rawState = dbCard.fsrs_state
    ? (State[dbCard.fsrs_state as keyof typeof State] as State | undefined)
    : undefined;
  const state = rawState === undefined ? State.New : rawState;

  const reps = Math.max(0, Number.isFinite(dbCard.review_count ?? NaN) ? (dbCard.review_count as number) : 0);
  // FSRS 5 的合法性约束：
  //   1) New 卡：必须同时满足 stability=0 且 difficulty=0，FSRS.next_state
  //      才会走 init_stability / init_difficulty 分支；否则会进入
  //      "d < 1 || s < S_MIN" 校验并抛 "Invalid memory state"。
  //      因此 New 卡不论数据库遗留了什么非零残留值（如 s=0 但 d=0.3），
  //      一律强制归零，保证 (d,s)===(0,0)。
  //   2) 非 New 卡：difficulty ∈ [1,10]，stability ≥ S_MIN=1e-3。
  //      早期遗留数据可能出现 difficulty=0.3/0/NaN、stability=0/NaN，
  //      这里做 clamp + 下限兜底。
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : NaN;
  const FSRS_DIFFICULTY_MIN = 1;
  const FSRS_DIFFICULTY_MAX = 10;
  const FSRS_STABILITY_MIN = 1e-3;
  const FSRS_STABILITY_MAX = 36500;

  const rawStability = Number(dbCard.fsrs_stability);
  const rawDifficulty = Number(dbCard.fsrs_difficulty);
  let stability: number;
  let difficulty: number;
  if (state === State.New) {
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
 * 与桌面端 studyService.mapQualityToRating 保持一致。
 */
export const mapQualityToRating = (quality: number): Rating => {
  const q = Number.isFinite(quality) ? Math.trunc(quality) : 1;
  if (q <= 1) return Rating.Again;   // 0,1 → Again
  if (q === 2) return Rating.Hard;   // 2   → Hard
  if (q === 3) return Rating.Good;   // 3   → Good
  return Rating.Easy;                // 4,5 → Easy
};

/**
 * 加载用户个性化 FSRS 参数并返回 FSRS 实例。
 * 从 users.settings 读取 request_retention/maximum_interval/fsrs_parameters，
 * 通过 migrateParameters 自动迁移旧版参数（17/19 → 21）。
 * 读取失败时回退到 fsrs() 默认参数。
 *
 * 注意：移动端不支持 studyMode 预设覆盖（保持简单），如需扩展可后续添加。
 */
export const getFSRSForUser = async (
  userId: string,
  supabase: SupabaseClient,
): Promise<FSRS> => {
  try {
    const { data } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    const settings = (data?.settings as Record<string, unknown>) ?? {};
    const params: Partial<FSRSParameters> = {};

    if (settings.request_retention) {
      params.request_retention = Number(settings.request_retention);
    }
    if (settings.maximum_interval) {
      params.maximum_interval = Number(settings.maximum_interval);
    }

    // 加载用户个性化 FSRS w 参数
    if (Array.isArray(settings.fsrs_parameters)) {
      const wParams = settings.fsrs_parameters as number[];
      // 自动迁移旧版参数（17/19 → 21）
      const migratedW = migrateParameters(wParams);
      params.w = migratedW;
    }

    return fsrs(params);
  } catch (e) {
    logger.warn("[Mobile] Failed to fetch user settings for FSRS, using defaults", e);
    return fsrs();
  }
};

export const fsrsEngine = {
  dbCardToFSRS,
  mapQualityToRating,
  getFSRSForUser,
};
