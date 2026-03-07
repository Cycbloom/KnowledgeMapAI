import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  ScheduledTask,
  CreateScheduledTaskData,
  schedulerApi,
  TaskType,
  ProgressMode,
  TaskSettings,
} from "../../services/api/scheduler";
import {
  taskRecommendationApi,
  PrioritySuggestion,
} from "../../services/api/taskRecommendation";
import { TemplateSelector } from "./TemplateSelector";

interface TaskFormProps {
  task?: ScheduledTask;
  onSubmit: (data: CreateScheduledTaskData) => void;
  onCancel: () => void;
  knowledgePoints?: { id: string; title: string }[];
  defaultQueueLevel?: number;
  availableTasks?: ScheduledTask[];
  timeSliceSettings?: TaskSettings | null;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 分钟" },
  { value: 25, label: "25 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 45, label: "45 分钟" },
  { value: 60, label: "1 小时" },
  { value: 90, label: "1.5 小时" },
  { value: 120, label: "2 小时" },
  { value: 180, label: "3 小时" },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: "低", color: "text-slate-500 dark:text-slate-400" },
  { value: 2, label: "中", color: "text-blue-600 dark:text-blue-400" },
  { value: 3, label: "高", color: "text-amber-600 dark:text-amber-400" },
  { value: 4, label: "紧急", color: "text-red-600 dark:text-red-400" },
];

const COMMON_TAGS = [
  "学习",
  "工作",
  "阅读",
  "写作",
  "编程",
  "复习",
  "项目",
  "会议",
  "运动",
  "休息",
];

const TASK_DRAFT_KEY = "task_form_draft";

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

