import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePersistedListStateOptions {
  /** 存储类型，默认 localStorage */
  storage?: "localStorage" | "sessionStorage";
  /** 可选 TTL（毫秒），到期后视为无值并清除存储 */
  ttlMs?: number;
}

interface StoredEntry<T> {
  value: T;
  ts: number;
}

const DEBOUNCE_MS = 200;

function getStorage(type: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return type === "localStorage" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 从 storage 读取并校验 TTL。
 * - 解析失败或字段缺失：返回 null（不视为有效值）
 * - TTL 过期：清除 storage 中的条目并返回 null
 * - TTL 未配置或 ts 缺失：跳过 TTL 校验，返回 value
 */
function readStored<T>(
  storage: Storage,
  key: string,
  ttlMs?: number,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEntry<T>>;
    if (parsed === null || typeof parsed !== "object") return null;

    if (ttlMs !== undefined && typeof parsed.ts === "number") {
      if (Date.now() - parsed.ts > ttlMs) {
        storage.removeItem(key);
        return null;
      }
    }

    if ("value" in parsed) {
      return parsed.value as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 通用列表状态持久化 hook。
 *
 * - 基于 useState 懒初始化从 storage 读取（带 TTL 校验）
 * - 写入 debounce 200ms，仅当用户主动调用 setValue 后才写入
 *   （避免 mount 时把恢复的值或默认值写回 storage，导致 TTL 被刷新）
 * - 跨 tab 同步：监听 storage 事件（仅 localStorage），来自其他 tab 的更新
 *   不会触发回写（通过 userHasChangedRef 控制，避免循环）
 * - SSR 安全：typeof window === "undefined" 时仅返回 defaultValue
 *
 * @example
 * const [sortBy, setSortBy, { clear }] = usePersistedListState(
 *   "dashboard-sortBy",
 *   "updatedAt",
 * );
 */
export function usePersistedListState<T>(
  key: string,
  defaultValue: T,
  options?: UsePersistedListStateOptions,
): [T, (value: T | ((prev: T) => T)) => void, { clear: () => void }] {
  const storageType = options?.storage ?? "localStorage";
  const ttlMs = options?.ttlMs;
  const isClient = typeof window !== "undefined";

  // 懒初始化：在 render 阶段同步读取 storage（SSR 环境跳过）
  const [state, setState] = useState<T>(() => {
    if (!isClient) return defaultValue;
    const storage = getStorage(storageType);
    if (storage === null) return defaultValue;
    return readStored<T>(storage, key, ttlMs) ?? defaultValue;
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 标记：仅当用户主动调用 setValue 后才允许写入 storage。
  // mount 恢复 / storage 事件同步触发的 setState 不应回写，避免循环与 TTL 刷新。
  const userHasChangedRef = useRef(false);

  // 写入 storage（debounce 200ms）
  useEffect(() => {
    if (!isClient) return;
    if (!userHasChangedRef.current) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const storage = getStorage(storageType);
      if (storage === null) return;
      try {
        const entry: StoredEntry<T> = { value: state, ts: Date.now() };
        storage.setItem(key, JSON.stringify(entry));
      } catch (err) {
        console.warn("[usePersistedListState] 写入 storage 失败", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [state, key, storageType, isClient]);

  // 跨 tab 同步：监听 storage 事件（仅 localStorage，sessionStorage 不跨 tab）
  useEffect(() => {
    if (!isClient) return;
    if (storageType !== "localStorage") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<StoredEntry<T>>;
        if (parsed === null || typeof parsed !== "object") return;

        if (ttlMs !== undefined && typeof parsed.ts === "number") {
          if (Date.now() - parsed.ts > ttlMs) return;
        }

        if ("value" in parsed) {
          // 来自其他 tab 的更新，不触发回写（避免循环）
          userHasChangedRef.current = false;
          setState(parsed.value as T);
        }
      } catch {
        // 忽略解析错误
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [key, storageType, ttlMs, isClient]);

  // 卸载时清理 debounce timer，避免对已卸载组件调用
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    userHasChangedRef.current = true;
    setState(value);
  }, []);

  const clear = useCallback(() => {
    if (isClient) {
      const storage = getStorage(storageType);
      if (storage !== null) {
        try {
          storage.removeItem(key);
        } catch (err) {
          console.warn("[usePersistedListState] 清除 storage 失败", err);
        }
      }
    }
    // 重置标记：clear 触发的 setState 不应回写 storage（否则会立刻把默认值写回去）
    userHasChangedRef.current = false;
    setState(defaultValue);
  }, [key, storageType, isClient, defaultValue]);

  return [state, setValue, { clear }];
}
