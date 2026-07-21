import { useMemo } from "react";
import { DEFAULT_SHORTCUTS, type ShortcutKey } from "../../config/shortcuts";
import { useShortcutStore } from "../../store/useShortcutStore";

export type ShortcutPlatform = "mac" | "win" | "linux";

export interface UseShortcutLabelOptions {
  platform?: ShortcutPlatform;
}

/**
 * 检测当前平台。SSR 安全（typeof navigator === "undefined" 时默认 win）。
 * 优先使用 navigator.platform，回退到 navigator.userAgent。
 */
function detectPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "win";
  const platformString =
    typeof navigator.platform === "string" ? navigator.platform : "";
  const userAgent =
    typeof navigator.userAgent === "string" ? navigator.userAgent : "";
  if (/Mac|iPod|iPhone|iPad/i.test(platformString) || /Mac/i.test(userAgent)) {
    return "mac";
  }
  if (/Win/i.test(platformString) || /Windows/i.test(userAgent)) {
    return "win";
  }
  return "linux";
}

/**
 * 格式化主键显示。
 * - 单字符键：大写（如 "s" → "S"）
 * - 多字符键：首字母大写，其余保持（如 "ArrowUp" → "ArrowUp", "f1" → "F1"）
 */
function formatMainKey(key: string): string {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * 平台化格式化快捷键显示文本（纯函数，便于单元测试）。
 *
 * - macOS: Ctrl→"⌃"、Shift→"⇧"、Alt→"⌥"、Meta→"⌘"，主键大写，紧凑无分隔连接（如 "⌃S"）
 * - Win/Linux: Ctrl→"Ctrl"、Shift→"Shift"、Alt→"Alt"、Meta→"Win"，主键首字母大写，"+" 连接（如 "Ctrl+S"）
 *
 * 修饰键顺序：Ctrl、Meta、Alt、Shift、主键。
 */
export function formatShortcutKeys(
  keys: ShortcutKey,
  platform: ShortcutPlatform,
): string {
  const isMac = platform === "mac";
  const parts: string[] = [];

  if (keys.ctrl) parts.push(isMac ? "⌃" : "Ctrl");
  if (keys.meta) parts.push(isMac ? "⌘" : "Win");
  if (keys.alt) parts.push(isMac ? "⌥" : "Alt");
  if (keys.shift) parts.push(isMac ? "⇧" : "Shift");

  parts.push(formatMainKey(keys.key));

  return parts.join(isMac ? "" : "+");
}

/**
 * 获取快捷键的平台化显示标签。
 *
 * 解析顺序：
 * 1. 用户自定义绑定（useShortcutStore.bindings[actionId].keys）
 * 2. DEFAULT_SHORTCUTS 中的 defaultKeys
 * 3. 都没有则返回 null
 *
 * 平台自动检测：基于 navigator.platform / navigator.userAgent，SSR 安全。
 * 可通过 options.platform 显式指定以覆盖自动检测。
 *
 * 返回值经 useMemo 缓存，避免每帧重建字符串导致消费者 re-render。
 */
export function useShortcutLabel(
  actionId: string,
  options?: UseShortcutLabelOptions,
): string | null {
  const platform = options?.platform ?? detectPlatform();
  const binding = useShortcutStore((state) => state.bindings[actionId]);

  return useMemo(() => {
    let keys: ShortcutKey | undefined;
    if (binding?.keys) {
      keys = binding.keys;
    } else {
      const shortcut = DEFAULT_SHORTCUTS.find((s) => s.id === actionId);
      keys = shortcut?.defaultKeys;
    }
    if (!keys) return null;
    return formatShortcutKeys(keys, platform);
  }, [actionId, binding, platform]);
}
