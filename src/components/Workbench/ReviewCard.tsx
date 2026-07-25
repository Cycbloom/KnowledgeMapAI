import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Brain, TrendingUp, ChevronRight } from "lucide-react";
import type { PendingReviewTask } from "@shared/types";

const URGENCY_CONFIG = {
  overdue: {
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
  },
  today: {
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
  },
  upcoming: {
    color: "text-primary-500 dark:text-primary-400",
    bg: "bg-primary-100 dark:bg-primary-500/20",
  },
  future: {
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
  },
};

const DIFFICULTY_LABELS = {
  veryEasy: "scheduler.review.difficultyLevel.veryEasy",
  easy: "scheduler.review.difficultyLevel.easy",
  medium: "scheduler.review.difficultyLevel.medium",
  hard: "scheduler.review.difficultyLevel.hard",
  veryHard: "scheduler.review.difficultyLevel.veryHard",
} as const;

type DifficultyLabelKey = (typeof DIFFICULTY_LABELS)[keyof typeof DIFFICULTY_LABELS];

const getDifficultyLabel = (difficulty: number): DifficultyLabelKey => {
  if (difficulty <= 0.1) return DIFFICULTY_LABELS.veryEasy;
  if (difficulty <= 0.3) return DIFFICULTY_LABELS.easy;
  if (difficulty <= 0.5) return DIFFICULTY_LABELS.medium;
  if (difficulty <= 0.7) return DIFFICULTY_LABELS.hard;
  return DIFFICULTY_LABELS.veryHard;
};

interface ReviewCardProps {
  review: PendingReviewTask;
  getUrgencyLabel: (urgency: string) => string;
  onClick: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, getUrgencyLabel, onClick }) => {
  const { t } = useTranslation();
  const urgencyConfig = URGENCY_CONFIG[review.urgency] || URGENCY_CONFIG.future;
  const difficultyLabel = getDifficultyLabel(review.fsrs_difficulty ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group p-3 rounded-lg border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}>
              {getUrgencyLabel(review.urgency)}
            </span>
          </div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {t("unifiedWorkbench.labels.knowledgePointReview")}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Brain size={10} />
              <span>{t("unifiedWorkbench.labels.stability", { value: review.fsrs_stability?.toFixed(1) ?? "0.0" })}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={10} />
              <span>{t("unifiedWorkbench.labels.difficulty")}: {t(difficultyLabel)}</span>
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
      </div>
    </motion.div>
  );
};
