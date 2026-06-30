import { withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type { TaskSettings, UpdateTaskSettingsData } from "@shared/types";
import type { TaskSettingsRow } from "@shared/types/database";
import { DEFAULT_TASK_SETTINGS } from "@shared/constants/taskDefaults";

export const getSettings = async (): Promise<TaskSettings> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return {
        id: "",
        user_id: "",
        ...DEFAULT_TASK_SETTINGS,
      };
    }

    const { data, error } = await client
      .from("task_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    const row = data as TaskSettingsRow | null;
    if (!row) {
      return {
        id: "",
        user_id: userId,
        ...DEFAULT_TASK_SETTINGS,
      };
    }
    return {
      id: row.id,
      user_id: row.user_id,
      q0_time_slice: row.q0_time_slice ?? DEFAULT_TASK_SETTINGS.q0_time_slice,
      q1_time_slice: row.q1_time_slice ?? DEFAULT_TASK_SETTINGS.q1_time_slice,
      q2_time_slice: row.q2_time_slice ?? DEFAULT_TASK_SETTINGS.q2_time_slice,
      break_duration: row.break_duration ?? DEFAULT_TASK_SETTINGS.break_duration,
      sound_enabled: row.sound_enabled ?? DEFAULT_TASK_SETTINGS.sound_enabled,
      notification_enabled: row.notification_enabled ?? DEFAULT_TASK_SETTINGS.notification_enabled,
    };
  });
};

export const updateSettings = async (data: UpdateTaskSettingsData): Promise<TaskSettings> => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await client
      .from("task_settings")
      .upsert({
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSettings;
  });
};
