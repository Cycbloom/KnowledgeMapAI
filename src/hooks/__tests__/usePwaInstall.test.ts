// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePwaInstall,
  type BeforeInstallPromptEvent,
} from "../usePwaInstall";

/**
 * 构造一个模拟的 BeforeInstallPromptEvent。
 * 通过 Object.assign 向原生 Event 追加 prompt/userChoice 属性，
 * 以模拟浏览器在触发 beforeinstallprompt 时提供的事件对象。
 */
function createBeforeInstallPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted",
): BeforeInstallPromptEvent {
  const event = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome, platform: "web" }),
    },
  );
  return event as unknown as BeforeInstallPromptEvent;
}

/** 构造一个模拟的 MediaQueryList，matches 控制是否处于 standalone 模式 */
function createMatchMediaResult(matches: boolean): MediaQueryList {
  return {
    matches,
    media: "(display-mode: standalone)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

describe("usePwaInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 matchMedia 默认为非 standalone，确保初始 installed 为 false
    vi.mocked(window.matchMedia).mockReset();
    vi.mocked(window.matchMedia).mockReturnValue(createMatchMediaResult(false));
  });

  it("初始状态：canInstall 为 false, installed 为 false", () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it("触发 beforeinstallprompt 事件后 canInstall 应变为 true", () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });
    expect(result.current.canInstall).toBe(true);
    expect(result.current.installed).toBe(false);
  });

  it("触发 appinstalled 事件后 installed 应为 true 且 canInstall 应为 false", () => {
    const { result } = renderHook(() => usePwaInstall());
    // 先触发 beforeinstallprompt 使 canInstall 变为 true
    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });
    expect(result.current.canInstall).toBe(true);
    // 再触发 appinstalled
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall 在可安装时应返回用户选择并清空 deferredPrompt", async () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent("accepted"));
    });
    expect(result.current.canInstall).toBe(true);

    let outcome: "accepted" | "dismissed" | null = null;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe("accepted");
    // deferredPrompt 被清空，canInstall 应变为 false
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall 应支持 dismissed 结果", async () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent("dismissed"));
    });

    let outcome: "accepted" | "dismissed" | null = null;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe("dismissed");
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall 在不可安装时应返回 null", async () => {
    const { result } = renderHook(() => usePwaInstall());
    let outcome: "accepted" | "dismissed" | null = "accepted";
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe(null);
  });

  it("standalone 模式下初始 installed 应为 true", () => {
    // 覆盖 matchMedia 返回 matches: true 模拟 standalone 模式
    vi.mocked(window.matchMedia).mockReturnValueOnce(createMatchMediaResult(true));
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.installed).toBe(true);
    // 已安装状态下 canInstall 始终为 false
    expect(result.current.canInstall).toBe(false);
  });

  it("standalone 模式下即使触发 beforeinstallprompt canInstall 仍为 false", () => {
    vi.mocked(window.matchMedia).mockReturnValueOnce(createMatchMediaResult(true));
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it("卸载时应移除 beforeinstallprompt 与 appinstalled 事件监听器", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => usePwaInstall());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function),
    );
    expect(removeSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));
    removeSpy.mockRestore();
  });
});
