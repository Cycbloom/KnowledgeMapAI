/**
 * @vitest-environment node
 *
 * powerHandlers 单元测试 (R19 Task 22)
 *
 * 测试策略：
 * - 使用 mockElectron() 替换 electron 模块
 * - mock powerManager 模块以隔离测试，仅验证 handler 调用 powerManager 的方式
 * - 通过捕获 ipcMain.handle 调用获取 handler 函数
 * - mock logger 以避免错误路径日志污染测试
 *
 * 覆盖范围：
 * - power:startBlocker (成功 / 非字符串 reason / 空字符串 reason / 抛错)
 * - power:stopBlocker (成功 / 非字符串 reason / 空字符串 reason / 抛错)
 * - power:getActiveReasons (有活跃 / 无活跃)
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

// Mock powerManager 模块以隔离测试 handler 逻辑
vi.mock("../../utils/powerManager", () => ({
  startBlocker: vi.fn(),
  stopBlocker: vi.fn(),
  getActiveReasons: vi.fn(() => []),
  resetAllBlockers: vi.fn(),
}));

import { registerPowerHandlers } from "../powerHandlers";
import {
  startBlocker,
  stopBlocker,
  getActiveReasons,
} from "../../utils/powerManager";

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
describe("powerHandlers", () => {
  let handlers: Map<string, IpcHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置默认实现
    vi.mocked(getActiveReasons).mockReturnValue([]);
    registerPowerHandlers();
    handlers = captureHandlers();
  });

  describe("handler 注册", () => {
    it("应该注册 3 个 channel", () => {
      expect(handlers.has("power:startBlocker")).toBe(true);
      expect(handlers.has("power:stopBlocker")).toBe(true);
      expect(handlers.has("power:getActiveReasons")).toBe(true);
    });
  });

  describe("power:startBlocker", () => {
    it("成功时应返回 success:true 并调用 startBlocker", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:startBlocker",
        mockEvent,
        "study",
      );
      expect(result).toEqual({ success: true });
      expect(startBlocker).toHaveBeenCalledWith("study");
      expect(startBlocker).toHaveBeenCalledTimes(1);
    });

    it("非字符串 reason 应返回 success:false 且不调用 startBlocker", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:startBlocker",
        mockEvent,
        123,
      );
      expect(result).toEqual({
        success: false,
        error: "reason must be a non-empty string",
      });
      expect(startBlocker).not.toHaveBeenCalled();
    });

    it("空字符串 reason 应返回 success:false", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:startBlocker",
        mockEvent,
        "",
      );
      expect(result).toEqual({
        success: false,
        error: "reason must be a non-empty string",
      });
      expect(startBlocker).not.toHaveBeenCalled();
    });

    it("纯空白字符 reason 应返回 success:false", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:startBlocker",
        mockEvent,
        "   ",
      );
      expect(result).toEqual({
        success: false,
        error: "reason must be a non-empty string",
      });
      expect(startBlocker).not.toHaveBeenCalled();
    });

    it("startBlocker 抛错时应返回 success:false 与错误信息", async () => {
      vi.mocked(startBlocker).mockImplementationOnce(() => {
        throw new Error("start failed");
      });
      const result = await callIpcHandler(
        handlers,
        "power:startBlocker",
        mockEvent,
        "study",
      );
      expect(result).toEqual({ success: false, error: "start failed" });
    });
  });

  describe("power:stopBlocker", () => {
    it("成功时应返回 success:true 并调用 stopBlocker", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:stopBlocker",
        mockEvent,
        "study",
      );
      expect(result).toEqual({ success: true });
      expect(stopBlocker).toHaveBeenCalledWith("study");
      expect(stopBlocker).toHaveBeenCalledTimes(1);
    });

    it("非字符串 reason 应返回 success:false 且不调用 stopBlocker", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:stopBlocker",
        mockEvent,
        null,
      );
      expect(result).toEqual({
        success: false,
        error: "reason must be a non-empty string",
      });
      expect(stopBlocker).not.toHaveBeenCalled();
    });

    it("空字符串 reason 应返回 success:false", async () => {
      const result = await callIpcHandler(
        handlers,
        "power:stopBlocker",
        mockEvent,
        "",
      );
      expect(result).toEqual({
        success: false,
        error: "reason must be a non-empty string",
      });
      expect(stopBlocker).not.toHaveBeenCalled();
    });

    it("stopBlocker 抛错时应返回 success:false 与错误信息", async () => {
      vi.mocked(stopBlocker).mockImplementationOnce(() => {
        throw new Error("stop failed");
      });
      const result = await callIpcHandler(
        handlers,
        "power:stopBlocker",
        mockEvent,
        "study",
      );
      expect(result).toEqual({ success: false, error: "stop failed" });
    });
  });

  describe("power:getActiveReasons", () => {
    it("应返回当前活跃的 reason 数组", async () => {
      vi.mocked(getActiveReasons).mockReturnValueOnce(["study", "sync"]);
      const result = await callIpcHandler(
        handlers,
        "power:getActiveReasons",
        mockEvent,
      );
      expect(result).toEqual({ reasons: ["study", "sync"] });
      expect(getActiveReasons).toHaveBeenCalledTimes(1);
    });

    it("无活跃 blocker 时应返回空数组", async () => {
      vi.mocked(getActiveReasons).mockReturnValueOnce([]);
      const result = await callIpcHandler(
        handlers,
        "power:getActiveReasons",
        mockEvent,
      );
      expect(result).toEqual({ reasons: [] });
    });
  });
});
