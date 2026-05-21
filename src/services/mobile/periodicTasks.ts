import { getMobileSupabaseClient } from "@/lib/supabase";

export interface PeriodicTask {
  id: string;
  user_id: string;
  period_type: "weekly" | "monthly" | "quarterly";
  period_start: string;
  period_end: string;
  task_type: "focus" | "study" | "create" | "tasks";
  target: number;
  progress: number;
  status: "pending" | "completed";
  xp_reward: number;
  pass_points: number;
  created_at: string;
  updated_at: string;
}

export interface PeriodicPass {
  id: string;
  user_id: string;
  period_type: "weekly" | "monthly" | "quarterly";
  period_start: string;
  period_end: string;
  total_points: number;
  current_level: number;
  created_at: string;
  updated_at: string;
}

export interface PassReward {
  id: string;
  period_type: "weekly" | "monthly" | "quarterly";
  level: number;
  points_required: number;
  reward_type: "xp" | "achievement" | "badge";
  reward_value: number | null;
  achievement_code: string | null;
  name: string;
  description: string | null;
  icon: string;
}

export interface UserPassProgress {
  id: string;
  user_id: string;
  pass_id: string;
  level: number;
  claimed: boolean;
  claimed_at: string | null;
}

const PERIODIC_TASK_CONFIGS = {
  weekly: {
    focus: { target: 600, xp_reward: 100, pass_points: 10 },
    study: { target: 100, xp_reward: 80, pass_points: 10 },
    create: { target: 10, xp_reward: 60, pass_points: 10 },
    tasks: { target: 15, xp_reward: 80, pass_points: 10 },
  },
  monthly: {
    focus: { target: 2400, xp_reward: 300, pass_points: 20 },
    study: { target: 400, xp_reward: 200, pass_points: 20 },
    create: { target: 50, xp_reward: 150, pass_points: 20 },
    tasks: { target: 60, xp_reward: 200, pass_points: 20 },
  },
  quarterly: {
    focus: { target: 7200, xp_reward: 800, pass_points: 40 },
    study: { target: 1200, xp_reward: 500, pass_points: 40 },
    create: { target: 150, xp_reward: 400, pass_points: 40 },
    tasks: { target: 180, xp_reward: 500, pass_points: 40 },
  },
};

function getPeriodDates(
  periodType: "weekly" | "monthly" | "quarterly"
): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (periodType) {
    case "weekly": {
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
    case "monthly": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
    case "quarterly": {
      const quarter = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), quarter * 3, 1);
      const end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
  }
}

