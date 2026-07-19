/**
 * @vitest-environment node
 *
 * shellHandlers 单元测试 (R19 Task 21)
 *
 * 测试策略：
 * - 使用 mockElectron() + vi.mock('electron') 替换 electron 模块
 * - 通过 captureHandlers() 捕获 ipcMain.handle 调用获取 handler 函数
 * - mock shell.openExternal 控制成功/失败路径
 * - 验证 URL 校验逻辑（http/https 白名单）
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockElectron,
  callIpcHandler,
  type IpcHandler,
} from "../../../tests/helpers/electronMock";

const electronMock = mockElectron();

import { registerShellHandlers } from "../shellHandlers";

function captureHandlers(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>();
  for (const call of electronMock.ipcMain.handle.mock.calls) {
    const [channel, handler] = call as [string, IpcHandler];
    handlers.set(channel, handler);
  }
  return handlers;
}

describe("shellHandlers", () => {
  let handlers: Map<string, IpcHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    registerShellHandlers();
    handlers = captureHandlers();
  });

  it("应该注册 shell:openExternal channel", () => {
    expect(handlers.has("shell:openExternal")).toBe(true);
  });

  describe("shell:openExternal", () => {
    it("http:// URL 应调用 shell.openExternal 并返回 success", async () => {
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, "http://example.com");
      expect(electronMock.shell.openExternal).toHaveBeenCalledWith("http://example.com");
      expect(result).toEqual({ success: true });
    });

    it("https:// URL 应调用 shell.openExternal 并返回 success", async () => {
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, "https://example.com");
      expect(electronMock.shell.openExternal).toHaveBeenCalledWith("https://example.com");
      expect(result).toEqual({ success: true });
    });

    it("file:// URL 应拒绝（仅允许 http/https）", async () => {
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, "file:///etc/passwd");
      expect(electronMock.shell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: "Only http:// and https:// URLs are allowed" });
    });

    it("javascript: URL 应拒绝", async () => {
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, "javascript:alert(1)");
      expect(electronMock.shell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: "Only http:// and https:// URLs are allowed" });
    });

    it("非字符串 URL 应拒绝", async () => {
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, 123);
      expect(result).toEqual({ success: false, error: "Invalid URL type" });
    });

    it("shell.openExternal 抛错时应返回失败", async () => {
      electronMock.shell.openExternal.mockRejectedValueOnce(new Error("System denied"));
      const result = await callIpcHandler(handlers, "shell:openExternal", {}, "https://example.com");
      expect(result).toEqual({ success: false, error: "System denied" });
    });
  });
});
