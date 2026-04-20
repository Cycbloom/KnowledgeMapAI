import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type {
  ScheduledTask,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
  TaskSettings,
  UpdateTaskSettingsData,
  TaskStats,
  HeatmapData,
  TaskFilters,
  ExecutionFilters,
  QueueData,
} from "@shared/types";

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

const realtimeQueryConfig = {
  staleTime: 0,
  gcTime: GC_TIME,
  retry: 1,
};

export const schedulerKeys = {
  tasks: (filters?: TaskFilters) => ["scheduler", "tasks", filters] as const,
  task: (id: string) => ["scheduler", "task", id] as const,
  queues: () => ["scheduler", "queues"] as const,
  executions: (filters?: ExecutionFilters) =>
    ["scheduler", "executions", filters] as const,
  settings: () => ["scheduler", "settings"] as const,
  stats: (period: string) => ["scheduler", "stats", period] as const,
  heatmap: (year?: number, month?: number) =>
    ["scheduler", "heatmap", year, month] as const,
};

export function useSchedulerTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: schedulerKeys.tasks(filters),
    queryFn: () => api.scheduler.getTasks(filters),
    ...realtimeQueryConfig,
  });
}

export function useSchedulerTask(id: string) {
  return useQuery({
    queryKey: schedulerKeys.task(id),
    queryFn: () => api.scheduler.getTask(id),
    enabled: !!id,
    ...defaultQueryConfig,
  });
}

export function useSchedulerQueues() {
  return useQuery({
    queryKey: schedulerKeys.queues(),
    queryFn: () => api.scheduler.getQueues() as Promise<QueueData>,
    ...realtimeQueryConfig,
  });
}

export function useExecutions(filters?: ExecutionFilters) {
  return useQuery({
    queryKey: schedulerKeys.executions(filters),
    queryFn: () => api.scheduler.getExecutions(filters),
    ...defaultQueryConfig,
  });
}

export function useSchedulerSettings() {
  return useQuery({
    queryKey: schedulerKeys.settings(),
    queryFn: () => api.scheduler.getSettings() as Promise<TaskSettings>,
    ...defaultQueryConfig,
  });
}

export function useSchedulerStats(
  period: "day" | "week" | "month" | "year" = "week",
) {
  return useQuery({
    queryKey: schedulerKeys.stats(period),
    queryFn: () => api.scheduler.getStats(period) as Promise<TaskStats>,
    ...defaultQueryConfig,
  });
}

export function useHeatmap(year?: number, month?: number) {
  return useQuery({
    queryKey: schedulerKeys.heatmap(year, month),
    queryFn: () =>
      api.scheduler.getHeatmap(year, month) as Promise<HeatmapData[]>,
    ...defaultQueryConfig,
  });
}

export function useCreateScheduledTaskMutation() {
  return useMutation({
    mutationFn: (data: CreateScheduledTaskData) =>
      api.scheduler.createTask(data) as Promise<ScheduledTask>,
    onSuccess: (data) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: data.id, action: "created" });
    },
  });
}

export function useUpdateScheduledTaskMutation() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScheduledTaskData }) =>
      api.scheduler.updateTask(id, data) as Promise<ScheduledTask>,
    onSuccess: (_data, variables) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: variables.id, action: "updated" });
    },
  });
}

export function useDeleteScheduledTaskMutation() {
  return useMutation({
    mutationFn: (id: string) => api.scheduler.deleteTask(id),
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: id, action: "deleted" });
    },
  });
}

export function useStartScheduledTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.startTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: id, action: "updated" });
    },
  });
}

export function usePauseScheduledTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.pauseTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: id, action: "updated" });
    },
  });
}

export function useCompleteScheduledTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.completeTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_completed", { taskId: id });
    },
  });
}

export function useDemoteScheduledTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.demoteTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: id, action: "updated" });
    },
  });
}

export function useMoveScheduledTaskMutation() {
  return useMutation({
    mutationFn: ({ id, targetQueue }: { id: string; targetQueue: number }) =>
      api.scheduler.moveTask(id, targetQueue) as Promise<ScheduledTask>,
    onSuccess: (_data, variables) => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: variables.id, action: "updated" });
    },
  });
}

export function useReorderScheduledTasksMutation() {
  return useMutation({
    mutationFn: ({
      queueLevel,
      taskIds,
    }: {
      queueLevel: number;
      taskIds: string[];
    }) => api.scheduler.reorderTasks(queueLevel, taskIds),
    onSuccess: () => {
      frontendEventBus.publish("scheduler_task_changed", { taskId: "", action: "updated" });
    },
  });
}

export function useUpdateSchedulerSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTaskSettingsData) =>
      api.scheduler.updateSettings(data) as Promise<TaskSettings>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.settings() });
    },
  });
}
