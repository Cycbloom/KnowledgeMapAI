// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const mockState = vi.hoisted(() => ({
  celebrationEnabled: true,
  reducedMotion: false,
}));

// mock canvas-confetti：默认导出替换为 vi.fn()
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// mock usePreferencesStore：仅暴露 getState()，返回 mockState.celebrationEnabled
vi.mock("../../../store/usePreferencesStore", () => ({
  usePreferencesStore: {
    getState: () => ({ celebrationEnabled: mockState.celebrationEnabled }),
  },
}));

import confetti from "canvas-confetti";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { CELEBRATION_PRESETS } from "../../../services/celebrationService";
import type { CelebrationBurstPayload } from "../../../services/FrontendEventTypes";
import { CelebrationOverlay } from "../CelebrationOverlay";

function buildPayload(
  overrides: Partial<CelebrationBurstPayload> = {},
): CelebrationBurstPayload {
  return {
    preset: "task-completed",
    config: CELEBRATION_PRESETS["task-completed"],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("CelebrationOverlay", () => {
  beforeEach(() => {
    mockState.celebrationEnabled = true;
    mockState.reducedMotion = false;
    vi.mocked(confetti).mockClear();

    // 覆盖全局 matchMedia mock 以支持 per-test 控制 reducedMotion
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches:
        mockState.reducedMotion &&
        query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该默认渲染 null（不渲染可见 DOM）", () => {
    const { container } = render(<CelebrationOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("应该收到 celebration_burst 事件且 celebrationEnabled=true 且非 reduced-motion 时调用 confetti()", async () => {
    render(<CelebrationOverlay />);

    act(() => {
      frontendEventBus.publish("celebration_burst", buildPayload());
    });

    // 处理器为 async 且动态 import canvas-confetti，需等待微任务完成后再断言
    await act(async () => {});

    expect(vi.mocked(confetti)).toHaveBeenCalledTimes(1);
    const options = vi.mocked(confetti).mock.calls[0]?.[0];
    expect(options).toMatchObject({
      particleCount: 20,
      spread: 45,
      startVelocity: 35,
    });
  });

  it("应该 celebrationEnabled=false 时不调用 confetti()", () => {
    mockState.celebrationEnabled = false;
    render(<CelebrationOverlay />);

    act(() => {
      frontendEventBus.publish("celebration_burst", buildPayload());
    });

    expect(vi.mocked(confetti)).not.toHaveBeenCalled();
  });

  it("应该 prefers-reduced-motion: reduce 时不调用 confetti()", () => {
    mockState.reducedMotion = true;
    render(<CelebrationOverlay />);

    act(() => {
      frontendEventBus.publish("celebration_burst", buildPayload());
    });

    expect(vi.mocked(confetti)).not.toHaveBeenCalled();
  });

  it("应该组件卸载后取消订阅（卸载后再发布事件不触发 confetti）", () => {
    const { unmount } = render(<CelebrationOverlay />);

    unmount();

    act(() => {
      frontendEventBus.publish("celebration_burst", buildPayload());
    });

    expect(vi.mocked(confetti)).not.toHaveBeenCalled();
  });
});
