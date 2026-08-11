import { useCallback, useRef, useState } from 'react';
import type { ErrorBannerLevel } from '@/components/common/ErrorBanner';

export interface ShowErrorProps {
  title?: string;
  message: string;
  level?: ErrorBannerLevel;
  duration?: number;
  error?: Error;
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
}

export interface UseErrorBannerOptions {
  defaultLevel?: ErrorBannerLevel;
  defaultDuration?: number;
}

export interface UseErrorBannerReturn {
  show: (props: ShowErrorProps) => void;
  dismiss: () => void;
  isVisible: boolean;
  currentLevel: ErrorBannerLevel | null;
  /** 当前展示的 banner props，供 ErrorBanner 组件渲染使用 */
  bannerProps: ShowErrorProps | null;
}

export function useErrorBanner(
  options: UseErrorBannerOptions = {},
): UseErrorBannerReturn {
  const { defaultLevel = 'toast', defaultDuration = 5000 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<ErrorBannerLevel | null>(null);
  const [bannerProps, setBannerProps] = useState<ShowErrorProps | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (props: ShowErrorProps) => {
      const level = props.level ?? defaultLevel;

      setBannerProps(props);
      setCurrentLevel(level);
      setIsVisible(true);

      // toast 级别自动消失
      if (level === 'toast') {
        const duration = props.duration ?? defaultDuration;
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }
        dismissTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          setCurrentLevel(null);
          setBannerProps(null);
          dismissTimerRef.current = null;
        }, duration);
      }
    },
    [defaultLevel, defaultDuration],
  );

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setIsVisible(false);
    setCurrentLevel(null);
    setBannerProps(null);
  }, []);

  return {
    show,
    dismiss,
    isVisible,
    currentLevel,
    bannerProps,
  };
}