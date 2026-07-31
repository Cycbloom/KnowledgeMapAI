import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface TimeSlot {
  id: string;
  user_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  label?: string;
  created_at: string;
}

interface CreateTimeSlotData {
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  is_available?: boolean;
  label?: string;
}

interface UpdateTimeSlotData {
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  label?: string;
}

interface ListTimeSlotsResult {
  slots: TimeSlot[];
  weekView: Record<number, TimeSlot[]>;
  globalSlots: TimeSlot[];
}

class TimeSlotService {
  private parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  private checkOverlap(
    existingSlots: TimeSlot[],
    newStartMinutes: number,
    newEndMinutes: number,
  ): TimeSlot | null {
    for (const slot of existingSlots) {
      const existingStartMinutes = this.parseTimeToMinutes(slot.start_time);
      const existingEndMinutes = this.parseTimeToMinutes(slot.end_time);

      const hasOverlap =
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes;

      if (hasOverlap) {
        return slot;
      }
    }
    return null;
  }

  async list(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<ListTimeSlotsResult> {
    const { data: timeSlots, error } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", userId)
      .order("day_of_week", { ascending: true, nullsFirst: true })
      .order("start_time", { ascending: true });

    if (error) {
      logger.error("Get time slots error:", error);
      throw new AppError(i18next.t("scheduler.timeSlot.errors.fetchFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const weekViewData: Record<number, TimeSlot[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    const globalSlots: TimeSlot[] = [];

    for (const slot of timeSlots ?? []) {
      if (slot.day_of_week === null) {
        globalSlots.push(slot);
      } else {
        weekViewData[slot.day_of_week].push(slot);
      }
    }

    return {
      slots: timeSlots ?? [],
      weekView: weekViewData,
      globalSlots,
    };
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    data: CreateTimeSlotData,
  ): Promise<TimeSlot> {
    const { day_of_week, start_time, end_time, is_available, label } = data;

    const startMinutes = this.parseTimeToMinutes(start_time);
    const endMinutes = this.parseTimeToMinutes(end_time);

    if (endMinutes <= startMinutes) {
      throw new AppError(i18next.t("scheduler.timeSlot.errors.endAfterStart"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    let existingSlotsQuery = supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", userId);

    if (day_of_week !== null && day_of_week !== undefined) {
      existingSlotsQuery = supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", userId)
        .eq("day_of_week", day_of_week);
    }

    const { data: existingSlots } = await existingSlotsQuery;

    if (existingSlots && existingSlots.length > 0) {
      const conflictingSlot = this.checkOverlap(
        existingSlots,
        startMinutes,
        endMinutes,
      );
      if (conflictingSlot) {
        const error = new AppError(i18next.t("scheduler.timeSlot.errors.conflict"), 409, ErrorCodes.DATABASE_DUPLICATE_ENTRY) as AppError & {
          conflictingSlot?: TimeSlot;
        };
        error.conflictingSlot = conflictingSlot;
        throw error;
      }
    }

    const { data: timeSlot, error } = await supabase
      .from("user_time_slots")
      .insert({
        user_id: userId,
        day_of_week: day_of_week ?? null,
        start_time,
        end_time,
        is_available: is_available ?? true,
        label,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create time slot error:", error);
      throw new AppError(i18next.t("scheduler.timeSlot.errors.createFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return timeSlot as TimeSlot;
  }

  async update(
    supabase: SupabaseClient,
    userId: string,
    slotId: string,
    updates: UpdateTimeSlotData,
  ): Promise<TimeSlot> {
    const { start_time, end_time, is_available, label } = updates;

    const { data: existingSlot, error: fetchError } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("id", slotId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingSlot) {
      throw new AppError(i18next.t("scheduler.timeSlot.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const finalStartTime = start_time ?? existingSlot.start_time;
    const finalEndTime = end_time ?? existingSlot.end_time;

    const startMinutes = this.parseTimeToMinutes(finalStartTime);
    const endMinutes = this.parseTimeToMinutes(finalEndTime);

    if (endMinutes <= startMinutes) {
      throw new AppError(i18next.t("scheduler.timeSlot.errors.endAfterStart"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (start_time || end_time) {
      const { data: otherSlots } = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", userId)
        .neq("id", slotId);

      const slotsToCheck =
        existingSlot.day_of_week !== null
          ? otherSlots?.filter(
              (s: TimeSlot) => s.day_of_week === existingSlot.day_of_week,
            )
          : otherSlots?.filter((s: TimeSlot) => s.day_of_week === null);

      if (slotsToCheck && slotsToCheck.length > 0) {
        const conflictingSlot = this.checkOverlap(
          slotsToCheck,
          startMinutes,
          endMinutes,
        );
        if (conflictingSlot) {
          const error = new AppError(i18next.t("scheduler.timeSlot.errors.conflict"), 409, ErrorCodes.DATABASE_DUPLICATE_ENTRY) as AppError & {
            conflictingSlot?: TimeSlot;
          };
          error.conflictingSlot = conflictingSlot;
          throw error;
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (is_available !== undefined) updateData.is_available = is_available;
    if (label !== undefined) updateData.label = label;

    const { data: timeSlot, error } = await supabase
      .from("user_time_slots")
      .update(updateData)
      .eq("id", slotId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Update time slot error:", error);
      throw new AppError(i18next.t("scheduler.timeSlot.errors.updateFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return timeSlot as TimeSlot;
  }

  async delete(
    supabase: SupabaseClient,
    userId: string,
    slotId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("user_time_slots")
      .delete()
      .eq("id", slotId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Delete time slot error:", error);
      throw new AppError(i18next.t("scheduler.timeSlot.errors.deleteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const timeSlotService = new TimeSlotService();
