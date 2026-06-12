import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Calendar, Clock, Tag } from "lucide-react";
import { useTheme } from "../../hooks";

interface QuickTaskFormData {
  title: string;
  description: string;
  deadline: Date;
  estimated_duration: number;
  priority: number;
  tags: string[];
}

interface CalendarTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (data: QuickTaskFormData) => Promise<void>;
  defaultDate: Date;
}

const QUICK_TAG_KEYS = [
  "calendar.quickTags.study",
  "calendar.quickTags.work",
  "calendar.quickTags.life",
  "calendar.quickTags.health",
  "calendar.quickTags.review",
];

const QUICK_TAG_VALUES = ["学习", "工作", "生活", "健康", "复习"];

export const CalendarTaskModal: React.FC<CalendarTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  defaultDate,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState<QuickTaskFormData>({
    title: "",
    description: "",
    deadline: defaultDate,
    estimated_duration: 30,
    priority: 2,
    tags: [],
  });
  const [newTag, setNewTag] = useState("");

  const handleCreate = async () => {
    if (!taskForm.title.trim()) {
      return;
    }
    setSaving(true);
    try {
      await onCreateTask(taskForm);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !taskForm.tags.includes(newTag.trim())) {
      setTaskForm({ ...taskForm, tags: [...taskForm.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTaskForm({ ...taskForm, tags: taskForm.tags.filter((t) => t !== tag) });
  };

  const priorityLabels = [
    t("calendar.low"),
    t("calendar.medium"),
    t("calendar.high"),
    t("calendar.urgent"),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-xl p-6 ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {t("calendar.createTask")}
              </h3>
              <button
                onClick={onClose}
                className={`p-3 rounded-lg min-h-[44px] min-w-[44px] ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
              >
                <X
                  size={20}
                  className={isDark ? "text-slate-400" : "text-gray-500"}
                />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {t("calendar.taskTitle")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  placeholder={t("calendar.taskTitlePlaceholder")}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {t("calendar.description")}
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  placeholder={t("calendar.descriptionPlaceholder")}
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                  }`}
                />
              </div>

              {/* Deadline */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  <Calendar size={14} className="inline mr-1" />
                  {t("calendar.deadline")}
                </label>
                <input
                  type="datetime-local"
                  value={taskForm.deadline.toISOString().slice(0, 16)}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      deadline: new Date(e.target.value),
                    })
                  }
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-900"
                  }`}
                />
              </div>

              {/* Duration & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    <Clock size={14} className="inline mr-1" />
                    {t("calendar.estimatedDuration")}
                  </label>
                  <input
                    type="number"
                    value={taskForm.estimated_duration}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        estimated_duration: parseInt(e.target.value) || 30,
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("calendar.priority")}
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        priority: parseInt(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-900"
                    }`}
                  >
                    {priorityLabels.map((label, index) => (
                      <option key={index} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  <Tag size={14} className="inline mr-1" />
                  {t("calendar.tags")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addTag())
                    }
                    placeholder={t("calendar.addTag")}
                    className={`flex-1 px-3 py-3 rounded-lg border min-h-[44px] ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className={`px-4 py-3 rounded-lg min-h-[44px] ${
                      isDark
                        ? "bg-slate-600 text-white hover:bg-slate-500"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {t("calendar.add")}
                  </button>
                </div>
                {taskForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {taskForm.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 ${
                          isDark
                            ? "bg-slate-700 text-slate-300"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-red-500 p-1 min-h-[32px] min-w-[32px]"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick tags */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TAG_KEYS.map((key, index) => {
                  const tagValue = QUICK_TAG_VALUES[index];
                  return (
                    <button
                      key={tagValue}
                      type="button"
                      onClick={() => {
                        if (!taskForm.tags.includes(tagValue)) {
                          setTaskForm({
                            ...taskForm,
                            tags: [...taskForm.tags, tagValue],
                          });
                        }
                      }}
                      className={`px-3 py-2 rounded text-sm min-h-[40px] ${
                        taskForm.tags.includes(tagValue)
                          ? "bg-primary-600 text-white"
                          : isDark
                            ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      + {t(key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className={`px-4 py-3 rounded-lg font-medium min-h-[44px] ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t("calendar.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                )}
                {t("calendar.create")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
