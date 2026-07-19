/**
 * @vitest-environment node
 *
 * windowStateManager 单元测试 (R19 Task 22)
 *
 * 测试策略：
 * - 使用 mockElectron() 替换 electron 模块（app/screen/BrowserWindow）
 * - mock fs 模块以测试文件读写场景（不存在/损坏 JSON/原子写）
 * - mock logger 以避免 warn/error 路径日志污染测试
 * - 自定义 FakeWindow 对象模拟 BrowserWindow 的方法（isDestroyed/isMaximized/getBounds/getNormalBounds/on/removeListener）
 *
 * 覆盖范围：
 * - loadWindowState (文件不存在 / JSON 损坏 / 字段缺失 / width<MIN / height<MIN / 屏幕外 / 正常)
 * - saveWindowState (isDestroyed / 非最大化保存 bounds / 最大化保留原 bounds / 最大化无原 state 用 getNormalBounds / 原子写)
 * - trackWindowState (返回 unsubscribe / 监听 5 个事件 / unsubscribe 移除监听)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockElectron,
} from "../../../tests/helpers/electronMock";

// ============================================================
// Mock 注册：必须在 import 触发 electron 的模块之前完成
// ============================================================
const electronMock = mockElectron();

// Mock fs 模块以测试文件读写场景
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

// Mock logger 以避免 warn/error 路径日志污染测试输出
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as fs from "fs";
import {
  loadWindowState,
  saveWindowState,
  trackWindowState,
  type WindowState,
} from "../windowStateManager";

// ============================================================
// 类型定义：模拟 BrowserWindow 的最小子集
// ============================================================
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FakeWindow {
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  isMaximized: ReturnType<typeof vi.fn>;
  getBounds: ReturnType<typeof vi.fn>;
  getNormalBounds: ReturnType<typeof vi.fn>;
}

function createFakeWindow(overrides: Partial<FakeWindow> = {}): FakeWindow {
  return {
    on: vi.fn(),
    removeListener: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1400, height: 900 })),
    getNormalBounds: vi.fn(() => ({ x: 0, y: 0, width: 1400, height: 900 })),
    ...overrides,
  };
}

/** 设置 screen.getAllDisplays 返回值 */
function setDisplays(
  displays: Array<{ bounds: Bounds }>,
): void {
  electronMock.screen.getAllDisplays.mockReturnValue(displays);
}

// ============================================================
// 测试数据
// ============================================================
const VALID_STATE: WindowState = {
  x: 100,
  y: 100,
  width: 1400,
  height: 900,
  isMaximized: false,
};

const DEFAULT_DISPLAY_BOUNDS: Bounds = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
};

