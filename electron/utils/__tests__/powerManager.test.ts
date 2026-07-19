/**
 * @vitest-environment node
 *
 * powerManager 单元测试 (R19 Task 22)
 *
 * 测试策略：
 * - 使用 mockElectron() 替换 electron 模块
 * - electronMock 默认不提供 powerSaveBlocker，通过 Object.assign 在测试文件内扩展
 *   （vi.mock('electron') 工厂返回的是同一个 electronMockHolder.instance 对象，
 *    在 mockElectron() 之后、import powerManager 之前 Object.assign 即可让
 *    powerManager 内部 `import { powerSaveBlocker } from 'electron'` 拿到 mock）
 * - mock logger 以避免 warn/info/error 路径日志污染测试
 * - 每个 beforeEach 调用 resetAllBlockers 清空模块级 Map，保证测试独立性
 *
 * 覆盖范围：
 * - startBlocker (调用 powerSaveBlocker.start / 幂等 / 多 reason / 抛错)
 * - stopBlocker (调用 powerSaveBlocker.stop / 不存在 reason 幂等)
 * - getActiveReasons (空 / 多个 reason)
 * - resetAllBlockers (停止所有 / 空时不调用 stop)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockElectron,
} from "../../../tests/helpers/electronMock";

// ============================================================
// Mock 注册：必须在 import 触发 electron 的模块之前完成
// ============================================================
const electronMock = mockElectron();

// powerSaveBlocker mock 定义（独立变量，便于测试中直接访问）
const powerSaveBlocker = {
  start: vi.fn(() => 1),
  stop: vi.fn(),
  isStarted: vi.fn(() => true),
};

// electronMock 默认未提供 powerSaveBlocker，通过 Object.assign 扩展。
// vi.mock('electron') 工厂返回 electronMockHolder.instance（即 electronMock），
// 在 mockElectron() 之后、powerManager 模块加载之前注入 powerSaveBlocker，
// 即可使 powerManager.ts 内 `import { powerSaveBlocker } from 'electron'` 拿到此 mock。
Object.assign(electronMock, { powerSaveBlocker });

// Mock logger 以避免 warn/info/error 路径日志污染测试输出
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  startBlocker,
  stopBlocker,
  getActiveReasons,
  resetAllBlockers,
} from "../powerManager";

// ============================================================
// 测试组
// ============================================================
describe("powerManager", () => {
  beforeEach(() => {
    // 先清空模块级 activeBlockers Map（会调用 powerSaveBlocker.stop 清理残留 blocker）
    resetAllBlockers();
    // 然后清空所有 mock 状态（包括上面 resetAllBlockers 触发的 stop 调用）
    vi.clearAllMocks();
    // 重置默认实现（clearAllMocks 不重置 mockReturnValue/mockImplementation）
    powerSaveBlocker.start.mockImplementation(() => 1);
    powerSaveBlocker.stop.mockImplementation(() => undefined);
    powerSaveBlocker.isStarted.mockImplementation(() => true);
  });

  // ============================================================
  // 1. startBlocker
  // ============================================================
  describe("startBlocker", () => {
    it("应该调用 powerSaveBlocker.start('prevent-display-sleep')", () => {
      startBlocker("study");
      expect(powerSaveBlocker.start).toHaveBeenCalledWith(
        "prevent-display-sleep",
      );
      expect(powerSaveBlocker.start).toHaveBeenCalledTimes(1);
    });

    it("启动后 reason 应出现在 getActiveReasons 中", () => {
      startBlocker("study");
      expect(getActiveReasons()).toContain("study");
      expect(getActiveReasons()).toHaveLength(1);
    });

    it("重复以同一 reason 调用不应创建新 blocker（幂等）", () => {
      startBlocker("study");
      startBlocker("study");
      expect(powerSaveBlocker.start).toHaveBeenCalledTimes(1);
      expect(getActiveReasons()).toHaveLength(1);
    });

    it("不同 reason 应创建独立 blocker", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1).mockReturnValueOnce(2);
      startBlocker("study");
      startBlocker("sync");
      expect(powerSaveBlocker.start).toHaveBeenCalledTimes(2);
      const reasons = getActiveReasons();
      expect(reasons).toHaveLength(2);
      expect(reasons).toContain("study");
      expect(reasons).toContain("sync");
    });

    it("powerSaveBlocker.start 抛错时应重新抛出且不加入 activeBlockers", () => {
      powerSaveBlocker.start.mockImplementationOnce(() => {
        throw new Error("start failed");
      });
      expect(() => startBlocker("error-case")).toThrow("start failed");
      expect(getActiveReasons()).not.toContain("error-case");
      expect(getActiveReasons()).toHaveLength(0);
    });
  });

  // ============================================================
  // 2. stopBlocker
  // ============================================================
  describe("stopBlocker", () => {
    it("应该调用 powerSaveBlocker.stop(blockerId)", () => {
      powerSaveBlocker.start.mockReturnValueOnce(42);
      startBlocker("study");
      stopBlocker("study");
      expect(powerSaveBlocker.stop).toHaveBeenCalledWith(42);
      expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
      expect(getActiveReasons()).not.toContain("study");
    });

    it("不存在的 reason 不应抛错（幂等）", () => {
      expect(() => stopBlocker("nonexistent")).not.toThrow();
      expect(powerSaveBlocker.stop).not.toHaveBeenCalled();
    });

    it("停止后再启动同一 reason 应创建新 blocker", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1);
      startBlocker("study");
      stopBlocker("study");
      powerSaveBlocker.start.mockReturnValueOnce(2);
      startBlocker("study");
      expect(powerSaveBlocker.start).toHaveBeenCalledTimes(2);
      expect(getActiveReasons()).toContain("study");
    });
  });

  // ============================================================
  // 3. getActiveReasons
  // ============================================================
  describe("getActiveReasons", () => {
    it("无活跃 blocker 时应返回空数组", () => {
      expect(getActiveReasons()).toEqual([]);
    });

    it("应返回当前活跃的 reason 数组", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1).mockReturnValueOnce(2);
      startBlocker("study");
      startBlocker("sync");
      const reasons = getActiveReasons();
      expect(reasons).toHaveLength(2);
      expect(reasons).toContain("study");
      expect(reasons).toContain("sync");
    });

    it("停止 blocker 后应从数组中移除", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1).mockReturnValueOnce(2);
      startBlocker("study");
      startBlocker("sync");
      stopBlocker("study");
      const reasons = getActiveReasons();
      expect(reasons).toHaveLength(1);
      expect(reasons).toContain("sync");
      expect(reasons).not.toContain("study");
    });
  });

  // ============================================================
  // 4. resetAllBlockers
  // ============================================================
  describe("resetAllBlockers", () => {
    it("应停止所有活跃 blocker 并清空 Map", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1).mockReturnValueOnce(2);
      startBlocker("study");
      startBlocker("sync");
      resetAllBlockers();
      expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(2);
      expect(powerSaveBlocker.stop).toHaveBeenCalledWith(1);
      expect(powerSaveBlocker.stop).toHaveBeenCalledWith(2);
      expect(getActiveReasons()).toEqual([]);
    });

    it("无活跃 blocker 时不应调用 stop", () => {
      resetAllBlockers();
      expect(powerSaveBlocker.stop).not.toHaveBeenCalled();
    });

    it("reset 后可重新启动 blocker", () => {
      powerSaveBlocker.start.mockReturnValueOnce(1);
      startBlocker("study");
      resetAllBlockers();
      powerSaveBlocker.start.mockReturnValueOnce(2);
      startBlocker("study");
      expect(getActiveReasons()).toContain("study");
      expect(getActiveReasons()).toHaveLength(1);
    });
  });
});
