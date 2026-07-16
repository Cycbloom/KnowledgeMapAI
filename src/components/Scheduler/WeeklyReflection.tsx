import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Calendar, X, Save, Target,
  BarChart3, Brain, Lightbulb,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { taskReviewApi, TaskReview, Mood } from '../../services/api/review';
import { api } from '../../services/api';
import { formatDuration, formatDate } from '../../utils/formatters';
import type {UserTaskStats} from '@shared/types';
import { Skeleton } from '../common';
import { useFormDraft } from '../../hooks';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface WeeklyReflectionDraft {
  content: string;
  improvements: string;
  learnings: string;
}

interface WeeklyReflectionProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (review: TaskReview) => void;
}

const MOOD_EMOJIS: Record<Mood, string> = {
  great: '😊',
  good: '🙂',
  neutral: '😐',
  tired: '😴',
  stressed: '😰',
};

export const WeeklyReflection: React.FC<WeeklyReflectionProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<WeeklyReflectionDraft>({
    key: 'weeklyReflection_draft',
    initialValue: {
      content: '',
      improvements: '',
      learnings: '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingReview, setExistingReview] = useState<TaskReview | null>(null);
  const [weekStats, setWeekStats] = useState<UserTaskStats | null>(null);
  const [weekReviews, setWeekReviews] = useState<TaskReview[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekRange = (offset: number = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
      startObj: monday,
      endObj: sunday,
    };
  };

  const weekRange = getWeekRange(weekOffset);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, weekOffset]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, _tasks, reviews, existingReview] = await Promise.all([
        api.scheduler.getStats('week'),
        api.scheduler.list({ status: 'completed' }),
        taskReviewApi.getReviews({ 
          review_type: 'daily',
          from_date: weekRange.start,
          to_date: weekRange.end,
        }),
        taskReviewApi.getWeeklyReview(weekRange.start),
      ]);

      setWeekStats(stats);
      
      setWeekReviews(reviews);

      if (existingReview) {
        setExistingReview(existingReview);
        setFormData({
          content: existingReview.content || '',
          improvements: existingReview.improvements || '',
          learnings: existingReview.learnings || '',
        });
      } else {
        setFormData({
          content: '',
          improvements: '',
          learnings: '',
        });
        setExistingReview(null);
      }
    } catch (error) {
      console.error('Failed to load weekly reflection data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const reviewData = {
        review_type: 'weekly' as const,
        content: formData.content || undefined,
        improvements: formData.improvements || undefined,
        learnings: formData.learnings || undefined,
      };

      let review: TaskReview;
      if (existingReview) {
        review = await taskReviewApi.updateReview(existingReview.id, reviewData);
      } else {
        review = await taskReviewApi.createReview(reviewData);
      }

      clearDraft();
      setExistingReview(review);
      onSave?.(review);
    } catch (error) {
      console.error('Failed to save weekly reflection:', error);
    } finally {
      setSaving(false);
    }
  };

  const getMoodDistribution = () => {
    const distribution: Record<Mood, number> = {
      great: 0, good: 0, neutral: 0, tired: 0, stressed: 0
    };
    weekReviews.forEach(r => {
      if (r.mood) distribution[r.mood]++;
    });
    return distribution;
  };

  const moodDistribution = getMoodDistribution();
  const dominantMood = (Object.entries(moodDistribution) as [Mood, number][])
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">周反思</h2>
                    <p className="text-sm text-white/80">
                      {formatDate(weekRange.startObj, 'short')} - {formatDate(weekRange.endObj, 'short')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWeekOffset(o => o + 1)}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm px-2">
                    {weekOffset === 0 ? '本周' : `${Math.abs(weekOffset)}周前`}
                  </span>
                  <button
                    onClick={() => setWeekOffset(o => Math.min(0, o - 1))}
                    disabled={weekOffset === 0}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors ml-2"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                      <Skeleton className="h-8 w-12 mx-auto mb-2" />
                      <Skeleton className="h-3 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-primary-500">{weekStats?.completed_tasks || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">完成任务</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-500">
                      {formatDuration(weekStats?.total_duration || 0, { emptyText: "0分钟" })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">专注时长</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-primary-500">{weekReviews.length}</div>
                    <div className="text-xs text-slate-500 mt-1">每日回顾</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-3xl">
                      {dominantMood && dominantMood[1] > 0 ? MOOD_EMOJIS[dominantMood[0]] : '🤔'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">主要心情</div>
                  </div>
                </div>

                {weekStats?.daily && weekStats.daily.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <BarChart3 size={16} className="text-primary-500" />
                      每日完成趋势
                    </h3>
                    <div className="flex items-end gap-1 h-20">
                      {weekStats.daily.map((day: { date: string; completed: number; duration: number }, i: number) => {
                        const dailyData = weekStats?.daily ?? [];
                        const maxCompleted = Math.max(...dailyData.map((d: { date: string; completed: number; duration: number }) => d.completed), 1);
                        const height = (day.completed / maxCompleted) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <motion.div
                              className="w-full bg-gradient-to-t from-primary-500 to-primary-500 rounded-t"
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(height, 5)}%` }}
                              transition={{ delay: i * 0.1 }}
                            />
                            <div className="text-xs text-slate-400 mt-1">
                              {['一', '二', '三', '四', '五', '六', '日'][i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Target size={16} className="text-primary-500" />
                    本周总结
                  </h3>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="这周整体感觉如何？有什么收获？"
                    className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500" />
                      下周改进计划
                    </h3>
                    <textarea
                      value={formData.improvements}
                      onChange={(e) => setFormData(prev => ({ ...prev, improvements: e.target.value }))}
                      placeholder="下周想要改进什么？"
                      className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <Brain size={16} className="text-primary-500" />
                      本周学习收获
                    </h3>
                    <textarea
                      value={formData.learnings}
                      onChange={(e) => setFormData(prev => ({ ...prev, learnings: e.target.value }))}
                      placeholder="这周学到了什么新东西？"
                      className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <motion.button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    取消
                  </motion.button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium hover:from-primary-600 hover:to-primary-600 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Save size={18} />
                    {saving ? '保存中...' : existingReview ? '更新反思' : '保存反思'}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      {isOpen && !loading && !existingReview && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t('common.restoreDraftTitle')}
          message={t('common.restoreDraftMessage')}
          isDangerous={false}
        />
      )}
    </AnimatePresence>
  );
};