// ============================================================
// 测试组
// ============================================================
describe("windowStateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认提供一个 display，bounds 覆盖 (0,0)~(1920,1080)
    setDisplays([{ bounds: DEFAULT_DISPLAY_BOUNDS }]);
  });

  // ============================================================
  // 1. loadWindowState
  // ============================================================
  describe("loadWindowState", () => {
    it("文件不存在（readFileSync 抛错）时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
        throw new Error("ENOENT");
      });
      expect(loadWindowState()).toBeNull();
    });

    it("JSON 损坏时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce("invalid json {{{");
      expect(loadWindowState()).toBeNull();
    });

    it("字段缺失（缺少 height 与 isMaximized）时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify({ x: 0, y: 0, width: 1400 }),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("isMaximized 类型错误（非 boolean）时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify({
          x: 0,
          y: 0,
          width: 1400,
          height: 900,
          isMaximized: "true",
        }),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("width < MIN_WIDTH (800) 时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify({
          x: 0,
          y: 0,
          width: 600,
          height: 900,
          isMaximized: false,
        }),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("height < MIN_HEIGHT (600) 时应返回 null", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify({
          x: 0,
          y: 0,
          width: 1400,
          height: 400,
          isMaximized: false,
        }),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("bounds 不在任何屏幕内（displays 为空）时应返回 null", () => {
      setDisplays([]);
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify(VALID_STATE),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("bounds 不在任何屏幕内（坐标完全偏离）时应返回 null", () => {
      setDisplays([{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]);
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify({
          x: 5000,
          y: 5000,
          width: 1400,
          height: 900,
          isMaximized: false,
        }),
      );
      expect(loadWindowState()).toBeNull();
    });

    it("正常 state 应返回 parsed 对象", () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify(VALID_STATE),
      );
      const result = loadWindowState();
      expect(result).toEqual(VALID_STATE);
    });

    it("使用 app.getPath('userData') 拼接文件路径", () => {
      vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
        throw new Error("ENOENT");
      });
      electronMock.app.getPath.mockReturnValueOnce("/tmp/userdata");
      loadWindowState();
      expect(electronMock.app.getPath).toHaveBeenCalledWith("userData");
      const calledPath = vi.mocked(fs.readFileSync).mock.calls[0][0] as string;
      expect(calledPath).toContain("userdata");
      expect(calledPath).toContain("window-state.json");
    });
  });

  // ============================================================
  // 2. saveWindowState
  // ============================================================
  describe("saveWindowState", () => {
    it("window.isDestroyed() 为 true 时应直接返回不写入", () => {
      const win = createFakeWindow({ isDestroyed: vi.fn(() => true) });
      saveWindowState(win as unknown as Parameters<typeof saveWindowState>[0]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    it("非最大化时应保存当前 getBounds() 结果", () => {
      const bounds: Bounds = { x: 100, y: 200, width: 1400, height: 900 };
      const win = createFakeWindow({
        isMaximized: vi.fn(() => false),
        getBounds: vi.fn(() => bounds),
      });
      saveWindowState(win as unknown as Parameters<typeof saveWindowState>[0]);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [tmpPath, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      expect(tmpPath).toContain(".tmp");
      const parsed = JSON.parse(content) as WindowState;
      expect(parsed).toEqual({ ...bounds, isMaximized: false });
    });

    it("最大化且有现有 state 时应保留原 bounds 并标记 isMaximized:true", () => {
      const existingState: WindowState = {
        x: 100,
        y: 200,
        width: 1400,
        height: 900,
        isMaximized: false,
      };
      vi.mocked(fs.readFileSync).mockReturnValueOnce(
        JSON.stringify(existingState),
      );
      const win = createFakeWindow({
        isMaximized: vi.fn(() => true),
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 })),
        getNormalBounds: vi.fn(() => ({
          x: 999,
          y: 999,
          width: 999,
          height: 999,
        })),
      });
      saveWindowState(win as unknown as Parameters<typeof saveWindowState>[0]);
      expect(win.getNormalBounds).not.toHaveBeenCalled();
      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      const parsed = JSON.parse(content) as WindowState;
      expect(parsed).toEqual({ ...existingState, isMaximized: true });
    });

    it("最大化且无现有 state 时应使用 getNormalBounds()", () => {
      vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
        throw new Error("ENOENT");
      });
      const normalBounds: Bounds = {
        x: 100,
        y: 200,
        width: 1400,
        height: 900,
      };
      const win = createFakeWindow({
        isMaximized: vi.fn(() => true),
        getNormalBounds: vi.fn(() => normalBounds),
      });
      saveWindowState(win as unknown as Parameters<typeof saveWindowState>[0]);
      expect(win.getNormalBounds).toHaveBeenCalledTimes(1);
      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      const parsed = JSON.parse(content) as WindowState;
      expect(parsed).toEqual({ ...normalBounds, isMaximized: true });
    });

    it("应使用原子写（先写 .tmp 再 rename）", () => {
      const win = createFakeWindow();
      saveWindowState(win as unknown as Parameters<typeof saveWindowState>[0]);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.renameSync).toHaveBeenCalledTimes(1);
      const [tmpPath] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      const [renameFrom, renameTo] = vi.mocked(fs.renameSync).mock
        .calls[0] as [string, string];
      expect(tmpPath.endsWith(".tmp")).toBe(true);
      expect(renameFrom).toBe(tmpPath);
      expect(renameTo.endsWith(".tmp")).toBe(false);
      expect(renameTo).toContain("window-state.json");
    });

    it("写入异常时应被捕获（不抛出）", () => {
      vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
        throw new Error("disk full");
      });
      const win = createFakeWindow();
      expect(() =>
        saveWindowState(
          win as unknown as Parameters<typeof saveWindowState>[0],
        ),
      ).not.toThrow();
    });
  });

  // ============================================================
  // 3. trackWindowState
  // ============================================================
  describe("trackWindowState", () => {
    it("应返回 unsubscribe 函数", () => {
      const win = createFakeWindow();
      const unsubscribe = trackWindowState(
        win as unknown as Parameters<typeof trackWindowState>[0],
      );
      expect(typeof unsubscribe).toBe("function");
    });

    it("应监听 resize/move/maximize/unmaximize/close 事件", () => {
      const win = createFakeWindow();
      trackWindowState(
        win as unknown as Parameters<typeof trackWindowState>[0],
      );
      const registeredEvents = win.on.mock.calls.map(
        (call) => call[0] as string,
      );
      expect(registeredEvents).toContain("resize");
      expect(registeredEvents).toContain("move");
      expect(registeredEvents).toContain("maximize");
      expect(registeredEvents).toContain("unmaximize");
      expect(registeredEvents).toContain("close");
      expect(registeredEvents).toHaveLength(5);
    });

    it("unsubscribe 应移除所有监听器", () => {
      const win = createFakeWindow();
      const unsubscribe = trackWindowState(
        win as unknown as Parameters<typeof trackWindowState>[0],
      );
      unsubscribe();
      const removedEvents = win.removeListener.mock.calls.map(
        (call) => call[0] as string,
      );
      expect(removedEvents).toContain("resize");
      expect(removedEvents).toContain("move");
      expect(removedEvents).toContain("maximize");
      expect(removedEvents).toContain("unmaximize");
      expect(removedEvents).toContain("close");
      expect(removedEvents).toHaveLength(5);
    });
  });
});
