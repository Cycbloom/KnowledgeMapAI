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
