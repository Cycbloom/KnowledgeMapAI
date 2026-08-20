import { useState, useCallback, useEffect } from 'react';
import { useIsMobile } from '../common/useIsMobile';

export type LayoutMode = 'flash' | 'focus';

const STORAGE_KEY = 'km-quiz-layout';
const VALID_MODES: ReadonlyArray<LayoutMode> = ['flash', 'focus'];

function isValidMode(value: unknown): value is LayoutMode {
  return VALID_MODES.includes(value as LayoutMode);
}

function readStoredMode(): LayoutMode {
  try {
    if (typeof window === 'undefined') {
      return 'flash';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return 'flash';
    }
    return isValidMode(stored) ? stored : 'flash';
  } catch {
    return 'flash';
  }
}

function writeStoredMode(mode: LayoutMode): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    console.warn('[useQuizLayoutPref] Failed to write layout preference to localStorage:', err);
  }
}

export interface UseQuizLayoutPrefReturn {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  isForcedFlash: boolean;
}

export function useQuizLayoutPref(): UseQuizLayoutPrefReturn {
  const deviceInfo = useIsMobile();
  const isForcedFlash = deviceInfo.isMobile;

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    const initial = readStoredMode();
    return isForcedFlash ? 'flash' : initial;
  });

  useEffect(() => {
    if (isForcedFlash && layoutMode !== 'flash') {
      setLayoutModeState('flash');
    }
  }, [isForcedFlash, layoutMode]);

  const setLayoutMode = useCallback(
    (mode: LayoutMode) => {
      if (isForcedFlash) {
        return;
      }
      if (!isValidMode(mode)) {
        return;
      }
      setLayoutModeState(mode);
      writeStoredMode(mode);
    },
    [isForcedFlash],
  );

  return {
    layoutMode: isForcedFlash ? 'flash' : layoutMode,
    setLayoutMode,
    isForcedFlash,
  };
}
