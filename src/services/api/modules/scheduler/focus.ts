import { request } from "../../client.js";

export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  pomodoro_count: number;
  white_noise_type?: string;
  is_break: boolean;
  created_at: string;
}

export interface CreateFocusSessionData {
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  pomodoro_count?: number;
  white_noise_type?: string;
  is_break?: boolean;
}

export interface UserFocusStats {
  id: string;
  user_id: string;
  total_focus_seconds: number;
  total_sessions: number;
  total_pomodoros: number;
  total_tasks_completed: number;
  current_streak: number;
  longest_streak: number;
  last_focus_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyFocusStats {
  date: string;
  total_duration: number;
  session_count: number;
  pomodoro_count: number;
  tasks_completed: number;
  avg_session_duration: number;
}

export interface WeeklyFocusStats {
  week_start: string;
  week_end: string;
  total_duration: number;
  total_sessions: number;
  total_pomodoros: number;
  tasks_completed: number;
  daily_average: number;
  best_day: { date: string; duration: number };
  streak_days: number;
}

export interface MonthlyFocusStats {
  month: string;
  total_duration: number;
  total_sessions: number;
  total_pomodoros: number;
  tasks_completed: number;
  daily_average: number;
  active_days: number;
  best_day: { date: string; duration: number };
  streak_longest: number;
  weekly_breakdown: Array<{
    week: number;
    duration: number;
    sessions: number;
  }>;
}

export const focusApi = {
  createFocusSession: (data: CreateFocusSessionData) =>
    request("/scheduler/focus-sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFocusSession: (id: string, data: Partial<FocusSession>) =>
    request(`/scheduler/focus-sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getFocusSessions: (options?: {
    from_date?: string;
    to_date?: string;
    task_id?: string;
    is_break?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.from_date) params.append("from_date", options.from_date);
    if (options?.to_date) params.append("to_date", options.to_date);
    if (options?.task_id) params.append("task_id", options.task_id);
    if (options?.is_break !== undefined)
      params.append("is_break", String(options.is_break));
    if (options?.limit) params.append("limit", String(options.limit));
    const queryString = params.toString();
    return request(
      `/scheduler/focus-sessions${queryString ? `?${queryString}` : ""}`,
    );
  },

  getUserFocusStats: () => request("/scheduler/focus-stats"),

  getDailyFocusStats: (date?: string) => {
    const params = date ? `?date=${date}` : "";
    return request(`/scheduler/focus-stats/daily${params}`);
  },

  getWeeklyFocusStats: (weekStart?: string) => {
    const params = weekStart ? `?week_start=${weekStart}` : "";
    return request(`/scheduler/focus-stats/weekly${params}`);
  },

  getMonthlyFocusStats: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year !== undefined) params.append("year", String(year));
    if (month !== undefined) params.append("month", String(month));
    const queryString = params.toString();
    return request(
      `/scheduler/focus-stats/monthly${queryString ? `?${queryString}` : ""}`,
    );
  },

  getYearlyHeatmap: (year?: number) => {
    const params = year ? `?year=${year}` : "";
    return request(`/scheduler/focus-stats/heatmap${params}`);
  },
};
