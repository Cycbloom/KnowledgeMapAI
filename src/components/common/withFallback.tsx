import { ComponentType, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { QueryErrorResetBoundary } from '@tanstack/react-query';

export interface WithFallbackOptions {
  /** 自定义回退 UI（优先级高于 variant） */
  fallback?: ReactNode;
  /** 错误回退变体。默认 'panel' */
  variant?: 'fullscreen' | 'panel' | 'inline';
  /** 传给 ErrorBoundary 的 resetKeys */
  resetKeys?: unknown[];
  /** 是否使用 QueryErrorResetBoundary 包裹。默认 true */
  withQueryReset?: boolean;
}

/**
 * 用 ErrorBoundary 包裹组件，支持面板级优雅降级。
 * 默认启用 QueryErrorResetBoundary，确保 React Query 错误能被重置。
 *
 * @example
 * ```tsx
 * const SafeNotesPanel = withFallback(NotesPanel, { variant: 'panel' });
 * ```
 */
export function withFallback<P extends Record<string, unknown>>(
  WrappedComponent: ComponentType<P>,
  options: WithFallbackOptions = {},
) {
  const {
    fallback,
    variant = 'panel',
    resetKeys,
    withQueryReset = true,
  } = options;

  const displayName = `withFallback(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`;

  if (withQueryReset) {
    const WithQueryReset = (props: P) => (
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            fallback={fallback}
            variant={variant}
            resetKeys={resetKeys ?? [reset]}
          >
            <WrappedComponent {...props} />
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    );
    WithQueryReset.displayName = displayName;
    return WithQueryReset;
  }

  const WithoutQueryReset = (props: P) => (
    <ErrorBoundary
      fallback={fallback}
      variant={variant}
      resetKeys={resetKeys}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  WithoutQueryReset.displayName = displayName;
  return WithoutQueryReset;
}