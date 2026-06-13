import { api } from "../../services/api";
import { createSimpleMutation, createInvalidationMutation } from "./mutationFactory";

export const useCreateTaskMutation = createSimpleMutation(api.tasks.create);

export const useRetryTaskMutation = createInvalidationMutation(
  api.tasks.retry,
  [["tasks"]],
);

export const useDeleteTaskMutation = createInvalidationMutation(
  api.tasks.delete,
  [["tasks"]],
);