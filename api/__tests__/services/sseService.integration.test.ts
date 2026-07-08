/**
 * SSE Service 集成测试 (Task 3.9)
 *
 * 测试 SSEService 类的真实行为：连接生命周期、消息推送、死连接清理、
 * 多用户隔离、连接数限制。使用 createMockResponse 模拟 Express Response，
 * 通过 emit('close') 模拟客户端断开连接。
 *
 * 与 sseService.test.ts（单元测试）的区别：
 * - 单元测试聚焦单个方法的行为（连接数限制、写入失败阈值、心跳启停）
 * - 集成测试聚焦多客户端生命周期场景：连接 → 接收消息 → 断开 → 自动清理
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sseService } from "../../services/core/sseService";
import {
  createMockResponse,
  type MockResponse,
} from "../../../tests/helpers/mockFactories";

// SSEService 内部状态访问器（私有字段需通过类型断言访问以做集成验证）
interface SSEServiceInternal {
  clients: Map<string, MockResponse[]>;
  writeFailures: Map<MockResponse, number>;
}

const getInternal = (): SSEServiceInternal =>
  sseService as unknown as SSEServiceInternal;

describe("SSE Service 集成测试", () => {
  beforeEach(() => {
    const internal = getInternal();
    internal.clients.clear();
    internal.writeFailures.clear();
    sseService.stopHeartbeat();
  });

  afterEach(() => {
    sseService.stopHeartbeat();
    vi.useRealTimers();
  });

  // ============================================================
  // 连接生命周期：连接 → 接收消息 → 断开 → 自动清理
  // ============================================================
  describe("连接生命周期", () => {
    it("客户端连接后能收到服务端推送的消息", () => {
      const res = createMockResponse();
      const result = sseService.addClient("user-lifecycle-1", res);

      expect(result).toBe(true);

      sseService.sendToUser("user-lifecycle-1", { type: "notification", message: "hello" });

      // 验证 res.write 被调用，且写入的是 SSE 格式数据
      expect(res.write).toHaveBeenCalledTimes(1);
      const writtenData = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(writtenData).toContain("data:");
      expect(writtenData).toContain("notification");
      expect(writtenData).toContain("hello");
    });

    it("客户端 close 事件触发后自动从 clients 中移除", () => {
      const res = createMockResponse();
      sseService.addClient("user-lifecycle-2", res);

      // 连接存在时能收到消息
      sseService.sendToUser("user-lifecycle-2", { msg: "before-close" });
      expect(res.write).toHaveBeenCalledTimes(1);

      // 模拟连接关闭（addClient 内部注册了 res.on('close', ...) 监听器）
      res.emit("close");

      // 关闭后不应再收到消息
      (res.write as ReturnType<typeof vi.fn>).mockClear();
      sseService.sendToUser("user-lifecycle-2", { msg: "after-close" });
      expect(res.write).not.toHaveBeenCalled();

      // clients Map 中该用户应无残留连接
      const internal = getInternal();
      expect(internal.clients.has("user-lifecycle-2")).toBe(false);
    });

    it("addClient 返回的 res 已注册 close 事件监听器", () => {
      const res = createMockResponse();
      sseService.addClient("user-lifecycle-3", res);

      // res.on('close', cb) 应被调用以注册断开监听
      expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
    });
  });

  // ============================================================
  // 消息推送：同一用户的多个连接均收到消息
  // ============================================================
  describe("消息推送", () => {
    it("同一用户的多个客户端都收到推送消息", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const res3 = createMockResponse();

      sseService.addClient("user-broadcast", res1);
      sseService.addClient("user-broadcast", res2);
      sseService.addClient("user-broadcast", res3);

      sseService.sendToUser("user-broadcast", { type: "update", payload: { id: 42 } });

      expect(res1.write).toHaveBeenCalledTimes(1);
      expect(res2.write).toHaveBeenCalledTimes(1);
      expect(res3.write).toHaveBeenCalledTimes(1);

      // 所有客户端收到的数据应一致
      const data1 = (res1.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const data2 = (res2.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const data3 = (res3.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(data1).toBe(data2);
      expect(data2).toBe(data3);
      expect(data1).toContain("update");
    });

    it("SSE 数据格式正确：data: {JSON}\\n\\n", () => {
      const res = createMockResponse();
      sseService.addClient("user-format", res);

      const payload = { type: "task-completed", taskId: "task-123" };
      sseService.sendToUser("user-format", payload);

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(written).toBe(`data: ${JSON.stringify(payload)}\n\n`);
    });

    it("向无连接的用户发送消息不抛异常", () => {
      expect(() => {
        sseService.sendToUser("nonexistent-user", { msg: "no one here" });
      }).not.toThrow();
    });

    it("连续推送多条消息按顺序写入", () => {
      const res = createMockResponse();
      sseService.addClient("user-sequence", res);

      for (let i = 0; i < 5; i++) {
        sseService.sendToUser("user-sequence", { index: i });
      }

      expect(res.write).toHaveBeenCalledTimes(5);
      const calls = (res.write as ReturnType<typeof vi.fn>).mock.calls;
      for (let i = 0; i < 5; i++) {
        const data = calls[i][0] as string;
        expect(data).toContain(`"index":${i}`);
      }
    });
  });

  // ============================================================
  // 多用户隔离：用户 A 的消息不会推送到用户 B
  // ============================================================
  describe("多用户隔离", () => {
    it("不同用户的连接互相隔离", () => {
      const userARes = createMockResponse();
      const userBRes = createMockResponse();

      sseService.addClient("user-A", userARes);
      sseService.addClient("user-B", userBRes);

      // 给 user-A 发消息
      sseService.sendToUser("user-A", { msg: "for A only" });

      expect(userARes.write).toHaveBeenCalledTimes(1);
      expect(userBRes.write).not.toHaveBeenCalled();

      // 给 user-B 发消息
      sseService.sendToUser("user-B", { msg: "for B only" });

      expect(userARes.write).toHaveBeenCalledTimes(1); // 仍然是 1
      expect(userBRes.write).toHaveBeenCalledTimes(1);
    });

    it("同一用户多个连接中断开部分连接后，剩余连接仍能收到消息", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const res3 = createMockResponse();

      sseService.addClient("user-partial", res1);
      sseService.addClient("user-partial", res2);
      sseService.addClient("user-partial", res3);

      // res2 断开
      res2.emit("close");

      // 推送消息
      sseService.sendToUser("user-partial", { msg: "after partial disconnect" });

      expect(res1.write).toHaveBeenCalledTimes(1);
      expect(res2.write).not.toHaveBeenCalled(); // 已断开
      expect(res3.write).toHaveBeenCalledTimes(1);
    });

    it("用户所有连接断开后，clients Map 中该用户条目被删除", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      sseService.addClient("user-all-disconnect", res1);
      sseService.addClient("user-all-disconnect", res2);

      const internal = getInternal();
      expect(internal.clients.has("user-all-disconnect")).toBe(true);
      expect(internal.clients.get("user-all-disconnect")).toHaveLength(2);

      res1.emit("close");
      res2.emit("close");

      expect(internal.clients.has("user-all-disconnect")).toBe(false);
    });
  });

  // ============================================================
  // 死连接清理：写入失败累计达到阈值后自动剔除
  // ============================================================
  describe("死连接清理", () => {
    it("写入持续失败的连接被自动剔除并 end", () => {
      const deadRes = createMockResponse(false); // write 返回 false
      sseService.addClient("user-dead", deadRes);

      // 前 2 次失败未达阈值
      sseService.sendToUser("user-dead", { msg: 1 });
      sseService.sendToUser("user-dead", { msg: 2 });
      expect(deadRes.end).not.toHaveBeenCalled();

      // 第 3 次失败达阈值，触发 end 并移除
      sseService.sendToUser("user-dead", { msg: 3 });
      expect(deadRes.end).toHaveBeenCalledTimes(1);

      // 移除后再发消息不会触发 write
      (deadRes.write as ReturnType<typeof vi.fn>).mockClear();
      sseService.sendToUser("user-dead", { msg: 4 });
      expect(deadRes.write).not.toHaveBeenCalled();
    });

    it("死连接被剔除后不影响同用户的健康连接", () => {
      const deadRes = createMockResponse(false);
      const healthyRes = createMockResponse(true);

      sseService.addClient("user-mixed", deadRes);
      sseService.addClient("user-mixed", healthyRes);

      // 3 次发送，deadRes 每次失败，healthyRes 每次成功
      sseService.sendToUser("user-mixed", { msg: 1 });
      sseService.sendToUser("user-mixed", { msg: 2 });
      sseService.sendToUser("user-mixed", { msg: 3 });

      // deadRes 达到阈值被剔除
      expect(deadRes.end).toHaveBeenCalledTimes(1);
      // healthyRes 不受影响，3 次都收到
      expect(healthyRes.write).toHaveBeenCalledTimes(3);

      // 再发消息，只有 healthyRes 收到
      (deadRes.write as ReturnType<typeof vi.fn>).mockClear();
      (healthyRes.write as ReturnType<typeof vi.fn>).mockClear();
      sseService.sendToUser("user-mixed", { msg: 4 });

      expect(deadRes.write).not.toHaveBeenCalled();
      expect(healthyRes.write).toHaveBeenCalledTimes(1);
    });

    it("writeFailures Map 在连接移除后被清理", () => {
      const res = createMockResponse(false);
      sseService.addClient("user-failure-cleanup", res);

      sseService.sendToUser("user-failure-cleanup", { msg: 1 });
      sseService.sendToUser("user-failure-cleanup", { msg: 2 });
      sseService.sendToUser("user-failure-cleanup", { msg: 3 });

      // 达到阈值后被移除
      const internal = getInternal();
      expect(internal.writeFailures.has(res)).toBe(false);
    });
  });

  // ============================================================
  // 连接数限制：每用户最多 5 个连接
  // ============================================================
  describe("连接数限制", () => {
    it("达到上限后拒绝新连接", () => {
      const clients: MockResponse[] = [];
      for (let i = 0; i < 5; i++) {
        const res = createMockResponse();
        expect(sseService.addClient("user-limit", res)).toBe(true);
        clients.push(res);
      }

      // 第 6 个被拒绝
      const sixth = createMockResponse();
      expect(sseService.addClient("user-limit", sixth)).toBe(false);

      // 第 6 个不会收到消息
      sseService.sendToUser("user-limit", { msg: "for first 5 only" });
      expect(sixth.write).not.toHaveBeenCalled();
    });

    it("断开一个连接后可以重新建立新连接", () => {
      const clients: MockResponse[] = [];
      for (let i = 0; i < 5; i++) {
        const res = createMockResponse();
        sseService.addClient("user-recycle", res);
        clients.push(res);
      }

      // 断开第一个
      clients[0].emit("close");

      // 新连接应成功
      const newRes = createMockResponse();
      expect(sseService.addClient("user-recycle", newRes)).toBe(true);

      // 新连接能收到消息
      sseService.sendToUser("user-recycle", { msg: "welcome back" });
      expect(newRes.write).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 心跳：定时向所有连接发送 keep-alive
  // ============================================================
  describe("心跳机制", () => {
    it("心跳定时向所有已连接客户端发送 keep-alive", () => {
      vi.useFakeTimers();

      const res1 = createMockResponse();
      const res2 = createMockResponse();
      sseService.addClient("user-heartbeat-1", res1);
      sseService.addClient("user-heartbeat-2", res2);

      sseService.startHeartbeat(1000);

      // 推进 1 秒，触发一次心跳
      vi.advanceTimersByTime(1000);

      expect(res1.write).toHaveBeenCalled();
      expect(res2.write).toHaveBeenCalled();

      // 心跳内容为 SSE 注释行
      const heartbeatData1 = (res1.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(heartbeatData1).toContain(": keep-alive");
    });

    it("心跳对无连接的用户不发送", () => {
      vi.useFakeTimers();

      sseService.startHeartbeat(500);
      // 无连接，推进时间不应抛异常
      expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    });

    it("多轮心跳持续发送", () => {
      vi.useFakeTimers();

      const res = createMockResponse();
      sseService.addClient("user-multi-heartbeat", res);

      sseService.startHeartbeat(200);

      vi.advanceTimersByTime(200);
      vi.advanceTimersByTime(200);
      vi.advanceTimersByTime(200);

      // 3 轮心跳 = 3 次 write（仅心跳，不含其他消息）
      const heartbeatWrites = (res.write as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => (call[0] as string).includes("keep-alive"),
      );
      expect(heartbeatWrites).toHaveLength(3);
    });
  });

  // ============================================================
  // 综合场景：多用户、多连接、断开、推送混合
  // ============================================================
  describe("综合场景", () => {
    it("多用户多连接混合操作", () => {
      // 用户 A 有 2 个连接，用户 B 有 1 个连接
      const a1 = createMockResponse();
      const a2 = createMockResponse();
      const b1 = createMockResponse();

      sseService.addClient("user-mix-A", a1);
      sseService.addClient("user-mix-A", a2);
      sseService.addClient("user-mix-B", b1);

      // 1. 给 A 发消息
      sseService.sendToUser("user-mix-A", { msg: "to A" });
      expect(a1.write).toHaveBeenCalledTimes(1);
      expect(a2.write).toHaveBeenCalledTimes(1);
      expect(b1.write).not.toHaveBeenCalled();

      // 2. A 的第一个连接断开
      a1.emit("close");

      // 3. 再给 A 发消息，只有 a2 收到
      (a2.write as ReturnType<typeof vi.fn>).mockClear();
      sseService.sendToUser("user-mix-A", { msg: "to A again" });
      expect(a1.write).toHaveBeenCalledTimes(1); // 不变
      expect(a2.write).toHaveBeenCalledTimes(1);
      expect(b1.write).not.toHaveBeenCalled();

      // 4. 给 B 发消息
      sseService.sendToUser("user-mix-B", { msg: "to B" });
      expect(b1.write).toHaveBeenCalledTimes(1);
    });

    it("removeClient 手动移除与 close 事件移除效果一致", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      sseService.addClient("user-manual-remove", res1);
      sseService.addClient("user-manual-remove", res2);

      // 手动移除 res1
      sseService.removeClient("user-manual-remove", res1);

      // res1 不会再收到消息
      sseService.sendToUser("user-manual-remove", { msg: "after manual remove" });
      expect(res1.write).not.toHaveBeenCalled();
      expect(res2.write).toHaveBeenCalledTimes(1);

      // res2 通过 close 事件移除
      res2.emit("close");

      const internal = getInternal();
      expect(internal.clients.has("user-manual-remove")).toBe(false);
    });
  });
});
