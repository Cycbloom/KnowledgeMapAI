import { useCallback, useEffect, useState } from "react";

export interface UseFirstRunHintOptions {
  /** localStorage key，用于持久化 dismiss 标记 */
  storageKey: string;
  /** dismiss 触发方式，默认 'manual'（由调用方主动调用 dismiss） */
  dismissOn?: "click" | "manual" | "timeout";
  /** dismissOn='timeout' 时的自动消失时间（毫秒） */
  timeoutMs?: number;
}

export interface UseFirstRunHintResult {
  /** 是否显示首次提示 */
  isVisible: boolean;
  /** 隐藏提示并写入 localStorage 标记 */
  dismiss: () => void;
  /** 清除 localStorage 标记并恢复显示（主要用于测试） */
  reset: () => void;
}

const DISMISSED_FLAG = "true";

/**
 * 读取 localStorage 中的 dismiss 标记。
 * - SSR 环境或读取异常时返回 false（视为未 dismiss）
 * - 仅当值严格等于 'true' 时视为已 dismiss
 */
function readDismissedFlag(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey) === DISMISSED_FLAG;
  } catch {
    // 隐私模式 / storage 已满 / 跨域限制等情况下吞掉异常
    return false;
  }
}

/**
 * 写入或清除 localStorage 中的 dismiss 标记。
 * SSR 环境或写入异常时静默失败并打印 warn（前端允许 console.warn）。
 */
function writeDismissedFlag(storageKey: string, dismissed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (dismissed) {
      window.localStorage.setItem(storageKey, DISMISSED_FLAG);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch (err) {
    console.warn("[useFirstRunHint] 写入 storage 失败", err);
  }
}

/**
 * 首次使用提示 hook。
 *
 * - mount 时读取 localStorage 标记，无标记则 isVisible=true
 * - dismiss() 写入标记并隐藏；reset() 清除标记恢复显示（测试用）
 * - dismissOn='timeout' 时 mount 后自动定时 dismiss，组件卸载清理 timer
 * - dismissOn='click' 与 'manual' 由调用方主动调用 dismiss()
 * - SSR 安全：typeof window === 'undefined' 时返回 isVisible=false
 *
 * @example
 * const { isVisible, dismiss } = useFirstRunHint({
 *   storageKey: "hint-graph-drag",
 *   dismissOn: "manual",
 * });
 */
export function useFirstRunHint(
  options: UseFirstRunHintOptions,
): UseFirstRunHintResult {
  const { storageKey, dismissOn = "manual", timeoutMs } = options;
  const isClient = typeof window !== "undefined";

  // 懒初始化：在 render 阶段同步读取 storage（SSR 环境跳过，返回 false）
  const [isVisible, setVisible] = useState<boolean>(() => {
    if (!isClient) return false;
    return !readDismissedFlag(storageKey);
  });

  const dismiss = useCallback(() => {
    if (!isClient) return;
    writeDismissedFlag(storageKey, true);
    setVisible(false);
  }, [storageKey, isClient]);

  const reset = useCallback(() => {
    if (!isClient) return;
    writeDismissedFlag(storageKey, false);
    setVisible(true);
  }, [storageKey, isClient]);

  // dismissOn='timeout' 时 mount 后自动 dismiss，组件卸载清理 timer。
  // dismiss 经 useCallback 稳定（依赖 storageKey / isClient），storageKey
  // 不变时不会重启 timer；storageKey 变化时重启是符合预期的行为。
  useEffect(() => {
    if (!isClient) return;
    if (dismissOn !== "timeout") return;
    if (timeoutMs === undefined) return;

    const timer = setTimeout(() => {
      dismiss();
    }, timeoutMs);

    return () => {
      clearTimeout(timer);
    };
  }, [dismissOn, timeoutMs, dismiss, isClient]);

  return { isVisible, dismiss, reset };
}
