import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
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
} from '../services/api/scheduler';

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

const realtimeQueryConfig = {
  staleTime: 0,
  gcTime: GC_TIME,
  retry: 1,
};

export const schedulerKeys = {
  tasks: (filters?: TaskFilters) => ['scheduler', 'tasks', filters] as const,
  task: (id: string) => ['scheduler', 'task', id] as const,
  queues: () => ['scheduler', 'queues'] as const,
  executions: (filters?: ExecutionFilters) => ['scheduler', 'executions', filters] as const,
  settings: () => ['scheduler', 'settings'] as const,
  stats: (period: string) => ['scheduler', 'stats', period] as const,
  heatmap: (year?: number, month?: number) => ['scheduler', 'heatmap', year, month] as const,
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

export function useQueues() {
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

export function useSchedulerStats(period: 'day' | 'week' | 'month' | 'year' = 'week') {
  return useQuery({
    queryKey: schedulerKeys.stats(period),
    queryFn: () => api.scheduler.getStats(period) as Promise<TaskStats>,
    ...defaultQueryConfig,
  });
}

export function useHeatmap(year?: number, month?: number) {
  return useQuery({
    queryKey: schedulerKeys.heatmap(year, month),
    queryFn: () => api.scheduler.getHeatmap(year, month) as Promise<HeatmapData[]>,
    ...defaultQueryConfig,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScheduledTaskData) => api.scheduler.createTask(data) as Promise<ScheduledTask>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScheduledTaskData }) =>
      api.scheduler.updateTask(id, data) as Promise<ScheduledTask>,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useStartTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.startTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function usePauseTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.pauseTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.completeTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'heatmap'] });
    },
  });
}

export function useDemoteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduler.demoteTask(id) as Promise<ScheduledTask>,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useMoveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetQueue }: { id: string; targetQueue: number }) =>
      api.scheduler.moveTask(id, targetQueue) as Promise<ScheduledTask>,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: schedulerKeys.task(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useReorderTasksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueLevel, taskIds }: { queueLevel: number; taskIds: string[] }) =>
      api.scheduler.reorderTasks(queueLevel, taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'queues'] });
    },
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTaskSettingsData) => api.scheduler.updateSettings(data) as Promise<TaskSettings>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulerKeys.settings() });
    },
  });
}
