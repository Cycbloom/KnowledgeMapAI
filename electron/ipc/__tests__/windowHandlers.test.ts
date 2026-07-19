/**
 * @vitest-environment node
 *
 * windowHandlers 单元测试 (R19 Task 21)
 *
 * 测试策略：
 * - 使用 mockElectron() + vi.mock('electron') 替换 electron 模块
 * - 通过 captureHandlers() 捕获 ipcMain.handle 调用获取 handler 函数
 * - mock deps.getMainWindow() 返回可控的 BrowserWindow mock
 * - 验证 handler 是否调用了正确的方法（minimize/maximize/unmaximize/close）
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockElectron,
  callIpcHandler,
  type IpcHandler,
} from "../../../tests/helpers/electronMock";

const electronMock = mockElectron();

import { registerWindowHandlers } from "../windowHandlers";

function captureHandlers(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>();
  for (const call of electronMock.ipcMain.handle.mock.calls) {
    const [channel, handler] = call as [string, IpcHandler];
    handlers.set(channel, handler);
  }
  return handlers;
}

describe("windowHandlers", () => {
  let handlers: Map<string, IpcHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    registerWindowHandlers({ getMainWindow: () => null }); // 默认返回 null
    handlers = captureHandlers();
  });

  it("应该注册 3 个 channel", () => {
    expect(handlers.has("window:minimize")).toBe(true);
    expect(handlers.has("window:maximize")).toBe(true);
    expect(handlers.has("window:close")).toBe(true);
  });

  describe("window:minimize", () => {
    it("mainWindow 存在时应调用 minimize()", async () => {
      const minimizeSpy = vi.fn();
      registerWindowHandlers({
        getMainWindow: () => ({ minimize: minimizeSpy } as unknown as ReturnType<typeof electronMock.BrowserWindow>),
      });
      handlers = captureHandlers();
      await callIpcHandler(handlers, "window:minimize", {});
      expect(minimizeSpy).toHaveBeenCalledTimes(1);
    });

    it("mainWindow 为 null 时不应抛错", async () => {
      await expect(callIpcHandler(handlers, "window:minimize", {})).resolves.toBeUndefined();
    });
  });

  describe("window:maximize", () => {
    it("未最大化时应调用 maximize()", async () => {
      const maximizeSpy = vi.fn();
      const unmaximizeSpy = vi.fn();
      registerWindowHandlers({
        getMainWindow: () => ({
          isMaximized: () => false,
          maximize: maximizeSpy,
          unmaximize: unmaximizeSpy,
        } as unknown as ReturnType<typeof electronMock.BrowserWindow>),
      });
      handlers = captureHandlers();
      await callIpcHandler(handlers, "window:maximize", {});
      expect(maximizeSpy).toHaveBeenCalledTimes(1);
      expect(unmaximizeSpy).not.toHaveBeenCalled();
    });

    it("已最大化时应调用 unmaximize()", async () => {
      const maximizeSpy = vi.fn();
      const unmaximizeSpy = vi.fn();
      registerWindowHandlers({
        getMainWindow: () => ({
          isMaximized: () => true,
          maximize: maximizeSpy,
          unmaximize: unmaximizeSpy,
        } as unknown as ReturnType<typeof electronMock.BrowserWindow>),
      });
      handlers = captureHandlers();
      await callIpcHandler(handlers, "window:maximize", {});
      expect(unmaximizeSpy).toHaveBeenCalledTimes(1);
      expect(maximizeSpy).not.toHaveBeenCalled();
    });

    it("mainWindow 为 null 时不应抛错", async () => {
      await expect(callIpcHandler(handlers, "window:maximize", {})).resolves.toBeUndefined();
    });
  });

  describe("window:close", () => {
    it("mainWindow 存在时应调用 close()", async () => {
      const closeSpy = vi.fn();
      registerWindowHandlers({
        getMainWindow: () => ({ close: closeSpy } as unknown as ReturnType<typeof electronMock.BrowserWindow>),
      });
      handlers = captureHandlers();
      await callIpcHandler(handlers, "window:close", {});
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it("mainWindow 为 null 时不应抛错", async () => {
      await expect(callIpcHandler(handlers, "window:close", {})).resolves.toBeUndefined();
    });
  });
});
