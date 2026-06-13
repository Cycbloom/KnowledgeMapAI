import { api } from "../../services/api";
import { createInvalidationMutation } from "./mutationFactory";

export const useUpdateCardProgressMutation = createInvalidationMutation(
  ({ id, quality }: { id: string; quality: number }) =>
    api.study.updateProgress(id, quality),
  [["studyCards"], ["graphNodeStatus"]],
);

export const useUpdateCardMutation = createInvalidationMutation(
  ({ id, data }: { id: string; data: Record<string, unknown> }) =>
    api.study.update(id, data),
  [["studyCards"]],
);

export const useDeleteCardMutation = createInvalidationMutation(
  (id: string) => api.study.delete(id),
  [["studyCards"]],
);

export const useDeleteCardsBatchMutation = createInvalidationMutation(
  (ids: string[]) => api.study.deleteBatch(ids),
  [["studyCards"]],
);

export const useCreateCardsBatchMutation = createInvalidationMutation(
  api.study.createCardsBatch,
  [["studyCards"]],
);