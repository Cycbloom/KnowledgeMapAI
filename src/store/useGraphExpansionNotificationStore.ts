import { create } from 'zustand';
import { api } from '../services/api';
import { frontendEventBus } from '../services/timer/FrontendEventBus';
import type { SSEMessagePayload } from '../services/FrontendEventTypes';

const WATCHDOG_MS = 10 * 60 * 1000;

export type GraphExpansionMode = 'depth' | 'width';

export interface GraphExpansionNotice {
  status: 'generating' | 'success' | 'error';
  mode: GraphExpansionMode;
  taskId: string;
  graphId: string;
  /** 任务发起时的界面路径，用于「查看」跳回原界面 */
  origin: string;
  /** 后台任务当前进度百分比（0-100），运行中由 SSE 透传 processor 上报值 */
  progress?: number;
  count?: { graphs?: number; nodes?: number };
}

interface GraphExpansionNotificationStore {
  notice: GraphExpansionNotice | null;
  setNotice: (notice: GraphExpansionNotice | null) => void;
  clearNotice: () => void;
  /** 对指定 AI 智能拓展（深度/宽度）后台任务进行全局跟踪，完成后弹出右下角通知（跨路由存活） */
  startTracking: (
    taskId: string,
    options: { mode: GraphExpansionMode; graphId: string; origin?: string },
  ) => void;
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

interface TaskStatusPayload {
  status?: string;
  output_data?: {
    total_graphs_created?: number;
    total_nodes_created?: number;
    totalNodes?: number;
    totalEdges?: number;
  };
  runtime_progress?: {
    total_graphs_created?: number;
    total_nodes_created?: number;
    totalNodes?: number;
    totalEdges?: number;
  };
}

const resolveCount = (
  task: TaskStatusPayload | null,
  mode: GraphExpansionMode,
): { graphs?: number; nodes?: number } => {
  // 拓展处理器把完成结果作为 progress 写入 runtime_progress 列（第 4 位置参数），
  // 而非 output_data；部分处理器仍写 output_data，故两者都读、runtime 优先。
  const out = task?.runtime_progress ?? task?.output_data;
  if (!out) return {};
  if (mode === 'width') {
    return {
      graphs: out.total_graphs_created ?? 0,
      nodes: out.total_nodes_created ?? 0,
    };
  }
  // 深度拓展仅在原图谱内新增节点，不新建图谱
  return { graphs: 0, nodes: out.totalNodes ?? 0 };
};

/**
 * AI 智能拓展（深度/宽度）后台任务完成的全局通知 store。
 *
 * 拓展是后台任务（AI 较耗时），用户提交后即可关闭面板继续其它操作。任务完成后
 * 由此 store 弹出右下角通知，引导用户查看新增图谱/节点。跟踪基于 SSE task_update
 * + 初始对账 + 看门狗兜底（与关系发现 / 自动分类通知同模式）。
 */
export const useGraphExpansionNotificationStore =
  create<GraphExpansionNotificationStore>((set) => ({
    notice: null,

    setNotice: (notice) => set({ notice }),

    clearNotice: () => {
      clearTracking();
      set({ notice: null });
    },

    startTracking: (taskId, options) => {
      clearTracking();
      let finished = false;
      let settled = false;
      const origin = options.origin ?? window.location.pathname + window.location.search;

      const settleSuccess = async () => {
        if (settled) return;
        settled = true;
        try {
          const task = (await api.ai.getTaskStatus(taskId)) as TaskStatusPayload;
          set({
            notice: {
              status: 'success',
              mode: options.mode,
              taskId,
              graphId: options.graphId,
              origin,
              count: resolveCount(task, options.mode),
            },
          });
        } finally {
          finished = true;
          clearTracking();
        }
      };

      const settleError = () => {
        finished = true;
        clearTracking();
        set({
          notice: {
            status: 'error',
            mode: options.mode,
            taskId,
            graphId: options.graphId,
            origin,
          },
        });
      };

      const settleCancelled = () => {
        finished = true;
        clearTracking();
        set({ notice: null });
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
          settleError();
        } else if (status === 'cancelled') {
          settleCancelled();
        } else {
          // 运行中：透传 processor 上报的进度百分比，通知以文字比例形式展示
          const rawProgress = (payload as { progress?: { progress?: unknown } })
            .progress?.progress;
          const pct =
            typeof rawProgress === 'number' && Number.isFinite(rawProgress)
              ? Math.max(0, Math.min(100, Math.round(rawProgress)))
              : undefined;
          set((s) => ({
            notice:
              s.notice && s.notice.taskId === taskId && s.notice.status === 'generating'
                ? { ...s.notice, progress: pct }
                : s.notice,
          }));
        }
      };

      currentUnsubscribe = frontendEventBus.subscribe('sse_message', handleSse);

      // 立即展示「生成中」，避免任务已排队但通知空白
      set({
        notice: {
          status: 'generating',
          mode: options.mode,
          taskId,
          graphId: options.graphId,
          origin,
        },
      });

      // 初始对账：避免订阅前任务已完成的竞态
      void api.ai
        .getTaskStatus(taskId)
        .catch(() => null)
        .then((t) => {
          if (finished) return;
          const seed = t as TaskStatusPayload | null;
          if (seed?.status === 'completed') {
            void settleSuccess();
          } else if (seed?.status === 'failed') {
            settleError();
          } else if (seed?.status === 'cancelled') {
            settleCancelled();
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
            const cur = t as TaskStatusPayload | null;
            if (cur?.status === 'completed') {
              void settleSuccess();
            } else if (cur?.status === 'failed') {
              settleError();
            } else if (cur?.status === 'cancelled') {
              settleCancelled();
            } else {
              finished = true;
              clearTracking();
              set({ notice: null });
            }
          });
      }, WATCHDOG_MS);
    },
  }));