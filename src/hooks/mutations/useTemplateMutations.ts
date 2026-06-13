import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys } from "../queries/config";
import type { TemplateCategory } from "@shared/types/graph";
import { createInvalidationMutation } from "./mutationFactory";

export const useCreateTemplateMutation = createInvalidationMutation(
  api.templates.create,
  [["templates"]],
);

export const useUpdateTemplateMutation = createInvalidationMutation(
  ({ id, data }: { id: string; data: Record<string, unknown> }) =>
    api.templates.update(id, data),
  [["templates"], (vars) => queryKeys.template(vars.id)],
);

export const useDeleteTemplateMutation = createInvalidationMutation(
  api.templates.delete,
  [["templates"]],
);

export const usePrefetchTemplates = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (category?: TemplateCategory) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.templates(category),
        queryFn: () => api.templates.list(category),
        staleTime: 1000 * 60 * 30,
      });
    },
    [queryClient],
  );
};
