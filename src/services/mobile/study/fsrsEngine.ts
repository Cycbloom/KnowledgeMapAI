import {
  fsrs,
  migrateParameters,
  type FSRS,
  type FSRSParameters,
} from "ts-fsrs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";
import { dbCardToFSRS, mapQualityToRating } from "@shared/utils/fsrs/cardConversion";

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
