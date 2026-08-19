import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../services/api";
import { createOptimisticMutation } from "../mutations/mutationFactory";
import { useOptimisticMutation } from "../mutations/useOptimisticMutation";
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

export function useSchedulerTasks(
  filters?: UserTaskFilters,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: queryKeys.schedulerTasks(filters),
    queryFn: () => api.scheduler.list(filters),
    enabled,
    ...realtimeQueryConfig,
    placeholderData: keepPreviousData,
  });
}

export function useSchedulerTask(id: string) {
  return useQuery({
    queryKey: queryKeys.schedulerTask(id),
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
    queryKey: queryKeys.queues(),
    queryFn: () => api.scheduler.getQueues(options) as Promise<QueueData>,
    ...realtimeQueryConfig,
  });
}

export function useExecutions(filters?: ExecutionFilters) {
  return useQuery({
    queryKey: queryKeys.calendarExecutions(filters),
    queryFn: () => api.scheduler.getExecutions(filters),
    ...defaultQueryConfig,
  });
}

export function useSchedulerSettings() {
  return useQuery({
    queryKey: queryKeys.schedulerSettings(),
    queryFn: () => api.scheduler.getSettings() as Promise<TaskSettings>,
    ...defaultQueryConfig,
  });
}

export function useSchedulerStats(
  period: "day" | "week" | "month" | "year" = "week",
) {
  return useQuery({
    queryKey: queryKeys.stats(period),
    queryFn: () => api.scheduler.getStats(period) as Promise<UserTaskStats>,
    ...defaultQueryConfig,
  });
}

export function useHeatmap(year?: number, month?: number) {
  return useQuery({
    queryKey: queryKeys.heatmap(year, month),
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
      api.scheduler.start(id).then(r => r.task),
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
      api.scheduler.pause(id).then(r => r.task),
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
  return useOptimisticMutation<UserTask, { id: string; targetQueue: number }>({
    mutationFn: ({ id, targetQueue }: { id: string; targetQueue: number }) =>
      api.scheduler.move(id, targetQueue) as Promise<UserTask>,
    queryKey: queryKeys.schedulerTasks(),
    queryKeyFilter: (old, { id, targetQueue }) =>
      Array.isArray(old)
        ? old.map((t: UserTask) =>
            t.id === id ? { ...t, queue_level: targetQueue } : t,
          )
        : old,
    onSettled: (_data, _error, variables) => {
      invalidateTaskChange(queryClient, variables.id);
    },
  });
}

export function useReorderUserTasksMutation() {
  const queryClient = useQueryClient();
  return useOptimisticMutation<
    void,
    { queueLevel: number; taskIds: string[] }
  >({
    mutationFn: ({
      queueLevel,
      taskIds,
    }: {
      queueLevel: number;
      taskIds: string[];
    }) => api.scheduler.reorder(queueLevel, taskIds),
    queryKey: queryKeys.queues(),
    queryKeyFilter: (old, { queueLevel, taskIds }) => {
      if (!old || typeof old !== "object") return old;
      const queues = old as QueueData;
      const key = `q${queueLevel}` as keyof QueueData;
      const current = queues[key] ?? [];
      const currentById = new Map(current.map((t) => [t.id, t]));
      const reordered = taskIds
        .map((id) => currentById.get(id))
        .filter((t): t is UserTask => !!t);
      const remaining = current.filter((t) => !taskIds.includes(t.id));
      return {
        ...queues,
        [key]: [...reordered, ...remaining],
      };
    },
    onSettled: () => {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.schedulerSettings() });
    },
  });
}
