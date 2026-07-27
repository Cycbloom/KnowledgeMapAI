import React, { useState, useEffect, useCallback, useId } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  Tag,
  Link,
  Star,
  AlertCircle,
  Sparkles,
  Loader2,
  Zap,
  ChevronDown,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import type {
  UserTask,
  CreateUserTaskData,
  UpdateUserTaskData,
  TaskType,
  ProgressMode,
  TaskSettings,
  UserTaskStatus,
} from "@shared/types";

type TaskFormData = CreateUserTaskData & Partial<UpdateUserTaskData>;
import {
  taskRecommendationApi,
  PrioritySuggestion,
} from "../../services/api/taskRecommendation";
import { TemplateSelector } from "./TemplateSelector";
import { useFormDraft, useBeforeUnload } from "../../hooks";
import { ConfirmationModal } from "../common/ConfirmationModal";
import { SaveButton } from "../common/SaveButton";

interface TaskFormProps {
  task?: UserTask;
  onSubmit: (data: TaskFormData) => void;
  onCancel: () => void;
  knowledgePoints?: { id: string; title: string }[];
  defaultQueueLevel?: number;
  availableTasks?: UserTask[];
  timeSliceSettings?: TaskSettings | null;
}

interface TaskDraft {
  title: string;
  description: string;
  estimatedDuration: number;
  deadline: string;
  tags: string[];
  knowledgePointId: string;
  priority: number;
  queueLevel: number;
  taskType: TaskType;
  totalDuration: number;
  progressMode: ProgressMode;
  context: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  onSubmit,
  onCancel,
  knowledgePoints = [],
  defaultQueueLevel = 2,
  availableTasks = [],
  timeSliceSettings = null,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = !!task;

  const fieldIdBase = useId();
  const titleFieldId = `${fieldIdBase}-title`;
  const titleErrorId = `${fieldIdBase}-title-error`;
  const descriptionFieldId = `${fieldIdBase}-description`;
  const taskTypeFieldId = `${fieldIdBase}-taskType`;
  const totalDurationFieldId = `${fieldIdBase}-totalDuration`;
  const progressModeFieldId = `${fieldIdBase}-progressMode`;
  const estimatedDurationFieldId = `${fieldIdBase}-estimatedDuration`;
  const deadlineFieldId = `${fieldIdBase}-deadline`;
  const statusFieldId = `${fieldIdBase}-status`;
  const customTagFieldId = `${fieldIdBase}-customTag`;
  const knowledgePointFieldId = `${fieldIdBase}-knowledgePoint`;

  const DURATION_OPTIONS = [
    { value: 15, label: t("scheduler.taskForm.duration15min") },
    { value: 25, label: t("scheduler.taskForm.duration25min") },
    { value: 30, label: t("scheduler.taskForm.duration30min") },
    { value: 45, label: t("scheduler.taskForm.duration45min") },
    { value: 60, label: t("scheduler.taskForm.duration1hour") },
    { value: 90, label: t("scheduler.taskForm.duration1_5hours") },
    { value: 120, label: t("scheduler.taskForm.duration2hours") },
    { value: 180, label: t("scheduler.taskForm.duration3hours") },
  ];

  const PRIORITY_OPTIONS = [
    {
      value: 1,
      label: t("scheduler.taskForm.priorityLow"),
      color: "text-slate-500 dark:text-slate-400",
    },
    {
      value: 2,
      label: t("scheduler.taskForm.priorityMedium"),
      color: "text-primary-600 dark:text-primary-400",
    },
    {
      value: 3,
      label: t("scheduler.taskForm.priorityHigh"),
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      value: 4,
      label: t("scheduler.taskForm.priorityUrgent"),
      color: "text-red-600 dark:text-red-400",
    },
  ];

