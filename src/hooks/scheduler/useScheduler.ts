import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type {
  UserTask,
  CreateUserTaskData,
  UpdateUserTaskData,
  TaskSettings,
  UpdateTaskSettingsData,
  UserTaskStats,
  HeatmapData,
  UserTaskFilters,
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
  tasks: (filters?: UserTaskFilters) => ["scheduler", "tasks", filters] as const,
  task: (id: string) => ["scheduler", "task", id] as const,
  queues: () => ["scheduler", "queues"] as const,
  executions: (filters?: ExecutionFilters) =>
    ["scheduler", "executions", filters] as const,
  settings: () => ["scheduler", "settings"] as const,
  stats: (period: string) => ["scheduler", "stats", period] as const,
  heatmap: (year?: number, month?: number) =>
    ["scheduler", "heatmap", year, month] as const,
};

export function useSchedulerTasks(filters?: UserTaskFilters) {
  return useQuery({
    queryKey: schedulerKeys.tasks(filters),
    queryFn: () => api.scheduler.list(filters),
    ...realtimeQueryConfig,
  });
}

export function useSchedulerTask(id: string) {
  return useQuery({
    queryKey: schedulerKeys.task(id),
    queryFn: () => api.scheduler.get(id),
    enabled: !!id,
    ...defaultQueryConfig,
  });
}

export function useSchedulerQueues(options?: {
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}) {
  return useQuery({
    queryKey: schedulerKeys.queues(),
    queryFn: () => api.scheduler.getQueues(options) as Promise<QueueData>,
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
    queryFn: () => api.scheduler.getStats(period) as Promise<UserTaskStats>,
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

export function useCreateUserTaskMutation() {
  return useMutation({
    mutationFn: (data: CreateUserTaskData) =>
      api.scheduler.create(data) as Promise<UserTask>,
    onSuccess: (data) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: data.id,
        action: "created",
      });
    },
  });
}

export function useUpdateUserTaskMutation() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserTaskData }) =>
      api.scheduler.update(id, data) as Promise<UserTask>,
    onSuccess: (_data, variables) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: variables.id,
        action: "updated",
      });
    },
  });
}

export function useDeleteUserTaskMutation() {
  return useMutation({
    mutationFn: (id: string) => api.scheduler.delete(id),
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: id,
        action: "deleted",
      });
    },
  });
}

export function useStartUserTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.start(id) as Promise<UserTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: id,
        action: "updated",
      });
    },
  });
}

export function usePauseUserTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.pause(id) as Promise<UserTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: id,
        action: "updated",
      });
    },
  });
}

export function useCompleteUserTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.complete(id) as Promise<UserTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_completed", { taskId: id });
    },
  });
}

export function useDemoteUserTaskMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.demote(id) as Promise<UserTask>,
    onSuccess: (_data, id) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: id,
        action: "updated",
      });
    },
  });
}

export function useMoveUserTaskMutation() {
  return useMutation({
    mutationFn: ({ id, targetQueue }: { id: string; targetQueue: number }) =>
      api.scheduler.move(id, targetQueue) as Promise<UserTask>,
    onSuccess: (_data, variables) => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: variables.id,
        action: "updated",
      });
    },
  });
}

export function useReorderUserTasksMutation() {
  return useMutation({
    mutationFn: ({
      queueLevel,
      taskIds,
    }: {
      queueLevel: number;
      taskIds: string[];
    }) => api.scheduler.reorder(queueLevel, taskIds),
    onSuccess: () => {
      frontendEventBus.publish("scheduler_task_changed", {
        taskId: "",
        action: "updated",
      });
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
