import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Task } from "../../types";
import { queryKeys, realtimeQueryConfig } from "./config";

export const useTasks = (
  enabled: boolean = true,
  status?: string,
  limit: number = 20,
  offset: number = 0,
) => {
  return useQuery({
    queryKey: queryKeys.tasks(status, limit, offset),
    queryFn: async () =>
      (await api.tasks.list(status, limit, offset)) as {
        tasks: Task[];
        total: number;
      },
    enabled,
    ...realtimeQueryConfig,
  });
};
