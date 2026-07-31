import { getMobileSupabaseClient } from "@/utils/supabase";
import type { AchievementRow } from "@shared/types/database";
import type { IAchievementsApi, Achievement, DailyTask } from "../api/contracts/IAchievementsApi";
import { logger } from "@/utils/logger";

interface UserAchievementData {
  achievement_id: string;
  unlocked_at: string;
}

export const mobileAchievementsApi: IAchievementsApi = {
  list: async (): Promise<Achievement[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return [];
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data: allAchievements, error: fetchError } = await client
      .from("achievements")
      .select("*")
      .order("condition_value", { ascending: true });

    if (fetchError) {
      logger.error("Error fetching achievements:", fetchError);
      return [];
    }

    const { data: userAchievements, error: userError } = await client
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", user.id);

    if (userError) {
      logger.error("Error fetching user achievements:", userError);
      return (allAchievements || []) as Achievement[];
    }

    const unlockedMap = new Map(
      (userAchievements || []).map((ua: UserAchievementData) => [ua.achievement_id, ua.unlocked_at])
    );

    return (allAchievements || []).map((ach: AchievementRow) => ({
      ...ach,
      unlocked_at: unlockedMap.get(ach.id) || null,
    })) as Achievement[];
  },

  check: async (type: string, value: number): Promise<{ newUnlocks: Achievement[] }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { newUnlocks: [] };
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { newUnlocks: [] };
    }

    const { data: candidates } = await client
      .from("achievements")
      .select("*")
      .eq("condition_type", type)
      .lte("condition_value", value);

    if (!candidates || candidates.length === 0) {
      return { newUnlocks: [] };
    }

    const candidateRows = candidates as AchievementRow[];

    const { data: unlocked } = await client
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id)
      .in("achievement_id", candidateRows.map((c) => c.id));

    const unlockedIds = new Set((unlocked || []).map((u: { achievement_id: string }) => u.achievement_id));
    const newUnlocks = candidateRows.filter((c) => !unlockedIds.has(c.id));

    if (newUnlocks.length === 0) {
      return { newUnlocks: [] };
    }

    const unlocksToInsert = newUnlocks.map((ach) => ({
      user_id: user.id,
      achievement_id: ach.id,
      unlocked_at: new Date().toISOString(),
    }));

    await client.from("user_achievements").insert(unlocksToInsert);

    return { newUnlocks: newUnlocks as Achievement[] };
  },

  getDailyTasks: async (): Promise<DailyTask[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return [];
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const today = new Date().toISOString().split("T")[0];

    const { count } = await client
      .from("daily_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("task_date", today);

    if (!count || count === 0) {
      const tasks = [
        { user_id: user.id, task_date: today, task_type: "login", target: 1, xp_reward: 20 },
        { user_id: user.id, task_date: today, task_type: "study_cards", target: 10, xp_reward: 50 },
        { user_id: user.id, task_date: today, task_type: "focus_time", target: 25, xp_reward: 50 },
        { user_id: user.id, task_date: today, task_type: "create_node", target: 1, xp_reward: 30 },
      ];

      await client.from("daily_tasks").insert(tasks);
    }

    const { data, error } = await client
      .from("daily_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_date", today)
      .order("created_at");

    if (error) {
      logger.error("Error fetching daily tasks:", error);
      return [];
    }

    return (data || []) as DailyTask[];
  },

  checkIn: async (): Promise<{ success: boolean }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { success: false };
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false };
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: task } = await client
      .from("daily_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_date", today)
      .eq("task_type", "login")
      .single();

    const taskRow = task as DailyTask | null;
    if (taskRow && taskRow.status === "pending") {
      await client
        .from("daily_tasks")
        .update({
          status: "completed",
          progress: 1,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskRow.id);
    }

    return { success: true };
  },
};
