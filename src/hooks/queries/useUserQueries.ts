import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, staticQueryConfig } from "./config";

export const useUser = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: api.auth.getUser,
    enabled,
    ...staticQueryConfig,
    retry: false,
  });
};
