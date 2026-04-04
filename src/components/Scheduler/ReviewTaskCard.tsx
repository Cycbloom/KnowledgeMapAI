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
} from "lucide-react";
import type { PendingReviewTask } from "@shared/types";

interface ReviewTaskCardProps {
  task: PendingReviewTask;
  knowledgePointTitle?: string;
  onComplete: (quality: number) => void;
  onSkip: () => void;
}

const URGENCY_CONFIG = {
  overdue: {
    label: "已过期",
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
    border: "border-red-300 dark:border-red-400",
    icon: AlertTriangle,
  },
  today: {
    label: "今天",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    border: "border-amber-300 dark:border-amber-400",
    icon: Clock,
  },
  upcoming: {
    label: "即将到期",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    border: "border-blue-300 dark:border-blue-400",
    icon: Calendar,
  },
  future: {
    label: "计划中",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    border: "border-emerald-300 dark:border-emerald-400",
    icon: CheckCircle2,
  },
};

const QUALITY_LABELS = [
  { value: 0, label: "完全忘记", color: "text-red-500" },
  { value: 1, label: "印象模糊", color: "text-orange-500" },
  { value: 2, label: "勉强记得", color: "text-amber-500" },
  { value: 3, label: "基本掌握", color: "text-yellow-500" },
  { value: 4, label: "熟练掌握", color: "text-lime-500" },
  { value: 5, label: "完全掌握", color: "text-green-500" },
];

const getMasteryLabel = (level: number): { label: string; color: string } => {
  if (level < 0.2) return { label: "初学", color: "text-slate-500" };
  if (level < 0.4) return { label: "入门", color: "text-blue-500" };
  if (level < 0.6) return { label: "熟悉", color: "text-cyan-500" };
  if (level < 0.8) return { label: "熟练", color: "text-emerald-500" };
  return { label: "精通", color: "text-purple-500" };
};

const formatNextReviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `已过期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  if (diffDays <= 7) return `${diffDays} 天后`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} 周后`;
  return `${Math.ceil(diffDays / 30)} 个月后`;
};

const estimateNextInterval = (
  quality: number,
  currentInterval: number,
  easeFactor: number
): number => {
  if (quality < 3) return 1;
  
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newInterval: number;
  if (currentInterval === 0) {
    newInterval = 1;
  } else if (currentInterval === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(currentInterval * newEaseFactor);
  }

  return newInterval;
};

export const ReviewTaskCard: React.FC<ReviewTaskCardProps> = ({
  task,
  knowledgePointTitle,
  onComplete,
  onSkip,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const urgencyConfig = URGENCY_CONFIG[task.urgency];
  const UrgencyIcon = urgencyConfig.icon;
  const masteryInfo = getMasteryLabel(task.masteryLevel);
  const nextReviewText = formatNextReviewDate(task.next_review_date);

  const estimatedNextInterval =
    selectedQuality !== null
      ? estimateNextInterval(selectedQuality, task.interval_days, task.ease_factor)
      : null;

  const handleComplete = async () => {
    if (selectedQuality === null) return;
    setIsSubmitting(true);
    try {
      await onComplete(selectedQuality);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <span className="text-xs text-slate-400">
            下次复习: {nextReviewText}
          </span>
        </div>

        <h4 className="font-medium text-slate-900 dark:text-white mb-3 text-lg">
          {knowledgePointTitle || `知识点 #${task.knowledge_point_id.slice(0, 8)}`}
        </h4>

        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Brain size={14} className="text-purple-500" />
            <span className="text-slate-600 dark:text-slate-400">掌握程度:</span>
            <span className={`font-medium ${masteryInfo.color}`}>
              {masteryInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-cyan-500" />
            <span className="text-slate-600 dark:text-slate-400">间隔:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {task.interval_days} 天
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-amber-500" />
            <span className="text-slate-600 dark:text-slate-400">EF:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {task.ease_factor.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              回忆质量评分
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
            <span className="text-[10px] text-slate-400">完全忘记</span>
            <span className="text-[10px] text-slate-400">完全掌握</span>
          </div>
        </div>

        {estimatedNextInterval !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
          >
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-cyan-500" />
              <span className="text-slate-600 dark:text-slate-400">
                预计下次复习:
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {estimatedNextInterval === 1
                  ? "明天"
                  : `${estimatedNextInterval} 天后`}
              </span>
            </div>
          </motion.div>
        )}

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
                完成复习
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
            跳过
          </button>
        </div>

        {task.last_quality_score !== null && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>上次评分:</span>
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const lastScore = task.last_quality_score;
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
