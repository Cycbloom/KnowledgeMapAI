import { useEffect, useRef } from "react";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { api } from "../../services/api";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface UseTaskSettledInvalidatorOptions {
  /**
   * 后台任务 ID 集合，任一变化都会重建订阅（沿用旧任务的终态对账）。
   * 每次提交新任务时用新数组调用即可。
   */
  taskIds: string[];
  /** 全部任务进入终态（completed/failed/cancelled）后触发一次，用于刷新前端缓存。 */
  onAllSettled: () => void;
}

/**
 * 订阅后台任务执行结果：给定一组 taskId，等其全部进入终态后回调一次。
 *
 * 背景：`asyncTaskService.updateTaskStatus` 广播的 `task_update` SSE 不携带
 * cacheKeys，前端 React Query 不会自动失效图谱数据。此 hook 通过
 * `frontendEventBus`(useTaskEvents 建立的 SSE 连接) 监听终态，并在订阅前用
 * `getTaskStatus` 做一次初始对账，规避「任务在订阅前已完成」的竞态，确保后台
 * 拓展这类落库任务完成后前端即时刷新，无需手动重取。
 */
export function useTaskSettledInvalidator({
  taskIds,
  onAllSettled,
}: UseTaskSettledInvalidatorOptions) {
  const onAllSettledRef = useRef(onAllSettled);
  useEffect(() => {
    onAllSettledRef.current = onAllSettled;
  }, [onAllSettled]);

  useEffect(() => {
    if (!taskIds || taskIds.length === 0) return;

    const pendingSet = new Set<string>(taskIds);
    let settled = false;
    let isAlive = true;

    const settleIfDone = () => {
      if (!settled && pendingSet.size === 0) {
        settled = true;
        onAllSettledRef.current();
      }
    };

    const handleSse = (raw: unknown) => {
      const msg = raw as { type?: string; taskId?: string; status?: string };
      if (!msg || msg.type !== "task_update" || !msg.taskId) return;
      if (!TERMINAL_STATUSES.has(msg.status ?? "")) return;
      if (pendingSet.delete(msg.taskId)) {
        settleIfDone();
      }
    };

    // 初始对账：避免订阅前任务已完成/失败（竞态），逐个查询终态补删
    for (const id of taskIds) {
      void api.ai
        .getTaskStatus(id)
        .catch(() => null)
        .then((t) => {
          if (!isAlive) return;
          const seed = t as { status?: string } | null;
          if (seed?.status && TERMINAL_STATUSES.has(seed.status)) {
            if (pendingSet.delete(id)) {
              settleIfDone();
            }
          }
        });
    }

    const unsubscribe = frontendEventBus.subscribe("sse_message", handleSse);
    return () => {
      isAlive = false;
      unsubscribe();
    };
  }, [taskIds]);
}