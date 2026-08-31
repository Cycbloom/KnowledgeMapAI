import { useExecutionSessionStore } from "../store/useExecutionSessionStore";
import type { ActivityKind } from "@shared/types";

/** 一次学习活动的上下文，由学习/答题页面写入，会话桥据此开启/延续/结束会话 */
export interface ExecutionContext {
  taskId?: string;
  subtaskId?: string;
  knowledgePointId?: string;
  stage?: ActivityKind;
  kind: ActivityKind;
}

/** 可变引用：存放最新一次学习活动上下文，供会话桥在路由/上下文变化时读取 */
export const executionContextRef: { current: ExecutionContext | null } = {
  current: null,
};

/** 页面写入学习活动上下文（无上下文传 null）并通知会话桥重新评估 */
export function setExecutionContext(ctx: ExecutionContext | null): void {
  executionContextRef.current = ctx;
  useExecutionSessionStore.getState().bumpContext();
}