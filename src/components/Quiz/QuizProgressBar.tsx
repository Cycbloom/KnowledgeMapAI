import React, { useState, useEffect } from 'react';
import { Check, Clock, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimeFromSeconds } from '../../utils/formatters';

interface QuizProgressBarProps {
  current: number;
  total: number;
  answered: boolean[];
  onJump: (index: number) => void;
  startTime?: number;
  flaggedCount?: number;
}

export const QuizProgressBar: React.FC<QuizProgressBarProps> = ({
  current,
  total,
  answered,
  onJump,
  startTime,
  flaggedCount = 0,
}) => {
  const { t } = useTranslation();
  const progress = total > 0 ? (answered.filter(Boolean).length / total) * 100 : 0;

  // Session timer (UX2-04)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          第 <span className="text-primary-600 font-bold">{current + 1}</span> / {total} 题
        </span>
        <div className="flex items-center gap-3">
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-500" title={t('quiz.progress.flaggedForReview')}>
              <Flag size={12} fill="currentColor" aria-hidden="true" />
              {flaggedCount}
            </span>
          )}
          {startTime && (
            <span
              className="flex items-center gap-1 text-gray-500 dark:text-slate-400"
              title={t('quiz.progress.elapsedTime')}
              aria-live="polite"
              aria-atomic="true"
            >
              <Clock size={12} aria-hidden="true" />
              {formatTimeFromSeconds(elapsedSeconds)}
            </span>
          )}
          <span
            className="text-gray-500"
            aria-live="polite"
            aria-atomic="true"
          >
            已答 {answered.filter(Boolean).length} 题
          </span>
        </div>
      </div>

      <div
        className="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={answered.filter(Boolean).length}
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
              aria-label={`第 ${index + 1} 题${isAnswered ? ' (已答)' : ''}`}
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
