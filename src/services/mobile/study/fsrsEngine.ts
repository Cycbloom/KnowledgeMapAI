import { fsrs, Card, Rating, State, createEmptyCard, migrateParameters } from "ts-fsrs";
import type { FSRS, FSRSParameters } from "ts-fsrs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyCard } from "@/types";
import { logger } from "@/utils/logger";

/**
 * 将数据库中的 StudyCard 转换为 ts-fsrs 的 Card 对象。
 * 与桌面端 studyService.dbCardToFSRS 保持一致，避免跨端数据漂移。
 */
export const dbCardToFSRS = (dbCard: StudyCard): Card => {
  const empty = createEmptyCard();
  return {
    ...empty,
    due: new Date(dbCard.next_review || new Date()),
    stability: dbCard.fsrs_stability || 0,
    difficulty: dbCard.fsrs_difficulty || 0,
    elapsed_days: dbCard.fsrs_elapsed_days || 0,
    scheduled_days: dbCard.fsrs_scheduled_days || 0,
    reps: dbCard.review_count || 0,
    state: dbCard.fsrs_state ? (State[dbCard.fsrs_state as keyof typeof State] ?? State.New) : State.New,
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
  if (quality <= 1) return Rating.Again;
  if (quality === 2) return Rating.Hard;
  if (quality === 3) return Rating.Good;
  return Rating.Easy;
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
