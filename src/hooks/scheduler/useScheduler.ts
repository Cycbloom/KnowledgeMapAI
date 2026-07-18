import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../services/api";
import { createOptimisticMutation } from "../mutations/mutationFactory";
import { queryKeys } from "../queries/config";
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
  staleTime: 30 * 1000,
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

/** Invalidate scheduler queries affected by a task change */
function invalidateTaskChange(queryClient: ReturnType<typeof useQueryClient>, taskId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTasks() });
  queryClient.invalidateQueries({ queryKey: queryKeys.queues() });
  if (taskId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTask(taskId) });
  }
}

/** Invalidate scheduler queries affected by a task completion */
function invalidateTaskCompletion(queryClient: ReturnType<typeof useQueryClient>, taskId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTasks() });
  queryClient.invalidateQueries({ queryKey: queryKeys.queues() });
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.heatmap() });
  if (taskId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTask(taskId) });
  }
}

export function useSchedulerTasks(filters?: UserTaskFilters) {
  return useQuery({
    queryKey: schedulerKeys.tasks(filters),
    queryFn: () => api.scheduler.list(filters),
    ...realtimeQueryConfig,
    placeholderData: keepPreviousData,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserTaskData) =>
      api.scheduler.create(data) as Promise<UserTask>,
    onSuccess: (data) => {
      invalidateTaskChange(queryClient, data.id);
    },
  });
}

export function useUpdateUserTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserTaskData }) =>
      api.scheduler.update(id, data) as Promise<UserTask>,
    onSuccess: (_data, variables) => {
      invalidateTaskChange(queryClient, variables.id);
    },
  });
}

export function useDeleteUserTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.delete(id),
    onSuccess: (_data, id) => {
      invalidateTaskChange(queryClient, id);
    },
  });
}

export function useStartUserTaskMutation() {
  const queryClient = useQueryClient();
  return createOptimisticMutation<UserTask, string, UserTask[]>({
    mutationFn: (id: string) =>
      api.scheduler.start(id) as Promise<UserTask>,
    queryKey: queryKeys.schedulerTasks(),
    optimisticUpdater: (old: UserTask[] | undefined, id: string) => {
      if (!old) return old;
      return old.map((t) => (t.id === id ? { ...t, status: "in_progress" } : t));
    },
    onSettled: (_data, _error, id) => {
      invalidateTaskChange(queryClient, id);
    },
  })();
}

export function usePauseUserTaskMutation() {
  const queryClient = useQueryClient();
  return createOptimisticMutation<UserTask, string, UserTask[]>({
    mutationFn: (id: string) =>
      api.scheduler.pause(id) as Promise<UserTask>,
    queryKey: queryKeys.schedulerTasks(),
    optimisticUpdater: (old: UserTask[] | undefined, id: string) => {
      if (!old) return old;
      return old.map((t) => (t.id === id ? { ...t, status: "paused" } : t));
    },
    onSettled: (_data, _error, id) => {
      invalidateTaskChange(queryClient, id);
    },
  })();
}

export function useCompleteUserTaskMutation() {
  const queryClient = useQueryClient();
  return createOptimisticMutation<UserTask, string, UserTask[]>({
    mutationFn: (id: string) =>
      api.scheduler.complete(id) as Promise<UserTask>,
    queryKey: queryKeys.schedulerTasks(),
    optimisticUpdater: (old: UserTask[] | undefined, id: string) => {
      if (!old) return old;
      return old.map((t) => (t.id === id ? { ...t, status: "completed" } : t));
    },
    onSettled: (_data, _error, id) => {
      invalidateTaskCompletion(queryClient, id);
    },
  })();
}

export function useDemoteUserTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.scheduler.demote(id) as Promise<UserTask>,
    onSuccess: (_data, id) => {
      invalidateTaskChange(queryClient, id);
    },
  });
}

export function useMoveUserTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetQueue }: { id: string; targetQueue: number }) =>
      api.scheduler.move(id, targetQueue) as Promise<UserTask>,
    onSuccess: (_data, variables) => {
      invalidateTaskChange(queryClient, variables.id);
    },
  });
}

export function useReorderUserTasksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      queueLevel,
      taskIds,
    }: {
      queueLevel: number;
      taskIds: string[];
    }) => api.scheduler.reorder(queueLevel, taskIds),
    onSuccess: () => {
      invalidateTaskChange(queryClient);
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
