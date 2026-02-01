import React, { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const LoadingBar: React.FC = () => {
  const isFetching = useIsFetching({
    predicate: (query) => !query.meta?.silent
  });
  const isMutating = useIsMutating();
  const isLoading = isFetching > 0 || isMutating > 0;
  
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    if (isLoading) {
      setIsVisible(true);
      setProgress(old => (old < 10 ? 10 : old)); // Start at 10%
      
      // Slowly increase progress up to 90%
      interval = setInterval(() => {
        setProgress(old => {
          if (old >= 90) return old;
          const diff = Math.random() * 10;
          return Math.min(old + diff, 90);
        });
      }, 500);
    } else {
      // Complete the progress bar
      setProgress(100);
      
      // Hide after animation finishes
      timeout = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 400);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoading]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none">
      <div 
        className="h-full bg-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
