import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";

export const useCreateTaskMutation = () => {
  return useMutation({
    mutationFn: api.tasks.create,
  });
};

export const useRetryTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.retry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};

export const useDeleteTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
