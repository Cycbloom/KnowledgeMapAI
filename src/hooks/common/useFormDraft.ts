import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseFormDraftOptions<T> {
  key: string;
  initialValue: T;
  debounceDelay?: number;
  storage?: 'localStorage' | 'sessionStorage';
}

export interface UseFormDraftResult<T> {
  value: T;
  setValue: (v: T | ((prev: T) => T)) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  showRestorePrompt: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function useFormDraft<T>(options: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const {
    key,
    initialValue,
    debounceDelay = 800,
    storage: storageType = 'localStorage',
  } = options;
  const [value, setValueState] = useState<T>(initialValue);
  const [hasDraft, setHasDraft] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstWriteRef = useRef(true);
  // 挂载时的初始值快照：仅在与初始值存在实质差异时才记录草稿/提示恢复，
  // 避免把等于初始值的空草稿误判为“未保存的草稿”。
  const initialRef = useRef(initialValue);

  const getStorage = useCallback((): Storage | null => {
    try {
      return storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  }, [storageType]);

  const clearDraft = useCallback(() => {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
      setHasDraft(false);
    } catch (error) {
      console.error('[useFormDraft] failed to clear draft:', error);
    }
  }, [key, getStorage]);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(key);
      // 仅有实际内容差异的草稿才算“未保存的草稿”。等于初始值的残留空草稿
      // （如挂载即自动写入、取消未清理）直接清理并清理提示，避免每次打开误弹“恢复草稿”。
      if (raw !== null) {
        if (raw === JSON.stringify(initialRef.current)) {
          storage.removeItem(key);
        } else if (raw !== 'null' && raw !== 'undefined' && raw !== '') {
          setHasDraft(true);
          setShowRestorePrompt(true);
        }
      }
    } catch (error) {
      console.error('[useFormDraft] failed to read draft on mount:', error);
    }
  }, [key, getStorage]);

  useEffect(() => {
    if (isFirstWriteRef.current) {
      isFirstWriteRef.current = false;
      return;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    // 值回到了初始值说明没有实质草稿，清理残留即可，不再落盘
    if (JSON.stringify(value) === JSON.stringify(initialRef.current)) {
      clearDraft();
      return;
    }
    timerRef.current = setTimeout(() => {
      const storage = getStorage();
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('[useFormDraft] failed to persist draft:', error);
      }
    }, debounceDelay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, key, debounceDelay, getStorage, clearDraft]);

  const setValue = useCallback((v: T | ((prev: T) => T)) => {
    setValueState(v);
  }, []);

  const onRestore = useCallback(() => {
    const storage = getStorage();
    if (storage) {
      try {
        const raw = storage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as T;
          setValueState(parsed);
        }
      } catch (error) {
        console.error('[useFormDraft] failed to restore draft:', error);
      }
    }
    setShowRestorePrompt(false);
  }, [key, getStorage]);

  const onDiscard = useCallback(() => {
    clearDraft();
    setShowRestorePrompt(false);
  }, [clearDraft]);

  return {
    value,
    setValue,
    clearDraft,
    hasDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  };
}
