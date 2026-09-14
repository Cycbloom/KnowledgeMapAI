import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAutoSaveOptions<T> {
  value: T;
  onSave: (value: T) => Promise<void> | void;
  delay?: number;
  enabled?: boolean;
}

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveResult {
  status: AutoSaveStatus;
  save: () => Promise<void>;
  reset: () => void;
}

export function useAutoSave<T>(options: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const { value, onSave, delay = 3000, enabled = true } = options;
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const valueRef = useRef(value);
  // 记录最近一次已保存的值。自动保存仅在值发生变化后触发：
  // - 首次挂载（含 StrictMode 下 effect 二次执行）值未变 → 不保存；
  // - 用户改回已保存的值 → 不重复保存。
  const lastSavedRef = useRef(value);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const executeSave = useCallback(async () => {
    clearTimer();
    setStatus('saving');
    try {
      const currentValue = valueRef.current;
      await onSaveRef.current(currentValue);
      lastSavedRef.current = currentValue;
      setStatus('saved');
    } catch (error) {
      console.error('[useAutoSave] save failed:', error);
      setStatus('error');
    }
  }, [clearTimer]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!enabled) return;
    // 值未变化（例如 StrictMode 使 effect 执行两次、或用户改回已保存值）→ 不保存
    if (value === lastSavedRef.current) return;

    clearTimer();
    timerRef.current = setTimeout(() => {
      void executeSave();
    }, delay);

    return () => {
      clearTimer();
    };
  }, [value, delay, enabled, clearTimer, executeSave]);

  const save = useCallback(async () => {
    if (!enabled) return;
    await executeSave();
  }, [enabled, executeSave]);

  const reset = useCallback(() => {
    clearTimer();
    lastSavedRef.current = valueRef.current;
    setStatus('idle');
  }, [clearTimer]);

  return { status, save, reset };
}
