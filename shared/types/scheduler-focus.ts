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
  mode?: "focus" | "shortBreak" | "longBreak";
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
