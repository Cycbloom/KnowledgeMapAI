import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Edit2, Trash2, Clock, Layers, FileText, Loader2 } from 'lucide-react';
import type { QuizSet } from '@shared/types/quiz';
import { formatDate as formatDateUtil } from '../../utils/formatters';

interface QuizCardProps {
  quiz: QuizSet;
  isDark: boolean;
  onStartPractice?: (quiz: QuizSet) => void;
  onEdit?: (quiz: QuizSet) => void;
  onDelete?: (quiz: QuizSet) => void;
  onClick?: (quiz: QuizSet) => void;
}

const statusConfig: Record<string, { color: string; bgColor: string; darkBg: string; darkColor: string }> = {
  draft: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    darkBg: 'bg-slate-700',
    darkColor: 'text-slate-400',
  },
  generating: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    darkBg: 'bg-amber-900/30',
    darkColor: 'text-amber-400',
  },
  ready: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    darkBg: 'bg-emerald-900/30',
    darkColor: 'text-emerald-400',
  },
};

export const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  isDark,
  onStartPractice,
  onEdit,
  onDelete,
  onClick,
}) => {
  const { t } = useTranslation();
  const status = statusConfig[quiz.status] || statusConfig.draft;
  const isGenerating = quiz.status === 'generating';
  const isReady = quiz.status === 'ready';

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr, 'short-datetime');
  };

  const getDifficultyLabel = (difficulty: string) => {
    return t(`study.quizCard.difficulty.${difficulty}`, { defaultValue: difficulty });
  };

  const getCardTypeLabel = (cardTypes: string[]) => {
    if (!cardTypes || cardTypes.length === 0) return t('study.quizCard.noCardType');
    return cardTypes
      .map((ct) => t(`study.quizCard.cardType.${ct}`, { defaultValue: ct }))
      .join('、');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={() => onClick?.(quiz)}
      className={`group p-5 rounded-2xl border transition-all hover:shadow-xl flex flex-col h-full cursor-pointer ${
        isDark
          ? 'bg-slate-800 border-slate-700 hover:border-primary-500/50'
          : 'bg-white border-gray-100 hover:border-primary-200 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
            isDark ? `${status.darkBg} ${status.darkColor}` : `${status.bgColor} ${status.color}`
          }`}
        >
          {isGenerating && <Loader2 size={10} className="inline mr-1 animate-spin" />}
          {t(`study.quizCard.status.${quiz.status}`)}
        </span>
        <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          <Clock size={10} />
          <span>{formatDate(quiz.created_at)}</span>
        </div>
      </div>

      <h4 className="font-bold text-base line-clamp-2 leading-snug mb-2 min-h-[2.8rem]">
        {quiz.title}
      </h4>

      {quiz.description && (
        <p className={`text-sm line-clamp-2 mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          {quiz.description}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
          <Layers size={12} className="text-primary-400" />
          <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>{quiz.card_count} 张卡片</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
          <FileText size={12} className="text-emerald-400" />
          <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>
            {getDifficultyLabel(quiz.config?.difficulty || 'mixed')}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          {getCardTypeLabel(quiz.config?.cardTypes || [])}
        </div>

        <div className="flex items-center gap-1">
          {onEdit && !isGenerating && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(quiz);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark
                  ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
                  : 'text-gray-400 hover:text-amber-600 hover:bg-gray-100'
              }`}
              title="编辑"
            >
              <Edit2 size={16} />
            </button>
          )}

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(quiz);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark
                  ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
              }`}
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          )}

          {onStartPractice && isReady && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartPractice(quiz);
              }}
              className={`ml-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                isDark
                  ? 'text-primary-400 hover:bg-primary-500/10'
                  : 'text-primary-600 hover:bg-primary-50'
              }`}
            >
              <Play size={12} />
              开始
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
