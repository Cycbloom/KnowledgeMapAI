import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

export interface QuizExamItemStatus {
  id: string;
  status: 'unanswered' | 'answered' | 'current' | 'correct' | 'wrong';
}

interface QuizExamNavigatorProps {
  items: QuizExamItemStatus[];
  currentIndex: number;
  onSelect: (index: number) => void;
  isDark: boolean;
  showLegend?: boolean;
  className?: string;
}

export const QuizExamNavigator = ({
  items,
  currentIndex,
  onSelect,
  isDark,
  showLegend = true,
  className = '',
}: QuizExamNavigatorProps) => {
  const { t } = useTranslation();

  const legend: Array<{ status: QuizExamItemStatus['status']; label: string; cls: string }> = [
    { status: 'answered', label: t('study.quizPractice.exam.answered', '已答'), cls: isDark ? 'bg-primary-900/40 text-primary-300 border-primary-700' : 'bg-primary-50 text-primary-600 border-primary-300' },
    { status: 'correct', label: t('study.quizPractice.exam.correct', '正确'), cls: isDark ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700' : 'bg-emerald-50 text-emerald-600 border-emerald-300' },
    { status: 'wrong', label: t('study.quizPractice.exam.wrong', '错误'), cls: isDark ? 'bg-red-900/50 text-red-400 border-red-700' : 'bg-red-50 text-red-600 border-red-300' },
    { status: 'unanswered', label: t('study.quizPractice.exam.unanswered', '未答'), cls: isDark ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-white text-gray-400 border-gray-200' },
  ];

  return (
    <div className={className}>
      <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        {t('study.quizPractice.exam.answerSheet', '答题情况')}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {items.map((item, idx) => {
          const isCurrent = idx === currentIndex;
          let cls: string;
          let content: React.ReactNode = idx + 1;

          if (item.status === 'correct') {
            cls = isDark ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700' : 'bg-emerald-50 text-emerald-600 border-emerald-300';
            content = <Check size={14} aria-hidden="true" />;
          } else if (item.status === 'wrong') {
            cls = isDark ? 'bg-red-900/50 text-red-400 border-red-700' : 'bg-red-50 text-red-600 border-red-300';
            content = <X size={14} aria-hidden="true" />;
          } else if (item.status === 'answered') {
            cls = isDark ? 'bg-primary-900/40 text-primary-300 border-primary-700' : 'bg-primary-50 text-primary-600 border-primary-300';
          } else if (isCurrent) {
            cls = isDark
              ? 'bg-primary-600 text-white border-primary-500 ring-2 ring-primary-500/40'
              : 'bg-primary-600 text-white border-primary-500 ring-2 ring-primary-400/40';
          } else {
            cls = isDark ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-white text-gray-400 border-gray-200';
          }

          if (isCurrent && item.status !== 'correct' && item.status !== 'wrong') {
            cls = isDark
              ? 'bg-primary-600 text-white border-primary-500 ring-2 ring-primary-500/40'
              : 'bg-primary-600 text-white border-primary-500 ring-2 ring-primary-400/40';
          }

          const statusLabel =
            item.status === 'correct'
              ? t('study.quizPractice.exam.correct', '正确')
              : item.status === 'wrong'
                ? t('study.quizPractice.exam.wrong', '错误')
                : item.status === 'answered'
                  ? t('study.quizPractice.exam.answered', '已答')
                  : isCurrent
                    ? t('study.quizPractice.exam.current', '当前')
                    : t('study.quizPractice.exam.unanswered', '未答');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(idx)}
              className={`h-8 w-8 min-w-[32px] min-h-[32px] rounded-lg border text-xs font-bold flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${cls}`}
              aria-label={`${t('study.quizPractice.exam.questionShort', '第')}${idx + 1}${t('study.quizPractice.exam.questionUnit', '题')}：${statusLabel}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              {content}
            </button>
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {legend.map((l) => (
            <span key={l.status} className="flex items-center gap-1 text-[10px]">
              <span className={`inline-block h-3 w-3 rounded border ${l.cls}`} />
              <span className={isDark ? 'text-slate-500' : 'text-gray-500'}>{l.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
