import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, defaultQueryConfig } from "./config";
import type { TagSummary } from "../../services/api/contracts/ITagsApi";

/**
 * 全局标签聚合查询（跨图谱/笔记/任务）。
 *
 * queryKey 为 ["tags"]，标签 rename/merge/delete mutation
 * 及图谱 tags 更新后都会失效该键。
 */
export const useTags = () => {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: async () => {
      const res = await api.tags.list();
      return res.tags;
    },
    ...defaultQueryConfig,
  });
};

/** 便于调用方直接使用聚合类型 */
export type { TagSummary };
