/** @mastery display - 用户可见掌握度徽章渲染：颜色/标签/百分比文本/图标 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import {
  formatMasteryPct,
  getMasteryLabelKey,
  getMasteryTone,
  type MasteryTone,
} from '@/utils/formatMastery';

type MasteryLevelBadgeSize = 'sm' | 'md' | 'lg';
type MasteryLevelBadgeVariant = 'pill' | 'compact' | 'full';

const TONE_MAP: Record<MasteryTone, {
  textLight: string;
  textDark: string;
  pillBgLight: string;
  pillBgDark: string;
}> = {
  sky: {
    textLight: 'text-sky-700',
    textDark: 'text-sky-400',
    pillBgLight: 'bg-sky-50',
    pillBgDark: 'bg-sky-950/40',
  },
  amber: {
    textLight: 'text-amber-700',
    textDark: 'text-amber-400',
    pillBgLight: 'bg-amber-50',
    pillBgDark: 'bg-amber-950/40',
  },
  emerald: {
    textLight: 'text-emerald-700',
    textDark: 'text-emerald-400',
    pillBgLight: 'bg-emerald-50',
    pillBgDark: 'bg-emerald-950/40',
  },
  rose: {
    textLight: 'text-rose-700',
    textDark: 'text-rose-400',
    pillBgLight: 'bg-rose-50',
    pillBgDark: 'bg-rose-950/40',
  },
  violet: {
    textLight: 'text-violet-700',
    textDark: 'text-violet-400',
    pillBgLight: 'bg-violet-50',
    pillBgDark: 'bg-violet-950/40',
  },
  slate: {
    textLight: 'text-slate-600',
    textDark: 'text-slate-400',
    pillBgLight: 'bg-slate-50',
    pillBgDark: 'bg-slate-800/50',
  },
} as const;

const SIZE_CONFIG: Record<MasteryLevelBadgeSize, {
  icon: number;
  text: string;
  padding: string;
  gap: string;
}> = {
  sm: {
    icon: 12,
    text: 'text-[10px]',
    padding: 'px-1 py-0.5',
    gap: 'gap-0.5',
  },
  md: {
    icon: 14,
    text: 'text-xs',
    padding: 'px-1.5 py-0.5',
    gap: 'gap-1',
  },
  lg: {
    icon: 16,
    text: 'text-sm',
    padding: 'px-2 py-1',
    gap: 'gap-1.5',
  },
};

export interface MasteryLevelBadgeProps {
  mastery: number;
  size?: MasteryLevelBadgeSize;
  variant?: MasteryLevelBadgeVariant;
  showIcon?: boolean;
  showLabel?: boolean;
  showPercent?: boolean;
  isDark?: boolean;
  className?: string;
}

export const MasteryLevelBadge: React.FC<MasteryLevelBadgeProps> = ({
  mastery,
  size = 'md',
  variant = 'pill',
  showIcon = true,
  showLabel = true,
  showPercent = true,
  isDark,
  className = '',
}) => {
  /** @mastery display - 徽章颜色tone、标签key、百分比文本：仅用于 UI 展示 */
  const { t } = useTranslation();
  const themeDark = isDark ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const tone = getMasteryTone(mastery);
  const toneClasses = TONE_MAP[tone];
  const sizeConfig = SIZE_CONFIG[size];
  const labelKey = getMasteryLabelKey(mastery);
  const percentText = formatMasteryPct(mastery);

  const textClass = themeDark ? toneClasses.textDark : toneClasses.textLight;
  const pillBgClass = themeDark ? toneClasses.pillBgDark : toneClasses.pillBgLight;

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding} rounded-md ${pillBgClass} ${textClass} ${sizeConfig.text} font-semibold tabular-nums ${className}`.trim()}
        title={`${t(labelKey as never)} ${percentText}`}
      >
        {showIcon && <Brain size={sizeConfig.icon} className="shrink-0" />}
        {showPercent && <span>{percentText}</span>}
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <span
        className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding} rounded-md ${pillBgClass} ${textClass} ${sizeConfig.text} ${className}`.trim()}
      >
        {showIcon && <Brain size={sizeConfig.icon} className="shrink-0" />}
        {showLabel && (
          <span className="font-bold shrink-0">
            {t(labelKey as never)}
          </span>
        )}
        {showPercent && (
          <span className="font-semibold tabular-nums shrink-0">
            {percentText}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding} rounded-md ${pillBgClass} ${textClass} ${sizeConfig.text} ${className}`.trim()}
    >
      {showIcon && <Brain size={sizeConfig.icon} className="shrink-0" />}
      {showPercent && (
        <span className="font-semibold tabular-nums shrink-0">
          {percentText}
        </span>
      )}
      {showLabel && (
        <span className="font-medium shrink-0 opacity-90">
          {t(labelKey as never)}
        </span>
      )}
    </span>
  );
};

export default MasteryLevelBadge;
