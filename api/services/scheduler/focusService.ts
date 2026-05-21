import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
  HeatmapData,
} from "@shared/types/scheduler";

export class FocusService {
  async createFocusSession(
    client: SupabaseClient,
    userId: string,
    data: CreateFocusSessionData,
  ): Promise<FocusSession> {
    const { data: session, error } = await client
      .from("focus_sessions")
      .insert({
        user_id: userId,
        task_id: data.task_id,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration: data.duration,
        pomodoro_count: data.pomodoro_count || 0,
        white_noise_type: data.white_noise_type,
        is_break: data.is_break || false,
      })
      .select()
      .single();

    if (error)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return session as FocusSession;
  }

  async updateFocusSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string,
    updates: Partial<Omit<FocusSession, "id" | "user_id" | "created_at">>,
  ): Promise<FocusSession> {
    const { data, error } = await client
      .from("focus_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    if (!data) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    return data as FocusSession;
  }

  async getFocusSessions(
    client: SupabaseClient,
    userId: string,
    options?: {
      from_date?: string;
      to_date?: string;
      task_id?: string;
      is_break?: boolean;
      limit?: number;
    },
  ): Promise<FocusSession[]> {
    let query = client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (options?.from_date) {
      query = query.gte("started_at", options.from_date);
    }
    if (options?.to_date) {
      query = query.lte("started_at", options.to_date);
    }
    if (options?.task_id) {
      query = query.eq("task_id", options.task_id);
    }
    if (options?.is_break !== undefined) {
      query = query.eq("is_break", options.is_break);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return data as FocusSession[];
  }

  async getUserFocusStats(
    client: SupabaseClient,
    userId: string,
  ): Promise<UserFocusStats> {
    const { data, error } = await client
      .from("user_focus_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });

    if (!data) {
      return {
        id: "",
        user_id: userId,
        total_focus_seconds: 0,
        total_sessions: 0,
        total_pomodoros: 0,
        total_tasks_completed: 0,
        current_streak: 0,
        longest_streak: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as UserFocusStats;
  }

  async getDailyFocusStats(
    client: SupabaseClient,
    userId: string,
    date?: string,
  ): Promise<DailyFocusStats> {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const { data: sessions, error: sessionsError } = await client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_break", false)
      .gte("started_at", startDate.toISOString())
      .lt("started_at", endDate.toISOString());

    if (sessionsError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: sessionsError.message } });

    const { data: tasks, error: tasksError } = await client
      .from("user_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", startDate.toISOString())
      .lt("completed_at", endDate.toISOString());

    if (tasksError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: tasksError.message } });

    const totalDuration =
      sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const sessionCount = sessions?.length || 0;
    const pomodoroCount =
      sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0;

    return {
      date: targetDate,
      total_duration: totalDuration,
      session_count: sessionCount,
      pomodoro_count: pomodoroCount,
      tasks_completed: tasks?.length || 0,
      avg_session_duration:
        sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0,
    };
  }

  async getWeeklyFocusStats(
    client: SupabaseClient,
    userId: string,
    weekStart?: string,
  ): Promise<WeeklyFocusStats> {
    const now = new Date();
    const start = weekStart ? new Date(weekStart) : new Date(now);
    if (!weekStart) {
      start.setDate(start.getDate() - start.getDay());
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const { data: sessions, error: sessionsError } = await client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_break", false)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString());

    if (sessionsError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: sessionsError.message } });

    const { data: tasks, error: tasksError } = await client
      .from("user_tasks")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", start.toISOString())
      .lt("completed_at", end.toISOString());

    if (tasksError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: tasksError.message } });

    const stats = await this.getUserFocusStats(client, userId);

    const dailyStats: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dailyStats[d.toISOString().split("T")[0]] = 0;
    }

    sessions?.forEach((s) => {
      const dateStr = new Date(s.started_at).toISOString().split("T")[0];
      if (dailyStats[dateStr] !== undefined) {
        dailyStats[dateStr] += s.duration || 0;
      }
    });

    const totalDuration =
      sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const bestDay = Object.entries(dailyStats).reduce(
      (best, [date, duration]) =>
        duration > best.duration ? { date, duration } : best,
      { date: "", duration: 0 },
    );

    return {
      week_start: start.toISOString().split("T")[0],
      week_end: new Date(end.getTime() - 1).toISOString().split("T")[0],
      total_duration: totalDuration,
      total_sessions: sessions?.length || 0,
      total_pomodoros:
        sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0,
      tasks_completed: tasks?.length || 0,
      daily_average: Math.round(totalDuration / 7),
      best_day: bestDay,
      streak_days: stats.current_streak,
    };
  }

  async getMonthlyFocusStats(
    client: SupabaseClient,
    userId: string,
    year?: number,
    month?: number,
  ): Promise<MonthlyFocusStats> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const { data: sessions, error: sessionsError } = await client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_break", false)
      .gte("started_at", startDate.toISOString())
      .lte("started_at", endDate.toISOString());

    if (sessionsError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: sessionsError.message } });

    const { data: tasks, error: tasksError } = await client
      .from("user_tasks")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString());

    if (tasksError)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: tasksError.message } });

    const stats = await this.getUserFocusStats(client, userId);

    const dailyStats: Record<string, number> = {};
    const activeDays = new Set<string>();

    sessions?.forEach((s) => {
      const dateStr = new Date(s.started_at).toISOString().split("T")[0];
      if (!dailyStats[dateStr]) dailyStats[dateStr] = 0;
      dailyStats[dateStr] += s.duration || 0;
      activeDays.add(dateStr);
    });

    const totalDuration =
      sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const bestDay = Object.entries(dailyStats).reduce(
      (best, [date, duration]) =>
        duration > best.duration ? { date, duration } : best,
      { date: "", duration: 0 },
    );

    const weeksInMonth = Math.ceil(endDate.getDate() / 7);
    const weeklyBreakdown = [];
    for (let w = 0; w < weeksInMonth; w++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekSessions =
        sessions?.filter((s) => {
          const d = new Date(s.started_at);
          return d >= weekStart && d < weekEnd;
        }) || [];

      weeklyBreakdown.push({
        week: w + 1,
        duration: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        sessions: weekSessions.length,
      });
    }

    const daysInMonth = endDate.getDate();

    return {
      month: `${targetYear}-${targetMonth.toString().padStart(2, "0")}`,
      total_duration: totalDuration,
      total_sessions: sessions?.length || 0,
      total_pomodoros:
        sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0,
      tasks_completed: tasks?.length || 0,
      daily_average: Math.round(totalDuration / daysInMonth),
      active_days: activeDays.size,
      best_day: bestDay,
      streak_longest: stats.longest_streak,
      weekly_breakdown: weeklyBreakdown,
    };
  }

  async getYearlyHeatmap(
    client: SupabaseClient,
    userId: string,
    year?: number,
  ): Promise<HeatmapData[]> {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const { data: sessions, error } = await client
      .from("focus_sessions")
      .select("started_at, duration")
      .eq("user_id", userId)
      .eq("is_break", false)
      .gte("started_at", startDate.toISOString())
      .lte("started_at", endDate.toISOString());

    if (error)
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });

    const groupedByDate: Record<string, { count: number; duration: number }> =
      {};

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split("T")[0];
      groupedByDate[dateStr] = { count: 0, duration: 0 };
    }

    sessions?.forEach((s) => {
      const dateStr = new Date(s.started_at).toISOString().split("T")[0];
      if (groupedByDate[dateStr]) {
        groupedByDate[dateStr].count++;
        groupedByDate[dateStr].duration += s.duration || 0;
      }
    });

    return Object.entries(groupedByDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        duration: data.duration,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const focusService = new FocusService();
