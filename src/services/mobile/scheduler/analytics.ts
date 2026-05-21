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

export const getTimeSlots = async () => {
  return [];
};

export const createTimeSlot = async (_data: any) => {
  return {};
};

export const updateTimeSlot = async (_id: string, _data: any) => {
  return {};
};

export const deleteTimeSlot = async (_id: string) => {
  return;
};

export const getSchedules = async () => {
  return [];
};

export const createSchedule = async (_data: any) => {
  return {};
};

export const updateSchedule = async (_id: string, _data: any) => {
  return {};
};

export const deleteSchedule = async (_id: string) => {
  return;
};

export const createProgressPlan = async (_taskId: string, _data: any) => {
  return {};
};

export const updateProgressPlan = async (_taskId: string, _data: any) => {
  return {};
};

export const getProgressPlan = async (_taskId: string) => {
  return [];
};

export const updateProgress = async (_taskId: string, _data: any) => {
  return {};
};

export const getYearlyHeatmap = async (_year?: number) => {
  return [];
};
