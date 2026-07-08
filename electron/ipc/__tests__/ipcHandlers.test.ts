/**
 * @vitest-environment node
 *
 * Electron IPC Handlers 单元测试 (Task 3.11)
 *
 * 测试策略：
 * - 使用 createElectronMock() + vi.mock('electron') 替换 electron 模块
 * - 通过捕获 ipcMain.handle 调用获取 handler 函数，直接调用以测试逻辑
 * - mock DatabaseManager / SyncEngine 等依赖，仅测试 handler 注册与逻辑
 * - mock fs 模块以测试 configHandlers 的文件读写场景
 * - mock logger 以避免 db:batch fallback 路径的日志输出
 *
 * 覆盖范围：
 * - app:getVersion, app:getPlatform, api:getPort, app:quit
 * - db:query (findAll/findById/create/update/delete/softDelete/count/getPendingPush + 未就绪/未知方法)
 * - db:batch (事务执行 + 未就绪 + 异常回滚)
 * - db:getStatus
 * - sync:getStatus, sync:trigger, sync:pause, sync:resume, sync:setAuthToken, sync:fullSync
 * - config:read (文件存在/不存在/解析错误), config:write (正常/目录创建/写入失败)
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

// 1) Mock electron 模块（使用 helper 函数，内部通过 vi.hoisted 确保 mock 可用）
const electronMock = mockElectron();

// 2) Mock fs 模块以测试 configHandlers 的文件读写
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// 3) Mock logger 模块以避免 db:batch fallback 路径的日志输出污染测试
vi.mock("../../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================
// 现在可以 import handler 模块（它们会使用上面的 mock）
// ============================================================
import * as fs from "fs";
import { registerAppHandlers } from "../appHandlers";
import { registerConfigHandlers } from "../configHandlers";
import {
  registerDbIpcHandlers,
  type IpcDbRequest,
  type IpcDbBatchRequest,
} from "../dbHandlers";
import { registerSyncHandlers } from "../syncHandlers";

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

// ============================================================
// Mock 工厂：DatabaseManager / SyncEngine
// ============================================================
interface MockDbManager {
  isReady: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  getPendingPush: ReturnType<typeof vi.fn>;
  countPendingPush: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

function createMockDbManager(): MockDbManager {
  return {
    isReady: vi.fn(() => true),
    findAll: vi.fn(() => []),
    findById: vi.fn(() => null),
    create: vi.fn(() => ({})),
    update: vi.fn(() => ({})),
    delete: vi.fn(() => true),
    softDelete: vi.fn(() => true),
    getPendingPush: vi.fn(() => []),
    countPendingPush: vi.fn(() => ({})),
    // 默认实现：直接执行传入函数（模拟事务提交）
    transaction: vi.fn(<T>(fn: () => T): T => fn()),
  };
}

interface MockSyncEngine {
  getStatus: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  setAuthToken: ReturnType<typeof vi.fn>;
  fullSync: ReturnType<typeof vi.fn>;
}

function createMockSyncEngine(): MockSyncEngine {
  return {
    getStatus: vi.fn(() => ({
      isRunning: false,
      isOnline: true,
      lastSyncAt: null,
      pendingPush: 0,
      pendingPull: 0,
      conflicts: 0,
    })),
    sync: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    start: vi.fn(),
    setAuthToken: vi.fn(),
    fullSync: vi.fn(() => Promise.resolve()),
  };
}

const mockEvent = { sender: { send: vi.fn() } };

// ============================================================
// 测试组
// ============================================================
describe("Electron IPC Handlers", () => {
  let handlers: Map<string, IpcHandler>;
  let dbManager: MockDbManager;
  let syncEngine: MockSyncEngine;
  let getPort: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 清理所有 mock 状态（不影响 mock 实现）
    vi.clearAllMocks();

    // 重置 electron mock 中被测试修改过的实现
    // vi.clearAllMocks() 只清理 calls/instances，不重置 mockReturnValue/mockImplementation
    electronMock.app.getPath.mockImplementation(
      (name: string) => `/tmp/electron-mock/${name}`,
    );
    electronMock.app.getVersion.mockReturnValue("0.0.0-test");

    // 重置 fs mock 默认行为
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue("");
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    // 创建新鲜的依赖 mock
    dbManager = createMockDbManager();
    syncEngine = createMockSyncEngine();
    getPort = vi.fn(() => 3001);

    // 注册所有 handler（每个 register 函数会调用 ipcMain.handle 多次）
    registerAppHandlers({ getPort });
    registerDbIpcHandlers(dbManager);
    registerSyncHandlers({ getSyncEngine: () => syncEngine });
    registerConfigHandlers();

    // 捕获 handler 注册表
    handlers = captureHandlers();
  });

  // ============================================================
  // 1. handler 注册正确性
  // ============================================================
  describe("handler 注册", () => {
    it("appHandlers 注册 4 个 channel", () => {
      expect(handlers.has("app:getVersion")).toBe(true);
      expect(handlers.has("app:getPlatform")).toBe(true);
      expect(handlers.has("api:getPort")).toBe(true);
      expect(handlers.has("app:quit")).toBe(true);
    });

    it("dbHandlers 注册 3 个 channel", () => {
      expect(handlers.has("db:query")).toBe(true);
      expect(handlers.has("db:batch")).toBe(true);
      expect(handlers.has("db:getStatus")).toBe(true);
    });

    it("syncHandlers 注册 6 个 channel", () => {
      expect(handlers.has("sync:getStatus")).toBe(true);
      expect(handlers.has("sync:trigger")).toBe(true);
      expect(handlers.has("sync:pause")).toBe(true);
      expect(handlers.has("sync:resume")).toBe(true);
      expect(handlers.has("sync:setAuthToken")).toBe(true);
      expect(handlers.has("sync:fullSync")).toBe(true);
    });

    it("configHandlers 注册 2 个 channel", () => {
      expect(handlers.has("config:read")).toBe(true);
      expect(handlers.has("config:write")).toBe(true);
    });
  });

  // ============================================================
  // 2. appHandlers 逻辑
  // ============================================================
  describe("appHandlers", () => {
    it("app:getVersion 返回 app.getVersion() 结果", async () => {
      electronMock.app.getVersion.mockReturnValue("1.2.3");
      const result = await callIpcHandler(handlers, "app:getVersion", mockEvent);
      expect(result).toBe("1.2.3");
      expect(electronMock.app.getVersion).toHaveBeenCalledTimes(1);
    });

    it("app:getPlatform 返回 process.platform", async () => {
      const result = await callIpcHandler(
        handlers,
        "app:getPlatform",
        mockEvent,
      );
      expect(result).toBe(process.platform);
    });

    it("api:getPort 返回 deps.getPort() 结果", async () => {
      getPort.mockReturnValue(8080);
      const result = await callIpcHandler(handlers, "api:getPort", mockEvent);
      expect(result).toBe(8080);
      expect(getPort).toHaveBeenCalledTimes(1);
    });

    it("app:quit 调用 app.quit()", async () => {
      await callIpcHandler(handlers, "app:quit", mockEvent);
      expect(electronMock.app.quit).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 3. dbHandlers 逻辑
  // ============================================================
  describe("dbHandlers - db:query", () => {
    it("findAll 方法调用 dbManager.findAll 并返回数据", async () => {
      const mockData = [{ id: "1", name: "test" }];
      dbManager.findAll.mockReturnValue(mockData);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "findAll",
        params: { filters: { graphId: "g1" } },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: mockData });
      expect(dbManager.findAll).toHaveBeenCalledWith("nodes", { graphId: "g1" });
    });

    it("findById 方法调用 dbManager.findById", async () => {
      const mockRecord = { id: "123", name: "node" };
      dbManager.findById.mockReturnValue(mockRecord);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "findById",
        params: { id: "123" },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: mockRecord });
      expect(dbManager.findById).toHaveBeenCalledWith("nodes", "123");
    });

    it("create 方法调用 dbManager.create", async () => {
      const mockCreated = { id: "new1", name: "new" };
      dbManager.create.mockReturnValue(mockCreated);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "create",
        params: { data: { name: "new" } },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: mockCreated });
      expect(dbManager.create).toHaveBeenCalledWith("nodes", { name: "new" });
    });

    it("update 方法调用 dbManager.update", async () => {
      const mockUpdated = { id: "1", name: "updated" };
      dbManager.update.mockReturnValue(mockUpdated);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "update",
        params: { id: "1", data: { name: "updated" } },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: mockUpdated });
      expect(dbManager.update).toHaveBeenCalledWith("nodes", "1", {
        name: "updated",
      });
    });

    it("delete 方法调用 dbManager.delete", async () => {
      dbManager.delete.mockReturnValue(true);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "delete",
        params: { id: "1" },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: true });
      expect(dbManager.delete).toHaveBeenCalledWith("nodes", "1");
    });

    it("softDelete 方法调用 dbManager.softDelete", async () => {
      dbManager.softDelete.mockReturnValue(true);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "softDelete",
        params: { id: "1" },
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: true });
      expect(dbManager.softDelete).toHaveBeenCalledWith("nodes", "1");
    });

    it("count 方法返回 findAll 结果的长度", async () => {
      dbManager.findAll.mockReturnValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "count",
        params: {},
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: 3 });
      expect(dbManager.findAll).toHaveBeenCalledWith("nodes");
    });

    it("getPendingPush 方法调用 dbManager.getPendingPush", async () => {
      const mockPending = [{ id: "1" }];
      dbManager.getPendingPush.mockReturnValue(mockPending);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "getPendingPush",
        params: {},
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: true, data: mockPending });
      expect(dbManager.getPendingPush).toHaveBeenCalledWith("nodes");
    });

    it("未知方法返回 success: false", async () => {
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "unknownMethod",
        params: {},
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({
        success: false,
        error: "Unknown method: unknownMethod",
      });
    });

    it("数据库未就绪时返回 'Database not initialized'", async () => {
      dbManager.isReady.mockReturnValue(false);
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "findAll",
        params: {},
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({
        success: false,
        error: "Database not initialized",
      });
      expect(dbManager.findAll).not.toHaveBeenCalled();
    });

    it("异常被捕获并返回 success: false", async () => {
      dbManager.findAll.mockImplementation(() => {
        throw new Error("DB error");
      });
      const request: IpcDbRequest = {
        resource: "nodes",
        method: "findAll",
        params: {},
      };
      const result = await callIpcHandler(handlers, "db:query", mockEvent, request);
      expect(result).toEqual({ success: false, error: "DB error" });
    });
  });

  describe("dbHandlers - db:batch", () => {
    it("通过 transaction 执行多个 create 操作", async () => {
      dbManager.create.mockReturnValueOnce({ id: "1" }).mockReturnValueOnce({ id: "2" });
      const request: IpcDbBatchRequest = {
        operations: [
          { resource: "nodes", method: "create", params: { data: { name: "a" } } },
          { resource: "nodes", method: "create", params: { data: { name: "b" } } },
        ],
      };
      const result = await callIpcHandler(handlers, "db:batch", mockEvent, request);
      expect(result).toEqual({
        success: true,
        data: [{ id: "1" }, { id: "2" }],
      });
      expect(dbManager.transaction).toHaveBeenCalledTimes(1);
      expect(dbManager.create).toHaveBeenCalledTimes(2);
    });

    it("支持 update/delete/softDelete 操作", async () => {
      dbManager.update.mockReturnValue({ id: "1", updated: true });
      dbManager.delete.mockReturnValue(true);
      dbManager.softDelete.mockReturnValue(true);
      const request: IpcDbBatchRequest = {
        operations: [
          { resource: "nodes", method: "update", params: { id: "1", data: {} } },
          { resource: "nodes", method: "delete", params: { id: "2" } },
          { resource: "nodes", method: "softDelete", params: { id: "3" } },
        ],
      };
      const result = await callIpcHandler(handlers, "db:batch", mockEvent, request);
      expect(result).toMatchObject({ success: true });
      expect(dbManager.update).toHaveBeenCalledWith("nodes", "1", {});
      expect(dbManager.delete).toHaveBeenCalledWith("nodes", "2");
      expect(dbManager.softDelete).toHaveBeenCalledWith("nodes", "3");
    });

    it("未知方法在结果数组中标记错误（不抛出）", async () => {
      const request: IpcDbBatchRequest = {
        operations: [
          { resource: "nodes", method: "unknownOp", params: {} },
        ],
      };
      const result = await callIpcHandler(handlers, "db:batch", mockEvent, request);
      expect(result).toEqual({
        success: true,
        data: [{ error: "Unknown method: unknownOp" }],
      });
    });

    it("数据库未就绪时返回 'Database not initialized'", async () => {
      dbManager.isReady.mockReturnValue(false);
      const request: IpcDbBatchRequest = {
        operations: [],
      };
      const result = await callIpcHandler(handlers, "db:batch", mockEvent, request);
      expect(result).toEqual({
        success: false,
        error: "Database not initialized",
      });
    });

    it("transaction 抛出异常时返回 success: false", async () => {
      dbManager.transaction.mockImplementation(() => {
        throw new Error("Transaction rolled back");
      });
      const request: IpcDbBatchRequest = {
        operations: [
          { resource: "nodes", method: "create", params: { data: {} } },
        ],
      };
      const result = await callIpcHandler(handlers, "db:batch", mockEvent, request);
      expect(result).toEqual({
        success: false,
        error: "Transaction rolled back",
      });
    });
  });

  describe("dbHandlers - db:getStatus", () => {
    it("返回数据库就绪状态和 pending push 计数", async () => {
      dbManager.countPendingPush.mockReturnValue({
        nodes: 3,
        edges: 1,
      });
      const result = await callIpcHandler(handlers, "db:getStatus", mockEvent);
      expect(result).toEqual({
        success: true,
        data: {
          isReady: true,
          pendingPushCounts: { nodes: 3, edges: 1 },
          totalPendingPush: 4,
        },
      });
    });

    it("数据库未就绪时返回错误", async () => {
      dbManager.isReady.mockReturnValue(false);
      const result = await callIpcHandler(handlers, "db:getStatus", mockEvent);
      expect(result).toEqual({
        success: false,
        error: "Database not initialized",
      });
    });

    it("countPendingPush 异常被捕获", async () => {
      dbManager.countPendingPush.mockImplementation(() => {
        throw new Error("Count failed");
      });
      const result = await callIpcHandler(handlers, "db:getStatus", mockEvent);
      expect(result).toEqual({ success: false, error: "Count failed" });
    });
  });

  // ============================================================
  // 4. syncHandlers 逻辑
  // ============================================================
  describe("syncHandlers", () => {
    it("sync:getStatus 返回 engine.getStatus() 结果", async () => {
      const status = {
        isRunning: true,
        isOnline: true,
        lastSyncAt: "2026-07-07T00:00:00Z",
        pendingPush: 5,
        pendingPull: 2,
        conflicts: 0,
      };
      syncEngine.getStatus.mockReturnValue(status);
      const result = await callIpcHandler(handlers, "sync:getStatus", mockEvent);
      expect(result).toEqual({ success: true, data: status });
    });

    it("sync:getStatus engine 为 null 时返回错误", async () => {
      // 重新注册一个返回 null 的 deps
      vi.clearAllMocks();
      registerSyncHandlers({ getSyncEngine: () => null });
      const localHandlers = captureHandlers();
      const result = await callIpcHandler(
        localHandlers,
        "sync:getStatus",
        mockEvent,
      );
      expect(result).toEqual({
        success: false,
        error: "Sync engine not initialized",
      });
    });

    it("sync:trigger 调用 engine.sync() 并返回 success", async () => {
      syncEngine.sync.mockResolvedValue(undefined);
      const result = await callIpcHandler(handlers, "sync:trigger", mockEvent);
      expect(result).toEqual({ success: true });
      expect(syncEngine.sync).toHaveBeenCalledTimes(1);
    });

    it("sync:trigger engine.sync 抛出异常时返回错误", async () => {
      syncEngine.sync.mockRejectedValue(new Error("Network error"));
      const result = await callIpcHandler(handlers, "sync:trigger", mockEvent);
      expect(result).toEqual({ success: false, error: "Network error" });
    });

    it("sync:trigger engine 为 null 时返回错误", async () => {
      vi.clearAllMocks();
      registerSyncHandlers({ getSyncEngine: () => null });
      const localHandlers = captureHandlers();
      const result = await callIpcHandler(
        localHandlers,
        "sync:trigger",
        mockEvent,
      );
      expect(result).toEqual({
        success: false,
        error: "Sync engine not initialized",
      });
    });

    it("sync:pause 调用 engine.stop()", async () => {
      const result = await callIpcHandler(handlers, "sync:pause", mockEvent);
      expect(result).toEqual({ success: true });
      expect(syncEngine.stop).toHaveBeenCalledTimes(1);
    });

    it("sync:resume 调用 engine.start()", async () => {
      const result = await callIpcHandler(handlers, "sync:resume", mockEvent);
      expect(result).toEqual({ success: true });
      expect(syncEngine.start).toHaveBeenCalledTimes(1);
    });

    it("sync:setAuthToken 调用 engine.setAuthToken(token)", async () => {
      const result = await callIpcHandler(
        handlers,
        "sync:setAuthToken",
        mockEvent,
        "my-token",
      );
      expect(result).toEqual({ success: true });
      expect(syncEngine.setAuthToken).toHaveBeenCalledWith("my-token");
    });

    it("sync:setAuthToken engine 为 null 时返回错误", async () => {
      vi.clearAllMocks();
      registerSyncHandlers({ getSyncEngine: () => null });
      const localHandlers = captureHandlers();
      const result = await callIpcHandler(
        localHandlers,
        "sync:setAuthToken",
        mockEvent,
        "token",
      );
      expect(result).toEqual({
        success: false,
        error: "Sync engine not initialized",
      });
    });

    it("sync:fullSync 调用 engine.fullSync() 并返回 success", async () => {
      syncEngine.fullSync.mockResolvedValue(undefined);
      const result = await callIpcHandler(handlers, "sync:fullSync", mockEvent);
      expect(result).toEqual({ success: true });
      expect(syncEngine.fullSync).toHaveBeenCalledTimes(1);
    });

    it("sync:fullSync engine.fullSync 抛出异常时返回错误", async () => {
      syncEngine.fullSync.mockRejectedValue(new Error("Full sync failed"));
      const result = await callIpcHandler(handlers, "sync:fullSync", mockEvent);
      expect(result).toEqual({
        success: false,
        error: "Full sync failed",
      });
    });
  });

  // ============================================================
  // 5. configHandlers 逻辑
  // ============================================================
  describe("configHandlers", () => {
    it("config:read 文件不存在时返回空对象", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await callIpcHandler(handlers, "config:read", mockEvent);
      expect(result).toEqual({});
      expect(fs.existsSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("config:read 文件存在时返回解析后的 JSON", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ theme: "dark", lang: "zh-CN" }),
      );
      const result = await callIpcHandler(handlers, "config:read", mockEvent);
      expect(result).toEqual({ theme: "dark", lang: "zh-CN" });
    });

    it("config:read 解析异常时返回空对象", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json {{{");
      const result = await callIpcHandler(handlers, "config:read", mockEvent);
      expect(result).toEqual({});
    });

    it("config:read 使用 app.getPath('userData') 拼接路径", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      electronMock.app.getPath.mockReturnValue("/tmp/userdata");
      await callIpcHandler(handlers, "config:read", mockEvent);
      expect(electronMock.app.getPath).toHaveBeenCalledWith("userData");
      // existsSync 调用路径应包含 userData 目录
      const calledPath = vi.mocked(fs.existsSync).mock.calls[0][0] as string;
      expect(calledPath).toContain("userdata");
      expect(calledPath).toContain("config.json");
    });

    it("config:write 写入 JSON 数据并返回 success", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const data = { theme: "light" };
      const result = await callIpcHandler(
        handlers,
        "config:write",
        mockEvent,
        data,
      );
      expect(result).toEqual({ success: true });
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [path, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      expect(path).toContain("config.json");
      expect(JSON.parse(content)).toEqual({ theme: "light" });
    });

    it("config:write userData 目录不存在时创建目录", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        // userData 目录不存在，config.json 自然也不存在
        return !path.includes("userData");
      });
      const result = await callIpcHandler(
        handlers,
        "config:write",
        mockEvent,
        { theme: "dark" },
      );
      expect(result).toEqual({ success: true });
      expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
      const mkdirPath = vi.mocked(fs.mkdirSync).mock.calls[0][0] as string;
      expect(mkdirPath).toContain("userData");
    });

    it("config:write 写入异常时返回 success: false", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });
      const result = await callIpcHandler(
        handlers,
        "config:write",
        mockEvent,
        { theme: "dark" },
      );
      expect(result).toEqual({
        success: false,
        error: "Permission denied",
      });
    });
  });

  // ============================================================
  // 6. 综合：多 handler 隔离
  // ============================================================
  describe("handler 隔离", () => {
    it("不同 channel 的 handler 互不干扰", async () => {
      // 同时调用 db:query 和 sync:getStatus
      dbManager.findAll.mockReturnValue([{ id: "1" }]);
      syncEngine.getStatus.mockReturnValue({
        isRunning: true,
        isOnline: true,
        lastSyncAt: null,
        pendingPush: 1,
        pendingPull: 0,
        conflicts: 0,
      });

      const dbResult = await callIpcHandler(handlers, "db:query", mockEvent, {
        resource: "nodes",
        method: "findAll",
        params: {},
      });
      const syncResult = await callIpcHandler(
        handlers,
        "sync:getStatus",
        mockEvent,
      );

      expect(dbResult).toEqual({ success: true, data: [{ id: "1" }] });
      expect(syncResult).toMatchObject({
        success: true,
        data: { isRunning: true, pendingPush: 1 },
      });
    });

    it("未注册的 channel 不会被捕获", () => {
      expect(handlers.has("unknown:channel")).toBe(false);
    });
  });
});
