import React, { useState, useEffect } from "react";
import {
  Plus,
  CheckCircle,
  Circle,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskSubtask } from "../../../types";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { LearningStateBadge } from "../LearningStateBadge";
import { MasteryProgressBar } from "../MasteryProgressBar";

interface SubtaskListProps {
  taskId: string;
  knowledgePointId?: string;
  className?: string;
}

interface KnowledgePoint {
  id: string;
  title: string;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  knowledgePointId: defaultKnowledgePointId,
  className = "",
}) => {
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newSubtask, setNewSubtask] = useState({
    title: "",
    description: "",
    estimated_duration: undefined as number | undefined,
    knowledge_point_id: defaultKnowledgePointId || "",
  });

  useEffect(() => {
    loadSubtasks();
    loadKnowledgePoints();
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      const response = await api.scheduler.getSubtasks(taskId);
      if (response.success) {
        setSubtasks(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const data = await api.knowledgePoints.list();
      if (data) {
        setKnowledgePoints(
          data.map((kp: { id: string; title?: string }) => ({
            id: kp.id,
            title: kp.title || "未命名知识点",
          })),
        );
      }
    } catch (error) {
      console.error("Failed to load knowledge points:", error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.title.trim()) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "请输入子任务标题",
      });
      return;
    }

    if (!newSubtask.knowledge_point_id) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "请选择关联的知识点",
      });
      return;
    }

    try {
      const response = await api.scheduler.createSubtask(taskId, {
        title: newSubtask.title,
        description: newSubtask.description || undefined,
        estimated_duration: newSubtask.estimated_duration,
        knowledge_point_id: newSubtask.knowledge_point_id,
      });
      if (response.success) {
        setSubtasks([...subtasks, response.data]);
        setNewSubtask({
          title: "",
          description: "",
          estimated_duration: undefined,
          knowledge_point_id: defaultKnowledgePointId || "",
        });
        setIsAdding(false);
        frontendEventBus.publish("message_show", {
          type: "success",
          content: "子任务已添加",
        });
      }
    } catch (error: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: error.message || "添加子任务失败",
      });
    }
  };

  const handleToggleStatus = async (subtask: TaskSubtask) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";
    try {
      const response = await api.scheduler.updateSubtask(taskId, subtask.id, {
        status: newStatus,
      });
      if (response.success) {
        setSubtasks(
          subtasks.map((st) => (st.id === subtask.id ? response.data : st)),
        );
      }
    } catch (error: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: error.message || "更新状态失败",
      });
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const response = await api.scheduler.deleteSubtask(taskId, subtaskId);
      if (response.success) {
        setSubtasks(subtasks.filter((st) => st.id !== subtaskId));
        frontendEventBus.publish("message_show", {
          type: "success",
          content: "子任务已删除",
        });
      }
    } catch (error: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: error.message || "删除子任务失败",
      });
    }
  };

  const completedCount = subtasks.filter(
    (st) => st.status === "completed",
  ).length;
  const progress =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  const avgMastery =
    subtasks.length > 0
      ? subtasks.reduce((sum, st) => sum + (st.mastery_level || 0), 0) /
        subtasks.length
      : 0;

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="flex items-center justify-between cursor-pointer mb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            子任务
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {completedCount}/{subtasks.length} 完成
          </span>
          {subtasks.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              · 平均掌握度 {avgMastery.toFixed(0)}%
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          添加
        </button>
      </div>

      {isExpanded && (
        <>
          {subtasks.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {progress}%
                </span>
              </div>
            </div>
          )}

          {isAdding && (
            <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                value={newSubtask.title}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, title: e.target.value })
                }
                placeholder="子任务标题"
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <textarea
                value={newSubtask.description}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, description: e.target.value })
                }
                placeholder="描述（可选）"
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-slate-400" />
                <select
                  value={newSubtask.knowledge_point_id}
                  onChange={(e) =>
                    setNewSubtask({
                      ...newSubtask,
                      knowledge_point_id: e.target.value,
                    })
                  }
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">选择知识点</option>
                  {knowledgePoints.map((kp) => (
                    <option key={kp.id} value={kp.id}>
                      {kp.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <input
                  type="number"
                  value={newSubtask.estimated_duration || ""}
                  onChange={(e) =>
                    setNewSubtask({
                      ...newSubtask,
                      estimated_duration: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="预计时长（分钟）"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewSubtask({
                      title: "",
                      description: "",
                      estimated_duration: undefined,
                      knowledge_point_id: defaultKnowledgePointId || "",
                    });
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all"
                >
                  添加
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  subtask.status === "completed"
                    ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <button
                  onClick={() => handleToggleStatus(subtask)}
                  className="flex-shrink-0"
                >
                  {subtask.status === "completed" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-primary-500 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`font-medium ${
                        subtask.status === "completed"
                          ? "text-slate-500 dark:text-slate-400 line-through"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {subtask.title}
                    </p>
                    {subtask.learning_state && (
                      <LearningStateBadge
                        state={subtask.learning_state}
                        size="sm"
                      />
                    )}
                  </div>
                  {subtask.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {subtask.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {subtask.mastery_level !== undefined && (
                      <MasteryProgressBar
                        masteryLevel={subtask.mastery_level}
                        size="sm"
                        showLabel
                      />
                    )}
                    {subtask.estimated_duration && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {subtask.estimated_duration} 分钟
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {subtasks.length === 0 && !isAdding && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <p>暂无子任务</p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-2 text-sm text-primary-500 hover:text-primary-600"
                >
                  添加第一个子任务
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
