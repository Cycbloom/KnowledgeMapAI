import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger to keep test output clean and to allow asserting on log calls.
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from "../../../utils/logger";
import {
  AppEventBus,
  type DeadLetterEntry,
} from "../../../services/core/eventBus";
import type { AppEvent } from "../../../../shared/types/events";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppEventBus - 死信队列", () => {
  let bus: AppEventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    bus = new AppEventBus();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 正常 publish
  // -------------------------------------------------------------------------

  describe("正常 publish", () => {
    it("handler 被调用且接收完整 AppEvent", () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1", "test-source");

      // handler called synchronously during publish (initial attempt)
      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as AppEvent;
      expect(event.type).toBe("task_started");
      expect(event.payload).toEqual({ taskId: "t1" });
      expect(event.userId).toBe("user-1");
      expect(event.source).toBe("test-source");
      expect(event.id).toBeTypeOf("string");
      expect(event.timestamp).toBeTypeOf("string");
    });

    it("不阻塞调用方（handler 永不 resolve 时 publish 仍同步返回）", () => {
      const handler = vi
        .fn()
        .mockImplementation(() => new Promise<void>(() => {}));
      bus.subscribe("task_started", handler);

      let afterPublish = false;
      bus.publish("task_started", { taskId: "t1" }, "user-1");
      afterPublish = true;

      // publish returned synchronously despite handler never resolving
      expect(afterPublish).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("成功时不入死信队列", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      expect(bus.getDeadLetterQueue()).toHaveLength(0);
    });

    it("无订阅者时不抛错且不入 DLQ", async () => {
      expect(() => {
        bus.publish("task_started", { taskId: "t1" }, "user-1");
      }).not.toThrow();

      await vi.runAllTimersAsync();
      expect(bus.getDeadLetterQueue()).toHaveLength(0);
    });

    it("重试中途成功后不再调用 handler", async () => {
      let attempts = 0;
      const handler = vi.fn().mockImplementation(() => {
        attempts += 1;
        if (attempts < 3) {
          return Promise.reject(new Error("transient"));
        }
        return Promise.resolve();
      });
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");

      expect(handler).toHaveBeenCalledTimes(1);

      // 1s → retry 1 (fails)
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalledTimes(2);

      // 4s → retry 2 (succeeds)
      await vi.advanceTimersByTimeAsync(4000);
      expect(handler).toHaveBeenCalledTimes(3);

      // 16s → no further retries after success
      await vi.advanceTimersByTimeAsync(16000);
      expect(handler).toHaveBeenCalledTimes(3);

      expect(bus.getDeadLetterQueue()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // handler 失败重试
  // -------------------------------------------------------------------------

  describe("handler 失败重试", () => {
    it("失败后按 1s/4s/16s 间隔重试 3 次（共 4 次尝试）", async () => {
      // Pin system time to 0 so absolute Date.now() values are predictable.
      vi.setSystemTime(0);
      const callTimes: number[] = [];
      const handler = vi.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.reject(new Error("test error"));
      });
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");

      // Initial attempt happens synchronously during publish
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance 1s → retry 1
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalledTimes(2);

      // Advance 4s → retry 2
      await vi.advanceTimersByTimeAsync(4000);
      expect(handler).toHaveBeenCalledTimes(3);

      // Advance 16s → retry 3
      await vi.advanceTimersByTimeAsync(16000);
      expect(handler).toHaveBeenCalledTimes(4);

      // No more retries after 3 retries exhausted
      await vi.advanceTimersByTimeAsync(60000);
      expect(handler).toHaveBeenCalledTimes(4);

      // Verify exact intervals via Date.now()
      expect(callTimes).toHaveLength(4);
      expect(callTimes[0]).toBe(0);
      expect(callTimes[1] - callTimes[0]).toBe(1000);
      expect(callTimes[2] - callTimes[1]).toBe(4000);
      expect(callTimes[3] - callTimes[2]).toBe(16000);
    });

    it("重试 3 次仍失败后入死信队列", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new Error("persistent failure"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      expect(handler).toHaveBeenCalledTimes(4);
      const dlq = bus.getDeadLetterQueue();
      expect(dlq).toHaveLength(1);

      const entry = dlq[0] as DeadLetterEntry;
      expect(entry.eventType).toBe("task_started");
      expect(entry.errorMessage).toBe("persistent failure");
      expect(entry.payload).toEqual({ taskId: "t1" });
      expect(entry.attempts).toBe(4);
      expect(entry.eventId).toBeTypeOf("string");
      expect(entry.eventId.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeTypeOf("string");
      expect(entry.lastAttempt).toBeTypeOf("string");
    });

    it("logger.error 在最终失败时被调用（含 eventType / event id / payload 摘要 / 堆栈）", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new Error("boom"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      expect(logger.error).toHaveBeenCalled();

      const deadLetterCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("dead-lettered"),
      );
      expect(deadLetterCall).toBeDefined();

      const message = deadLetterCall?.[0] as string;
      const meta = deadLetterCall?.[1] as Record<string, unknown> | undefined;
      expect(message).toContain("task_started");
      expect(message).toContain("boom");
      expect(meta).toBeDefined();
      expect(meta?.eventType).toBe("task_started");
      expect(typeof meta?.eventId).toBe("string");
      expect(typeof meta?.payloadSummary).toBe("string");
      // payload summary should be JSON of the payload (truncated to 200 chars)
      expect(meta?.payloadSummary).toContain("taskId");
      expect(typeof meta?.errorStack).toBe("string");
    });

    it("payload 摘要截断到 200 字符", async () => {
      const longPayload = { data: "x".repeat(500) };
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", longPayload, "user-1");
      await vi.runAllTimersAsync();

      const deadLetterCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("dead-lettered"),
      );
      const meta = deadLetterCall?.[1] as Record<string, unknown>;
      const summary = meta.payloadSummary as string;
      expect(summary.length).toBeLessThanOrEqual(200);
    });

    it("同步抛错的 handler 也会被重试", async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error("sync throw");
      });
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      // 1 initial + 3 retries = 4 attempts
      expect(handler).toHaveBeenCalledTimes(4);
      expect(bus.getDeadLetterQueue()).toHaveLength(1);
      expect((bus.getDeadLetterQueue()[0] as DeadLetterEntry).errorMessage).toBe(
        "sync throw",
      );
    });
  });

  // -------------------------------------------------------------------------
  // 死信队列限制
  // -------------------------------------------------------------------------

  describe("死信队列限制", () => {
    it("超过 100 条时丢弃最旧条目（shift）", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      // Publish 101 events with distinguishable payloads
      for (let i = 0; i < 101; i++) {
        bus.publish("task_started", { idx: i }, "user-1");
      }

      await vi.runAllTimersAsync();

      const dlq = bus.getDeadLetterQueue();
      expect(dlq).toHaveLength(100);
      // Oldest entry (idx=0) was shifted out → first entry is idx=1
      expect((dlq[0] as DeadLetterEntry).payload).toEqual({ idx: 1 });
      // Latest entry is idx=100
      expect((dlq[99] as DeadLetterEntry).payload).toEqual({ idx: 100 });
    });

    it("恰好 100 条时不丢弃", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      for (let i = 0; i < 100; i++) {
        bus.publish("task_started", { idx: i }, "user-1");
      }

      await vi.runAllTimersAsync();

      const dlq = bus.getDeadLetterQueue();
      expect(dlq).toHaveLength(100);
      expect((dlq[0] as DeadLetterEntry).payload).toEqual({ idx: 0 });
      expect((dlq[99] as DeadLetterEntry).payload).toEqual({ idx: 99 });
    });

    it("多个订阅者失败时各自入 DLQ", async () => {
      const handler1 = vi
        .fn()
        .mockRejectedValue(new Error("h1 fail"));
      const handler2 = vi
        .fn()
        .mockRejectedValue(new Error("h2 fail"));
      bus.subscribe("task_started", handler1);
      bus.subscribe("task_started", handler2);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      expect(handler1).toHaveBeenCalledTimes(4);
      expect(handler2).toHaveBeenCalledTimes(4);
      expect(bus.getDeadLetterQueue()).toHaveLength(2);
    });

    it("同一事件 ID 在 DLQ 中可区分", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { idx: "a" }, "user-1");
      bus.publish("task_started", { idx: "b" }, "user-1");
      await vi.runAllTimersAsync();

      const dlq = bus.getDeadLetterQueue();
      expect(dlq).toHaveLength(2);
      expect((dlq[0] as DeadLetterEntry).eventId).not.toBe(
        (dlq[1] as DeadLetterEntry).eventId,
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDeadLetterQueue
  // -------------------------------------------------------------------------

  describe("getDeadLetterQueue", () => {
    it("无失败时返回空数组", () => {
      const dlq = bus.getDeadLetterQueue();
      expect(Array.isArray(dlq)).toBe(true);
      expect(dlq).toHaveLength(0);
    });

    it("返回只读数组（运行时为 Array，类型为 readonly DeadLetterEntry[]）", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { taskId: "t1" }, "user-1");
      await vi.runAllTimersAsync();

      const dlq = bus.getDeadLetterQueue();
      // Runtime: it's an array
      expect(Array.isArray(dlq)).toBe(true);
      expect(dlq).toHaveLength(1);
      // Compile-time: the type is `readonly DeadLetterEntry[]` — verified by
      // the fact that `dlq.push(...)` would not type-check.
      const entry = dlq[0] as DeadLetterEntry;
      expect(entry.eventType).toBe("task_started");
    });

    it("返回的视图反映当前内部状态", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fail"));
      bus.subscribe("task_started", handler);

      bus.publish("task_started", { idx: 1 }, "user-1");
      await vi.runAllTimersAsync();

      expect(bus.getDeadLetterQueue()).toHaveLength(1);

      bus.publish("task_started", { idx: 2 }, "user-1");
      await vi.runAllTimersAsync();

      expect(bus.getDeadLetterQueue()).toHaveLength(2);
    });
  });
});
