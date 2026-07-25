import { requestData } from "../../client";

export interface TaskSettings {
  id: string;
  user_id: string;
  q0_time_slice: number;
  q1_time_slice: number;
  q2_time_slice: number;
  break_duration: number;
  sound_enabled: boolean;
  notification_enabled: boolean;
}

export interface UpdateTaskSettingsData {
  q0_time_slice?: number;
  q1_time_slice?: number;
  q2_time_slice?: number;
  break_duration?: number;
  sound_enabled?: boolean;
  notification_enabled?: boolean;
}

export interface UserTimeSlot {
  id: string;
  user_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  label?: string;
  created_at: string;
}

export const settingsApi = {
  getSettings: () => requestData<TaskSettings>("/scheduler/settings"),

  updateSettings: (data: UpdateTaskSettingsData) =>
    requestData<TaskSettings>("/scheduler/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTimeSlots: async (): Promise<UserTimeSlot[]> => {
    const result = await requestData<{
      slots: UserTimeSlot[];
      weekView: Record<number, UserTimeSlot[]>;
      globalSlots: UserTimeSlot[];
    }>("/scheduler/time-slots");
    return result.slots;
  },

  createTimeSlot: (data: {
    day_of_week?: number;
    start_time: string;
    end_time: string;
    is_available?: boolean;
    label?: string;
  }) =>
    requestData<UserTimeSlot>("/scheduler/time-slots", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTimeSlot: (
    id: string,
    data: {
      start_time?: string;
      end_time?: string;
      is_available?: boolean;
      label?: string;
    },
  ) =>
    requestData<UserTimeSlot>(`/scheduler/time-slots/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTimeSlot: (id: string) =>
    requestData<void>(`/scheduler/time-slots/${id}`, { method: "DELETE" }),
};
