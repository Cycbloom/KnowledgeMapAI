import { withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type {
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
} from "@shared/types";
import type { FocusSessionRow } from "@shared/types/database";

export const getFocusSessions = async (): Promise<FocusSession[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    const { data, error } = await client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as FocusSession[] | null) ?? [];
  });
};

export const createFocusSession = async (data: CreateFocusSessionData): Promise<FocusSession> => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await client
      .from("focus_sessions")
      .insert({
        user_id: userId,
        task_id: data.task_id,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration: data.duration,
        pomodoro_count: data.pomodoro_count || 1,
        white_noise_type: data.white_noise_type,
        is_break: data.is_break || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as FocusSession;
  });
};

export const getUserFocusStats = async (): Promise<UserFocusStats | null> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return null;
    }

    const { data, error } = await client
      .from("user_focus_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as UserFocusStats | null;
  });
};

export const getDailyFocusStats = async (): Promise<DailyFocusStats[]> => {
  return [];
};

export const getWeeklyFocusStats = async (): Promise<WeeklyFocusStats[]> => {
  return [];
};

export const getMonthlyFocusStats = async (): Promise<MonthlyFocusStats[]> => {
  return [];
};

export const updateFocusSession = async (
  _id: string,
  _data: Partial<FocusSessionRow>
): Promise<FocusSession> => {
  return {} as FocusSession;
};
