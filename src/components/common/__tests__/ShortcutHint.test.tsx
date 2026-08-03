// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ShortcutHint } from "../ShortcutHint";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const mockShortcutLabel = vi.hoisted(() => ({
  label: "Ctrl+S" as string | null,
}));

const mockPreferences = vi.hoisted(() => ({
  enabled: true,
}));

vi.mock("../../../hooks/common/useShortcutLabel", () => ({
  useShortcutLabel: () => mockShortcutLabel.label,
}));

vi.mock("../../../store/usePreferencesStore", () => ({
  usePreferencesStore: (
    selector: (state: { shortcutHintEnabled: boolean }) => unknown,
  ) => selector({ shortcutHintEnabled: mockPreferences.enabled }),
}));

describe("ShortcutHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockShortcutLabel.label = "Ctrl+S";
    mockPreferences.enabled = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("应该渲染子元素（按钮）", () => {
    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("应该注入 aria-keyshortcuts 属性", () => {
    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toHaveAttribute("aria-keyshortcuts", "Ctrl+S");
  });

  it("shortcutLabel 为 null 时：不注入 aria-keyshortcuts，dev 环境 console.warn", () => {
    mockShortcutLabel.label = null;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ShortcutHint actionId="nonexistent.id">
        <button>Click me</button>
      </ShortcutHint>,
    );

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("nonexistent.id"),
    );

    warnSpy.mockRestore();
  });

  it("shortcutHintEnabled=false：hover 不显示气泡，但 aria-keyshortcuts 仍注入", () => {
    mockPreferences.enabled = false;

    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Ctrl+S");

    const wrapper = screen.getByTestId("shortcut-hint-wrapper");
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(
      screen.queryByTestId("shortcut-hint-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("shortcutHintEnabled=true + shortcutLabel 非 null + hover 500ms：显示气泡", () => {
    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    expect(
      screen.queryByTestId("shortcut-hint-tooltip"),
    ).not.toBeInTheDocument();

    const wrapper = screen.getByTestId("shortcut-hint-wrapper");
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const tooltip = screen.getByTestId("shortcut-hint-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Ctrl+S");
  });

  it("mouseLeave：气泡消失", () => {
    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    const wrapper = screen.getByTestId("shortcut-hint-wrapper");
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("shortcut-hint-tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);
    expect(
      screen.queryByTestId("shortcut-hint-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("hover 不足 500ms 离开：不显示气泡", () => {
    render(
      <ShortcutHint actionId="save">
        <button>Click me</button>
      </ShortcutHint>,
    );

    const wrapper = screen.getByTestId("shortcut-hint-wrapper");
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(
      screen.queryByTestId("shortcut-hint-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("应该保留子元素原有的 onMouseEnter/onMouseLeave 处理函数", () => {
    const originalEnter = vi.fn();
    const originalLeave = vi.fn();

    render(
      <ShortcutHint actionId="save">
        <button onMouseEnter={originalEnter} onMouseLeave={originalLeave}>
          Click me
        </button>
      </ShortcutHint>,
    );

    const button = screen.getByRole("button", { name: "Click me" });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(originalEnter).toHaveBeenCalledTimes(1);
    expect(originalLeave).toHaveBeenCalledTimes(1);
  });
});