import { useCallback, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

export interface UseSkipToContentResult {
  skipLinkRef: RefObject<HTMLAnchorElement>;
  mainRef: RefObject<HTMLElement>;
  handleSkip: (e: KeyboardEvent) => void;
}

export function useSkipToContent(): UseSkipToContentResult {
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const handleSkip = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    mainRef.current?.focus();
  }, []);

  return { skipLinkRef, mainRef, handleSkip };
}
