import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MemoryEventBusBackend,
  createEventBusBackend,
  type EventBusBackend,
} from "../../../services/core/eventBusBackend";
import type { AppEventHandler } from "../../../../shared/types/events";

/**
 * MemoryEventBusBackend 单元测试。
 *
 * 覆盖：
 * - subscribe / getHandlers 基本注册与查询
 * - Set 自动去重（同一 handler 多次 subscribe 只生效一次）
 * - 多 handler 并发分发（A 与 B 都被注册）
 * - unsubscribe 单个 handler 后其他 handler 仍保留
 * - unsubscribe 后 Set 为空时从 Map 中清理（getHandlers 返回 undefined）
 * - getEventTypes 返回所有已注册 eventType
 * - clear 清空所有订阅
 * - 工厂函数分支（memory 默认 / redis 抛错 / 未知值抛错）
 *
 * 设计说明：EventBusBackend 接口采用 getHandlers 而非 publish（见
 * eventBusBackend.ts 顶部注释）。handler 实际执行 + 重试 + 死信队列由
 * AppEventBus 编排，已在 eventBus.test.ts 中覆盖。本测试仅验证后端
 * 注册表行为。
 */
describe("MemoryEventBusBackend", () => {
  let backend: MemoryEventBusBackend;

  beforeEach(() => {
    backend = new MemoryEventBusBackend();
  });

  describe("subscribe / getHandlers 基本注册", () => {
    it("subscribe 后 getHandlers 返回包含该 handler 的集合", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);

      const handlers = backend.getHandlers("task_started");
      expect(handlers).toBeDefined();
      expect(handlers?.size).toBe(1);
      expect(handlers?.has(handler)).toBe(true);
    });

    it("getHandlers 对未订阅的 eventType 返回 undefined", () => {
      const handlers = backend.getHandlers("task_started");
      expect(handlers).toBeUndefined();
    });

    it("subscribe 后返回的 Set 是只读视图（ReadonlySet）", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);

      const handlers = backend.getHandlers("task_started");
      // Runtime: it's a Set; compile-time type is ReadonlySet (verified by
      // the fact that `handlers.add(...)` would not type-check).
      expect(handlers).toBeInstanceOf(Set);
    });
  });

  describe("Set 自动去重", () => {
    it("同一 handler 多次 subscribe 只生效一次（Set 去重）", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);
      backend.subscribe("task_started", handler);
      backend.subscribe("task_started", handler);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(1);
    });

    it("不同 handler 各自独立计数", () => {
      const h1: AppEventHandler = vi.fn();
      const h2: AppEventHandler = vi.fn();
      const h3: AppEventHandler = vi.fn();
      backend.subscribe("task_started", h1);
      backend.subscribe("task_started", h2);
      backend.subscribe("task_started", h3);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(3);
      expect(handlers?.has(h1)).toBe(true);
      expect(handlers?.has(h2)).toBe(true);
      expect(handlers?.has(h3)).toBe(true);
    });
  });

  describe("多 handler 并发分发", () => {
    it("多 handler subscribe 后 getHandlers 返回所有 handler", () => {
      const handlerA: AppEventHandler = vi.fn();
      const handlerB: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handlerA);
      backend.subscribe("task_started", handlerB);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(2);
      expect(handlers?.has(handlerA)).toBe(true);
      expect(handlers?.has(handlerB)).toBe(true);
    });

    it("不同 eventType 的 handler 互不干扰", () => {
      const handlerA: AppEventHandler = vi.fn();
      const handlerB: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handlerA);
      backend.subscribe("task_completed", handlerB);

      const aHandlers = backend.getHandlers("task_started");
      const bHandlers = backend.getHandlers("task_completed");
      expect(aHandlers?.size).toBe(1);
      expect(bHandlers?.size).toBe(1);
      expect(aHandlers?.has(handlerA)).toBe(true);
      expect(aHandlers?.has(handlerB)).toBe(false);
      expect(bHandlers?.has(handlerB)).toBe(true);
      expect(bHandlers?.has(handlerA)).toBe(false);
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribe 单个 handler 后该 handler 不再在集合中", () => {
      const handlerA: AppEventHandler = vi.fn();
      const handlerB: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handlerA);
      backend.subscribe("task_started", handlerB);

      backend.unsubscribe("task_started", handlerA);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(1);
      expect(handlers?.has(handlerA)).toBe(false);
      expect(handlers?.has(handlerB)).toBe(true);
    });

    it("unsubscribe 后 Set 为空时从 Map 中清理（getHandlers 返回 undefined）", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);
      expect(backend.getHandlers("task_started")).toBeDefined();

      backend.unsubscribe("task_started", handler);

      // Set 为空后应从 Map 中 delete，getHandlers 返回 undefined
      expect(backend.getHandlers("task_started")).toBeUndefined();
    });

    it("unsubscribe 未注册的 eventType 不报错", () => {
      const handler: AppEventHandler = vi.fn();
      expect(() => {
        backend.unsubscribe("task_started", handler);
      }).not.toThrow();
    });

    it("unsubscribe 未注册的 handler 不影响其他 handler", () => {
      const handlerA: AppEventHandler = vi.fn();
      const handlerB: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handlerA);

      // handlerB 从未注册，unsubscribe 应无效果
      backend.unsubscribe("task_started", handlerB);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(1);
      expect(handlers?.has(handlerA)).toBe(true);
    });

    it("unsubscribe 后重新 subscribe 同一 handler 仍生效", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);
      backend.unsubscribe("task_started", handler);
      backend.subscribe("task_started", handler);

      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(1);
      expect(handlers?.has(handler)).toBe(true);
    });
  });

  describe("getEventTypes", () => {
    it("无订阅时返回空数组", () => {
      expect(backend.getEventTypes()).toEqual([]);
    });

    it("subscribe 后返回所有已注册 eventType", () => {
      backend.subscribe("task_started", vi.fn());
      backend.subscribe("task_completed", vi.fn());
      backend.subscribe("graph_created", vi.fn());

      const eventTypes = backend.getEventTypes();
      expect(eventTypes).toHaveLength(3);
      expect(eventTypes).toContain("task_started");
      expect(eventTypes).toContain("task_completed");
      expect(eventTypes).toContain("graph_created");
    });

    it("unsubscribe 清空后 eventType 不再出现在列表中", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);
      backend.subscribe("task_completed", vi.fn());

      backend.unsubscribe("task_started", handler);

      const eventTypes = backend.getEventTypes();
      expect(eventTypes).toEqual(["task_completed"]);
    });
  });

  describe("clear", () => {
    it("清空所有订阅", () => {
      backend.subscribe("task_started", vi.fn());
      backend.subscribe("task_completed", vi.fn());
      backend.subscribe("graph_created", vi.fn());

      backend.clear();

      expect(backend.getHandlers("task_started")).toBeUndefined();
      expect(backend.getHandlers("task_completed")).toBeUndefined();
      expect(backend.getHandlers("graph_created")).toBeUndefined();
      expect(backend.getEventTypes()).toEqual([]);
    });

    it("clear 后可重新 subscribe", () => {
      const handler: AppEventHandler = vi.fn();
      backend.subscribe("task_started", handler);
      backend.clear();

      backend.subscribe("task_started", handler);
      const handlers = backend.getHandlers("task_started");
      expect(handlers?.size).toBe(1);
      expect(handlers?.has(handler)).toBe(true);
    });

    it("对空 backend 调用 clear 不报错", () => {
      expect(() => backend.clear()).not.toThrow();
    });
  });

  describe("createEventBusBackend 工厂", () => {
    it("默认返回 MemoryEventBusBackend 实例", () => {
      const original = process.env.EVENT_BUS_BACKEND;
      delete process.env.EVENT_BUS_BACKEND;
      try {
        const b = createEventBusBackend();
        expect(b).toBeInstanceOf(MemoryEventBusBackend);
      } finally {
        if (original !== undefined) {
          process.env.EVENT_BUS_BACKEND = original;
        }
      }
    });

    it("EVENT_BUS_BACKEND=memory 返回 MemoryEventBusBackend 实例", () => {
      const original = process.env.EVENT_BUS_BACKEND;
      process.env.EVENT_BUS_BACKEND = "memory";
      try {
        const b = createEventBusBackend();
        expect(b).toBeInstanceOf(MemoryEventBusBackend);
      } finally {
        process.env.EVENT_BUS_BACKEND = original;
      }
    });

    it("EVENT_BUS_BACKEND=redis 抛出未实现错误", () => {
      const original = process.env.EVENT_BUS_BACKEND;
      process.env.EVENT_BUS_BACKEND = "redis";
      try {
        expect(() => createEventBusBackend()).toThrow(
          "Redis event bus backend not yet implemented. Set EVENT_BUS_BACKEND=memory",
        );
      } finally {
        process.env.EVENT_BUS_BACKEND = original;
      }
    });

    it("未知 EVENT_BUS_BACKEND 值抛错", () => {
      const original = process.env.EVENT_BUS_BACKEND;
      process.env.EVENT_BUS_BACKEND = "unknown-backend";
      try {
        expect(() => createEventBusBackend()).toThrow(
          "Unknown EVENT_BUS_BACKEND: unknown-backend. Supported: memory",
        );
      } finally {
        process.env.EVENT_BUS_BACKEND = original;
      }
    });

    it("工厂返回的实例实现 EventBusBackend 接口", () => {
      const original = process.env.EVENT_BUS_BACKEND;
      delete process.env.EVENT_BUS_BACKEND;
      try {
        const b: EventBusBackend = createEventBusBackend();
        // 接口方法存在性检查
        expect(typeof b.subscribe).toBe("function");
        expect(typeof b.unsubscribe).toBe("function");
        expect(typeof b.getHandlers).toBe("function");
        expect(typeof b.getEventTypes).toBe("function");
        expect(typeof b.clear).toBe("function");
      } finally {
        if (original !== undefined) {
          process.env.EVENT_BUS_BACKEND = original;
        }
      }
    });
  });
});
