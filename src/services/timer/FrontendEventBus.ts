type Handler<T> = (payload: T) => void;

class FrontendEventBus<
  TEventMap extends Record<string, unknown> = Record<string, unknown>,
> {
  private handlers = new Map<
    keyof TEventMap & string,
    Set<Handler<unknown>>
  >();

  subscribe<K extends keyof TEventMap & string>(
    eventType: K,
    handler: Handler<TEventMap[K]>,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)?.add(handler as Handler<unknown>);
    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe<K extends keyof TEventMap & string>(
    eventType: K,
    handler: Handler<TEventMap[K]>,
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as Handler<unknown>);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  publish<K extends keyof TEventMap & string>(
    eventType: K,
    payload: TEventMap[K],
  ): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch {
        // swallow to protect other handlers
      }
    });
  }

  once<K extends keyof TEventMap & string>(
    eventType: K,
    handler: Handler<TEventMap[K]>,
  ): () => void {
    const wrappedHandler: Handler<TEventMap[K]> = (payload) => {
      this.unsubscribe(eventType, wrappedHandler);
      handler(payload);
    };
    return this.subscribe(eventType, wrappedHandler);
  }

  off<K extends keyof TEventMap & string>(
    eventType: K,
    handler?: Handler<TEventMap[K]>,
  ): void {
    if (handler) {
      this.unsubscribe(eventType, handler);
    } else {
      this.handlers.delete(eventType);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const frontendEventBus = new FrontendEventBus();
export { FrontendEventBus };
