import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { learningPathKeys } from "../queries/useLearningPathQueries";
import {
  CreateLearningPathInput,
  UpdateLearningPathInput,
  NodeStatus,
  AddNodeInput,
  UpdateProgressInput,
  CreatePlanInput,
  UpdatePlanInput,
} from "../../services/api/learningPaths";
import { createInvalidationMutation } from "./mutationFactory";

export const useCreateLearningPathMutation = createInvalidationMutation(
  (data: CreateLearningPathInput) => api.learningPaths.create(data),
  [learningPathKeys.lists()],
);

export const useUpdateLearningPathMutation = createInvalidationMutation(
  ({ id, data }: { id: string; data: UpdateLearningPathInput }) =>
    api.learningPaths.update(id, data),
  [learningPathKeys.lists(), (vars) => learningPathKeys.detail(vars.id)],
);

export const useDeleteLearningPathMutation = createInvalidationMutation(
  (id: string) => api.learningPaths.delete(id),
  [learningPathKeys.lists()],
);

export const useAddNodeToPathMutation = createInvalidationMutation(
  ({ pathId, data }: { pathId: string; data: AddNodeInput }) =>
    api.learningPaths.addNode(pathId, data),
  [(vars) => learningPathKeys.detail(vars.pathId)],
);

export const useUpdateNodeStatusMutation = createInvalidationMutation(
  ({
    pathId,
    nodeId,
    status,
  }: {
    pathId: string;
    nodeId: string;
    status: NodeStatus;
  }) => api.learningPaths.updateNodeStatus(pathId, nodeId, status),
  [
    (vars) => learningPathKeys.detail(vars.pathId),
    (vars) => learningPathKeys.progress(vars.pathId),
  ],
);

export const useRemoveNodeFromPathMutation = createInvalidationMutation(
  ({ pathId, nodeId }: { pathId: string; nodeId: string }) =>
    api.learningPaths.removeNode(pathId, nodeId),
  [(vars) => learningPathKeys.detail(vars.pathId)],
);

export const useUpdateProgressMutation = createInvalidationMutation(
  ({ pathId, data }: { pathId: string; data: UpdateProgressInput }) =>
    api.learningPaths.updateProgress(pathId, data),
  [(vars) => learningPathKeys.progress(vars.pathId)],
);

export const useCreatePlanMutation = createInvalidationMutation(
  ({ pathId, data }: { pathId: string; data: CreatePlanInput }) =>
    api.learningPaths.createPlan(pathId, data),
  [(vars) => learningPathKeys.plans(vars.pathId)],
);

export const useUpdatePlanMutation = createInvalidationMutation(
  ({ pathId, date, data }: { pathId: string; date: string; data: UpdatePlanInput }) =>
    api.learningPaths.updatePlan(pathId, date, data),
  [(vars) => learningPathKeys.plans(vars.pathId)],
);

export const usePrefetchLearningPaths = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (status?: string) => {
      queryClient.prefetchQuery({
        queryKey: learningPathKeys.list(
          status as "active" | "completed" | "archived" | undefined,
        ),
        queryFn: () =>
          api.learningPaths.list(
            status as "active" | "completed" | "archived" | undefined,
          ),
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient],
  );
};