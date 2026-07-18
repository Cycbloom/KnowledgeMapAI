import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Task } from "../../types";
import { queryKeys, realtimeQueryConfig } from "./config";

/**
 * 单页任务列表数据。
 *
 * queryFn 在原始 API 返回的 { tasks, total } 基础上附带本次请求的
 * offset / limit，供 getNextPageParam 计算下一页 offset。
 */
interface TasksPage {
  tasks: Task[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * 任务列表查询（无限滚动）。
 *
 * 后端 GET /tasks 接口使用 offset/limit 分页（不支持 page/pageSize），
 * 返回 { tasks, total }。本 hook 以 offset 作为 pageParam：
 * - initialPageParam = 调用方传入的 offset（默认 0）
 * - getNextPageParam: 当 offset + limit < total 时返回下一页 offset
 *
 * 调用方读取展平后的任务列表：
 *   data?.pages.flatMap((p) => p.tasks) ?? []
 * 以及总数（各页 total 一致）：
 *   data?.pages[0]?.total ?? 0
 */
export const useTasks = (
  enabled: boolean = true,
  status?: string,
  limit: number = 20,
  offset: number = 0,
) => {
  return useInfiniteQuery<TasksPage>({
    queryKey: queryKeys.tasks(status, limit, offset),
    queryFn: async ({ pageParam }) => {
      // pageParam 类型默认为 unknown（TPageParam 未显式绑定），
      // 此处用类型守卫收敛为 number，避免 unknown ?? number 推断为 {}。
      const currentOffset = typeof pageParam === "number" ? pageParam : offset;
      const result = (await api.tasks.list(status, limit, currentOffset)) as {
        tasks: Task[];
        total: number;
      };
      return {
        tasks: result.tasks,
        total: result.total,
        offset: currentOffset,
        limit,
      };
    },
    initialPageParam: offset,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled,
    ...realtimeQueryConfig,
  });
};
