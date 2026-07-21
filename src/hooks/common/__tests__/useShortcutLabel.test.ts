// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutBinding,
} from "../../../config/shortcuts";
import { useShortcutStore } from "../../../store/useShortcutStore";
import {
  useShortcutLabel,
  formatShortcutKeys,
} from "../useShortcutLabel";

function resetStoreBindings(): void {
  const defaultBindings: Record<string, ShortcutBinding> = {};
  DEFAULT_SHORTCUTS.forEach((shortcut) => {
    defaultBindings[shortcut.id] = {
      id: shortcut.id,
      keys: shortcut.defaultKeys,
      enabled: true,
    };
  });
  useShortcutStore.setState({
    bindings: defaultBindings,
    enabled: true,
  });
}

describe("useShortcutLabel", () => {
  beforeEach(() => {
    resetStoreBindings();
  });

  it("默认绑定：save 在 win 平台返回 Ctrl+S", () => {
    const { result } = renderHook(() =>
      useShortcutLabel("save", { platform: "win" }),
    );
    expect(result.current).toBe("Ctrl+S");
  });

  it("默认绑定：save 在 mac 平台返回 ⌃S", () => {
    const { result } = renderHook(() =>
      useShortcutLabel("save", { platform: "mac" }),
    );
    expect(result.current).toBe("⌃S");
  });

  it("用户自定义：save = Ctrl+Shift+S 在 win 平台", () => {
    useShortcutStore.getState().setBinding("save", {
      key: "s",
      ctrl: true,
      shift: true,
    });
    const { result } = renderHook(() =>
      useShortcutLabel("save", { platform: "win" }),
    );
    expect(result.current).toBe("Ctrl+Shift+S");
  });

  it("用户自定义：save 在 mac 平台返回 ⌃⇧S", () => {
    useShortcutStore.getState().setBinding("save", {
      key: "s",
      ctrl: true,
      shift: true,
    });
    const { result } = renderHook(() =>
      useShortcutLabel("save", { platform: "mac" }),
    );
    expect(result.current).toBe("⌃⇧S");
  });

  it("无绑定：non-existent 返回 null", () => {
    const { result } = renderHook(() =>
      useShortcutLabel("non-existent", { platform: "win" }),
    );
    expect(result.current).toBeNull();
  });

  it("store 无 binding 时 fallback 到 DEFAULT_SHORTCUTS", () => {
    const { bindings } = useShortcutStore.getState();
    const newBindings = { ...bindings };
    delete newBindings["save"];
    useShortcutStore.setState({ bindings: newBindings });

    const { result } = renderHook(() =>
      useShortcutLabel("save", { platform: "win" }),
    );
    // DEFAULT_SHORTCUTS.save.defaultKeys = { key: "s", ctrl: true }
    expect(result.current).toBe("Ctrl+S");
  });

  it("mac 平台使用 ⌃/⇧/⌥/⌘ 符号", () => {
    expect(formatShortcutKeys({ key: "a", ctrl: true }, "mac")).toBe("⌃A");
    expect(formatShortcutKeys({ key: "a", meta: true }, "mac")).toBe("⌘A");
    expect(formatShortcutKeys({ key: "a", alt: true }, "mac")).toBe("⌥A");
    expect(formatShortcutKeys({ key: "a", shift: true }, "mac")).toBe("⇧A");
  });

  it("win 平台使用 Ctrl/Shift/Alt/Win 文本", () => {
    expect(formatShortcutKeys({ key: "a", ctrl: true }, "win")).toBe("Ctrl+A");
    expect(formatShortcutKeys({ key: "a", meta: true }, "win")).toBe("Win+A");
    expect(formatShortcutKeys({ key: "a", alt: true }, "win")).toBe("Alt+A");
    expect(formatShortcutKeys({ key: "a", shift: true }, "win")).toBe("Shift+A");
  });

  it("linux 平台与 win 平台格式一致", () => {
    expect(formatShortcutKeys({ key: "a", ctrl: true }, "linux")).toBe(
      "Ctrl+A",
    );
    expect(formatShortcutKeys({ key: "a", meta: true }, "linux")).toBe("Win+A");
  });

  it("返回值稳定：同输入不产生新字符串引用", () => {
    const { result, rerender } = renderHook(() =>
      useShortcutLabel("save", { platform: "win" }),
    );
    const first = result.current;
    rerender();
    const second = result.current;
    expect(second).toBe(first);
  });
});

describe("formatShortcutKeys", () => {
  it("mac: 仅 ctrl → ⌃ + 主键", () => {
    expect(formatShortcutKeys({ key: "s", ctrl: true }, "mac")).toBe("⌃S");
  });

  it("mac: 仅 meta → ⌘ + 主键", () => {
    expect(formatShortcutKeys({ key: "s", meta: true }, "mac")).toBe("⌘S");
  });

  it("mac: 仅 alt → ⌥ + 主键", () => {
    expect(formatShortcutKeys({ key: "s", alt: true }, "mac")).toBe("⌥S");
  });

  it("mac: 仅 shift → ⇧ + 主键", () => {
    expect(formatShortcutKeys({ key: "s", shift: true }, "mac")).toBe("⇧S");
  });

  it("mac: ctrl+meta+alt+shift 组合", () => {
    expect(
      formatShortcutKeys(
        { key: "s", ctrl: true, meta: true, alt: true, shift: true },
        "mac",
      ),
    ).toBe("⌃⌘⌥⇧S");
  });

  it("mac: 无修饰键 → 仅主键", () => {
    expect(formatShortcutKeys({ key: "s" }, "mac")).toBe("S");
  });

  it("mac: 紧凑无分隔连接", () => {
    expect(
      formatShortcutKeys({ key: "s", ctrl: true, shift: true }, "mac"),
    ).toBe("⌃⇧S");
  });

  it("win: 仅 ctrl → Ctrl + 主键", () => {
    expect(formatShortcutKeys({ key: "s", ctrl: true }, "win")).toBe("Ctrl+S");
  });

  it("win: 仅 meta → Win + 主键", () => {
    expect(formatShortcutKeys({ key: "s", meta: true }, "win")).toBe("Win+S");
  });

  it("win: ctrl+shift 组合", () => {
    expect(
      formatShortcutKeys({ key: "s", ctrl: true, shift: true }, "win"),
    ).toBe("Ctrl+Shift+S");
  });

  it("win: ctrl+meta+alt+shift 组合", () => {
    expect(
      formatShortcutKeys(
        { key: "s", ctrl: true, meta: true, alt: true, shift: true },
        "win",
      ),
    ).toBe("Ctrl+Win+Alt+Shift+S");
  });

  it("win: 无修饰键 → 仅主键", () => {
    expect(formatShortcutKeys({ key: "s" }, "win")).toBe("S");
  });

  it("win: 用 + 分隔", () => {
    expect(
      formatShortcutKeys({ key: "s", ctrl: true, shift: true }, "win"),
    ).toBe("Ctrl+Shift+S");
  });

  it("单字符主键大写", () => {
    expect(formatShortcutKeys({ key: "a", ctrl: true }, "win")).toBe("Ctrl+A");
    expect(formatShortcutKeys({ key: "a", ctrl: true }, "mac")).toBe("⌃A");
  });

  it("多字符主键首字母大写", () => {
    expect(formatShortcutKeys({ key: "f1", ctrl: true }, "win")).toBe(
      "Ctrl+F1",
    );
    expect(formatShortcutKeys({ key: "arrowup", ctrl: true }, "win")).toBe(
      "Ctrl+Arrowup",
    );
  });
});
