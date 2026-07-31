import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import i18next from "i18next";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';

const ALLOWED_SETTINGS_FIELDS = [
  "q0_time_slice",
  "q1_time_slice",
  "q2_time_slice",
  "break_duration",
  "sound_enabled",
  "notification_enabled",
] as const;

class TaskSettingService {
  async get(supabase: SupabaseClient, userId: string) {
    const { data: settings, error } = await supabase
      .from("task_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new AppError(i18next.t("scheduler.api.errors.getSettingsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from("task_settings")
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        throw new AppError(i18next.t("scheduler.api.errors.createSettingsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return newSettings;
    }

    return settings;
  }

  async update(supabase: SupabaseClient, userId: string, data: Record<string, unknown>) {
    const updateData: Record<string, unknown> = {};

    for (const field of ALLOWED_SETTINGS_FIELDS) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(i18next.t("scheduler.api.errors.noUpdateFields"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data: settings, error } = await supabase
      .from("task_settings")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new AppError(i18next.t("scheduler.api.errors.updateSettingsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return settings;
  }

  async updateNotes(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    notes: string,
  ) {
    const { data: task, error } = await notDeleted(supabase
      .from("user_tasks")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (error) {
      logger.error("Update notes error:", error);
      throw new AppError(i18next.t("scheduler.api.errors.updateNoteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!task) {
      throw new AppError(i18next.t("scheduler.api.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return task;
  }
}

export const taskSettingService = new TaskSettingService();
