import { useEffect, useRef, useCallback } from "react";

/**
 * 移动端虚拟键盘处理 Hook
 *
 * 监听 `focusin`/`focusout` 事件，结合 `visualViewport` API 检测键盘弹出，
 * 在移动端（`window.innerWidth < 768`）确保输入框在可视区域内。
 */
export function useKeyboardHandler() {
  const isMobileRef = useRef(false);
  const lastViewportHeightRef = useRef(0);

  const scrollInputIntoView = useCallback((input: HTMLElement) => {
    // 使用 setTimeout 确保键盘弹出后布局已更新
    setTimeout(() => {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  useEffect(() => {
    isMobileRef.current = window.innerWidth < 768;

    if (typeof window === "undefined" || !window.visualViewport) {
      // 非浏览器环境或不支持 visualViewport 时，降级使用 focusin/focusout
      const handleFocusIn = (e: FocusEvent) => {
        if (!isMobileRef.current) return;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          scrollInputIntoView(target);
        }
      };

      document.addEventListener("focusin", handleFocusIn);
      return () => {
        document.removeEventListener("focusin", handleFocusIn);
      };
    }

    // visualViewport API 检测键盘弹出
    const handleViewportResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const currentHeight = vv.height;
      const prevHeight = lastViewportHeightRef.current;

      if (prevHeight > 0 && currentHeight < prevHeight - 100) {
        // 键盘弹出：可视区域高度显著减少
        const activeElement = document.activeElement as HTMLElement | null;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "SELECT")
        ) {
          scrollInputIntoView(activeElement);
        }
      }

      lastViewportHeightRef.current = currentHeight;
    };

    lastViewportHeightRef.current = window.visualViewport.height;
    window.visualViewport.addEventListener("resize", handleViewportResize);

    // 同时监听 focusin 作为补充
    const handleFocusIn = (e: FocusEvent) => {
      if (!isMobileRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        scrollInputIntoView(target);
      }
    };

    document.addEventListener("focusin", handleFocusIn);

    // 监听窗口 resize 以更新 isMobile 状态
    const handleWindowResize = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [scrollInputIntoView]);
}