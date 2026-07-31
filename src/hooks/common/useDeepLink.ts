import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 监听来自 Electron 主进程的深度链接事件。
 * 协议格式：knowledgemap://graph/{graphId}
 *
 * - 仅在 Electron 环境下生效（window.electronAPI 存在时）
 * - 收到 URL 后解析 graphId 并 navigate 到 /graph/{graphId}
 * - 无效 URL 静默忽略
 */
export function useDeepLink(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const electronAPI = (window as Window & { electronAPI?: unknown }).electronAPI;
    if (!electronAPI || typeof electronAPI !== "object") {
      return;
    }

    const deepLink = (electronAPI as {
      deepLink?: {
        onOpenUrl?: (
          callback: (data: { url: string; timestamp: number }) => void,
        ) => (() => void) | undefined;
      };
    }).deepLink;
    if (!deepLink?.onOpenUrl) {
      return;
    }

    const unsubscribe = deepLink.onOpenUrl(({ url }) => {
      // 解析 knowledgemap://graph/{graphId}
      const match = /^knowledgemap:\/\/graph\/([^/?#]+)/.exec(url);
      if (match?.[1]) {
        navigate(`/graph/${match[1]}`);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [navigate]);
}