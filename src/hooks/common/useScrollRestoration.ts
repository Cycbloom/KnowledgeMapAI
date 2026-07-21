import { useEffect, useRef, type RefObject } from "react";

export interface UseScrollRestorationOptions {
  /** 存储类型，默认 sessionStorage（短时记忆） */
  storage?: "localStorage" | "sessionStorage";
  /** TTL 毫秒数，默认 5 分钟（300000ms），到期后不再恢复 */
  ttlMs?: number;
  /** 依赖项变化时重置 scroll 到顶部（如筛选条件变化时不再停留在旧位置） */
  deps?: unknown[];
}

interface StoredScroll {
  scrollTop: number;
  ts: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STORAGE = "sessionStorage" as const;

function getStorage(type: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "localStorage" ? window.localStorage : window.sessionStorage;
}

/**
 * 记录并恢复滚动容器的 scrollTop。
 *
 * - 容器卸载时保存 `scrollTop` 到 storage（带 TTL 时间戳）
 * - 容器首次挂载时尝试读取 storage，有值且未过期则 `scrollTo({ top })`（通过 rAF 延迟一帧）
 * - `deps` 变化时不恢复，重置到顶部（避免筛选后停留在旧位置）
 *
 * @example
 * const scrollRef = useScrollRestoration<HTMLDivElement>("notes-list-scroll", {
 *   deps: [view, sortBy, filterTag],
 * });
 * return <div ref={scrollRef} />;
 */
export function useScrollRestoration<T extends HTMLElement>(
  key: string,
  options?: UseScrollRestorationOptions,
): RefObject<T> {
  const storageType = options?.storage ?? DEFAULT_STORAGE;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const deps = options?.deps ?? [];
  const ref = useRef<T>(null);
  const isFirstRunRef = useRef(true);

  // 卸载时保存 scrollTop（带 TTL 时间戳）
  useEffect(() => {
    return (): void => {
      const store = getStorage(storageType);
      if (store === null) return;
      const el = ref.current;
      if (el === null) return;
      try {
        const entry: StoredScroll = {
          scrollTop: el.scrollTop,
          ts: Date.now(),
        };
        store.setItem(key, JSON.stringify(entry));
      } catch (err) {
        console.warn("[useScrollRestoration] 保存 scrollTop 失败", err);
      }
    };
  }, [key, storageType]);

  // 首次挂载时恢复 / deps 变化时重置到顶部
  useEffect(() => {
    const store = getStorage(storageType);
    if (store === null) return;
    const el = ref.current;
    if (el === null) return;

    const isFirstRun = isFirstRunRef.current;
    isFirstRunRef.current = false;

    if (!isFirstRun) {
      // deps 变化：重置到顶部，不恢复
      const rafId = requestAnimationFrame(() => {
        el.scrollTo({ top: 0 });
      });
      return (): void => cancelAnimationFrame(rafId);
    }

    // 首次挂载：尝试恢复
    let targetScrollTop: number | null = null;
    try {
      const raw = store.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Partial<StoredScroll>;
        if (
          typeof parsed?.scrollTop === "number" &&
          typeof parsed?.ts === "number" &&
          Date.now() - parsed.ts <= ttlMs
        ) {
          targetScrollTop = parsed.scrollTop;
        }
      }
    } catch (err) {
      console.warn("[useScrollRestoration] 读取 scrollTop 失败", err);
    }

    if (targetScrollTop === null) return;

    // 捕获到 const 以避免闭包内类型退化为 number | null
    const top = targetScrollTop;
    const rafId = requestAnimationFrame(() => {
      el.scrollTo({ top });
    });
    return (): void => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, storageType, ttlMs, ...deps]);

  return ref;
}
