import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { StudyCard } from "../../types";

export const useUpdateCardProgressMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      api.study.updateProgress(id, quality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyCards"] });
      queryClient.invalidateQueries({ queryKey: ["graphNodeStatus"] });
    },
  });
};

export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StudyCard> }) =>
      api.study.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyCards"] });
    },
  });
};

export const useDeleteCardMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.study.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyCards"] });
    },
  });
};

export const useDeleteCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.study.deleteBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyCards"] });
    },
  });
};

export const useCreateCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.study.createCardsBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyCards"] });
    },
  });
};
