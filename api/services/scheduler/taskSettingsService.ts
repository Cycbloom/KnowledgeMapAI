import { SupabaseClient } from "@supabase/supabase-js";
import type { TaskSettings } from "@shared/types/scheduler";

const DEFAULT_SETTINGS: Omit<TaskSettings, "id" | "user_id"> = {
  q0_time_slice: 25,
  q1_time_slice: 50,
  q2_time_slice: 100,
  break_duration: 5,
  sound_enabled: true,
  notification_enabled: true,
};

export class TaskSettingsService {
  async getSettings(
    client: SupabaseClient,
    userId: string,
  ): Promise<TaskSettings> {
    const { data, error } = await client
      .from("task_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch settings: ${error.message}`);

    if (!data) {
      const { data: newSettings, error: createError } = await client
        .from("task_settings")
        .insert({
          user_id: userId,
          ...DEFAULT_SETTINGS,
        })
        .select()
        .single();

      if (createError)
        throw new Error(`Failed to create settings: ${createError.message}`);
      return newSettings as TaskSettings;
    }

    return data as TaskSettings;
  }

  async updateSettings(
    client: SupabaseClient,
    userId: string,
    updates: Partial<Omit<TaskSettings, "id" | "user_id">>,
  ): Promise<TaskSettings> {
    const existingSettings = await this.getSettings(client, userId);

    const { data, error } = await client
      .from("task_settings")
      .update(updates)
      .eq("id", existingSettings.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update settings: ${error.message}`);
    return data as TaskSettings;
  }
}

export const taskSettingsService = new TaskSettingsService();