const loadDraft = (): TaskDraft | null => {
  try {
    const saved = localStorage.getItem(TASK_DRAFT_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load draft:", e);
  }
  return null;
};

const saveDraft = (draft: TaskDraft) => {
  try {
    localStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error("Failed to save draft:", e);
  }
};

const clearDraft = () => {
  try {
    localStorage.removeItem(TASK_DRAFT_KEY);
  } catch (e) {
    console.error("Failed to clear draft:", e);
  }
};

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  onSubmit,
  onCancel,
  knowledgePoints = [],
  defaultQueueLevel = 2,
  availableTasks = [],
  timeSliceSettings = null,
}) => {
  const isEditing = !!task;

  const getInitialState = () => {
    if (isEditing) {
      return {
        title: task?.title || "",
        description: task?.description || "",
        estimatedDuration: task?.estimated_duration || 25,
        deadline: task?.deadline ? task.deadline.slice(0, 16) : "",
        tags: task?.tags || [],
        knowledgePointId: task?.knowledge_point_id || "",
        priority: task?.priority || 2,
        queueLevel: task?.queue_level ?? defaultQueueLevel,
        taskType: (task as any)?.task_type || "one_time",
        totalDuration: (task as any)?.total_duration || 0,
        progressMode: (task as any)?.progress_mode || "average",
        context: (task as any)?.context || "",
      };
    }
    const draft = loadDraft();
    if (draft) {
      return {
        ...draft,
        taskType: draft.taskType || "one_time",
        totalDuration: draft.totalDuration || 0,
        progressMode: draft.progressMode || "average",
        context: draft.context || "",
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

  const initialState = getInitialState();

  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [estimatedDuration, setEstimatedDuration] = useState(
    initialState.estimatedDuration,
  );
  const [deadline, setDeadline] = useState(initialState.deadline);
  const [tags, setTags] = useState<string[]>(initialState.tags);
  const [customTag, setCustomTag] = useState("");
  const [knowledgePointId, setKnowledgePointId] = useState(
    initialState.knowledgePointId,
  );
  const [priority, setPriority] = useState(initialState.priority);
  const [queueLevel, setQueueLevel] = useState(initialState.queueLevel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [prioritySuggestion, setPrioritySuggestion] =
    useState<PrioritySuggestion | null>(null);
  const [showPrioritySuggestion, setShowPrioritySuggestion] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>(initialState.taskType);
  const [totalDuration, setTotalDuration] = useState(
    initialState.totalDuration,
  );
  const [progressMode, setProgressMode] = useState<ProgressMode>(
    initialState.progressMode,
  );
  const [context, setContext] = useState(initialState.context);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>(
    [],
  );
  const [showDependencySelector, setShowDependencySelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const handleTemplateSelect = (data: {
    title: string;
    description?: string;
    estimated_duration: number;
    tags: string[];
    priority: number;
  }) => {
    setTitle(data.title);
    if (data.description) setDescription(data.description);
    setEstimatedDuration(data.estimated_duration);
    setTags(data.tags);
    setPriority(data.priority);
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

  useEffect(() => {
    if (!isEditing) {
      saveDraft({
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
      });
    }
  }, [
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
    isEditing,
  ]);

  const applyPrioritySuggestion = () => {
    if (prioritySuggestion) {
      setPriority(prioritySuggestion.suggestedPriority);
      setQueueLevel(prioritySuggestion.suggestedQueue);
      setShowPrioritySuggestion(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = "请输入任务标题";
    }
    if (title.length > 100) {
      newErrors.title = "标题不能超过100个字符";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) {
      setErrors({ title: "请先输入任务标题" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await schedulerApi.generateTaskDetails(
        title.trim(),
        description || undefined,
      );

      const result = response.data || response;

      if (result) {
        if (result.description) {
          setDescription(result.description);
        }
        if (result.tags && result.tags.length > 0) {
          setTags((prev) => {
            const newTags = [...new Set([...prev, ...result.tags])];
            return newTags.slice(0, 5);
          });
        }
        if (result.estimated_duration) {
          const closest = DURATION_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - result.estimated_duration) <
            Math.abs(prev.value - result.estimated_duration)
              ? curr
              : prev,
          );
          setEstimatedDuration(closest.value);
        }
        if (result.priority) {
          setPriority(result.priority);
        }
        if (result.suggested_queue !== undefined) {
          setQueueLevel(result.suggested_queue);
        }
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      context: context.trim() || undefined,
    });

    if (selectedDependencies.length > 0) {
      selectedDependencies.forEach((depId) => {
        schedulerApi
          .addTaskDependency(task?.id || "", {
            depends_on_task_id: depId,
            dependency_type: "soft",
          })
          .catch((err) => console.error("Failed to add dependency:", err));
      });
    }
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
      setTitle("");
      setDescription("");
      setEstimatedDuration(25);
      setDeadline("");
      setTags([]);
      setKnowledgePointId("");
      setPriority(2);
      setQueueLevel(defaultQueueLevel);
      setErrors({});
      setPrioritySuggestion(null);
      setShowPrioritySuggestion(false);
      setTaskType("one_time");
      setTotalDuration(0);
      setProgressMode("average");
      setContext("");
      setSelectedDependencies([]);
    }
  };

  const handleClose = () => {
    onCancel();
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEditing ? "编辑任务" : "创建新任务"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowTemplateSelector(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              <FileText size={18} />
              <span>从模板创建</span>
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              任务标题 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入任务标题..."
                className={`
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border transition-all
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                  ${errors.title ? "border-red-400 dark:border-red-500" : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"}
                `}
              />
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={isGenerating || !title.trim()}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                  transition-all whitespace-nowrap
                  ${
                    isGenerating
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/20"
                  }
                `}
                title="AI 自动生成描述和标签"
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
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加任务描述，或点击 AI 按钮自动生成..."
              rows={3}
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                resize-none
              "
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Layers size={14} className="inline mr-1" />
              任务类型
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
              "
            >
              <option value="one_time">一次性任务</option>
              <option value="long_term">长期项目任务</option>
              <option value="periodic">周期性任务</option>
              <option value="learning">学习任务</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {taskType === "one_time" && "单次完成的任务，如完成一份报告"}
              {taskType === "long_term" &&
                "需要多天完成的长期任务，如完成一个项目"}
              {taskType === "periodic" && "按固定周期重复的任务，如每日阅读"}
              {taskType === "learning" && "学习相关的任务，如学习一门新技能"}
            </p>
          </div>

          {taskType === "long_term" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                任务总时长（分钟）
              </label>
              <input
                type="number"
                value={totalDuration || ""}
                onChange={(e) =>
                  setTotalDuration(parseInt(e.target.value) || 0)
                }
                placeholder="例如：180 表示3小时"
                min={0}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              />
              {totalDuration > 0 && timeSliceSettings && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  预计需要约{" "}
                  {Math.ceil(totalDuration / timeSliceSettings.q0_time_slice)}{" "}
                  个时间片完成
                </p>
              )}
            </div>
          )}

          {taskType === "long_term" && totalDuration > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                进度分配模式
              </label>
              <select
                value={progressMode}
                onChange={(e) =>
                  setProgressMode(e.target.value as ProgressMode)
                }
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              >
                <option value="average">平均分配 - 每天完成相同进度</option>
                <option value="decreasing">递减模式 - 前期多后期少</option>
                <option value="increasing">递增模式 - 前期少后期多</option>
                <option value="custom">自定义 - 手动设置每日进度</option>
              </select>
              <div className="mt-2 flex items-center gap-2">
                {progressMode === "average" && (
                  <Minus size={14} className="text-blue-500" />
                )}
                {progressMode === "decreasing" && (
                  <TrendingDown size={14} className="text-amber-500" />
                )}
                {progressMode === "increasing" && (
                  <TrendingUp size={14} className="text-emerald-500" />
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {progressMode === "average" && "每天完成相同的进度百分比"}
                  {progressMode === "decreasing" &&
                    "类似加速折旧，前期完成更多"}
                  {progressMode === "increasing" &&
                    "前期完成较少，后期逐渐增加"}
                  {progressMode === "custom" && "手动设置每天的进度目标"}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              前置依赖任务（可选）
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowDependencySelector(!showDependencySelector)
                }
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white text-left
                  flex items-center justify-between
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
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
                    ? `已选择 ${selectedDependencies.length} 个前置任务`
                    : "选择前置任务"}
                </span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {showDependencySelector && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {availableTasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                      暂无可选任务
                    </div>
                  ) : (
                    availableTasks
                      .filter((t) => t.id !== task?.id)
                      .map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
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
                            className="rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 rounded-lg text-sm"
                    >
                      {t.title}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDependencies(
                            selectedDependencies.filter((id) => id !== depId),
                          )
                        }
                        className="hover:text-cyan-900 dark:hover:text-cyan-100"
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
              任务上下文（可选）
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="描述任务的背景、目标、注意事项等..."
              rows={3}
              maxLength={2000}
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                resize-none
              "
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-right">
              {context.length}/2000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                预计时长
              </label>
              <select
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Calendar size={14} className="inline mr-1" />
                截止日期
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Star size={14} className="inline mr-1" />
                优先级
              </label>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
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
                  className="mt-2 p-2 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-200 dark:border-purple-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap
                        size={14}
                        className="text-purple-500 dark:text-purple-400"
                      />
                      <span className="text-xs text-purple-700 dark:text-purple-300">
                        建议: P{prioritySuggestion.suggestedPriority} / Q
                        {prioritySuggestion.suggestedQueue}
                        <span className="ml-1 text-purple-400 dark:text-purple-500">
                          ({Math.round(prioritySuggestion.confidence * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={applyPrioritySuggestion}
                        className="px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
                      >
                        应用
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrioritySuggestion(false)}
                        className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                  {prioritySuggestion.keywords.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      检测到:{" "}
                      {prioritySuggestion.keywords.slice(0, 3).join(", ")}
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                队列级别
              </label>
              <div className="flex gap-1">
                {[0, 1, 2].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setQueueLevel(level)}
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        queueLevel === level
                          ? level === 0
                            ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 ring-1 ring-cyan-300 dark:ring-cyan-500/50"
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
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Tag size={14} className="inline mr-1" />
              标签
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm flex items-center gap-1"
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
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入自定义标签，按 Enter 添加..."
              className="
                w-full px-4 py-2 rounded-xl
                bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
              "
            />
          </div>

          {knowledgePoints.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Link size={14} className="inline mr-1" />
                关联知识点
              </label>
              <select
                value={knowledgePointId}
                onChange={(e) => setKnowledgePointId(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                  text-slate-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              >
                <option value="">不关联知识点</option>
                {knowledgePoints.map((kp) => (
                  <option key={kp.id} value={kp.id}>
                    {kp.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          {!isEditing && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              重置
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
          >
            {isEditing ? "保存修改" : "创建任务"}
          </button>
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
    </motion.div>
  );
};
