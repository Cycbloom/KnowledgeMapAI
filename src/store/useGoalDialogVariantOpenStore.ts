import { create } from 'zustand';

interface GoalDialogVariantOpenStore {
  /** 待打开面板并回填变体的任务 id（由右下角完成通知「继续」设置） */
  taskId: string | null;
  /** 是否请求打开目标驱动面板（配合 taskId） */
  open: boolean;
  /** 请求打开面板并回填指定任务的候选路径 */
  requestOpen: (taskId: string) => void;
  /** 清空打开请求（面板打开后调用，避免重复触发） */
  clearOpen: () => void;
}

/**
 * 目标驱动面板「继续选择变体」的全局打开请求。
 *
 * 生成候选路径的后台任务完成通知点击「继续」后，跳转到图谱地图并请求打开
 * 目标驱动面板，回填该任务 output_data 的候选路径供用户选中保存。用全局
 * store 传递 taskId，避免依赖 URL 参数。
 */
export const useGoalDialogVariantOpenStore = create<GoalDialogVariantOpenStore>(
  (set) => ({
    taskId: null,
    open: false,

    requestOpen: (taskId) => set({ taskId, open: true }),

    clearOpen: () => set({ taskId: null, open: false }),
  }),
);