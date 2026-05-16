import { useEffect, useRef, useCallback } from 'react';

interface UseFocusTrapOptions {
  enabled?: boolean;
  initialFocus?: 'first' | 'last' | number;
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, initialFocus = 'first', restoreFocus = true } = options;
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('data-focus-trap-ignore')
    );
  }, []);

  const focusElement = useCallback((element: HTMLElement | undefined | null) => {
    if (element) {
      element.focus({ preventScroll: true });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          focusElement(lastElement);
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          focusElement(firstElement);
        }
      }
    },
    [getFocusableElements, focusElement]
  );

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    if (initialFocus === 'first') {
      focusElement(focusableElements[0]);
    } else if (initialFocus === 'last') {
      focusElement(focusableElements[focusableElements.length - 1]);
    } else if (typeof initialFocus === 'number' && focusableElements[initialFocus]) {
      focusElement(focusableElements[initialFocus]);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (restoreFocus && previousActiveElement.current) {
        focusElement(previousActiveElement.current);
      }
    };
  }, [enabled, initialFocus, restoreFocus, getFocusableElements, focusElement, handleKeyDown]);

  return containerRef;
}
