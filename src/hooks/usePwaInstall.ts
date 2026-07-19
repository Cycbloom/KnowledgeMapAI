import { useEffect, useState } from "react";

/**
 * BeforeInstallPromptEvent 类型定义
 * 浏览器在触发 beforeinstallprompt 事件时提供的事件对象
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface UsePwaInstallResult {
  /** 是否可以触发安装提示（deferredPrompt 已就绪且未安装） */
  canInstall: boolean;
  /** 是否已安装（standalone 模式或 appinstalled 事件已触发） */
  installed: boolean;
  /** 触发安装提示，返回用户选择结果；若不可安装返回 null */
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
}

/**
 * 扩展 Navigator 类型，包含 iOS Safari 的非标准 standalone 属性
 */
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

/**
 * 判断当前是否以 standalone 模式运行（已安装到桌面）
 */
function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  if (navigatorWithStandalone.standalone === true) return true;
  // Chrome/Edge/Firefox
  return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * PWA 安装 hook
 *
 * 监听 beforeinstallprompt 事件保存 deferredPrompt 引用，
 * 监听 appinstalled 事件更新 installed 状态并触发埋点。
 *
 * 注意：此 hook 仅在 Web 端有意义，Electron 端调用时 canInstall 始终为 false。
 */
export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandaloneMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      // 阻止浏览器默认安装提示（移动端 mini-infobar）
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      // 上报埋点
      trackPwaInstalled();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | null> => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    canInstall: deferredPrompt !== null && !installed,
    installed,
    promptInstall,
  };
}

/**
 * 上报 PWA 安装埋点事件
 */
function trackPwaInstalled(): void {
  // TODO: 接入埋点工具后上报 pwa_installed 事件
}
