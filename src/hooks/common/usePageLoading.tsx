import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface PageLoadingContextValue {
  isPageLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const PageLoadingContext = createContext<PageLoadingContextValue>({
  isPageLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function PageLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false);

  const startLoading = useCallback(() => setIsPageLoading(true), []);
  const stopLoading = useCallback(() => setIsPageLoading(false), []);

  return (
    <PageLoadingContext.Provider value={{ isPageLoading, startLoading, stopLoading }}>
      {children}
    </PageLoadingContext.Provider>
  );
}

/**
 * Marks the current route content as loaded.
 * Place this inside a Suspense boundary so it only renders
 * when the actual lazy component is committed (not the fallback).
 */
export function PageLoadedMarker() {
  const { stopLoading } = usePageLoading();

  useEffect(() => {
    stopLoading();
  }, [stopLoading]);

  return null;
}

export function usePageLoading(): PageLoadingContextValue {
  const ctx = useContext(PageLoadingContext);
  if (!ctx) {
    throw new Error('usePageLoading must be used within a PageLoadingProvider');
  }
  return ctx;
}