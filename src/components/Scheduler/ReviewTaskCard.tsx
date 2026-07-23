import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Star,
  SkipForward,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Zap,
  Gauge,
  Activity,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import type { PendingReviewTask } from "@shared/types";

interface ReviewTaskCardProps {
  task: PendingReviewTask;
  knowledgePointTitle?: string;
  onComplete: (quality: number) => void;
  onSkip: () => void;
}

const FSRS_STATE_CONFIG = {
  New: { label: "scheduler.review.fsrsState.new", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-500/20" },
  Learning: { label: "scheduler.review.fsrsState.learning", color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-500/20" },
  Review: { label: "scheduler.review.fsrsState.review", color: "text-green-500", bg: "bg-green-100 dark:bg-green-500/20" },
  Relearning: { label: "scheduler.review.fsrsState.relearning", color: "text-red-500", bg: "bg-red-100 dark:bg-red-500/20" },
};

const getFSRSStateConfig = (state?: string) => {
  return FSRS_STATE_CONFIG[state as keyof typeof FSRS_STATE_CONFIG] || FSRS_STATE_CONFIG.Review;
};

const getDifficultyLabel = (difficulty: number): { label: string; stars: number } => {
  if (difficulty <= 0.1) return { label: "scheduler.review.difficulty.veryEasy", stars: 1 };
  if (difficulty <= 0.3) return { label: "scheduler.review.difficulty.easy", stars: 2 };
  if (difficulty <= 0.5) return { label: "scheduler.review.difficulty.medium", stars: 3 };
  if (difficulty <= 0.7) return { label: "scheduler.review.difficulty.hard", stars: 4 };
  return { label: "scheduler.review.difficulty.veryHard", stars: 5 };
};

export const ReviewTaskCard: React.FC<ReviewTaskCardProps> = ({
  task,
  knowledgePointTitle,
  onComplete,
  onSkip,
}) => {
  const { t } = useTranslation();
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const URGENCY_CONFIG = {
    overdue: {
      label: t('scheduler.review.overdue'),
      color: "text-red-500 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-500/20",
      border: "border-red-300 dark:border-red-400",
      icon: AlertTriangle,
    },
    today: {
      label: t('scheduler.review.today'),
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      border: "border-amber-300 dark:border-amber-400",
      icon: Clock,
    },
    upcoming: {
      label: t('scheduler.review.upcoming'),
      color: "text-primary-500 dark:text-primary-400",
      bg: "bg-primary-100 dark:bg-primary-500/20",
      border: "border-primary-300 dark:border-primary-400",
      icon: Calendar,
    },
    future: {
      label: t('scheduler.review.planned'),
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      border: "border-emerald-300 dark:border-emerald-400",
      icon: CheckCircle2,
    },
  };

  const QUALITY_LABELS = [
    { value: 0, label: t('scheduler.review.quality.0'), color: "text-red-500" },
    { value: 1, label: t('scheduler.review.quality.1'), color: "text-orange-500" },
    { value: 2, label: t('scheduler.review.quality.2'), color: "text-amber-500" },
    { value: 3, label: t('scheduler.review.quality.3'), color: "text-yellow-500" },
    { value: 4, label: t('scheduler.review.quality.4'), color: "text-lime-500" },
    { value: 5, label: t('scheduler.review.quality.5'), color: "text-green-500" },
  ];

  const getMasteryLabel = (level: number): { label: string; color: string } => {
    if (level < 0.2) return { label: t('scheduler.review.mastery.beginner'), color: "text-slate-500" };
    if (level < 0.4) return { label: t('scheduler.review.mastery.introductory'), color: "text-primary-500" };
    if (level < 0.6) return { label: t('scheduler.review.mastery.familiar'), color: "text-primary-500" };
    if (level < 0.8) return { label: t('scheduler.review.mastery.proficient'), color: "text-emerald-500" };
    return { label: t('scheduler.review.mastery.master'), color: "text-primary-500" };
  };

  const formatNextReviewDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return t('scheduler.review.daysOverdue', { count: Math.abs(diffDays) });
    if (diffDays === 0) return t('scheduler.review.today');
    if (diffDays === 1) return t('scheduler.review.tomorrow');
    if (diffDays <= 7) return t('scheduler.review.daysLater', { count: diffDays });
    if (diffDays <= 30) return t('scheduler.review.weeksLater', { count: Math.ceil(diffDays / 7) });
    return t('scheduler.review.monthsLater', { count: Math.ceil(diffDays / 30) });
  };

  const urgencyConfig = URGENCY_CONFIG[task.urgency];
  const UrgencyIcon = urgencyConfig.icon;
  const masteryInfo = getMasteryLabel(task.masteryLevel);
  const nextReviewText = formatNextReviewDate(task.next_review_date);

  const handleComplete = async () => {
    if (selectedQuality === null) return;
    setIsSubmitting(true);
    try {
      await onComplete(selectedQuality);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fsrsStateConfig = getFSRSStateConfig(task.fsrs_state);
  const difficultyInfo = getDifficultyLabel(task.fsrs_difficulty ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${urgencyConfig.border}
        bg-white dark:bg-slate-900/80 backdrop-blur-sm
        hover:shadow-lg overflow-hidden
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${urgencyConfig.bg}`} />

      <div className="p-4 pl-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}
          >
            <UrgencyIcon size={12} className="inline mr-1" />
            {urgencyConfig.label}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${fsrsStateConfig.bg} ${fsrsStateConfig.color}`}>
            <Activity size={12} className="inline mr-1" />
            {t(fsrsStateConfig.label as never)}
          </span>
          <span className="text-xs text-slate-400">
            {t('scheduler.review.nextReview')}: {nextReviewText}
          </span>
        </div>

        <h4 className="font-medium text-slate-900 dark:text-white mb-3 text-lg">
          {knowledgePointTitle || t('scheduler.review.knowledgePoint', { id: task.knowledge_point_id.slice(0, 8) })}
        </h4>

        <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <Brain size={14} className="text-primary-500" />
            <span className="text-slate-600 dark:text-slate-400">{t('scheduler.review.masteryLevel')}:</span>
            <span className={`font-medium ${masteryInfo.color}`}>
              {masteryInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-500" />
            <span className="text-slate-600 dark:text-slate-400">{t('scheduler.review.stability')}:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {task.fsrs_stability?.toFixed(1) ?? "0.0"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge size={14} className="text-primary-500" />
            <span className="text-slate-600 dark:text-slate-400">{t('scheduler.review.difficulty')}:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {t(difficultyInfo.label as never)}
            </span>
          </div>
          {task.fsrs_retrievability !== undefined && (
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-primary-500" />
              <span className="text-slate-600 dark:text-slate-400">{t('scheduler.review.retrievability')}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {Math.round((task.fsrs_retrievability ?? 0) * 100)}%
              </span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('scheduler.review.qualityRating')}
            </span>
            {selectedQuality !== null && (
              <span
                className={`text-xs ${
                  QUALITY_LABELS[selectedQuality].color
                } font-medium`}
              >
                {QUALITY_LABELS[selectedQuality].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {QUALITY_LABELS.map((item) => (
              <button
                key={item.value}
                onClick={() => setSelectedQuality(item.value)}
                className={`
                  flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    selectedQuality === item.value
                      ? `${item.color} bg-opacity-20 bg-current ring-2 ring-current`
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800"
                  }
                `}
              >
                {item.value}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[10px] text-slate-400">{t('scheduler.review.quality.0')}</span>
            <span className="text-[10px] text-slate-400">{t('scheduler.review.quality.5')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleComplete}
            disabled={selectedQuality === null || isSubmitting}
            className={`
              flex-1 py-2.5 rounded-lg font-medium transition-all
              flex items-center justify-center gap-2 min-h-[44px]
              ${
                selectedQuality !== null
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              }
            `}
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                {t('scheduler.review.completeReview')}
              </>
            )}
          </button>
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="
              py-2.5 px-4 rounded-lg font-medium transition-all
              bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
              hover:bg-slate-200 dark:hover:bg-slate-700
              flex items-center gap-2 min-h-[44px]
            "
          >
            <SkipForward size={16} />
            {t('scheduler.review.skip')}
          </button>
        </div>

        {task.last_quality_score !== null && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('scheduler.review.lastScore')}:</span>
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const lastScore = task.last_quality_score ?? 0;
                  return (
                    <Star
                      key={i}
                      size={12}
                      className={
                        lastScore !== null && i <= lastScore
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-300 dark:text-slate-600"
                      }
                    />
                  );
                })}
              </div>
              <span className="text-slate-400">
                ({task.last_quality_score}/5)
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
