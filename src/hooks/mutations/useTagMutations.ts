import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys } from "../queries/config";
import type { TagResourceCounts } from "../../services/api/contracts/ITagsApi";

/**
 * 标签操作 mutation 公共缓存失效。
 *
 * 标签变更会同时影响图谱/笔记/任务三类资源的 tags 字段，
 * 以及标签聚合与 Dashboard 统计，故统一失效：
 * - ["tags"]   标签聚合
 * - ["graphs"] 图谱列表/详情（含 tagFilter 维度）
 * - ["notes"]  笔记列表/详情
 * - ["tasks"]  任务列表
 * - dashboardStats
 */
const invalidateTagAffectedCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
  queryClient.invalidateQueries({ queryKey: queryKeys.notesPrefix });
  queryClient.invalidateQueries({ queryKey: queryKeys.tasksPrefix });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
};

/** 重命名标签（跨图谱/笔记/任务批量替换） */
export const useRenameTagMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<{ updated: TagResourceCounts }, Error, { from: string; to: string }>({
    mutationFn: ({ from, to }) => api.tags.rename(from, to),
    onSettled: () => {
      invalidateTagAffectedCaches(queryClient);
    },
  });
};

/** 合并多个标签到目标标签 */
export const useMergeTagsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<
    { updated: TagResourceCounts },
    Error,
    { sources: string[]; target: string }
  >({
    mutationFn: ({ sources, target }) => api.tags.merge(sources, target),
    onSettled: () => {
      invalidateTagAffectedCaches(queryClient);
    },
  });
};

/** 删除标签（从所有资源中移除该标签） */
export const useDeleteTagMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<{ removed: TagResourceCounts }, Error, string>({
    mutationFn: (name) => api.tags.delete(name),
    onSettled: () => {
      invalidateTagAffectedCaches(queryClient);
    },
  });
};
