import { api } from "../../services/api";
import { createInvalidationMutation } from "./mutationFactory";

export const useCreateTaskMutation = createInvalidationMutation(
  api.tasks.create,
  [["tasks"]],
);

export const useRetryTaskMutation = createInvalidationMutation(
  api.tasks.retry,
  [["tasks"]],
);

export const useDeleteTaskMutation = createInvalidationMutation(
  api.tasks.delete,
  [["tasks"]],
);