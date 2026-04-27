import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  X,
  Save,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Clock,
  Tag,
  Brain,
} from "lucide-react";
import { reviewApi, TaskReview } from "../../services/api/review";
import { UserTask } from "@shared/types";

interface TaskRetrospectProps {
  isOpen: boolean;
  onClose: () => void;
  task: UserTask | null;
  onSave?: (review: TaskReview) => void;
  onSkip?: () => void;
}

export const TaskRetrospect: React.FC<TaskRetrospectProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onSkip,
}) => {
  const [content, setContent] = useState("");
  const [difficulties, setDifficulties] = useState("");
  const [improvements, setImprovements] = useState("");
  const [learnings, setLearnings] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingReview, setExistingReview] = useState<TaskReview | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadExistingReview();
    }
  }, [isOpen, task]);

  const loadExistingReview = async () => {
    if (!task) return;
    try {
      const review = await reviewApi.getTaskReview(task.id);
      if (review) {
        setExistingReview(review);
        setContent(review.content || "");
        setDifficulties(review.difficulties || "");
        setImprovements(review.improvements || "");
        setLearnings(review.learnings || "");
      } else {
        setContent("");
        setDifficulties("");
        setImprovements("");
        setLearnings("");
        setExistingReview(null);
      }
    } catch (error) {
      console.error("Failed to load task review:", error);
    }
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const reviewData = {
        task_id: task.id,
        review_type: "task" as const,
        content: content || undefined,
        difficulties: difficulties || undefined,
        improvements: improvements || undefined,
        learnings: learnings || undefined,
      };

      let review: TaskReview;
      if (existingReview) {
        review = await reviewApi.updateReview(existingReview.id, reviewData);
      } else {
        review = await reviewApi.createReview(reviewData);
      }

      setExistingReview(review);
      onSave?.(review);
      onClose();
    } catch (error) {
      console.error("Failed to save task review:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "--";
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  if (!task) return null;

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
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-500 to-primary-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">任务完成！</h2>
                    <p className="text-sm text-white/80">花点时间回顾一下</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  {task.title}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>
                      实际用时: {formatDuration(task.actual_duration)}
                    </span>
                  </div>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag size={14} />
                      <span>{task.tags.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  <MessageSquare size={16} className="text-primary-500" />
                  完成心得
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="这个任务完成得怎么样？有什么感受？"
                  className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    遇到的困难
                  </label>
                  <textarea
                    value={difficulties}
                    onChange={(e) => setDifficulties(e.target.value)}
                    placeholder="有什么阻碍？"
                    className="w-full h-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    <Lightbulb size={16} className="text-yellow-500" />
                    解决方案
                  </label>
                  <textarea
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    placeholder="如何解决的？"
                    className="w-full h-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  <Brain size={16} className="text-primary-500" />
                  学到了什么
                </label>
                <textarea
                  value={learnings}
                  onChange={(e) => setLearnings(e.target.value)}
                  placeholder="从这个任务中学到了什么新知识或技能？"
                  className="w-full h-16 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <motion.button
                  onClick={() => {
                    onSkip?.();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  跳过
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-primary-500 text-white font-medium hover:from-emerald-600 hover:to-primary-600 transition-all disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Save size={18} />
                  {saving ? "保存中..." : "保存复盘"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
