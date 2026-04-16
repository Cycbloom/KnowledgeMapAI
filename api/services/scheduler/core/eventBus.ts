import { logger } from "../../../utils/logger";
import type {
  SchedulerEventType,
  SchedulerEvent,
  SchedulerEventHandler,
} from "../../../../shared/types/scheduler";

class SchedulerEventBus {
  private handlers: Map<string, Set<SchedulerEventHandler>> = new Map();

  subscribe(eventType: SchedulerEventType, handler: SchedulerEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: SchedulerEventType, handler: SchedulerEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  async publish<T = unknown>(
    eventType: SchedulerEventType,
    payload: T,
    userId: string,
    source?: string,
  ): Promise<void> {
    const event: SchedulerEvent<T> = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      userId,
      timestamp: new Date().toISOString(),
      source,
    };

    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      logger.debug(`[EventBus] No subscribers for ${eventType}`);
      return;
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event as SchedulerEvent);
      } catch (error) {
        logger.error(
          `[EventBus] Handler failed for ${eventType}:`,
          error,
        );
      }
    });

    await Promise.allSettled(promises);
  }

  getHandlerCount(eventType?: SchedulerEventType): number {
    if (eventType) {
      return this.handlers.get(eventType)?.size ?? 0;
    }
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const schedulerEventBus = new SchedulerEventBus();
export { SchedulerEventBus };
