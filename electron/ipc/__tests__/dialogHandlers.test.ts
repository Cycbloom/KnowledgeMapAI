/**
 * @vitest-environment node
 *
 * dialogHandlers 单元测试 (R19 Task 22)
 *
 * 测试策略：
 * - 使用 mockElectron() 替换 electron 模块，隔离 dialog API
 * - 通过捕获 ipcMain.handle 调用获取 handler 函数，直接调用以测试逻辑
 * - mock logger 以避免错误路径的日志输出污染测试
 * - getMainWindow 返回 null 触发无 parent 分支（dialog.showXxx(options)）
 *
 * 覆盖范围：
 * - dialog:showSaveDialog (成功 / 抛错)
 * - dialog:showOpenDialog (成功 / 抛错)
 * - dialog:showMessageBox (成功 / 抛错)
 * - dialog:showErrorBox (成功 / 非字符串参数 / 抛错)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockElectron,
  callIpcHandler,
  type IpcHandler,
} from "../../../tests/helpers/electronMock";

// ============================================================
// Mock 注册：必须在 import 触发 electron 的模块之前完成
// ============================================================
const electronMock = mockElectron();

// Mock logger 以避免错误路径日志污染测试输出
vi.mock("../../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { registerDialogHandlers } from "../dialogHandlers";

// ============================================================
// 工具：从 ipcMain.handle 调用中捕获 handler 注册表
// ============================================================
function captureHandlers(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>();
  for (const call of electronMock.ipcMain.handle.mock.calls) {
    const [channel, handler] = call as [string, IpcHandler];
    handlers.set(channel, handler);
  }
  return handlers;
}

const mockEvent = { sender: { send: vi.fn() } };

// ============================================================
// 测试组
// ============================================================
describe("dialogHandlers", () => {
  let handlers: Map<string, IpcHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    // getMainWindow 返回 null 触发无 parent 分支
    registerDialogHandlers({ getMainWindow: () => null });
    handlers = captureHandlers();
  });

  describe("handler 注册", () => {
    it("应该注册 4 个 channel", () => {
      expect(handlers.has("dialog:showSaveDialog")).toBe(true);
      expect(handlers.has("dialog:showOpenDialog")).toBe(true);
      expect(handlers.has("dialog:showMessageBox")).toBe(true);
      expect(handlers.has("dialog:showErrorBox")).toBe(true);
    });
  });

  describe("dialog:showSaveDialog", () => {
    it("成功时应返回 canceled 与 filePath", async () => {
      electronMock.dialog.showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: "/tmp/test.txt",
      });
      const result = await callIpcHandler(
        handlers,
        "dialog:showSaveDialog",
        mockEvent,
        { defaultPath: "test.txt" },
      );
      expect(result).toEqual({ canceled: false, filePath: "/tmp/test.txt" });
      expect(electronMock.dialog.showSaveDialog).toHaveBeenCalledTimes(1);
    });

    it("filePath 为 undefined 时应规范化为 null", async () => {
      electronMock.dialog.showSaveDialog.mockResolvedValueOnce({
        canceled: true,
        filePath: undefined,
      });
      const result = await callIpcHandler(
        handlers,
        "dialog:showSaveDialog",
        mockEvent,
        {},
      );
      expect(result).toEqual({ canceled: true, filePath: null });
    });

    it("dialog 抛错时应返回 canceled:true, filePath:null", async () => {
      electronMock.dialog.showSaveDialog.mockRejectedValueOnce(
        new Error("dialog error"),
      );
      const result = await callIpcHandler(
        handlers,
        "dialog:showSaveDialog",
        mockEvent,
        {},
      );
      expect(result).toEqual({ canceled: true, filePath: null });
    });
  });

  describe("dialog:showOpenDialog", () => {
    it("成功时应返回 canceled 与 filePaths", async () => {
      electronMock.dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/tmp/a.txt", "/tmp/b.txt"],
      });
      const result = await callIpcHandler(
        handlers,
        "dialog:showOpenDialog",
        mockEvent,
        { properties: ["openFile"] },
      );
      expect(result).toEqual({
        canceled: false,
        filePaths: ["/tmp/a.txt", "/tmp/b.txt"],
      });
      expect(electronMock.dialog.showOpenDialog).toHaveBeenCalledTimes(1);
    });

    it("dialog 抛错时应返回 canceled:true, filePaths:[]", async () => {
      electronMock.dialog.showOpenDialog.mockRejectedValueOnce(
        new Error("dialog error"),
      );
      const result = await callIpcHandler(
        handlers,
        "dialog:showOpenDialog",
        mockEvent,
        {},
      );
      expect(result).toEqual({ canceled: true, filePaths: [] });
    });
  });

  describe("dialog:showMessageBox", () => {
    it("成功时应返回 response 与 checkboxChecked", async () => {
      electronMock.dialog.showMessageBox.mockResolvedValueOnce({
        response: 1,
        checkboxChecked: true,
      });
      const result = await callIpcHandler(
        handlers,
        "dialog:showMessageBox",
        mockEvent,
        { message: "hello" },
      );
      expect(result).toEqual({ response: 1, checkboxChecked: true });
      expect(electronMock.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    });

    it("dialog 抛错时应返回 response:-1, checkboxChecked:false", async () => {
      electronMock.dialog.showMessageBox.mockRejectedValueOnce(
        new Error("dialog error"),
      );
      const result = await callIpcHandler(
        handlers,
        "dialog:showMessageBox",
        mockEvent,
        {},
      );
      expect(result).toEqual({ response: -1, checkboxChecked: false });
    });
  });

  describe("dialog:showErrorBox", () => {
    it("成功时应返回 success:true 并调用 showErrorBox", async () => {
      const result = await callIpcHandler(
        handlers,
        "dialog:showErrorBox",
        mockEvent,
        "title",
        "content",
      );
      expect(result).toEqual({ success: true });
      expect(electronMock.dialog.showErrorBox).toHaveBeenCalledWith(
        "title",
        "content",
      );
    });

    it("title 非字符串时应返回 success:false 且不调用 showErrorBox", async () => {
      const result = await callIpcHandler(
        handlers,
        "dialog:showErrorBox",
        mockEvent,
        123,
        "content",
      );
      expect(result).toEqual({ success: false });
      expect(electronMock.dialog.showErrorBox).not.toHaveBeenCalled();
    });

    it("content 非字符串时应返回 success:false 且不调用 showErrorBox", async () => {
      const result = await callIpcHandler(
        handlers,
        "dialog:showErrorBox",
        mockEvent,
        "title",
        null,
      );
      expect(result).toEqual({ success: false });
      expect(electronMock.dialog.showErrorBox).not.toHaveBeenCalled();
    });

    it("showErrorBox 抛错时应返回 success:false", async () => {
      electronMock.dialog.showErrorBox.mockImplementationOnce(() => {
        throw new Error("show error failed");
      });
      const result = await callIpcHandler(
        handlers,
        "dialog:showErrorBox",
        mockEvent,
        "title",
        "content",
      );
      expect(result).toEqual({ success: false });
    });
  });
});
