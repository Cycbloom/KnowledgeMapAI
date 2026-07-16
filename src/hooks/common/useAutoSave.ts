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
      await onSaveRef.current(valueRef.current);
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
    setStatus('idle');
  }, [clearTimer]);

  return { status, save, reset };
}
