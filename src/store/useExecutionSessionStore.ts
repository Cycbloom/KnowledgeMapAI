import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * 学习会话（Execution）全局状态。
 *
 * 会话 = 一次连续学习活动（task_executions），从真正进入学习/答题界面开始，
 * 到离开该界面结束；会话内切知识点/学习↔做题只追加活动片段、不结束会话。
 * 番茄钟（focus_session）保持独立节奏，与此状态解耦。
 */
interface ExecutionSessionState {
  /** 当前打开的会话 id（in_progress） */
  executionId: string | null;
  active: boolean;
  /** 上下文版本计数，页面设置学习上下文后自增，驱动会话桥判断 begin/end */
  ctxVersion: number;
  setActive: (executionId: string) => void;
  clear: () => void;
  bumpContext: () => void;
}

export const useExecutionSessionStore = create<ExecutionSessionState>()(
  devtools(
    (set) => ({
      executionId: null,
      active: false,
      ctxVersion: 0,
      setActive: (executionId) => set({ executionId, active: true }),
      clear: () => set({ executionId: null, active: false }),
      bumpContext: () => set((s) => ({ ctxVersion: s.ctxVersion + 1 })),
    }),
    { name: "ExecutionSessionStore" },
  ),
);