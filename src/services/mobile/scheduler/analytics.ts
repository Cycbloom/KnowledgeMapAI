import type {
  UserTimeSlot,
  TaskSchedule,
  TaskProgressPlan,
  ProgressMode,
} from "@shared/types";

export const getTaskAnalytics = async () => {
  return {
    total_tasks: 0,
    completed_tasks: 0,
    total_duration: 0,
    avg_duration: 0,
    completion_rate: 0,
    tasks_by_queue: { q0: 0, q1: 0, q2: 0 },
    tasks_by_status: {},
  };
};

export const generateInsights = async () => {
  return { insights: [] };
};

export const getTimeSlots = async (): Promise<UserTimeSlot[]> => {
  return [];
};

export const createTimeSlot = async (_data: { day_of_week?: number; start_time: string; end_time: string; is_available?: boolean; label?: string }): Promise<UserTimeSlot> => {
  return {} as UserTimeSlot;
};

export const updateTimeSlot = async (_id: string, _data: Partial<Omit<UserTimeSlot, "id" | "user_id" | "created_at">>): Promise<UserTimeSlot> => {
  return {} as UserTimeSlot;
};

export const deleteTimeSlot = async (_id: string): Promise<void> => {
  return;
};

export const getSchedules = async (): Promise<TaskSchedule[]> => {
  return [];
};

export const createSchedule = async (_data: { task_template_id: string; schedule_type: "daily" | "weekly" | "custom" | "smart"; schedule_config?: Record<string, unknown>; is_active?: boolean }): Promise<TaskSchedule> => {
  return {} as TaskSchedule;
};

export const updateSchedule = async (_id: string, _data: Partial<Omit<TaskSchedule, "id" | "user_id" | "created_at" | "updated_at">>): Promise<TaskSchedule> => {
  return {} as TaskSchedule;
};

export const deleteSchedule = async (_id: string): Promise<void> => {
  return;
};

export const createProgressPlan = async (_taskId: string, _data: { start_date: string; end_date: string; progress_mode: ProgressMode; custom_allocations?: Array<{ date: string; percentage: number }> }): Promise<TaskProgressPlan> => {
  return {} as TaskProgressPlan;
};

export const updateProgressPlan = async (_taskId: string, _data: Partial<Omit<TaskProgressPlan, "id" | "task_id" | "created_at">>): Promise<TaskProgressPlan> => {
  return {} as TaskProgressPlan;
};

export const getProgressPlan = async (_taskId: string): Promise<TaskProgressPlan[]> => {
  return [];
};

export const updateProgress = async (_taskId: string, _data: { actual_percentage: number; notes?: string }): Promise<TaskProgressPlan> => {
  return {} as TaskProgressPlan;
};

export const getYearlyHeatmap = async (_year?: number): Promise<Array<{ date: string; count: number; duration: number }>> => {
  return [];
};
