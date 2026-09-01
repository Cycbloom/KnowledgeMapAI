import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useExecutionSession } from "../../hooks/study/useExecutionSession";
import {
  executionContextRef,
  type ExecutionContext,
} from "../../utils/executionSessionContext";
import { useExecutionSessionStore } from "../../store/useExecutionSessionStore";

/** 判断路径是否属于「学习/答题」活动集合（会话内可连续切换不结束） */
function isLearningActivity(pathname: string): boolean {
  return /^\/(learning|study)(\/|$)/.test(pathname);
}

function contextKey(ctx: ExecutionContext | null): string {
  if (!ctx) return "";
  // 含 taskId：跨任务切换（如复习打断跳到另一图谱）时，linkedTask 解析出不同任务
  // 后 key 变化，bridge 才会重新 begin 触发跨任务会话切换。
  return `${ctx.kind}|${ctx.knowledgePointId ?? ""}|${ctx.stage ?? ""}|${ctx.taskId ?? ""}`;
}

/**
 * 学习会话桥（全局挂载一次）。
 *
 * 统一由「路径是否为学习/答题 + 页面写入的学习上下文」驱动会话的
 * begin（进入/追加）/ end（离开），避免页面挂载/卸载竞态与重复 append。
 */
export function ExecutionSessionBridge() {
  const location = useLocation();
  const ctxVersion = useExecutionSessionStore((s) => s.ctxVersion);
  const { active, begin, end } = useExecutionSession();
  const inSetRef = useRef(false);
  const appliedKeyRef = useRef("");

  useEffect(() => {
    const inLearning = isLearningActivity(location.pathname);
    const ctx = executionContextRef.current;
    const key = contextKey(ctx);

    if (inLearning) {
      inSetRef.current = true;
      // 上下文已就绪且发生变化 → 开启/追加活动片段
      if (ctx && key !== appliedKeyRef.current) {
        appliedKeyRef.current = key;
        begin(ctx);
      }
      return;
    }

    // 仅当「路径离开学习/答题集合」才结束会话（上下文临时为空不结束，避免挑战跳转竞态）
    if (inSetRef.current || active) {
      inSetRef.current = false;
      appliedKeyRef.current = "";
      end();
    }
  }, [location.pathname, ctxVersion, active, begin, end]);

  return null;
}