async function initPeriodicTasks(
  client: any,
  userId: string
): Promise<void> {
  const periodTypes: ("weekly" | "monthly" | "quarterly")[] = [
    "weekly",
    "monthly",
    "quarterly",
  ];

  for (const periodType of periodTypes) {
    const { start, end } = getPeriodDates(periodType);

    const { count } = await (client.from("periodic_tasks") as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("period_type", periodType)
      .eq("period_start", start);

    if (count && count > 0) continue;

    const config = PERIODIC_TASK_CONFIGS[periodType];
    const tasks = [
      {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        task_type: "focus",
        target: config.focus.target,
        xp_reward: config.focus.xp_reward,
        pass_points: config.focus.pass_points,
      },
      {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        task_type: "study",
        target: config.study.target,
        xp_reward: config.study.xp_reward,
        pass_points: config.study.pass_points,
      },
      {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        task_type: "create",
        target: config.create.target,
        xp_reward: config.create.xp_reward,
        pass_points: config.create.pass_points,
      },
      {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        task_type: "tasks",
        target: config.tasks.target,
        xp_reward: config.tasks.xp_reward,
        pass_points: config.tasks.pass_points,
      },
    ];

    await (client.from("periodic_tasks") as any).upsert(tasks, {
      onConflict: "user_id,period_type,period_start,task_type",
      ignoreDuplicates: true,
    });

    await (client.from("periodic_passes") as any).upsert(
      {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        total_points: 0,
        current_level: 0,
      },
      { onConflict: "user_id,period_type,period_start" }
    );
  }
}

export const mobilePeriodicTasksApi = {
  list: async (): Promise<PeriodicTask[]> => {
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

    await initPeriodicTasks(client, user.id);

    const { data, error } = await (client.from("periodic_tasks") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("period_type")
      .order("task_type");

    if (error) {
      console.error("Error fetching periodic tasks:", error);
      return [];
    }

    return data || [];
  },

  check: async (
    taskType: string,
    value: number
  ): Promise<{ completedTasks: PeriodicTask[] }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { completedTasks: [] };
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { completedTasks: [] };
    }

    const periodTypes: ("weekly" | "monthly" | "quarterly")[] = [
      "weekly",
      "monthly",
      "quarterly",
    ];
    const completedTasks: PeriodicTask[] = [];

    for (const periodType of periodTypes) {
      const { start } = getPeriodDates(periodType);

      const { data: task } = await (client.from("periodic_tasks") as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("period_type", periodType)
        .eq("task_type", taskType)
        .eq("period_start", start)
        .single();

      if (!task || task.status === "completed") continue;

      const newProgress = Math.min(value, task.target);
      const updates: any = { progress: newProgress };

      if (newProgress >= task.target) {
        updates.status = "completed";

        const { data: currentPass } = await (client.from("periodic_passes") as any)
          .select("total_points")
          .eq("user_id", user.id)
          .eq("period_type", periodType)
          .eq("period_start", start)
          .single();

        if (currentPass) {
          await (client.from("periodic_passes") as any)
            .update({ total_points: currentPass.total_points + task.pass_points })
            .eq("user_id", user.id)
            .eq("period_type", periodType)
            .eq("period_start", start);
        }

        completedTasks.push(task);
      }

      await (client.from("periodic_tasks") as any).update(updates).eq("id", task.id);
    }

    return { completedTasks };
  },

  getPass: async (): Promise<{
    weekly: PeriodicPass | null;
    monthly: PeriodicPass | null;
    quarterly: PeriodicPass | null;
    rewards: PassReward[];
    userProgress: UserPassProgress[];
  }> => {
    const client = getMobileSupabaseClient();
    const emptyResult = {
      weekly: null,
      monthly: null,
      quarterly: null,
      rewards: [],
      userProgress: [],
    };

    if (!client) {
      return emptyResult;
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return emptyResult;
    }

    await initPeriodicTasks(client, user.id);

    const result: any = {
      weekly: null,
      monthly: null,
      quarterly: null,
      rewards: [],
      userProgress: [],
    };

    for (const periodType of ["weekly", "monthly", "quarterly"] as const) {
      const { start } = getPeriodDates(periodType);

      const { data: pass } = await (client.from("periodic_passes") as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("period_type", periodType)
        .eq("period_start", start)
        .single();

      result[periodType] = pass;
    }

    const { data: rewards } = await (client.from("pass_rewards") as any)
      .select("*")
      .order("period_type")
      .order("level");

    result.rewards = rewards || [];

    const passIds = [
      result.weekly?.id,
      result.monthly?.id,
      result.quarterly?.id,
    ].filter(Boolean);

    if (passIds.length > 0) {
      const { data: progress } = await (client.from("user_pass_progress") as any)
        .select("*")
        .in("pass_id", passIds);

      result.userProgress = progress || [];
    }

    return result;
  },

  claimReward: async (
    passId: string,
    level: number
  ): Promise<{ success: boolean; reward: PassReward | null; message: string }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { success: false, reward: null, message: "客户端未初始化" };
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, reward: null, message: "用户未登录" };
    }

    const { data: pass } = await (client.from("periodic_passes") as any)
      .select("*")
      .eq("id", passId)
      .eq("user_id", user.id)
      .single();

    if (!pass) {
      return { success: false, reward: null, message: "通行证不存在" };
    }

    const { data: reward } = await (client.from("pass_rewards") as any)
      .select("*")
      .eq("period_type", pass.period_type)
      .eq("level", level)
      .single();

    if (!reward) {
      return { success: false, reward: null, message: "奖励不存在" };
    }

    if (pass.total_points < reward.points_required) {
      return { success: false, reward: null, message: "积分不足" };
    }

    const { data: existingProgress } = await (client.from("user_pass_progress") as any)
      .select("*")
      .eq("pass_id", passId)
      .eq("level", level)
      .single();

    if (existingProgress?.claimed) {
      return { success: false, reward: null, message: "奖励已领取" };
    }

    await (client.from("user_pass_progress") as any).upsert(
      {
        user_id: user.id,
        pass_id: passId,
        level,
        claimed: true,
        claimed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,pass_id,level" }
    );

    if (reward.reward_type === "xp" && reward.reward_value) {
      const { data: userData } = await (client.from("users") as any)
        .select("xp, level")
        .eq("id", user.id)
        .single();

      if (userData) {
        let xp = (userData.xp || 0) + reward.reward_value;
        let userLevel = userData.level;
        let nextLevelThreshold = userLevel * 500;

        while (xp >= nextLevelThreshold) {
          xp -= nextLevelThreshold;
          userLevel++;
          nextLevelThreshold = userLevel * 500;
        }

        await (client.from("users") as any).update({ xp, level: userLevel }).eq("id", user.id);
      }
    }

    if (pass.current_level < level) {
      await (client.from("periodic_passes") as any).update({ current_level: level }).eq("id", passId);
    }

    return { success: true, reward, message: "奖励领取成功" };
  },

  checkStreak: async (): Promise<{ streak: number; bonusAwarded: number }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: dailyTasks } = await (client.from("daily_tasks") as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("task_date", today);

    if (!dailyTasks || dailyTasks.length === 0) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const allCompleted = dailyTasks.every((t: any) => t.status === "completed");
    if (!allCompleted) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const { data: stats } = await (client.from("user_focus_stats") as any)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!stats) {
      await (client.from("user_focus_stats") as any).insert({
        user_id: user.id,
        daily_task_streak: 1,
        last_daily_completion: today,
      });
      return { streak: 1, bonusAwarded: 0 };
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    let newStreak = 1;

    if (stats.last_daily_completion === yesterday) {
      newStreak = (stats.daily_task_streak || 0) + 1;
    }

    let bonusAwarded = 0;
    const streakMilestones: Record<number, number> = {
      7: 50,
      14: 100,
      30: 300,
      60: 600,
      100: 1000,
    };

    if (streakMilestones[newStreak]) {
      bonusAwarded = streakMilestones[newStreak];
    }

    await (client.from("user_focus_stats") as any)
      .update({
        daily_task_streak: newStreak,
        last_daily_completion: today,
      })
      .eq("user_id", user.id);

    return { streak: newStreak, bonusAwarded };
  },
};
