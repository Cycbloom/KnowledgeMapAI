import { api } from "../../services/api";
import { queryKeys } from "../queries/config";
import { useOptimisticMutation } from "./useOptimisticMutation";

export const useCreateTaskMutation = () => {
  return useOptimisticMutation({
    mutationFn: api.tasks.create,
    queryKey: ["tasks"],
    invalidateQueries: [queryKeys.tasksPrefix],
  });
};

export const useRetryTaskMutation = () => {
  return useOptimisticMutation({
    mutationFn: (id: string) => api.tasks.retry(id),
    queryKey: ["tasks"],
    invalidateQueries: [queryKeys.tasksPrefix],
  });
};

export const useDeleteTaskMutation = () => {
  return useOptimisticMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    queryKey: ["tasks"],
    invalidateQueries: [queryKeys.tasksPrefix],
  });
};