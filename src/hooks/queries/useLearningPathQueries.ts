import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { LearningPathStatus, type NodeStatus } from "../../services/api/learningPaths";

export const learningPathKeys = {
  all: ["learningPaths"] as const,
  lists: () => [...learningPathKeys.all, "list"] as const,
  list: (status?: LearningPathStatus) =>
    [...learningPathKeys.lists(), status] as const,
  details: () => [...learningPathKeys.all, "detail"] as const,
  detail: (id: string) => [...learningPathKeys.details(), id] as const,
  progress: (id: string) => [...learningPathKeys.all, "progress", id] as const,
  plans: (id: string) => [...learningPathKeys.all, "plans", id] as const,
};

export const useLearningPaths = (status?: LearningPathStatus) => {
  return useQuery({
    queryKey: learningPathKeys.list(status),
    queryFn: async () => {
      const result = await api.learningPaths.list(status);
      return Array.isArray(result) ? result : [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useLearningPath = (id: string) => {
  return useQuery({
    queryKey: learningPathKeys.detail(id),
    queryFn: async () => {
      const result = await api.learningPaths.get(id);
      return result as {
        nodes?: Array<{
          id: string;
          knowledge_point_id?: string;
          title: string;
          description?: string;
          status?: NodeStatus;
          estimated_time?: number;
          estimated_minutes?: number;
          difficulty_level?: number;
          order_index?: number;
          is_milestone?: boolean;
        }>;
        progress?: {
          completed_nodes: number;
          total_nodes: number;
          progress_percentage: number;
        };
        title?: string;
        target_completion_date?: string;
        [key: string]: unknown;
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useLearningPathProgress = (pathId: string) => {
  return useQuery({
    queryKey: learningPathKeys.progress(pathId),
    queryFn: () => api.learningPaths.getProgress(pathId),
    enabled: !!pathId,
    staleTime: 1000 * 60,
  });
};

export const useLearningPathPlans = (
  pathId: string,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: [...learningPathKeys.plans(pathId), startDate, endDate],
    queryFn: () => api.learningPaths.getPlans(pathId, startDate, endDate),
    enabled: !!pathId,
    staleTime: 1000 * 60 * 5,
  });
};
