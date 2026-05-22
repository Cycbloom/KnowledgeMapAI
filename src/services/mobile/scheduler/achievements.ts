import { withClient, withClientOptionalUser } from "../utils/clientHelper";
import type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
} from "@shared/types";

export const getAllAchievements = async (): Promise<Achievement[]> => {
  return withClient(async (client) => {
    const { data, error } = await client.from("achievements").select("*");

    if (error) {
      throw new Error(error.message);
    }

    return (data as Achievement[] | null) ?? [];
  });
};

export const getUserAchievements = async (): Promise<UserAchievement[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    const { data, error } = await client
      .from("user_achievements")
      .select("*, achievement:achievements(*)")
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return (data as UserAchievement[] | null) ?? [];
  });
};

export const checkAchievements = async (): Promise<AchievementCheckResult> => {
  return {
    unlocked: [],
    progress: [],
  };
};
