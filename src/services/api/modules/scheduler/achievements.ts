import { request } from "../../client";

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: "focus" | "tasks" | "streak" | "special" | "study" | "creation";
  icon: string;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  trigger_events: string[];
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  unlocked_at: string;
  progress: number;
  metadata: Record<string, unknown>;
}

export interface AchievementCheckResult {
  unlocked: Achievement[];
  progress: Array<{
    achievement: Achievement;
    current: number;
    target: number;
    percentage: number;
  }>;
}

export const achievementsApi = {
  getAllAchievements: () => request("/scheduler/achievements"),

  getUserAchievements: () => request("/scheduler/achievements/user"),

  checkAchievements: () =>
    request("/scheduler/achievements/check", { method: "POST" }),
};
