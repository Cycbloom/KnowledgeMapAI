import { request } from "../../client";
import type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "@shared/types";

// Re-export for backwards compatibility with existing imports.
export type { Achievement, UserAchievement, AchievementCheckResult };

// 修正：成就 API 由 SchedulerPlugin 注册到 /api/achievements（见
// api/services/plugins/SchedulerPlugin.ts），不是 /api/scheduler/achievements。
// 后端 res.json 直接返回数据（不是 { success, data } 包装），因此使用
// request<T> 而非 requestData<T>。
// 此处与 src/services/api/templates.ts 中的旧 achievementsApi 行为保持一致，
// 避免成就页（AchievementGallery）在切换到 schedulerApi 后命中 404。
export const achievementsApi = {
  getAllAchievements: (): Promise<Achievement[]> =>
    request<Achievement[]>("/achievements"),

  getUserAchievements: (): Promise<UserAchievement[]> =>
    request<UserAchievement[]>("/achievements/user"),

  checkAchievements: (): Promise<AchievementCheckResult> =>
    request<AchievementCheckResult>("/achievements/check", {
      method: "POST",
    }),
};
