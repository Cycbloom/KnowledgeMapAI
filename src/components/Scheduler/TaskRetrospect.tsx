import React, { useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
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
import { taskReviewApi, TaskReview } from "../../services/api/review";
import { formatDurationMinutes } from "../../utils/formatters";
import { message } from "@/utils/messageHelper";
import { UserTask } from "@shared/types";
import { useFormDraft } from "../../hooks";
import { useFocusTrap } from "../../hooks/common/useFocusTrap";
import { useEscapeKey } from "../../hooks/common/useEscapeKey";
import { ConfirmationModal } from "../common/ConfirmationModal";

interface TaskRetrospectDraft {
  content: string;
  difficulties: string;
  improvements: string;
  learnings: string;
}

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
  const { t } = useTranslation();
  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<TaskRetrospectDraft>({
    key: 'taskRetrospect_draft',
    initialValue: {
      content: "",
      difficulties: "",
      improvements: "",
      learnings: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existingReview, setExistingReview] = useState<TaskReview | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadExistingReview();
    }
  }, [isOpen, task, t]);

  const titleId = useId();
  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);

  const loadExistingReview = async () => {
    if (!task) return;
    try {
      const review = await taskReviewApi.getTaskReview(task.id);
      if (review) {
        setExistingReview(review);
        setFormData({
          content: review.content || "",
          difficulties: review.difficulties || "",
          improvements: review.improvements || "",
          learnings: review.learnings || "",
        });
      } else {
        setFormData({
          content: "",
          difficulties: "",
          improvements: "",
          learnings: "",
        });
        setExistingReview(null);
      }
    } catch (error) {
      console.error("Failed to load task review:", error);
      message.error(t('scheduler.taskRetrospect.loadFailed'));
    } finally {
      setLoaded(true);
    }
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const reviewData = {
        task_id: task.id,
        review_type: "task" as const,
        content: formData.content || undefined,
        difficulties: formData.difficulties || undefined,
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
      onClose();
    } catch (error) {
      console.error("Failed to save task review:", error);
      message.error(t('scheduler.taskRetrospect.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
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
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-500 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-500 to-primary-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h2 id={titleId} className="text-lg font-bold">{t('scheduler.taskRetrospect.taskCompleted')}</h2>
                    <p className="text-sm text-white/80">{t('scheduler.taskRetrospect.takeMomentToReview')}</p>
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
                      {t('scheduler.taskRetrospect.actualDuration')} {formatDurationMinutes(task.actual_duration)}
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
                  {t('scheduler.taskRetrospect.completionInsights')}
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder={t('scheduler.taskRetrospect.feelingPlaceholder')}
                  className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    {t('scheduler.taskRetrospect.difficulties')}
                  </label>
                  <textarea
                    value={formData.difficulties}
                    onChange={(e) => setFormData(prev => ({ ...prev, difficulties: e.target.value }))}
                    placeholder={t('scheduler.taskRetrospect.obstaclePlaceholder')}
                    className="w-full h-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    <Lightbulb size={16} className="text-yellow-500" />
                    {t('scheduler.taskRetrospect.solutions')}
                  </label>
                  <textarea
                    value={formData.improvements}
                    onChange={(e) => setFormData(prev => ({ ...prev, improvements: e.target.value }))}
                    placeholder={t('scheduler.taskRetrospect.solutionPlaceholder')}
                    className="w-full h-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  <Brain size={16} className="text-primary-500" />
                  {t('scheduler.taskRetrospect.learned')}
                </label>
                <textarea
                  value={formData.learnings}
                  onChange={(e) => setFormData(prev => ({ ...prev, learnings: e.target.value }))}
                  placeholder={t('scheduler.taskRetrospect.learningPlaceholder')}
                  className="w-full h-16 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-500">
                <motion.button
                  onClick={() => {
                    onSkip?.();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('scheduler.taskRetrospect.skip')}
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-primary-500 text-white font-medium hover:from-emerald-600 hover:to-primary-600 transition-all disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Save size={18} />
                  {saving ? t('scheduler.taskRetrospect.saving') : t('scheduler.taskRetrospect.saveRetrospect')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {isOpen && loaded && !existingReview && showRestorePrompt && (
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
