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

    return (data as TaskSettingsRow) ?? {
      id: "",
      user_id: userId,
      ...DEFAULT_TASK_SETTINGS,
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
