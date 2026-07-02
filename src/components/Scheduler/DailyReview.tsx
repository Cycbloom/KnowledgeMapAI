import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  CloudRain,
  Smile,
  Meh,
  Zap,
  Brain,
  Lightbulb,
  Calendar,
  CheckCircle,
  X,
  Save,
} from "lucide-react";
import { taskReviewApi, TaskReview, Mood } from "../../services/api/review";
import { api } from "../../services/api";
import { formatDurationMinutes, formatDate } from "../../utils/formatters";
import type { UserTask } from "@shared/types";

interface DailyReviewProps {
  isOpen: boolean;
  onClose: () => void;
  date?: string;
  onSave?: (review: TaskReview) => void;
}

const MOOD_CONFIG: Record<
  Mood,
  { icon: React.ReactNode; label: string; color: string; bg: string }
> = {
  great: {
    icon: <Smile size={24} />,
    label: "很棒",
    color: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/50",
  },
  good: {
    icon: <Sun size={24} />,
    label: "不错",
    color: "text-primary-500",
    bg: "bg-primary-100 dark:bg-primary-500/20 border-primary-300 dark:border-primary-500/50",
  },
  neutral: {
    icon: <Meh size={24} />,
    label: "一般",
    color: "text-slate-500",
    bg: "bg-slate-100 dark:bg-slate-500/20 border-slate-300 dark:border-slate-500/50",
  },
  tired: {
    icon: <Moon size={24} />,
    label: "疲惫",
    color: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50",
  },
  stressed: {
    icon: <CloudRain size={24} />,
    label: "压力大",
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/50",
  },
};

export const DailyReview: React.FC<DailyReviewProps> = ({
  isOpen,
  onClose,
  date,
  onSave,
}) => {
  const [mood, setMood] = useState<Mood | null>(null);
  const [content, setContent] = useState("");
  const [difficulties, setDifficulties] = useState("");
  const [improvements, setImprovements] = useState("");
  const [learnings, setLearnings] = useState("");
  const [completedTasks, setCompletedTasks] = useState<UserTask[]>([]);
  const [existingReview, setExistingReview] = useState<TaskReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetDate = date || new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, targetDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [review, tasks] = await Promise.all([
        taskReviewApi.getDailyReview(targetDate),
        api.scheduler.list({ status: "completed" }),
      ]);

      if (review) {
        setExistingReview(review);
        setMood(review.mood || null);
        setContent(review.content || "");
        setDifficulties(review.difficulties || "");
        setImprovements(review.improvements || "");
        setLearnings(review.learnings || "");
      }

      const todayTasks = tasks.filter((t: UserTask) => {
        if (!t.completed_at) return false;
        const completedDate = new Date(t.completed_at)
          .toISOString()
          .split("T")[0];
        return completedDate === targetDate;
      });
      setCompletedTasks(todayTasks);
    } catch (error) {
      console.error("Failed to load daily review data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const reviewData = {
        review_type: "daily" as const,
        mood: mood || undefined,
        content: content || undefined,
        difficulties: difficulties || undefined,
        improvements: improvements || undefined,
        learnings: learnings || undefined,
      };

      let review: TaskReview;
      if (existingReview) {
        review = await taskReviewApi.updateReview(existingReview.id, reviewData);
      } else {
        review = await taskReviewApi.createReview(reviewData);
      }

      setExistingReview(review);
      onSave?.(review);
    } catch (error) {
      console.error("Failed to save daily review:", error);
    } finally {
      setSaving(false);
    }
  };

  const totalDuration = completedTasks.reduce(
    (sum, t) => sum + (t.actual_duration || 0),
    0,
  );

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
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={24} className="text-primary-500" />
                  每日回顾
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {formatDate(targetDate, "long-date")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    今日完成
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-primary-500">
                        {completedTasks.length}
                      </div>
                      <div className="text-xs text-slate-500">任务</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-500">
                        {formatDurationMinutes(totalDuration)}
                      </div>
                      <div className="text-xs text-slate-500">专注时长</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Smile size={16} className="text-amber-500" />
                    今天感觉如何？
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(MOOD_CONFIG) as Mood[]).map((moodKey) => {
                      const config = MOOD_CONFIG[moodKey];
                      const isSelected = mood === moodKey;
                      return (
                        <motion.button
                          key={moodKey}
                          onClick={() => setMood(moodKey)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                            isSelected
                              ? config.bg
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span
                            className={
                              isSelected ? config.color : "text-slate-400"
                            }
                          >
                            {config.icon}
                          </span>
                          <span
                            className={`text-sm font-medium ${isSelected ? config.color : "text-slate-500"}`}
                          >
                            {config.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Brain size={16} className="text-primary-500" />
                    今日心得
                  </h3>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="记录今天的收获和感受..."
                    className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <CloudRain size={16} className="text-red-500" />
                      遇到的困难
                    </h3>
                    <textarea
                      value={difficulties}
                      onChange={(e) => setDifficulties(e.target.value)}
                      placeholder="今天遇到了什么困难？"
                      className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                      <Lightbulb size={16} className="text-amber-500" />
                      改进方向
                    </h3>
                    <textarea
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      placeholder="明天可以怎么改进？"
                      className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-primary-500" />
                    学到了什么
                  </h3>
                  <textarea
                    value={learnings}
                    onChange={(e) => setLearnings(e.target.value)}
                    placeholder="记录今天学到的新知识或技能..."
                    className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
                    {saving
                      ? "保存中..."
                      : existingReview
                        ? "更新回顾"
                        : "保存回顾"}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
