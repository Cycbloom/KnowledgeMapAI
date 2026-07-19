import { app, BrowserWindow, screen } from "electron";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const STATE_FILENAME = "window-state.json";
const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

function getStateFilePath(): string {
  return path.join(app.getPath("userData"), STATE_FILENAME);
}

/** Type guard: validate that an unknown value matches the WindowState shape. */
function isWindowState(value: unknown): value is WindowState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.width === "number" &&
    typeof v.height === "number" &&
    typeof v.isMaximized === "boolean"
  );
}

/** Check whether two axis-aligned rectangles overlap. */
function boundsIntersect(
  winBounds: { x: number; y: number; width: number; height: number },
  displayBounds: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    winBounds.x < displayBounds.x + displayBounds.width &&
    winBounds.x + winBounds.width > displayBounds.x &&
    winBounds.y < displayBounds.y + displayBounds.height &&
    winBounds.y + winBounds.height > displayBounds.y
  );
}

/** Verify the window bounds intersect at least one currently-attached display. */
function isWithinAnyDisplay(state: WindowState): boolean {
  const displays = screen.getAllDisplays();
  if (displays.length === 0) {
    return false;
  }
  const winBounds = {
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
  };
  return displays.some((display) => boundsIntersect(winBounds, display.bounds));
}

/** 读取持久化的窗口状态。文件不存在/损坏/bounds 不在屏幕内时返回 null。 */
export function loadWindowState(): WindowState | null {
  const filePath = getStateFilePath();

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    // File does not exist (first launch) or is unreadable — treat as fresh.
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.warn("[windowStateManager] 无法解析窗口状态文件", e);
    return null;
  }

  if (!isWindowState(parsed)) {
    return null;
  }

  if (parsed.width < MIN_WIDTH || parsed.height < MIN_HEIGHT) {
    return null;
  }

  if (!isWithinAnyDisplay(parsed)) {
    return null;
  }

  return parsed;
}

/** 同步保存窗口当前 bounds 与 maximized 状态到磁盘（原子写）。 */
export function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  const filePath = getStateFilePath();
  const isMaximized = window.isMaximized();

  let state: WindowState;
  if (isMaximized) {
    // Persisted bounds should reflect the user's normal (restored) window
    // size, not the maximized full-screen dimensions. Reuse the last saved
    // bounds; only flip the maximized flag to true. If no prior state exists,
    // fall back to getNormalBounds() which returns the restored bounds even
    // while the window is currently maximized.
    let existing: WindowState | null = null;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (isWindowState(parsed)) {
        existing = parsed;
      }
    } catch (e) {
      logger.warn(
        "[windowStateManager] 读取现有状态失败，将使用 normalBounds",
        e,
      );
    }

    if (existing) {
      state = { ...existing, isMaximized: true };
    } else {
      const normalBounds = window.getNormalBounds();
      state = {
        x: normalBounds.x,
        y: normalBounds.y,
        width: normalBounds.width,
        height: normalBounds.height,
        isMaximized: true,
      };
    }
  } else {
    const bounds = window.getBounds();
    state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    };
  }

  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    logger.warn("[windowStateManager] 保存窗口状态失败", e);
  }
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: NodeJS.Timeout | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/** 监听窗口 resize/move/unmaximize/close 事件以自动持久化。返回 unsubscribe 函数。 */
export function trackWindowState(window: BrowserWindow): () => void {
  const debouncedSave = debounce(() => saveWindowState(window), 500);

  const onChange = (): void => {
    debouncedSave();
  };
  const onClose = (): void => {
    // Synchronous save before the window closes — bypasses debounce to
    // guarantee the latest state is flushed to disk.
    saveWindowState(window);
  };

  window.on("resize", onChange);
  window.on("move", onChange);
  window.on("maximize", onChange);
  window.on("unmaximize", onChange);
  window.on("close", onClose);

  return () => {
    window.removeListener("resize", onChange);
    window.removeListener("move", onChange);
    window.removeListener("maximize", onChange);
    window.removeListener("unmaximize", onChange);
    window.removeListener("close", onClose);
  };
}
