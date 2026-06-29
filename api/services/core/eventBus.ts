import { logger } from "../../utils/logger";
import type {
  AppEventType,
  AppEvent,
  AppEventHandler,
} from "../../../shared/types/events";

export interface DeadLetterEntry {
  eventId: string;
  eventType: AppEventType;
  errorMessage: string;
  payload: unknown;
  timestamp: string;
  attempts: number;
  lastAttempt: string;
}

class AppEventBus {
  private handlers: Map<string, Set<AppEventHandler>> = new Map();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private readonly maxDeadLetterQueueSize = 100;
  private readonly maxRetries = 3;

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

  publish<T = unknown>(
    eventType: AppEventType,
    payload: T,
    userId: string,
    source?: string,
  ): void {
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

    // Fire-and-forget: execute all handlers asynchronously without blocking the
    // caller. Each handler runs with exponential-backoff retries and dead-letter
    // semantics; executeHandlerWithRetry is intentionally NOT awaited.
    for (const handler of handlers) {
      this.executeHandlerWithRetry(
        handler,
        event as AppEvent,
        eventType,
      ).catch((error) => {
        logger.error(
          `[AppEventBus] Retry orchestration failed for ${eventType}:`,
          error,
        );
      });
    }
  }

  /**
   * Execute a handler with exponential-backoff retries.
   *
   * Total attempts = 1 initial + `maxRetries` retries = 4 total (maxRetries defaults to 3).
   * Delays between retries follow `1000 * 4^retryIndex` ms → 1s, 4s, 16s.
   * On final failure, the event is recorded in the dead-letter queue.
   *
   * This method is async; `publish` invokes it without awaiting so the caller
   * is never blocked by handler execution or retry backoff.
   */
  private async executeHandlerWithRetry(
    handler: AppEventHandler,
    event: AppEvent,
    eventType: AppEventType,
  ): Promise<void> {
    let lastError: unknown;
    const totalAttempts = this.maxRetries + 1;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      // Skip delay on the initial attempt; apply exponential backoff before retries.
      if (attempt > 0) {
        const retryIndex = attempt - 1; // 0, 1, 2
        const delay = 1000 * Math.pow(4, retryIndex); // 1s, 4s, 16s
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay);
        });
      }

      try {
        await handler(event);
        return; // success — no further retries
      } catch (error) {
        lastError = error;
      }
    }

    // All retries exhausted → record dead-letter entry
    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    const errorStack =
      lastError instanceof Error ? lastError.stack ?? "" : "";
    const payloadSummary = JSON.stringify(event.payload).slice(0, 200);

    logger.error(
      `[AppEventBus] Handler dead-lettered for ${eventType} (event ${event.id}): ${errorMessage}`,
      {
        eventType,
        eventId: event.id,
        payloadSummary,
        errorStack,
      },
    );

    this.addToDeadLetterQueue({
      eventId: event.id,
      eventType,
      errorMessage,
      payload: event.payload,
      timestamp: new Date().toISOString(),
      attempts: totalAttempts,
      lastAttempt: new Date().toISOString(),
    });
  }

  private addToDeadLetterQueue(entry: DeadLetterEntry): void {
    this.deadLetterQueue.push(entry);
    while (this.deadLetterQueue.length > this.maxDeadLetterQueueSize) {
      this.deadLetterQueue.shift();
    }
  }

  /**
   * Returns a read-only view of the dead-letter queue for ops inspection.
   * The returned array reflects the current internal state.
   */
  getDeadLetterQueue(): readonly DeadLetterEntry[] {
    return this.deadLetterQueue;
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
