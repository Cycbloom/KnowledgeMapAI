import { create } from 'zustand';
import { api } from '../services/api';
import { frontendEventBus } from '../services/timer/FrontendEventBus';
import type { SSEMessagePayload } from '../services/FrontendEventTypes';

const WATCHDOG_MS = 10 * 60 * 1000;

export interface AutoClassifyNotice {
  status: 'generating' | 'success' | 'error';
  taskId: string;
  domainCount?: number;
}

interface AutoClassifyNotificationStore {
  notice: AutoClassifyNotice | null;
  setNotice: (notice: AutoClassifyNotice | null) => void;
  clearNotice: () => void;
  /** 自动分类领域后台任务完成后的全局通知（跨路由存活） */
  startTracking: (taskId: string) => void;
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
 * 自动分类领域任务完成的全局通知 store。
 *
 * 自动分类是后台任务（AI 聚类较耗时），用户提交后即可继续其它操作。任务完成后
 * 由此 store 弹出右下角通知，引导用户回到图谱地图应用候选领域。跟踪基于 SSE
 * task_update + 初始对账 + 看门狗兜底（与关系发现通知同模式）。
 */
export const useAutoClassifyNotificationStore =
  create<AutoClassifyNotificationStore>((set) => ({
    notice: null,

    setNotice: (notice) => set({ notice }),

    clearNotice: () => {
      clearTracking();
      set({ notice: null });
    },

    startTracking: (taskId) => {
      clearTracking();
      let finished = false;
      let settled = false;

      const settleSuccess = async () => {
        if (settled) return;
        settled = true;
        try {
          const task = (await api.ai.getTaskStatus(taskId)) as {
            status?: string;
            output_data?: { domains?: unknown[] };
          };
          const count = Array.isArray(task?.output_data?.domains)
            ? task.output_data.domains.length
            : 0;
          set({ notice: { status: 'success', taskId, domainCount: count } });
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
          set({ notice: { status: 'error', taskId } });
        } else if (status === 'cancelled') {
          finished = true;
          clearTracking();
          set({ notice: null });
        }
      };

      currentUnsubscribe = frontendEventBus.subscribe('sse_message', handleSse);

      // 立即展示「分析中」，避免任务已排队但通知空白
      set({ notice: { status: 'generating', taskId } });

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
            set({ notice: { status: 'error', taskId } });
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
              set({ notice: { status: 'error', taskId } });
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