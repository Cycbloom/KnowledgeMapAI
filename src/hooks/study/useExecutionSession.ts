import { useCallback, useRef } from "react";
import { useExecutionSessionStore } from "../../store/useExecutionSessionStore";
import { api } from "../../services/api";
import type { ActivityKind } from "@shared/types";

export interface ExecutionContext {
  taskId?: string;
  subtaskId?: string;
  knowledgePointId?: string;
  stage?: ActivityKind;
  kind: ActivityKind;
}

/**
 * 管理「会话（Execution）」的开启 / 追加 / 结束。
 *
 * - begin(ctx)：无开会话 → 新建并计时；开会话 → 追加活动片段（切知识点/学习↔做题）。
 * - end()：结束开会话，结算总时长并清空状态。
 *
 * 调用方（ExecutionSessionBridge）已按「上下文 key + active」做幂等守卫，
 * 此处再以序列号丢弃过期响应，避免并发 begin 互相覆盖会话 id。
 */
export function useExecutionSession() {
  const executionId = useExecutionSessionStore((s) => s.executionId);
  const active = useExecutionSessionStore((s) => s.active);
  const setActive = useExecutionSessionStore((s) => s.setActive);
  const clear = useExecutionSessionStore((s) => s.clear);
  const seqRef = useRef(0);

  const begin = useCallback(
    async (ctx: ExecutionContext): Promise<void> => {
      const mySeq = ++seqRef.current;
      const state = useExecutionSessionStore.getState();
      let result;
      if (state.active && state.executionId) {
        result = await api.scheduler.appendSessionActivity({
          execution_id: state.executionId,
          task_id: ctx.taskId,
          subtask_id: ctx.subtaskId,
          knowledge_point_id: ctx.knowledgePointId,
          stage: ctx.stage,
          kind: ctx.kind,
        });
      } else {
        result = await api.scheduler.startSession({
          task_id: ctx.taskId,
          subtask_id: ctx.subtaskId,
          knowledge_point_id: ctx.knowledgePointId,
          stage: ctx.stage,
          kind: ctx.kind,
        });
      }
      if (mySeq !== seqRef.current) return;
      if (result?.id) setActive(result.id);
    },
    [setActive],
  );

  const end = useCallback(async (): Promise<void> => {
    // 使后续 begin 不再复用旧会话 id / 旧 ctx
    seqRef.current += 1;
    const state = useExecutionSessionStore.getState();
    if (!state.active || !state.executionId) return;
    const id = state.executionId;
    clear();
    await api.scheduler.endSession(id).catch(() => {
      /* 结束失败非关键，静默 */
    });
  }, [clear]);

  return { executionId, active, begin, end };
}