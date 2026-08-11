import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useOptimisticMutation } from "./useOptimisticMutation";
import { createInvalidationMutation } from "./mutationFactory";
import { queryKeys } from "../queries/config";
import type { StudyCard } from "@shared/types/common";

/**
 * 复习卡片查询前缀匹配键。所有 `["studyCards", ...]` 查询共用此前缀，
 * 用于乐观更新时批量更新所有已加载的卡片缓存。
 */
const studyCardsPrefix = queryKeys.studyCardsPrefix;
const studyCardsInfinitePrefix = queryKeys.studyCardsInfinitePrefix;

/**
 * 复习评分。带乐观更新：
 * - onMutate：立即标记卡片为已复习（更新 last_reviewed）
 * - onSuccess：用服务端返回的 StudyCard 精确覆盖缓存，避免全量 refetch 闪烁
 * - onError：回滚至 mutation 前的缓存状态
 * - onSettled：失效复习卡片与图谱节点状态缓存
 */
export const useUpdateCardProgressMutation = () => {
  const queryClient = useQueryClient();
  return useOptimisticMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      api.study.updateProgress(id, quality),
    queryKey: studyCardsPrefix,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: studyCardsPrefix });
      const previousEntries = queryClient.getQueriesData<StudyCard[]>({
        queryKey: studyCardsPrefix,
      });

      queryClient.setQueriesData<StudyCard[]>(
        { queryKey: studyCardsPrefix },
        (old) =>
          old?.map((card) =>
            card.id === id
              ? { ...card, last_reviewed: new Date().toISOString() }
              : card,
          ),
      );

      return { previousEntries };
    },
    onSuccess: (updatedCard, { id }) => {
      queryClient.setQueriesData<StudyCard[]>(
        { queryKey: studyCardsPrefix },
        (old) =>
          old?.map((card) => (card.id === id ? updatedCard : card)),
      );
    },
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studyCardsPrefix });
      queryClient.invalidateQueries({ queryKey: studyCardsInfinitePrefix });
      queryClient.invalidateQueries({ queryKey: ["graphNodeStatus"] });
    },
  });
};

/**
 * 更新卡片(题目/答案/难度等)。带乐观更新：
 * - onMutate：立即用新字段更新缓存中的对应卡片
 * - onError：回滚至 mutation 前的缓存状态
 * - onSettled：失效复习卡片缓存
 */
export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();
  return useOptimisticMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StudyCard> }) =>
      api.study.update(id, data),
    queryKey: studyCardsPrefix,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: studyCardsPrefix });
      const previousEntries = queryClient.getQueriesData<StudyCard[]>({
        queryKey: studyCardsPrefix,
      });

      queryClient.setQueriesData<StudyCard[]>(
        { queryKey: studyCardsPrefix },
        (old) =>
          old?.map((card) =>
            card.id === id ? { ...card, ...data } as StudyCard : card,
          ),
      );

      return { previousEntries };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studyCardsPrefix });
      queryClient.invalidateQueries({ queryKey: studyCardsInfinitePrefix });
    },
  });
};

/**
 * 删除复习卡片。带乐观更新：
 * - onMutate：立即从缓存中移除该卡片
 * - onError：回滚至 mutation 前的缓存状态
 * - onSettled：失效复习卡片缓存
 */
export const useDeleteCardMutation = () => {
  const queryClient = useQueryClient();
  return useOptimisticMutation({
    mutationFn: (id: string) => api.study.delete(id),
    queryKey: studyCardsPrefix,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: studyCardsPrefix });
      const previousEntries = queryClient.getQueriesData<StudyCard[]>({
        queryKey: studyCardsPrefix,
      });

      queryClient.setQueriesData<StudyCard[]>(
        { queryKey: studyCardsPrefix },
        (old) => old?.filter((card) => card.id !== id),
      );

      return { previousEntries };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studyCardsPrefix });
      queryClient.invalidateQueries({ queryKey: studyCardsInfinitePrefix });
    },
  });
};

/**
 * 批量删除复习卡片。带乐观更新：
 * - onMutate：立即从缓存中移除所有选中的卡片
 * - onError：回滚至 mutation 前的缓存状态
 * - onSettled：失效复习卡片缓存
 */
export const useDeleteCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useOptimisticMutation({
    mutationFn: (ids: string[]) => api.study.deleteBatch(ids),
    queryKey: studyCardsPrefix,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: studyCardsPrefix });
      const previousEntries = queryClient.getQueriesData<StudyCard[]>({
        queryKey: studyCardsPrefix,
      });
      const idSet = new Set(ids);

      queryClient.setQueriesData<StudyCard[]>(
        { queryKey: studyCardsPrefix },
        (old) => old?.filter((card) => !idSet.has(card.id)),
      );

      return { previousEntries };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studyCardsPrefix });
      queryClient.invalidateQueries({ queryKey: studyCardsInfinitePrefix });
    },
  });
};

export const useCreateCardsBatchMutation = createInvalidationMutation(
  api.study.createCardsBatch,
  [["studyCards"], ["studyCardsInfinite"]],
);