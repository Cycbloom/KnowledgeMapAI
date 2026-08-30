import { create } from 'zustand';

interface AutoClassifyPanelStore {
  /** 待打开面板并加载的任务 id（由右下角完成通知「继续」设置） */
  taskId: string | null;
  /** 是否请求打开面板（配合 taskId） */
  open: boolean;
  /** 请求打开面板并加载指定任务的候选结果 */
  requestOpen: (taskId: string) => void;
  /** 清空打开请求（面板打开后调用，避免重复触发） */
  clearOpen: () => void;
}

/**
 * 自动分类领域「确认候选」面板的全局打开请求。
 *
 * 后台任务完成通知点击「继续」后，跳转到图谱地图并请求打开候选确认面板，
 * 加载该任务的 output_data。用全局 store 传递 taskId，避免依赖 URL 参数。
 */
export const useAutoClassifyPanelStore = create<AutoClassifyPanelStore>(
  (set) => ({
    taskId: null,
    open: false,

    requestOpen: (taskId) => set({ taskId, open: true }),

    clearOpen: () => set({ taskId: null, open: false }),
  }),
);