import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, BookOpenCheck, Check, type LucideIcon } from 'lucide-react';
import type { LayoutMode } from '../../hooks/quiz/useQuizLayoutPref';

interface QuizLayoutSwitcherProps {
  layoutMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  value: LayoutMode;
  labelKey: 'study.quiz.layoutFlash' | 'study.quiz.layoutFocus';
  hintKey: 'study.quiz.layoutFlashHint' | 'study.quiz.layoutFocusHint';
  icon: LucideIcon;
}

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    value: 'flash',
    labelKey: 'study.quiz.layoutFlash',
    hintKey: 'study.quiz.layoutFlashHint',
    icon: Zap,
  },
  {
    value: 'focus',
    labelKey: 'study.quiz.layoutFocus',
    hintKey: 'study.quiz.layoutFocusHint',
    icon: BookOpenCheck,
  },
];

/**
 * QuizLayoutSwitcher
 * 答题模式（闪卡 / 专注）切换器。侧边栏原生纵向双按钮样式：
 * - 顶部分区标签「答题布局」，与进度/退出同语系视觉
 * - 两行按钮纵向堆叠：未激活为浅灰底；激活为主色实底 + 勾选图标
 * - 保留 role=radiogroup / radio 语义与 aria 属性，保证键盘可访问
 */
export const QuizLayoutSwitcher: React.FC<QuizLayoutSwitcherProps> = ({
  layoutMode,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const handleSelect = (mode: LayoutMode, isOptionDisabled: boolean) => {
    if (isOptionDisabled) {
      return;
    }
    onChange(mode);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-xs text-slate-500 dark:text-slate-400 px-0.5">
        {t('study.quiz.mode')}
      </div>
      <div
        className="flex flex-col gap-2 w-full"
        role="radiogroup"
        aria-label={t('study.quiz.layoutLabel')}
      >
        {MODE_OPTIONS.map((opt) => {
          const isFocusOption = opt.value === 'focus';
          const isOptionDisabled = disabled && isFocusOption;
          const Icon = opt.icon;
          const isActive = layoutMode === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={isOptionDisabled}
              tabIndex={isActive ? 0 : -1}
              disabled={isOptionDisabled}
              onClick={() => handleSelect(opt.value, isOptionDisabled)}
              title={
                isOptionDisabled
                  ? t('study.quiz.layoutFlash')
                  : t(opt.labelKey)
              }
              className={`w-full h-11 rounded-lg inline-flex items-center gap-2.5 px-3 transition-all select-none ${
                isActive
                  ? 'bg-primary-500 dark:bg-primary-600 text-white shadow-sm'
                  : isOptionDisabled
                    ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-70'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} className="shrink-0" aria-hidden={true} />
              <span className="flex-1 flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold whitespace-nowrap">
                  {t(opt.labelKey)}
                </span>
                <span
                  className={`truncate text-xs ${
                    isActive
                      ? 'text-white/85'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t(opt.hintKey)}
                </span>
              </span>
              {isActive ? (
                <Check size={16} className="shrink-0" aria-hidden={true} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
