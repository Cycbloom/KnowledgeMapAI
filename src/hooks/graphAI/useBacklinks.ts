import { useQuery } from "@tanstack/react-query";
import { backlinksApi } from "../../services/api/backlinks";
import { queryKeys } from "../queries/config";
import type { BacklinkItem } from "@shared/types";

export interface UseBacklinksResult {
  backlinks: BacklinkItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * 获取某知识点的反向链接列表
 * @param knowledgePointId 知识点 ID（为空时不查询）
 */
export const useBacklinks = (
  knowledgePointId: string | undefined | null,
): UseBacklinksResult => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.backlinks(knowledgePointId ?? ""),
    queryFn: () => backlinksApi.list(knowledgePointId as string),
    enabled: !!knowledgePointId,
    staleTime: 30_000, // 30 秒内不重新请求
  });

  return {
    backlinks: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
    refresh: () => refetch(),
  };
};