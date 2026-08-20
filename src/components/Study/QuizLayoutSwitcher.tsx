import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, BookOpenCheck, type LucideIcon } from 'lucide-react';
import type { LayoutMode } from '../../hooks/quiz/useQuizLayoutPref';

interface QuizLayoutSwitcherProps {
  layoutMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  value: LayoutMode;
  labelKey: 'study.quiz.layoutFlash' | 'study.quiz.layoutFocus';
  icon: LucideIcon;
}

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  { value: 'flash', labelKey: 'study.quiz.layoutFlash', icon: Zap },
  { value: 'focus', labelKey: 'study.quiz.layoutFocus', icon: BookOpenCheck },
];

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
    <div
      className="inline-flex items-center rounded-xl border overflow-hidden bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 shadow-sm"
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
            className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium min-h-[40px] sm:min-h-[44px] transition-all flex items-center gap-1.5 sm:gap-2 select-none ${
              isActive
                ? 'bg-primary-500 dark:bg-primary-600 text-white'
                : isOptionDisabled
                  ? 'text-gray-300 dark:text-slate-500 cursor-not-allowed opacity-60'
                  : 'text-gray-500 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Icon size={14} className="sm:hidden" aria-hidden={true} />
            <Icon size={16} className="hidden sm:block" aria-hidden={true} />
            <span>{t(opt.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
};
