import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys } from "./config";

export const useTemplates = (category?: string) => {
  return useQuery({
    queryKey: queryKeys.templates(category),
    queryFn: async () => {
      const result = await api.templates.list(category);
      if (result && typeof result === "object" && "templates" in result) {
        return result.templates;
      }
      return Array.isArray(result) ? result : [];
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: queryKeys.template(id),
    queryFn: () => api.templates.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
};
