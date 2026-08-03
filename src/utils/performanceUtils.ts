/**
 * 防抖函数
 *
 * 延迟执行函数，在延迟期间如果有新的调用，则重新计时。
 * 适用于处理频繁触发的事件（如输入框输入、窗口调整大小）。
 *
 * @template T - 函数类型
 * @param fn - 要防抖的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   fetchSearchResults(query);
 * }, 300);
 *
 * // 只有最后一次调用会在 300ms 后执行
 * debouncedSearch('h');
 * debouncedSearch('he');
 * debouncedSearch('hello'); // 只有这个会执行
 * ```
 */
export type DebouncedFunction<T extends (...args: never[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  /** 取消待执行的防抖调用 */
  cancel: () => void;
};

export const debounce = <T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): DebouncedFunction<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  return Object.assign(debounced, {
    cancel: (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  });
};

/**
 * 节流函数
 *
 * 限制函数在指定时间间隔内只能执行一次。
 * 适用于处理持续触发但需要控制频率的事件（如滚动、拖拽）。
 *
 * @template T - 函数类型
 * @param fn - 要节流的函数
 * @param delay - 执行间隔（毫秒）
 * @returns 节流后的函数
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle((scrollTop: number) => {
 *   updateScrollPosition(scrollTop);
 * }, 100);
 *
 * // 每 100ms 最多执行一次
 * window.addEventListener('scroll', () => throttledScroll(window.scrollY));
 * ```
 */
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

/**
 * requestAnimationFrame 节流函数
 *
 * 使用 requestAnimationFrame 进行节流，确保函数每帧最多执行一次。
 * 适用于动画、拖拽等需要与浏览器渲染同步的场景。
 *
 * @template T - 函数类型
 * @param fn - 要节流的函数
 * @returns RAF 节流后的函数
 *
 * @example
 * ```typescript
 * const rafThrottledMove = rafThrottle((x: number, y: number) => {
 *   updateElementPosition(x, y);
 * });
 *
 * // 在拖拽时使用
 * element.addEventListener('mousemove', (e) => {
 *   rafThrottledMove(e.clientX, e.clientY);
 * });
 * ```
 */
export const rafThrottle = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): ((...args: TArgs) => void) => {
  let rafId: number | null = null;
  let lastArgs: TArgs | null = null;

  return (...args: TArgs) => {
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

/**
 * 带首次立即执行的防抖函数
 *
 * 第一次调用立即执行，后续调用使用防抖逻辑。
 * 适用于需要立即响应用户操作，但后续操作需要防抖的场景。
 *
 * @template T - 函数类型
 * @param fn - 要防抖的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 *
 * @example
 * ```typescript
 * const debouncedSave = debounceWithLeading((data: string) => {
 *   saveToServer(data);
 * }, 1000);
 *
 * // 第一次调用立即执行
 * debouncedSave('first');  // 立即执行
 * debouncedSave('second'); // 1秒后执行（如果没有新的调用）
 * ```
 */
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

/**
 * 批量更新选项
 */
interface BatchUpdateOptions {
  /** 最大批量大小，达到此数量立即刷新 */
  maxBatchSize?: number;
  /** 最大等待时间（毫秒），超时自动刷新 */
  maxWaitTime?: number;
}

/**
 * 创建批量更新器
 *
 * 收集多个更新请求，批量处理以提高性能。
 * 适用于需要批量处理频繁更新的场景（如批量写入数据库）。
 *
 * @template T - 数据项类型
 * @param updateFn - 批量更新函数
 * @param options - 配置选项
 * @param options.maxBatchSize - 最大批量大小（默认 100）
 * @param options.maxWaitTime - 最大等待时间（默认 100ms）
 * @returns 批量更新器对象
 *
 * @example
 * ```typescript
 * const batchUpdater = createBatchUpdater<string>((items) => {
 *   console.log('批量更新:', items);
 * }, { maxBatchSize: 10, maxWaitTime: 1000 });
 *
 * batchUpdater.add('item1');
 * batchUpdater.add('item2');
 * // 达到 maxBatchSize 或 maxWaitTime 后自动刷新
 *
 * // 手动刷新
 * batchUpdater.flush();
 * ```
 */
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

/**
 * 记忆化函数
 *
 * 缓存函数计算结果，相同参数直接返回缓存值。
 * 适用于纯函数或计算成本高的函数。
 *
 * @template T - 函数类型
 * @param fn - 要记忆化的函数
 * @param resolver - 可选的缓存键解析函数
 * @returns 记忆化后的函数
 *
 * @example
 * ```typescript
 * const memoizedFib = memoize((n: number): number => {
 *   if (n <= 1) return n;
 *   return memoizedFib(n - 1) + memoizedFib(n - 2);
 * });
 *
 * memoizedFib(40); // 计算并缓存
 * memoizedFib(40); // 直接返回缓存值
 *
 * // 自定义缓存键
 * const memoizedFetch = memoize(
 *   (url: string, options: object) => fetchData(url, options),
 *   (url, options) => `${url}:${JSON.stringify(options)}`
 * );
 * ```
 */
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

/**
 * 带过期时间的记忆化函数
 *
 * 缓存函数计算结果，并在指定时间后自动过期。
 * 适用于需要定期刷新缓存数据的场景。
 *
 * @template T - 函数类型
 * @param fn - 要记忆化的函数
 * @param ttl - 缓存过期时间（毫秒）
 * @param resolver - 可选的缓存键解析函数
 * @returns 记忆化后的函数
 *
 * @example
 * ```typescript
 * const memoizedFetch = memoizeWithExpiry(
 *   (userId: string) => fetchUserProfile(userId),
 *   60000 // 缓存 1 分钟
 * );
 *
 * memoizedFetch('user-123'); // 计算并缓存
 * memoizedFetch('user-123'); // 1 分钟内返回缓存值
 * // 1 分钟后重新计算
 * ```
 */
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

/**
 * 数组分块
 *
 * 将数组分割成指定大小的多个块。
 *
 * @template T - 数组元素类型
 * @param array - 要分割的数组
 * @param size - 每块的大小
 * @returns 分块后的二维数组
 *
 * @example
 * ```typescript
 * chunk([1, 2, 3, 4, 5], 2);
 * // [[1, 2], [3, 4], [5]]
 * ```
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * 分块处理数组
 *
 * 将数组分块后异步处理，避免一次性处理大量数据导致阻塞。
 * 适用于批量 API 调用、批量数据库操作等场景。
 *
 * @template T - 输入数组元素类型
 * @template R - 输出数组元素类型
 * @param items - 要处理的数组
 * @param chunkSize - 每块的大小
 * @param processor - 处理每块的异步函数
 * @returns 所有块的处理结果合并后的数组
 *
 * @example
 * ```typescript
 * const results = await processInChunks(
 *   largeArray,
 *   100,
 *   async (chunk) => {
 *     return await batchInsert(chunk);
 *   }
 * );
 * ```
 */
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
