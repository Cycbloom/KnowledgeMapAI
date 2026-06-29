import type {
  AppEventType,
  AppEventHandler,
} from "../../../shared/types/events";

/**
 * 事件总线后端抽象接口。
 *
 * 设计决策说明（与 spec.md 的偏差）：
 * spec.md 要求 EventBusBackend 包含 `publish(event: AppEvent): void` 方法，
 * 但 AppEventBus 的 handler 执行需要带指数退避重试 + 死信队列语义
 * （executeHandlerWithRetry）。若 backend.publish 直接调用 handler，会绕过
 * 重试与死信逻辑；若 backend.publish 不调用 handler，则该方法形同虚设。
 *
 * 因此实际实现改为暴露 `getHandlers(eventType)` 返回当前订阅者集合的
 * 只读视图，由 AppEventBus 自己遍历订阅者并调用 executeHandlerWithRetry
 * （保留重试 + 死信队列）。这比 spec 中的 publish 方法更合理：
 * - backend 职责：维护订阅者注册表（subscribe / unsubscribe / 查询）
 * - AppEventBus 职责：handler 调用编排 + 重试 + 死信队列
 *
 * 此外，getEventTypes() / clear() 用于支持 AppEventBus.getHandlerCount()
 * （无 eventType 时遍历所有 eventType）与 AppEventBus.clear()。
 *
 * 与 Round 8 Task 1-2 cacheService/rateLimiter 抽象策略一致：
 * 接口 + Memory 实现 + Redis 留未实现分支（createEventBusBackend 工厂）。
 */
export interface EventBusBackend {
  subscribe(eventType: AppEventType, handler: AppEventHandler): void;
  unsubscribe(eventType: AppEventType, handler: AppEventHandler): void;
  getHandlers(
    eventType: AppEventType,
  ): ReadonlySet<AppEventHandler> | undefined;
  getEventTypes(): AppEventType[];
  clear(): void;
}

/**
 * 基于进程内存的事件总线后端实现。
 *
 * - handlers Map 提供 eventType → Set<AppEventHandler> 订阅者注册表
 * - Set 自动去重（同一 handler 多次 subscribe 只生效一次）
 * - unsubscribe 后若 Set 为空，从 Map 中 delete 该 eventType
 *
 * 将原 eventBus.ts 中的 handlers Map 逻辑完整迁移到此类，行为完全等价。
 */
export class MemoryEventBusBackend implements EventBusBackend {
  private readonly handlers = new Map<AppEventType, Set<AppEventHandler>>();

  subscribe(eventType: AppEventType, handler: AppEventHandler): void {
    const existing = this.handlers.get(eventType);
    if (existing) {
      existing.add(handler);
      return;
    }
    this.handlers.set(eventType, new Set([handler]));
  }

  unsubscribe(eventType: AppEventType, handler: AppEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(eventType);
    }
  }

  getHandlers(
    eventType: AppEventType,
  ): ReadonlySet<AppEventHandler> | undefined {
    return this.handlers.get(eventType);
  }

  getEventTypes(): AppEventType[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
  }
}

/**
 * 事件总线后端工厂：根据 EVENT_BUS_BACKEND 环境变量返回对应实现。
 *
 * - memory（默认）：返回 MemoryEventBusBackend 实例
 * - redis：抛错（未来 Web 多实例部署时实现 RedisEventBusBackend）
 * - 未知值：抛错（避免静默回退导致难以排查的行为偏差）
 */
export function createEventBusBackend(): EventBusBackend {
  const backend = process.env.EVENT_BUS_BACKEND ?? "memory";
  if (backend === "memory") {
    return new MemoryEventBusBackend();
  }
  if (backend === "redis") {
    throw new Error(
      "Redis event bus backend not yet implemented. Set EVENT_BUS_BACKEND=memory",
    );
  }
  throw new Error(
    `Unknown EVENT_BUS_BACKEND: ${backend}. Supported: memory`,
  );
}
