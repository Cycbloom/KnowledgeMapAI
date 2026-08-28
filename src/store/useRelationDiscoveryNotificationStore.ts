import { create } from 'zustand';
import { api } from '../services/api';
import { frontendEventBus } from '../services/timer/FrontendEventBus';
import type { SSEMessagePayload } from '../services/FrontendEventTypes';

const WATCHDOG_MS = 10 * 60 * 1000;

export interface RelationDiscoveryNotice {
  status: 'generating' | 'success' | 'error';
  graphId: string;
  taskId: string;
  suggestionCount?: number;
}

interface RelationDiscoveryNotificationStore {
  notice: RelationDiscoveryNotice | null;
  setNotice: (notice: RelationDiscoveryNotice | null) => void;
  clearNotice: () => void;
  /** 对指定关系发现任务进行全局跟踪，完成后弹出右下角通知（跨路由存活） */
  startTracking: (taskId: string, graphId: string) => void;
}

let currentUnsubscribe: (() => void) | null = null;
let currentWatchdog = 0;

const clearTracking = () => {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }
  if (currentWatchdog) {
    window.clearTimeout(currentWatchdog);
    currentWatchdog = 0;
  }
};

/**
 * 关系发现任务完成的全局通知 store。
 *
 * 状态提升到全局（而非面板组件内）的目的：发现是后台任务，用户可能关掉面板或
 * 切换页面，完成通知需在跨路由后仍可见。跟踪基于 SSE task_update + 初始对账
 * + 看门狗兜底（与 useLevelTestNotificationStore 同模式）。
 */
export const useRelationDiscoveryNotificationStore =
  create<RelationDiscoveryNotificationStore>((set) => ({
    notice: null,

    setNotice: (notice) => set({ notice }),

    clearNotice: () => {
      clearTracking();
      set({ notice: null });
    },

    startTracking: (taskId, graphId) => {
      clearTracking();
      let finished = false;
      let settled = false;

      const settleSuccess = async () => {
        if (settled) return;
        settled = true;
        try {
          const task = (await api.ai.getTaskStatus(taskId)) as {
            status?: string;
            output_data?: { suggestions?: unknown[] };
          };
          const count = Array.isArray(task?.output_data?.suggestions)
            ? task.output_data.suggestions.length
            : 0;
          set({
            notice: {
              status: 'success',
              graphId,
              taskId,
              suggestionCount: count,
            },
          });
        } finally {
          finished = true;
          clearTracking();
        }
      };

      const handleSse = (payload: SSEMessagePayload) => {
        if (payload.type !== 'task_update') return;
        if (typeof payload.taskId !== 'string' || payload.taskId !== taskId) {
          return;
        }
        const status = typeof payload.status === 'string' ? payload.status : '';
        if (status === 'completed') {
          void settleSuccess();
        } else if (status === 'failed') {
          finished = true;
          clearTracking();
          set({ notice: { status: 'error', graphId, taskId } });
        } else if (status === 'cancelled') {
          finished = true;
          clearTracking();
          set({ notice: null });
        }
      };

      currentUnsubscribe = frontendEventBus.subscribe('sse_message', handleSse);

      // 立即展示「分析中」，避免任务已排队但面板/通知空白
      set({ notice: { status: 'generating', graphId, taskId } });

      // 初始对账：避免订阅前任务已完成的竞态
      void api.ai
        .getTaskStatus(taskId)
        .catch(() => null)
        .then((t) => {
          if (finished) return;
          const seed = t as { status?: string } | null;
          if (seed?.status === 'completed') {
            void settleSuccess();
          } else if (seed?.status === 'failed') {
            finished = true;
            clearTracking();
            set({ notice: { status: 'error', graphId, taskId } });
          } else if (seed?.status === 'cancelled') {
            finished = true;
            clearTracking();
            set({ notice: null });
          }
        });

      // 看门狗：SSE 断连等导致事件缺失时做一次最终对账
      currentWatchdog = window.setTimeout(() => {
        if (finished) return;
        void api.ai
          .getTaskStatus(taskId)
          .catch(() => null)
          .then((t) => {
            if (finished) return;
            const cur = t as { status?: string } | null;
            if (cur?.status === 'completed') {
              void settleSuccess();
            } else if (cur?.status === 'failed') {
              finished = true;
              clearTracking();
              set({ notice: { status: 'error', graphId, taskId } });
            } else if (cur?.status === 'cancelled') {
              finished = true;
              clearTracking();
              set({ notice: null });
            } else {
              finished = true;
              clearTracking();
              set({ notice: null });
            }
          });
      }, WATCHDOG_MS);
    },
  }));
