import { logger } from "../../utils/logger";
import type {
  AppEventType,
  AppEvent,
  AppEventHandler,
} from "../../../shared/types/events";

class AppEventBus {
  private handlers: Map<string, Set<AppEventHandler>> = new Map();

  subscribe(eventType: AppEventType, handler: AppEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: AppEventType, handler: AppEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  async publish<T = unknown>(
    eventType: AppEventType,
    payload: T,
    userId: string,
    source?: string,
  ): Promise<void> {
    const event: AppEvent<T> = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      userId,
      timestamp: new Date().toISOString(),
      source,
    };

    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      logger.debug(`[AppEventBus] No subscribers for ${eventType}`);
      return;
    }

    logger.debug(
      `[AppEventBus] Publishing ${eventType} to ${handlers.size} subscriber(s)`,
    );

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event as AppEvent);
      } catch (error) {
        logger.error(
          `[AppEventBus] Handler failed for ${eventType}:`,
          error,
        );
      }
    });

    await Promise.allSettled(promises);
  }

  getHandlerCount(eventType?: AppEventType): number {
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

export const appEventBus = new AppEventBus();
export { AppEventBus };
