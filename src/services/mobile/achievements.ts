import { getMobileSupabaseClient } from "@/lib/supabase";
import type { AchievementRow } from "@shared/types/database";

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: "focus" | "tasks" | "streak" | "special" | "study" | "creation";
  icon: string;
  color?: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden?: boolean;
  trigger_events: string[];
  created_at: string;
  unlocked_at?: string;
}

export interface DailyTask {
  id: string;
  user_id: string;
  task_date: string;
  task_type: "login" | "study_cards" | "focus_time" | "create_node";
  target: number;
  progress: number;
  status: "pending" | "completed";
  xp_reward: number;
  completed_at?: string;
  created_at: string;
}

interface UserAchievementData {
  achievement_id: string;
  unlocked_at: string;
}

export const mobileAchievementsApi = {
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
      console.error("Error fetching achievements:", fetchError);
      return [];
    }

    const { data: userAchievements, error: userError } = await client
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", user.id);

    if (userError) {
      console.error("Error fetching user achievements:", userError);
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
      console.error("Error fetching daily tasks:", error);
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
