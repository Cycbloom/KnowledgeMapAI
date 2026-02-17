export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
};

export const rafThrottle = <T extends (...args: unknown[]) => void>(
  fn: T
): ((...args: Parameters<T>) => void) => {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      if (lastArgs) {
        fn(...lastArgs);
      }
      rafId = null;
    });
  };
};

export const debounceWithLeading = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstCall = true;

  return (...args: Parameters<T>) => {
    if (isFirstCall) {
      fn(...args);
      isFirstCall = false;
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
};

interface BatchUpdateOptions {
  maxBatchSize?: number;
  maxWaitTime?: number;
}

export const createBatchUpdater = <T>(
  updateFn: (items: T[]) => void,
  options: BatchUpdateOptions = {}
) => {
  const { maxBatchSize = 100, maxWaitTime = 100 } = options;
  let batch: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (batch.length > 0) {
      updateFn([...batch]);
      batch = [];
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const add = (item: T) => {
    batch.push(item);

    if (batch.length >= maxBatchSize) {
      flush();
      return;
    }

    if (!timeoutId) {
      timeoutId = setTimeout(flush, maxWaitTime);
    }
  };

  const addMany = (items: T[]) => {
    batch.push(...items);

    if (batch.length >= maxBatchSize) {
      flush();
      return;
    }

    if (!timeoutId) {
      timeoutId = setTimeout(flush, maxWaitTime);
    }
  };

  return { add, addMany, flush };
};

export const memoize = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  resolver?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
};

export const memoizeWithExpiry = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  ttl: number,
  resolver?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();

  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, { value: result, expiry: now + ttl });
    return result;
  }) as T;
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const processInChunks = async <T, R>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<R[]>
): Promise<R[]> => {
  const chunks = chunk(items, chunkSize);
  const results: R[] = [];

  for (const chunk of chunks) {
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);
  }

  return results;
};
