import { create } from 'zustand';
import { api } from '../services/api';
import { frontendEventBus } from '../services/timer/FrontendEventBus';
import { mapToRuntimeProgress } from '../hooks/scheduler/useTaskEvents';
import type { SSEMessagePayload } from '../services/FrontendEventTypes';
import type { TaskRuntimeProgress } from '@shared/types/common';
import type { LevelTestNotice } from '../components/Learning/LevelTestNotification';

const TASK_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

const WATCHDOG_MS = 10 * 60 * 1000;

interface TaskStatusSeed {
  status?: string;
  runtime_progress?: unknown;
}

let currentUnsubscribe: (() => void) | null = null;
let currentWatchdog = 0;

const clearActiveTracking = () => {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }
  if (currentWatchdog) {
    window.clearTimeout(currentWatchdog);
    currentWatchdog = 0;
  }
};

interface LevelTestNotificationStore {
  notice: LevelTestNotice | null;
  startGenerationTracking: (
    taskIds: string[],
    nodeId: string,
    graphId: string,
    from: 'graph' | 'learning',
  ) => void;
  stopGenerationTracking: () => void;
  setNotice: (notice: LevelTestNotice | null) => void;
  clearNotice: () => void;
}

/**
 * 关卡测试题目生成进度与结果通知的全局 store。
 *
 * 状态提升到全局（而非页面组件内）的目的：生成过程可能跨路由持续，
 * 通知需在切换页面后仍保持可见。跟踪基于后端 SSE task_update 事件，
 * 零轮询开销；预留初始对账与看门狗兜底（均为单次查询）以规避 SSE 断连。
 */
export const useLevelTestNotificationStore = create<LevelTestNotificationStore>((set) => ({
  notice: null,

  setNotice: (notice) => set({ notice }),

  clearNotice: () => {
    clearActiveTracking();
    set({ notice: null });
  },

  stopGenerationTracking: () => {
    clearActiveTracking();
  },

  startGenerationTracking: (taskIds, nodeId, graphId, from) => {
    clearActiveTracking();
    const ids = new Set(taskIds);
    const statusMap = new Map<string, string>();
    const progressMap = new Map<string, TaskRuntimeProgress>();
    let finished = false;

    const compute = () => {
      let completedTasks = 0;
      for (const status of statusMap.values()) {
        if (status === 'completed') completedTasks++;
      }
      // 取进度百分比最高的任务进度用于展示（单节点场景即该节点进度，
      // stageLabel 含「已入库 X/Y 题」等题量信息）
      const latestProgress = [...progressMap.values()]
        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];

      set({
        notice: {
          status: 'generating',
          current: completedTasks,
          total: ids.size,
          progress: latestProgress,
          nodeId,
          graphId,
          from,
        },
      });

      const allSettled = [...ids].every((id) => {
        const status = statusMap.get(id);
        return status !== undefined && TASK_TERMINAL_STATUSES.includes(status);
      });

      if (allSettled && !finished) {
        finished = true;
        clearActiveTracking();
        set({
          notice: {
            status: completedTasks === ids.size ? 'success' : 'error',
            nodeId,
            graphId,
            from,
          },
        });
      }
    };

    const applySeed = (seed: Array<TaskStatusSeed | null>) => {
      for (let i = 0; i < taskIds.length; i++) {
        const task = seed[i];
        if (task?.status) statusMap.set(taskIds[i], task.status);
        if (task?.runtime_progress) {
          const mapped = mapToRuntimeProgress(task.runtime_progress);
          if (mapped) progressMap.set(taskIds[i], mapped);
        }
      }
      compute();
    };

    const handleSseMessage = (payload: SSEMessagePayload) => {
      if (payload.type !== 'task_update') return;
      const { taskId, status, progress } = payload;
      if (typeof taskId !== 'string' || !ids.has(taskId)) return;
      if (typeof status === 'string') statusMap.set(taskId, status);
      const mapped = mapToRuntimeProgress(progress);
      if (mapped) progressMap.set(taskId, mapped);
      compute();
    };

    currentUnsubscribe = frontendEventBus.subscribe('sse_message', handleSseMessage);

    // 初始对账：避免订阅前任务已完成的竞态
    Promise.all(
      taskIds.map((id) => api.ai.getTaskStatus(id).catch(() => null)),
    ).then((results) => {
      if (finished) return;
      applySeed(results.map((r) => (r ? (r as unknown as TaskStatusSeed) : null)));
    });

    // 看门狗：SSE 断连等导致事件缺失时，做一次最终对账（非周期性轮询）
    currentWatchdog = window.setTimeout(() => {
      if (finished) return;
      Promise.all(
        taskIds.map((id) => api.ai.getTaskStatus(id).catch(() => null)),
      ).then((results) => {
        if (finished) return;
        applySeed(results.map((r) => (r ? (r as unknown as TaskStatusSeed) : null)));
        const allSettled = [...ids].every((id) => {
          const status = statusMap.get(id);
          return status !== undefined && TASK_TERMINAL_STATUSES.includes(status);
        });
        if (!allSettled) {
          finished = true;
          clearActiveTracking();
          set({ notice: { status: 'timeout', nodeId, graphId, from } });
        }
      });
    }, WATCHDOG_MS);
  },
}));
