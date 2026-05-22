import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import {
  learningPathKeys,
} from "../queries/useLearningPathQueries";
import {
  CreateLearningPathInput,
  UpdateLearningPathInput,
  NodeStatus,
  AddNodeInput,
  UpdateProgressInput,
  CreatePlanInput,
  UpdatePlanInput,
} from "../../services/api/learningPaths";

export const useCreateLearningPathMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLearningPathInput) =>
      api.learningPaths.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningPathKeys.lists() });
    },
  });
};

export const useUpdateLearningPathMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLearningPathInput }) =>
      api.learningPaths.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: learningPathKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.detail(variables.id),
      });
    },
  });
};

export const useDeleteLearningPathMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.learningPaths.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningPathKeys.lists() });
    },
  });
};

export const useAddNodeToPathMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pathId, data }: { pathId: string; data: AddNodeInput }) =>
      api.learningPaths.addNode(pathId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.detail(variables.pathId),
      });
    },
  });
};

export const useUpdateNodeStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      nodeId,
      status,
    }: {
      pathId: string;
      nodeId: string;
      status: NodeStatus;
    }) => api.learningPaths.updateNodeStatus(pathId, nodeId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.detail(variables.pathId),
      });
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.progress(variables.pathId),
      });
    },
  });
};

export const useRemoveNodeFromPathMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      nodeId,
    }: {
      pathId: string;
      nodeId: string;
    }) => api.learningPaths.removeNode(pathId, nodeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.detail(variables.pathId),
      });
    },
  });
};

export const useUpdateProgressMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      data,
    }: {
      pathId: string;
      data: UpdateProgressInput;
    }) => api.learningPaths.updateProgress(pathId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.progress(variables.pathId),
      });
    },
  });
};

export const useCreatePlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      data,
    }: {
      pathId: string;
      data: CreatePlanInput;
    }) => api.learningPaths.createPlan(pathId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.plans(variables.pathId),
      });
    },
  });
};

export const useUpdatePlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      date,
      data,
    }: {
      pathId: string;
      date: string;
      data: UpdatePlanInput;
    }) => api.learningPaths.updatePlan(pathId, date, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.plans(variables.pathId),
      });
    },
  });
};

export const usePrefetchLearningPaths = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (status?: string) => {
      queryClient.prefetchQuery({
        queryKey: learningPathKeys.list(status as 'active' | 'completed' | 'archived' | undefined),
        queryFn: () => api.learningPaths.list(status as 'active' | 'completed' | 'archived' | undefined),
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient]
  );
};
