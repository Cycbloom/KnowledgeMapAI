import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSaveFeedbackResult {
  /** Whether the transient "saved" indicator should currently be shown. */
  saved: boolean;
  /** Show the "saved" indicator and auto-hide it after the configured duration. */
  notify: () => void;
}

const DEFAULT_SAVED_DURATION_MS = 1500;

/**
 * Provides a transient "saved" feedback flag for auto-persisted settings.
 * Calling `notify()` sets `saved` to true and schedules a timer to reset it
 * after the given duration, so client-side write actions can confirm to the
 * user that their change has been persisted.
 */
export const useSaveFeedback = (
  durationMs: number = DEFAULT_SAVED_DURATION_MS,
): UseSaveFeedbackResult => {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(() => {
    setSaved(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setSaved(false), durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { saved, notify };
};