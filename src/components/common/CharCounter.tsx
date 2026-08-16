import React from 'react';
import { cn } from '@/utils/utils';

interface CharCounterProps {
  value: number;
  max: number;
  className?: string;
}

/**
 * CharCounter：字符计数反馈，用于带 maxLength 的输入。
 * - 常规：灰色 "x/N"
 * - 接近上限（>80%）：琥珀色警示
 * - 达到/超过上限：红色高亮
 * - 提供 aria-live="polite"，供辅助技术感知变化（不打断正在输入）
 */
const CharCounter: React.FC<CharCounterProps> = ({
  value,
  max,
  className = '',
}) => {
  const over = value > max;
  const nearLimit = !over && max > 0 && value > max * 0.8;

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        over && 'text-red-600 dark:text-red-400 font-medium',
        nearLimit && 'text-amber-600 dark:text-amber-400',
        !over && !nearLimit && 'text-gray-500 dark:text-gray-400',
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {value}/{max}
    </span>
  );
};

export { CharCounter };
export type { CharCounterProps };