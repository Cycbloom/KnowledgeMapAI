import React, { useMemo } from 'react';
import { Check, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuizProgressBarProps {
  current: number;
  total: number;
  answered: boolean[];
  onJump: (index: number) => void;
  flaggedCount?: number;
}

const QuizProgressBarComponent: React.FC<QuizProgressBarProps> = ({
  current,
  total,
  answered,
  onJump,
  flaggedCount = 0,
}) => {
  const { t } = useTranslation();
  // 单趟统计已答题数，替代三处 answered.filter(Boolean).length 的 O(3*answered) 扫描
  const answeredCount = useMemo(() => {
    let c = 0;
    for (const a of answered) if (a) c++;
    return c;
  }, [answered]);
  const progress = total > 0 ? (answeredCount / total) * 100 : 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {t('study.quizProgressBar.questionProgress', { current: current + 1, total })}
        </span>
        <div className="flex items-center gap-3">
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-500" title={t('quiz.progress.flaggedForReview')}>
              <Flag size={12} fill="currentColor" aria-hidden="true" />
              {flaggedCount}
            </span>
          )}
          <span
            className="text-gray-500"
            aria-live="polite"
            aria-atomic="true"
          >
            {t('study.quizProgressBar.answeredCount', { count: answeredCount })}
          </span>
        </div>
      </div>

      <div
        className="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('quiz.progressBar.ariaLabel')}
      >
        <div
          className="absolute h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: total }, (_, index) => {
          const isAnswered = answered[index];
          const isCurrent = index === current;

          return (
            <button
              key={index}
              onClick={() => onJump(index)}
              className={`
                w-8 h-8 rounded-lg text-xs font-bold transition-all relative
                ${isCurrent
                  ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-2 dark:ring-offset-slate-900'
                  : isAnswered
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }
              `}
              aria-label={t('study.quizProgressBar.questionAria', { index: index + 1, answered: isAnswered ? t('study.quizProgressBar.answeredSuffix') : '' })}
            >
              {isAnswered ? (
                <Check size={14} className="mx-auto" aria-hidden="true" />
              ) : (
                index + 1
              )}
              {isCurrent && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const areEqual = (prev: QuizProgressBarProps, next: QuizProgressBarProps) => {
  return (
    prev.current === next.current &&
    prev.total === next.total &&
    prev.flaggedCount === next.flaggedCount &&
    prev.onJump === next.onJump &&
    prev.answered.length === next.answered.length &&
    prev.answered.every((v, i) => v === next.answered[i])
  );
};

export const QuizProgressBar = React.memo(QuizProgressBarComponent, areEqual);
