import React from 'react';
import { Check } from 'lucide-react';

interface QuizProgressBarProps {
  current: number;
  total: number;
  answered: boolean[];
  onJump: (index: number) => void;
}

export const QuizProgressBar: React.FC<QuizProgressBarProps> = ({
  current,
  total,
  answered,
  onJump,
}) => {
  const progress = total > 0 ? (answered.filter(Boolean).length / total) * 100 : 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          第 <span className="text-primary-600 font-bold">{current + 1}</span> / {total} 题
        </span>
        <span className="text-gray-500">
          已答 {answered.filter(Boolean).length} 题
        </span>
      </div>

      <div className="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
              title={`第 ${index + 1} 题${isAnswered ? ' (已答)' : ''}`}
            >
              {isAnswered ? (
                <Check size={14} className="mx-auto" />
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
