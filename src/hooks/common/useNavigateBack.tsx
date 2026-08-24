import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDetailParentPath } from "../../utils/navigation";

interface NavigationContextValue {
  goBack: (fallbackPath?: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface StackEntry {
  /** 用于去重的路径名 key：同页不同 query 只保留一个历史条目 */
  key: string;
  /** 完整 URL（pathname + search），返回时精确还原上一页的上下文（如 graph_id / node_id） */
  full: string;
}

/**
 * 应用内导航栈。
 * - 记录完整 URL（含 query），因此「返回」能带回上一页的图谱 / 节点 / 角色等参数，
 *   解决原先只存 pathname 导致的返回丢失上下文（如学习模式跳转学习中心后返回错乱）。
 * - 以 pathname 去重：同页面的子状态切换（如 /study?view=quizzes、图内节点切换）不会重复入栈，
 *   返回时会回到上一个真正的页面。
 */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const stackRef = useRef<StackEntry[]>([]);

  useEffect(() => {
    const key = location.pathname;
    const full = location.pathname + location.search;
    const stack = stackRef.current;
    const top = stack[stack.length - 1];
    // 同页（pathname 相同）仅刷新完整 URL，避免 query 变化产生历史噪音
    if (top && top.key === key) {
      if (top.full !== full) top.full = full;
      return;
    }
    const idx = stack.findIndex((e) => e.key === key);
    if (idx >= 0) {
      stack.length = idx + 1;
    } else {
      stack.push({ key, full });
    }
  }, [location]);

  const goBack = useCallback(
    (fallbackPath?: string) => {
      const stack = stackRef.current;
      const key = location.pathname;
      if (stack.length > 0 && stack[stack.length - 1].key === key) {
        stack.pop();
      }
      const prev = stack[stack.length - 1];
      const target = prev?.full ?? fallbackPath ?? getDetailParentPath(location.pathname) ?? "/";
      navigate(target, { replace: true });
    },
    [location, navigate],
  );

  const value = useMemo<NavigationContextValue>(() => ({ goBack }), [goBack]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigateBack(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigateBack must be used within a NavigationProvider");
  }
  return ctx;
}
