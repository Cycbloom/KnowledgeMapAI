import React, { useLayoutEffect, useState, useRef } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const LoadingBar: React.FC = () => {
  const isFetching = useIsFetching({
    predicate: (query) => !query.meta?.silent
  });
  // Bug 5: 过滤掉标记为 silent 的 mutation(如笔记自动保存),
  // 避免静默后台操作触发顶部进度条。
  const isMutating = useIsMutating({
    predicate: (mutation) => !mutation.options.meta?.silent,
  });
  const isLoading = isFetching > 0 || isMutating > 0;
  
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsLoadingRef = useRef(isLoading);

  useLayoutEffect(() => {
    if (isLoading === prevIsLoadingRef.current) return;
    prevIsLoadingRef.current = isLoading;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isLoading) {
      setIsVisible(true);
      setProgress(10);
      
      intervalRef.current = setInterval(() => {
        setProgress(old => {
          if (old >= 90) return old;
          const diff = Math.random() * 10;
          return Math.min(old + diff, 90);
        });
      }, 500);
    } else {
      setProgress(100);
      
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 400);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoading]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none" aria-live="polite" aria-atomic="true">
      <div
        className="h-full bg-primary-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
