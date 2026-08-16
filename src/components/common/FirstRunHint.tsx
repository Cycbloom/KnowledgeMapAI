import React from 'react';
import { useFirstRunHint } from '@/hooks/common/useFirstRunHint';
import { cn } from '@/utils/utils';

export interface FirstRunHintProps {
  /** localStorage key，用于持久化 dismiss 标记 */
  storageKey: string;
  /** 标题文本 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** dismiss 按钮文案（应为已翻译文本） */
  dismissLabel: string;
  /** 箭头方向：指向下方元素用 'bottom'（默认），指向上方元素用 'top' */
  placement?: 'top' | 'bottom';
  className?: string;
  /** dismiss 时额外回调 */
  onDismiss?: () => void;
  /** 受控模式：传入时用它覆盖内部 isVisible 决定是否渲染；未传入时保持内部逻辑 */
  visible?: boolean;
}

export const FirstRunHint: React.FC<FirstRunHintProps> = ({
  storageKey,
  title,
  description,
  dismissLabel,
  placement = 'bottom',
  className,
  onDismiss,
  visible,
}) => {
  const internal = useFirstRunHint({ storageKey });

  const isVisible = visible ?? internal.isVisible;

  if (!isVisible) return null;

  const handleDismiss = () => {
    internal.dismiss();
    onDismiss?.();
  };

  return (
    <div
      className={cn('relative', className)}
      role="status"
      data-testid="first-run-hint"
    >
      <div className="relative bg-primary-600 text-white rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-1">{title}</p>
        {description && (
          <p className="text-xs text-primary-50 mb-2">{description}</p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            {dismissLabel}
          </button>
        </div>
        {/* 指向箭头：'top' 时朝上并指向上方元素，'bottom'（默认）时朝下指向下方元素 */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8',
            placement === 'top'
              ? '-top-2 border-l-transparent border-r-transparent border-b-8 border-b-primary-600'
              : '-bottom-2 border-l-transparent border-r-transparent border-t-8 border-t-primary-600',
          )}
        />
      </div>
    </div>
  );
};