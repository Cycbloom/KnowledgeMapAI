import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  RefreshCw,
  ArrowLeft,
  X,
  AlertTriangle,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import type { StudyCard } from '@shared/types/common';

interface QuizResultProps {
  quizSetId: string;
  results: {
    total: number;
    correct: number;
    byType: Record<string, { correct: number; total: number }>;
    wrongCards: StudyCard[];
  };
  onRetry: () => void;
  onRetryWrong: () => void;
  onBack: () => void;
}

const cardTypeLabels: Record<string, string> = {
  qa: '问答题',
  choice: '单选题',
  multi_choice: '多选题',
  true_false: '判断题',
  fill_in_the_blank: '填空题',
  essay: '解答题',
};

export const QuizResult: React.FC<QuizResultProps> = ({
  results,
  onRetry,
  onRetryWrong,
  onBack,
}) => {
  const accuracy = results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
  const hasWrongCards = results.wrongCards.length > 0;

  const getAccuracyColor = (acc: number) => {
    if (acc >= 80) return 'text-emerald-500';
    if (acc >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getAccuracyGradient = (acc: number) => {
    if (acc >= 80) return 'from-emerald-500 to-emerald-600';
    if (acc >= 60) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8 bg-gray-50 dark:bg-slate-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className={`h-2 bg-gradient-to-r ${getAccuracyGradient(accuracy)}`} />

        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                accuracy >= 80
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : accuracy >= 60
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
              }`}
            >
              {accuracy >= 80 ? (
                <Trophy className="w-12 h-12 text-emerald-500" />
              ) : accuracy >= 60 ? (
                <Target className="w-12 h-12 text-amber-500" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-red-500" />
              )}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-2 text-gray-900 dark:text-white"
            >
              {accuracy >= 80 ? '太棒了！' : accuracy >= 60 ? '继续加油！' : '需要努力！'}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-500 dark:text-slate-400"
            >
              测验完成，以下是你的成绩单
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="text-center p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/50">
              <div className="text-3xl font-black text-gray-900 dark:text-white">
                {results.total}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">总题数</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {results.correct}
              </div>
              <div className="text-sm text-emerald-600/70 dark:text-emerald-400/70 mt-1">正确</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-red-50 dark:bg-red-900/20">
              <div className="text-3xl font-black text-red-600 dark:text-red-400">
                {results.total - results.correct}
              </div>
              <div className="text-sm text-red-600/70 dark:text-red-400/70 mt-1">错误</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-slate-300">正确率</span>
              <span className={`text-2xl font-black ${getAccuracyColor(accuracy)}`}>
                {accuracy}%
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className={`h-full bg-gradient-to-r ${getAccuracyGradient(accuracy)} rounded-full`}
              />
            </div>
          </motion.div>

          {Object.keys(results.byType).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-indigo-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">各题型得分</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(results.byType).map(([type, stats]) => {
                  const typeAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 dark:text-slate-300 w-20">
                        {cardTypeLabels[type] || type}
                      </span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            typeAccuracy >= 80
                              ? 'bg-emerald-500'
                              : typeAccuracy >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${typeAccuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-500 dark:text-slate-400 w-16 text-right">
                        {stats.correct}/{stats.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {hasWrongCards && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">薄弱知识点</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {results.wrongCards.slice(0, 5).map((card) => (
                  <div
                    key={card.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
                  >
                    <X size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {card.question}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {cardTypeLabels[card.card_type] || card.card_type}
                      </p>
                    </div>
                  </div>
                ))}
                {results.wrongCards.length > 5 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">
                    还有 {results.wrongCards.length - 5} 道错题...
                  </p>
                )}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="space-y-3"
          >
            <button
              onClick={onRetry}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              重新测验
            </button>

            {hasWrongCards && (
              <button
                onClick={onRetryWrong}
                className="w-full py-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-2xl font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-2"
              >
                <BookOpen size={18} />
                错题重练 ({results.wrongCards.length} 题)
              </button>
            )}

            <button
              onClick={onBack}
              className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} />
              返回测验列表
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
