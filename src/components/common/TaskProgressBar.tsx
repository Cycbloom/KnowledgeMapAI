import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { TaskRuntimeProgress } from '@shared/types/common';

interface TaskProgressBarProps {
  progress?: TaskRuntimeProgress;
  className?: string;
}

/**
 * 任务运行时进度条（通用组件）。
 *
 * - `progress === undefined`：返回 `null`
 * - 有 `percent`：渲染填充进度条
 * - 无 `percent`：渲染动画 indeterminate 模式
 * - 有 `completed/total`：追加"已完成 X/Y"文本
 * - 有 `stageLabel`：追加阶段文案
 * - 有 `current`：追加"当前：xxx"文本
 *
 * 暗色模式通过 `dark:` 前缀 Tailwind 类适配，依赖 `darkMode: "class"` 配置。
 */
export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({
  progress,
  className,
}) => {
  const { t } = useTranslation();
  if (!progress) return null;

  const hasPercent = typeof progress.percent === 'number';
  const hasCount =
    typeof progress.completed === 'number' &&
    typeof progress.total === 'number';

  // 状态行："{stageLabel} · 已完成 X/Y"
  const statusParts: string[] = [];
  if (progress.stageLabel) {
    statusParts.push(progress.stageLabel);
  }
  if (hasCount) {
    statusParts.push(t('common.taskProgress.completedFormat', {
      completed: progress.completed ?? 0,
      total: progress.total ?? 0,
    }));
  }
  const statusText = statusParts.join(' · ');

  // 限制 percent 到 0-100，防止后端推送异常值导致布局溢出
  const safePercent = hasPercent
    ? Math.max(0, Math.min(100, progress.percent ?? 0))
    : 0;

  return (
    <div className={cn('space-y-1', className)} data-testid="task-progress-bar">
      <div
        role="progressbar"
        aria-valuenow={hasPercent ? safePercent : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={statusText || progress.stageLabel || t('common.taskProgress.title')}
        className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700"
      >
        {hasPercent ? (
          <div
            className="h-full bg-primary-500 dark:bg-primary-400 transition-all duration-300"
            style={{ width: `${safePercent}%` }}
            data-testid="task-progress-bar-fill"
          />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-r from-primary-500 to-violet-500 dark:from-primary-400 dark:to-violet-400 animate-pulse"
            data-testid="task-progress-bar-indeterminate"
          />
        )}
      </div>

      {(statusText || progress.current) && (
        <div
          className="text-xs text-gray-600 dark:text-slate-400 space-y-0.5"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusText && (
            <div data-testid="task-progress-status">{statusText}</div>
          )}
          {progress.current && (
            <div data-testid="task-progress-current">{t('common.taskProgress.current', { current: progress.current })}</div>
          )}
        </div>
      )}
    </div>
  );
};

export type { TaskProgressBarProps };