  const COMMON_TAGS = [
    t("scheduler.taskForm.tagStudy"),
    t("scheduler.taskForm.tagWork"),
    t("scheduler.taskForm.tagReading"),
    t("scheduler.taskForm.tagWriting"),
    t("scheduler.taskForm.tagCoding"),
    t("scheduler.taskForm.tagReview"),
    t("scheduler.taskForm.tagProject"),
    t("scheduler.taskForm.tagMeeting"),
    t("scheduler.taskForm.tagExercise"),
    t("scheduler.taskForm.tagRest"),
  ];

  const getInitialDraft = (): TaskDraft => {
    if (isEditing) {
      return {
        title: task?.title || "",
        description:
          typeof task?.description === "string" ? task.description : "",
        estimatedDuration: task?.estimated_duration || 25,
        deadline: task?.deadline ? task.deadline.slice(0, 16) : "",
        tags: task?.tags || [],
        knowledgePointId: task?.knowledge_point_id || "",
        priority: task?.priority || 2,
        queueLevel: task?.queue_level ?? defaultQueueLevel,
        taskType: task?.task_type || "one_time",
        totalDuration: task?.total_duration || 0,
        progressMode: task?.progress_mode || "average",
        context: typeof task?.context === "string" ? task.context : "",
      };
    }
    return {
      title: "",
      description: "",
      estimatedDuration: 25,
      deadline: "",
      tags: [],
      knowledgePointId: "",
      priority: 2,
      queueLevel: defaultQueueLevel,
      taskType: "one_time" as TaskType,
      totalDuration: 0,
      progressMode: "average" as ProgressMode,
      context: "",
    };
  };

  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<TaskDraft>({
    key: "task_form_draft",
    initialValue: getInitialDraft(),
  });

  const {
    title,
    description,
    estimatedDuration,
    deadline,
    tags,
    knowledgePointId,
    priority,
    queueLevel,
    taskType,
    totalDuration,
    progressMode,
    context,
  } = formData;

  const [status, setStatus] = useState<UserTaskStatus>(
    task?.status || "pending",
  );
  const [customTag, setCustomTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [prioritySuggestion, setPrioritySuggestion] =
    useState<PrioritySuggestion | null>(null);
  const [showPrioritySuggestion, setShowPrioritySuggestion] = useState(false);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>(
    [],
  );
  const [showDependencySelector, setShowDependencySelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Warn user before leaving when there are unsaved changes
  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(getInitialDraft());
  useBeforeUnload(isDirty, t("common.unsavedChanges"));

  const handleTemplateSelect = (data: {
    title: string;
    description?: string;
    estimated_duration: number;
    tags: string[];
    priority: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      title: data.title,
      description: data.description ?? prev.description,
      estimatedDuration: data.estimated_duration,
      tags: data.tags,
      priority: data.priority,
    }));
  };

