import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Calendar,
  Tag,
  AlertTriangle,
  Timer,
  BarChart3,
  FileText,
  Bookmark,
} from "lucide-react";
import { api } from "../../../services/api";
import { UserTaskDetail } from "../../../types";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubtaskList } from "./SubtaskList";
import { TaskLinks } from "./TaskLinks";
import { KnowledgePointAssociation } from "./KnowledgePointAssociation";
import { ExecutionRecords } from "./ExecutionRecords";
import { ProgressDetail } from "./ProgressDetail";
import { SaveAsTemplateModal } from "../SaveAsTemplateModal";

type WorkTab = "notes" | "subtasks" | "executions" | "progress";

interface TaskWorkbenchProps {
  taskId: string;
  onBack: () => void;
  onEdit?: () => void;
}

export const TaskWorkbench: React.FC<TaskWorkbenchProps> = ({
  taskId,
  onBack,
  onEdit,
}) => {
  const [task, setTask] = useState<UserTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkTab>("notes");
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

  useEffect(() => {
    loadTaskDetail();
  }, [taskId]);

  const loadTaskDetail = async () => {
    setLoading(true);
    try {
      const response = await api.scheduler.getDetail(taskId);
      if (response.success) {
        setTask(response.data);
      }
    } catch (error) {
      console.error("Failed to load task detail:", error);
      frontendEventBus.publish("message_show", { type: "error", content: "加载任务详情失败" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.start(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已开始" });
      loadTaskDetail();
    } catch (error: any) {
      frontendEventBus.publish("message_show", { type: "error", content: error.message || "开始任务失败" });
    }
  };

  const handlePauseTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.pause(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已暂停" });
      loadTaskDetail();
    } catch (error: any) {
      frontendEventBus.publish("message_show", { type: "error", content: error.message || "暂停任务失败" });
    }
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.complete(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已完成" });
      loadTaskDetail();
    } catch (error: any) {
      frontendEventBus.publish("message_show", { type: "error", content: error.message || "完成任务失败" });
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm("确定要删除这个任务吗？此操作不可撤销。")) return;
    try {
      await api.scheduler.delete(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已删除" });
      onBack();
    } catch (error: any) {
      frontendEventBus.publish("message_show", { type: "error", content: error.message || "删除任务失败" });
    }
  };

  const handleSaveNotes = useCallback(
    async (notes: string) => {
      if (!task) return;
      try {
        await api.scheduler.updateNotes(task.id, notes);
        setTask({ ...task, notes });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "保存笔记失败";
        frontendEventBus.publish("message_show", { type: "error", content: message });
      }
    },
    [task],
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400";
      case "in_progress":
        return "bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-400";
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "in_progress":
        return <Play className="w-4 h-4" />;
      case "paused":
        return <Pause className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "in_progress":
        return "进行中";
      case "paused":
        return "已暂停";
      case "cancelled":
        return "已取消";
      default:
        return "待处理";
    }
  };

  const getTaskTypeLabel = (type?: string) => {
    switch (type) {
      case "one_time":
        return "一次性任务";
      case "long_term":
        return "长期项目";
      case "periodic":
        return "周期任务";
      case "learning":
        return "学习任务";
      default:
        return "普通任务";
    }
  };

  const getPriorityInfo = (priority: number) => {
    if (priority >= 4)
      return {
        label: "高优先级",
        color: "text-red-500",
        bg: "bg-red-100 dark:bg-red-500/20",
      };
    if (priority >= 2)
      return {
        label: "中优先级",
        color: "text-yellow-500",
        bg: "bg-yellow-100 dark:bg-yellow-500/20",
      };
    return {
      label: "低优先级",
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-500/20",
    };
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "未设置";
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "未设置";
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabs: { id: WorkTab; label: string; icon: React.ReactNode }[] = [
    { id: "notes", label: "笔记", icon: <FileText size={16} /> },
    { id: "subtasks", label: "子任务", icon: <CheckCircle size={16} /> },
    { id: "executions", label: "执行记录", icon: <Clock size={16} /> },
    { id: "progress", label: "进度", icon: <BarChart3 size={16} /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          任务不存在
        </h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          返回
        </button>
      </div>
    );
  }

  const priorityInfo = getPriorityInfo(task.priority);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onBack}
                className="flex-shrink-0 p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all"
                title="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {task.title}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowSaveAsTemplate(true)}
                className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                title="保存为模板"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteTask}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status and meta info */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}
            >
              {getStatusIcon(task.status)}
              {getStatusLabel(task.status)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
              <Tag className="w-3 h-3" />
              {getTaskTypeLabel(task.task_type)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.bg} ${priorityInfo.color}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {priorityInfo.label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
              Q{task.queue_level}
            </span>
          </div>
        </div>
      </div>

      {/* Main content - Left/Right split */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left panel - Task info */}
        <div className="w-[360px] flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                描述
              </h3>
              <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Time info cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Timer className="w-3.5 h-3.5" />
                <span className="text-xs">预计时长</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {formatDuration(task.estimated_duration)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">实际时长</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {formatDuration(task.actual_duration)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="text-xs">总时长</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {formatDuration(task.total_duration)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">截止日期</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {task.deadline ? formatDate(task.deadline) : "未设置"}
              </p>
            </div>
          </div>

          {/* Progress for long-term tasks */}
          {task.task_type === "long_term" &&
            task.progress_percentage !== undefined && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  进度
                </h3>
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-500 h-full transition-all duration-300"
                    style={{ width: `${task.progress_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {task.progress_percentage}% 完成
                </p>
              </div>
            )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                标签
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-0.5 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <TaskLinks taskId={task.id} />

          {/* Knowledge Points */}
          <KnowledgePointAssociation taskId={task.id} />

          {/* Timestamps */}
          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p>创建: {formatDate(task.created_at)}</p>
            <p>更新: {formatDate(task.updated_at)}</p>
            {task.completed_at && (
              <p>完成: {formatDate(task.completed_at)}</p>
            )}
          </div>
        </div>

        {/* Right panel - Work area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab bar */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4">
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            {activeTab === "notes" && (
              <div className="h-full">
                <MarkdownEditor
                  value={task.notes || ""}
                  onChange={(notes) => setTask({ ...task, notes })}
                  onSave={handleSaveNotes}
                  placeholder="在这里记录任务笔记...&#10;&#10;支持 Markdown 语法：&#10;- **粗体** *斜体*&#10;- # 标题&#10;- 列表项&#10;- [链接](url)"
                  className="h-full"
                />
              </div>
            )}

            {activeTab === "subtasks" && <SubtaskList taskId={task.id} />}

            {activeTab === "executions" && (
              <ExecutionRecords taskId={task.id} />
            )}

            {activeTab === "progress" && (
              <ProgressDetail
                taskId={task.id}
                taskType={task.task_type}
                progressPercentage={task.progress_percentage}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer - Action buttons */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {task.status === "in_progress" && (
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 animate-pulse" />
                进行中
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {task.status === "pending" && (
              <button
                onClick={handleStartTask}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md shadow-primary-500/30 hover:shadow-lg"
              >
                <Play className="w-4 h-4" />
                开始任务
              </button>
            )}
            {task.status === "in_progress" && (
              <>
                <button
                  onClick={handlePauseTask}
                  className="flex items-center gap-2 px-5 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  暂停任务
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-md shadow-green-500/30"
                >
                  <CheckCircle className="w-4 h-4" />
                  完成任务
                </button>
              </>
            )}
            {task.status === "paused" && (
              <button
                onClick={handleStartTask}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md shadow-primary-500/30"
              >
                <Play className="w-4 h-4" />
                继续任务
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save as Template Modal */}
      {showSaveAsTemplate && task && (
        <SaveAsTemplateModal
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            estimated_duration: task.estimated_duration,
            tags: task.tags,
            priority: task.priority,
          }}
          onClose={() => setShowSaveAsTemplate(false)}
          onSuccess={() => {
            frontendEventBus.publish("message_show", { type: "success", content: "模板保存成功!" });
          }}
        />
      )}
    </div>
  );
};
