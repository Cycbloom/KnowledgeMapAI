import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import type { LayoutMode } from '../../hooks/quiz/useQuizLayoutPref';
import { QuizLayoutSwitcher } from './QuizLayoutSwitcher';

interface QuizActiveHeaderProps {
  isDark: boolean;
  isMobile: boolean;
  layoutMode: LayoutMode;
  onChangeLayout: (mode: LayoutMode) => void;
  isForcedFlash: boolean;
  currentCardIndex: number;
  quizCardsLength: number;
  onBackToDashboard: () => void;
  showSliderHint?: boolean;
}

export function QuizActiveHeader({
  isDark,
  isMobile,
  layoutMode,
  onChangeLayout,
  isForcedFlash,
  currentCardIndex,
  quizCardsLength,
  onBackToDashboard,
  showSliderHint = false,
}: QuizActiveHeaderProps) {
  void isMobile;
  const { t } = useTranslation();

  const progressText = t('study.header.progressFmt', {
    current: currentCardIndex + 1,
    total: quizCardsLength,
  });

  return (
    <header
      className={`flex-none h-14 md:h-16 flex items-center justify-between gap-3 px-3 md:px-6 w-full border-b backdrop-blur ${
        isDark
          ? 'dark:bg-slate-900/80 border-slate-700'
          : 'bg-white/80 border-gray-200'
      }`}
    >
      <div className="flex-none">
        <button
          type="button"
          onClick={onBackToDashboard}
          aria-label={t('study.header.exit')}
          className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-1 px-2 rounded-lg border transition-colors text-sm font-medium ${
            isDark
              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
          }`}
        >
          <ArrowLeft size={18} aria-hidden={true} />
          <span>{t('study.header.exit')}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 text-center">
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <h2
          role="heading"
          aria-level={2}
          className={`text-base md:text-lg font-semibold truncate ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {t('study.header.titleQuiz')}
        </h2>
        <div
          className={`text-[11px] md:text-xs opacity-70 ${
            isDark ? 'text-slate-300' : 'text-gray-600'
          }`}
        >
          {showSliderHint
            ? t('study.header.slideHint')
            : t('study.header.focusHint')}
        </div>
      </div>

      <div className="flex-none flex items-center gap-2 md:gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs md:text-sm font-medium ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-white border-gray-200 text-gray-700'
          }`}
        >
          {progressText}
        </span>

        <div className="max-md:hidden">
          <QuizLayoutSwitcher
            layoutMode={layoutMode}
            onChange={onChangeLayout}
            disabled={isForcedFlash}
          />
        </div>
      </div>
    </header>
  );
}
