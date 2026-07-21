import { useCallback, useEffect, useRef, useState } from 'react';

export type MicrofeedbackState = 'idle' | 'pending' | 'success' | 'error';

export interface UseMicrofeedbackOptions {
  /** 自动复位毫秒数，默认 1500 */
  resetMs?: number;
  /** 成功后是否自动复位，默认 true */
  resetOnSuccess?: boolean;
  /** 失败后是否自动复位，默认 false（错误不复位） */
  resetOnError?: boolean;
}

export interface UseMicrofeedbackReturn {
  state: MicrofeedbackState;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** 进入 pending */
  trigger: () => void;
  /** 进入 success（按 resetOnSuccess 自动复位） */
  succeed: () => void;
  /** 进入 error（按 resetOnError 决定是否复位） */
  fail: () => void;
  /** 强制回 idle */
  reset: () => void;
  /** 一站式：trigger → await → succeed/fail；失败时重新 throw */
  run: <T>(promise: Promise<T>) => Promise<T>;
}

const DEFAULT_RESET_MS = 1500;

export function useMicrofeedback(options?: UseMicrofeedbackOptions): UseMicrofeedbackReturn {
  const resetMs = options?.resetMs ?? DEFAULT_RESET_MS;
  const resetOnSuccess = options?.resetOnSuccess ?? true;
  const resetOnError = options?.resetOnError ?? false;

  const [state, setState] = useState<MicrofeedbackState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setState('idle');
    }, resetMs);
  }, [clearTimer, resetMs]);

  const reset = useCallback(() => {
    clearTimer();
    setState('idle');
  }, [clearTimer]);

  const trigger = useCallback(() => {
    clearTimer();
    setState('pending');
  }, [clearTimer]);

  const succeed = useCallback(() => {
    setState('success');
    if (resetOnSuccess) {
      scheduleReset();
    }
  }, [resetOnSuccess, scheduleReset]);

  const fail = useCallback(() => {
    setState('error');
    if (resetOnError) {
      scheduleReset();
    }
  }, [resetOnError, scheduleReset]);

  const run = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      trigger();
      try {
        const result = await promise;
        succeed();
        return result;
      } catch (error) {
        fail();
        throw error;
      }
    },
    [trigger, succeed, fail],
  );

  // 组件卸载时清理 timer，避免内存泄漏与对已卸载组件调用 setState
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    isIdle: state === 'idle',
    isPending: state === 'pending',
    isSuccess: state === 'success',
    isError: state === 'error',
    trigger,
    succeed,
    fail,
    reset,
    run,
  };
}