  const analyzePriority = useCallback(
    async (titleText: string, descriptionText?: string) => {
      if (!titleText.trim() || isEditing) return;

      try {
        const result = await taskRecommendationApi.analyzePriority(
          titleText,
          descriptionText,
        );
        setPrioritySuggestion(result.data);
        setShowPrioritySuggestion(true);
      } catch (error) {
        console.error("Failed to analyze priority:", error);
      }
    },
    [isEditing],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (title.trim()) {
        analyzePriority(title, description);
      } else {
        setPrioritySuggestion(null);
        setShowPrioritySuggestion(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [title, description, analyzePriority]);

  const applyPrioritySuggestion = () => {
    if (prioritySuggestion) {
      setFormData((prev) => ({
        ...prev,
        priority: prioritySuggestion.suggestedPriority,
        queueLevel: prioritySuggestion.suggestedQueue,
      }));
      setShowPrioritySuggestion(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = t("scheduler.taskForm.errorTitleRequired");
    }
    if (title.length > 100) {
      newErrors.title = t("scheduler.taskForm.errorTitleTooLong");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) {
      setErrors({ title: t("scheduler.taskForm.errorEnterTitleFirst") });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.scheduler.generateDetails(
        title.trim(),
        description || undefined,
      );

      const result = response;

      if (result) {
        if (result.description) {
          setFormData((prev) => ({ ...prev, description: result.description }));
        }
        if (result.tags && result.tags.length > 0) {
          setFormData((prev) => {
            const newTags = [...new Set([...prev.tags, ...result.tags])];
            return { ...prev, tags: newTags.slice(0, 5) };
          });
        }
        if (result.estimated_duration) {
          const closest = DURATION_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - result.estimated_duration) <
            Math.abs(prev.value - result.estimated_duration)
              ? curr
              : prev,
          );
          setFormData((prev) => ({
            ...prev,
            estimatedDuration: closest.value,
          }));
        }
        if (result.priority) {
          setFormData((prev) => ({ ...prev, priority: result.priority }));
        }
        if (result.suggested_queue !== undefined) {
          setFormData((prev) => ({
            ...prev,
            queueLevel: result.suggested_queue,
          }));
        }
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!validate()) return;

    if (!isEditing) {
      clearDraft();
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      estimated_duration: estimatedDuration,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      tags: tags.length > 0 ? tags : undefined,
      knowledge_point_id: knowledgePointId || undefined,
      priority,
      queue_level: queueLevel,
      task_type: taskType,
      total_duration: taskType === "long_term" ? totalDuration : undefined,
      progress_mode: taskType === "long_term" ? progressMode : undefined,
      context: typeof context === "string" ? context.trim() : undefined,
      status: isEditing ? status : undefined,
    });

    if (selectedDependencies.length > 0) {
      selectedDependencies.forEach((depId) => {
        api.scheduler
          .addTaskDependency(task?.id || "", {
            depends_on_task_id: depId,
            dependency_type: "soft",
          })
          .catch((err: unknown) =>
            console.error("Failed to add dependency:", err),
          );
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSave();
  };

  const handleCancel = () => {
    if (!isEditing) {
      clearDraft();
    }
    onCancel();
  };

  const handleReset = () => {
    if (!isEditing) {
      clearDraft();
      setFormData({
        title: "",
        description: "",
        estimatedDuration: 25,
        deadline: "",
        tags: [],
        knowledgePointId: "",
        priority: 2,
        queueLevel: defaultQueueLevel,
        taskType: "one_time" as TaskType,
        totalDuration: 0,
        progressMode: "average" as ProgressMode,
        context: "",
      });
      setErrors({});
      setPrioritySuggestion(null);
      setShowPrioritySuggestion(false);
      setSelectedDependencies([]);
    }
  };

  const handleClose = () => {
    onCancel();
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTag.trim()) {
      e.preventDefault();
      addTag(customTag.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-500 rounded-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[95dvh] sm:max-h-[90dvh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEditing
              ? t("scheduler.taskForm.editTask")
              : t("scheduler.taskForm.createTask")}
          </h2>
          <button
            onClick={handleClose}
            className="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors touch-target"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 sm:space-y-4 max-h-[calc(95dvh-140px)] sm:max-h-[calc(90dvh-140px)] overflow-y-auto"
        >
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowTemplateSelector(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors min-h-[44px] touch-target"
            >
              <FileText size={18} />
              <span>{t("scheduler.taskForm.createFromTemplate")}</span>
            </button>
          )}

          <div>
            <label htmlFor={titleFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t("scheduler.taskForm.taskTitle")}{" "}
              <span aria-hidden="true" className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id={titleFieldId}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? titleErrorId : undefined}
                type="text"
                autoComplete="off"
                value={title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder={t("scheduler.taskForm.titlePlaceholder")}
                className={`
                  flex-1 input-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border transition-all
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  ${errors.title ? "border-red-400 dark:border-red-500" : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500"}
                `}
              />
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={isGenerating || !title.trim()}
                className={`
                  flex items-center gap-1.5 px-4 py-3 rounded-xl
                  transition-all whitespace-nowrap min-h-[44px] touch-target
                  ${
                    isGenerating
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary-500 to-pink-500 text-white hover:from-primary-400 hover:to-pink-400 shadow-lg shadow-primary-500/20"
                  }
                `}
                title={t("scheduler.taskForm.aiGenerateHint")}
              >
                {isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                <span className="text-sm font-medium">AI</span>
              </button>
            </div>
            {errors.title && (
              <p role="alert" id={titleErrorId} className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={descriptionFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t("scheduler.taskForm.taskDescription")}
            </label>
            <textarea
              id={descriptionFieldId}
              autoComplete="off"
              value={description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder={t("scheduler.taskForm.descriptionPlaceholder")}
              rows={3}
              className="
                w-full textarea-mobile rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                resize-none transition-all
              "
            />
          </div>

          <div>
            <label htmlFor={taskTypeFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Layers size={14} className="inline mr-1" />
              {t("scheduler.taskForm.taskType")}
            </label>
            <select
              id={taskTypeFieldId}
              value={taskType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  taskType: e.target.value as TaskType,
                }))
              }
              className="
                w-full select-mobile rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                transition-all
              "
            >
              <option value="one_time">
                {t("scheduler.taskForm.typeOneTime")}
              </option>
              <option value="long_term">
                {t("scheduler.taskForm.typeLongTerm")}
              </option>
              <option value="periodic">
                {t("scheduler.taskForm.typePeriodic")}
              </option>
              <option value="learning">
                {t("scheduler.taskForm.typeLearning")}
              </option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {taskType === "one_time" &&
                t("scheduler.taskForm.typeOneTimeDesc")}
              {taskType === "long_term" &&
                t("scheduler.taskForm.typeLongTermDesc")}
              {taskType === "periodic" &&
                t("scheduler.taskForm.typePeriodicDesc")}
              {taskType === "learning" &&
                t("scheduler.taskForm.typeLearningDesc")}
            </p>
          </div>

          {taskType === "long_term" && (
            <div>
              <label htmlFor={totalDurationFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                {t("scheduler.taskForm.totalDuration")}
              </label>
              <input
                id={totalDurationFieldId}
                type="number"
                value={totalDuration || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    totalDuration: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder={t("scheduler.taskForm.totalDurationPlaceholder")}
                min={0}
                className="
                  w-full input-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              />
              {totalDuration > 0 && timeSliceSettings && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("scheduler.taskForm.estimatedTimeSlices", {
                    count: Math.ceil(
                      totalDuration / timeSliceSettings.q0_time_slice,
                    ),
                  })}
                </p>
              )}
            </div>
          )}

          {taskType === "long_term" && totalDuration > 0 && (
            <div>
              <label htmlFor={progressModeFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("scheduler.taskForm.progressMode")}
              </label>
              <select
                id={progressModeFieldId}
                value={progressMode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    progressMode: e.target.value as ProgressMode,
                  }))
                }
                className="
                  w-full select-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              >
                <option value="average">
                  {t("scheduler.taskForm.progressAverage")}
                </option>
                <option value="decreasing">
                  {t("scheduler.taskForm.progressDecreasing")}
                </option>
                <option value="increasing">
                  {t("scheduler.taskForm.progressIncreasing")}
                </option>
                <option value="custom">
                  {t("scheduler.taskForm.progressCustom")}
                </option>
              </select>
              <div className="mt-2 flex items-center gap-2">
                {progressMode === "average" && (
                  <Minus size={14} className="text-primary-500" />
                )}
                {progressMode === "decreasing" && (
                  <TrendingDown size={14} className="text-amber-500" />
                )}
                {progressMode === "increasing" && (
                  <TrendingUp size={14} className="text-emerald-500" />
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {progressMode === "average" &&
                    t("scheduler.taskForm.progressAverageDesc")}
                  {progressMode === "decreasing" &&
                    t("scheduler.taskForm.progressDecreasingDesc")}
                  {progressMode === "increasing" &&
                    t("scheduler.taskForm.progressIncreasingDesc")}
                  {progressMode === "custom" &&
                    t("scheduler.taskForm.progressCustomDesc")}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t("scheduler.taskForm.dependencies")}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowDependencySelector(!showDependencySelector)
                }
                className="
                  w-full select-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white text-left
                  flex items-center justify-between
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              >
                <span
                  className={
                    selectedDependencies.length > 0
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {selectedDependencies.length > 0
                    ? t("scheduler.taskForm.dependenciesSelected", {
                        count: selectedDependencies.length,
                      })
                    : t("scheduler.taskForm.selectDependencies")}
                </span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {showDependencySelector && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-500 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {availableTasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                      {t("scheduler.taskForm.noAvailableTasks")}
                    </div>
                  ) : (
                    availableTasks
                      .filter((t) => t.id !== task?.id)
                      .map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-500 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDependencies.includes(t.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDependencies([
                                  ...selectedDependencies,
                                  t.id,
                                ]);
                              } else {
                                setSelectedDependencies(
                                  selectedDependencies.filter(
                                    (id) => id !== t.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded border-slate-300 dark:border-slate-500 text-primary-500 focus:ring-primary-500/50"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {t.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Q{t.queue_level} · P{t.priority}
                            </p>
                          </div>
                        </label>
                      ))
                  )}
                </div>
              )}
            </div>
            {selectedDependencies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDependencies.map((depId) => {
                  const t = availableTasks.find((item) => item.id === depId);
                  return t ? (
                    <span
                      key={depId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-lg text-sm"
                    >
                      {t.title}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDependencies(
                            selectedDependencies.filter((id) => id !== depId),
                          )
                        }
                        className="hover:text-primary-900 dark:hover:text-primary-100"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <FileText size={14} className="inline mr-1" />
              {t("scheduler.taskForm.context")}
            </label>

            {(() => {
              let parsedContext: Record<string, unknown> = {};
              try {
                parsedContext = context
                  ? typeof context === "string"
                    ? JSON.parse(context)
                    : context
                  : {};
              } catch {
                return (
                  <textarea
                    value={context}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        context: e.target.value,
                      }))
                    }
                    placeholder={t("scheduler.taskForm.contextPlaceholder")}
                    rows={3}
                    maxLength={2000}
                    className="
                      w-full textarea-mobile rounded-xl
                      bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                      text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                      focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                      resize-none font-mono text-xs
                      transition-all
                    "
                  />
                );
              }

              const hasGraphContext = !!(
                parsedContext.graph_id || parsedContext.source_graph_id
              );
              const isAutoGenerated = parsedContext.auto_generated === true;

              if (
                hasGraphContext ||
                isAutoGenerated ||
                Object.keys(parsedContext).length > 0
              ) {
                return (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-primary-50 dark:from-slate-800 dark:to-primary-500/10 border border-slate-200 dark:border-slate-500">
                      <div className="flex items-center gap-2 mb-2">
                        {isAutoGenerated && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
                            <Sparkles size={12} />
                            自动生成
                          </span>
                        )}
                        {task?.source === "system_recommendation" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                            <Zap size={12} />
                            系统推荐
                          </span>
                        )}
                        {task?.source === "import" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                            导入
                          </span>
                        )}
                      </div>

                      {hasGraphContext && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const graphId = String(
                              parsedContext.graph_id ||
                                parsedContext.source_graph_id ||
                                "",
                            );
                            if (
                              graphId &&
                              graphId !== "" &&
                              graphId !== "undefined"
                            ) {
                              navigate(`/graph/${graphId}`);
                            }
                          }}
                          className="w-full flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-500 hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors cursor-pointer text-left"
                        >
                          <Layers
                            size={16}
                            className="text-primary-500 mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              关联图谱
                            </p>
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                              {String(
                                parsedContext.graph_title ||
                                  parsedContext.source_graph_title ||
                                  parsedContext.topic ||
                                  "点击查看图谱",
                              )}
                            </p>
                          </div>
                          <ExternalLink
                            size={14}
                            className="text-slate-400 mt-1 flex-shrink-0"
                          />
                        </button>
                      )}

                      {!!parsedContext.node_id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const graphId = String(
                              parsedContext.graph_id ||
                                parsedContext.source_graph_id ||
                                "",
                            );
                            const nodeId = String(parsedContext.node_id);
                            if (
                              graphId &&
                              nodeId &&
                              graphId !== "" &&
                              graphId !== "undefined"
                            ) {
                              navigate(`/graph/${graphId}?node=${nodeId}`);
                            }
                          }}
                          className="w-full flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-500 hover:border-amber-300 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer text-left"
                        >
                          <Link
                            size={16}
                            className="text-amber-500 mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              关联知识点
                            </p>
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                              {String(
                                parsedContext.node_title ||
                                  parsedContext.knowledge_point_title ||
                                  "点击查看知识点",
                              )}
                            </p>
                          </div>
                          <ExternalLink
                            size={14}
                            className="text-slate-400 mt-1 flex-shrink-0"
                          />
                        </button>
                      )}

                      {parsedContext.depth !== undefined && (
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>扩展深度</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {String(parsedContext.depth)}
                          </span>
                        </div>
                      )}

                      {parsedContext.max_depth !== undefined && (
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>最大深度</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {String(parsedContext.max_depth)}
                          </span>
                        </div>
                      )}

                      {!!parsedContext.style && (
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>扩展风格</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                            {String(parsedContext.style)}
                          </span>
                        </div>
                      )}

                      {!!parsedContext.topic && (
                        <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-500">
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            主题
                          </p>
                          <p className="text-sm text-slate-800 dark:text-slate-200">
                            {String(parsedContext.topic)}
                          </p>
                        </div>
                      )}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1">
                        <ChevronDown
                          size={12}
                          className="transition-transform group-open:rotate-180"
                        />
                        查看原始数据
                      </summary>
                      <pre className="mt-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-32 overflow-y-auto">
                        {JSON.stringify(parsedContext, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              }

              return (
                <textarea
                  value={context}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      context: e.target.value,
                    }))
                  }
                  placeholder={t("scheduler.taskForm.contextPlaceholder")}
                  rows={3}
                  maxLength={2000}
                  className="
                    w-full textarea-mobile rounded-xl
                    bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                    text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                    resize-none transition-all
                  "
                />
              );
            })()}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-right">
              {context.length}/2000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={estimatedDurationFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                {t("scheduler.taskForm.estimatedDuration")}
              </label>
              <select
                id={estimatedDurationFieldId}
                value={estimatedDuration}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedDuration: Number(e.target.value),
                  }))
                }
                className="
                  w-full select-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={deadlineFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Calendar size={14} className="inline mr-1" />
                {t("scheduler.taskForm.deadline")}
              </label>
              <input
                id={deadlineFieldId}
                type="datetime-local"
                value={deadline}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, deadline: e.target.value }))
                }
                className="
                  w-full input-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Star size={14} className="inline mr-1" />
                {t("scheduler.taskForm.priority")}
              </label>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, priority: opt.value }))
                    }
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        priority === opt.value
                          ? `bg-slate-100 dark:bg-slate-700 ${opt.color} ring-1 ring-current`
                          : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {showPrioritySuggestion && prioritySuggestion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 p-2 rounded-lg bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-500/10 dark:to-pink-500/10 border border-primary-200 dark:border-primary-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap
                        size={14}
                        className="text-primary-500 dark:text-primary-400"
                      />
                      <span className="text-xs text-primary-700 dark:text-primary-300">
                        {t("scheduler.taskForm.suggestion")}: P
                        {prioritySuggestion.suggestedPriority} / Q
                        {prioritySuggestion.suggestedQueue}
                        <span className="ml-1 text-primary-400 dark:text-primary-500">
                          ({Math.round(prioritySuggestion.confidence * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={applyPrioritySuggestion}
                        className="px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-500/30 transition-colors"
                      >
                        {t("scheduler.taskForm.apply")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrioritySuggestion(false)}
                        className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {t("scheduler.taskForm.ignore")}
                      </button>
                    </div>
                  </div>
                  {prioritySuggestion.keywords.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t("scheduler.taskForm.detected")}:{" "}
                      {prioritySuggestion.keywords.slice(0, 3).join(", ")}
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("scheduler.taskForm.queueLevel")}
              </label>
              <div className="flex gap-1">
                {[0, 1, 2].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, queueLevel: level }))
                    }
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        queueLevel === level
                          ? level === 0
                            ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-500/50"
                            : level === 1
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/50"
                              : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-500/50"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      }
                    `}
                  >
                    Q{level}
                  </button>
                ))}
              </div>
            </div>

            {isEditing && (
              <div>
                <label htmlFor={statusFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  <CircleDot size={14} className="inline mr-1" />
                  状态
                </label>
                <select
                  id={statusFieldId}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserTaskStatus)}
                  className="
                    w-full select-mobile rounded-xl
                    bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                    text-slate-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                    transition-all
                  "
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor={customTagFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Tag size={14} className="inline mr-1" />
              {t("scheduler.taskForm.tags")}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_TAGS.filter((t) => !tags.includes(t))
                .slice(0, 6)
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
            </div>
            <input
              id={customTagFieldId}
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("scheduler.taskForm.customTagPlaceholder")}
              className="
                w-full input-mobile rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                transition-all
              "
            />
          </div>

          {knowledgePoints.length > 0 && (
            <div>
              <label htmlFor={knowledgePointFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Link size={14} className="inline mr-1" />
                {t("scheduler.taskForm.linkKnowledge")}
              </label>
              <select
                id={knowledgePointFieldId}
                value={knowledgePointId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    knowledgePointId: e.target.value,
                  }))
                }
                className="
                  w-full select-mobile rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                  transition-all
                "
              >
                <option value="">
                  {t("scheduler.taskForm.noKnowledgeLink")}
                </option>
                {knowledgePoints.map((kp) => (
                  <option key={kp.id} value={kp.id}>
                    {kp.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-500 bg-slate-50/50 dark:bg-slate-800/30">
          {!isEditing && (
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors min-h-[44px] touch-target font-medium"
            >
              {t("scheduler.taskForm.reset")}
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors min-h-[44px] touch-target font-medium"
          >
            {t("scheduler.taskForm.cancel")}
          </button>
          <SaveButton
            onSave={handleSave}
            variant="primary"
            size="md"
            className="flex-1 sm:flex-none touch-target"
            idleLabel={
              isEditing
                ? t("scheduler.taskForm.saveChanges")
                : t("scheduler.taskForm.createTaskBtn")
            }
          />
        </div>
      </motion.div>

      {/* Template Selector Modal */}
      <AnimatePresence>
        {showTemplateSelector && (
          <TemplateSelector
            onSelect={handleTemplateSelect}
            onClose={() => setShowTemplateSelector(false)}
          />
        )}
      </AnimatePresence>

      {!isEditing && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t("common.draft.restoreTitle", {
            defaultValue: "Restore unsaved draft?",
          })}
          message={t("common.draft.restoreMessage", {
            defaultValue:
              "We found an unsaved draft from a previous session. Would you like to restore it?",
          })}
          confirmText={t("common.draft.restore", {
            defaultValue: "Restore",
          })}
          cancelText={t("common.draft.discard", {
            defaultValue: "Discard",
          })}
        />
      )}
    </motion.div>
  );
};
