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

  const getStorage = useCallback((): Storage | null => {
    try {
      return storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  }, [storageType]);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        setHasDraft(true);
        setShowRestorePrompt(true);
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
  }, [value, key, debounceDelay, getStorage]);

  const setValue = useCallback((v: T | ((prev: T) => T)) => {
    setValueState(v);
  }, []);

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
