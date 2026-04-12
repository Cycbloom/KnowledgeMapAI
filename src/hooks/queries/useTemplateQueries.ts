import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys } from "./config";
import type { TemplateCategory, Template } from "@shared/types/graph";

export const useTemplates = (category?: TemplateCategory) => {
  return useQuery<Template[]>({
    queryKey: queryKeys.templates(category),
    queryFn: async () => {
      const result = await api.templates.list(category);
      if (result && typeof result === "object" && "templates" in result) {
        return result.templates as Template[];
      }
      return Array.isArray(result) ? result : [];
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useTemplate = (id: string) => {
  return useQuery<Template>({
    queryKey: queryKeys.template(id),
    queryFn: () => api.templates.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
};
