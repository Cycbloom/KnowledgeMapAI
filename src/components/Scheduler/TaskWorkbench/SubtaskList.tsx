import React, { useState, useEffect } from "react";
import {
  Plus,
  CheckCircle,
  Circle,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskSubtask } from "../../../types";
import { useMessageStore } from "../../../store/useMessageStore";

interface SubtaskListProps {
  taskId: string;
  className?: string;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  className = "",
}) => {
  const { addMessage } = useMessageStore();
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newSubtask, setNewSubtask] = useState({
    title: "",
    description: "",
    estimated_duration: undefined as number | undefined,
  });

  useEffect(() => {
    loadSubtasks();
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

  const handleAddSubtask = async () => {
    if (!newSubtask.title.trim()) {
      addMessage({ type: "error", content: "请输入子任务标题" });
      return;
    }

    try {
      const response = await api.scheduler.createSubtask(taskId, {
        title: newSubtask.title,
        description: newSubtask.description || undefined,
        estimated_duration: newSubtask.estimated_duration,
      });
      if (response.success) {
        setSubtasks([...subtasks, response.data]);
        setNewSubtask({
          title: "",
          description: "",
          estimated_duration: undefined,
        });
        setIsAdding(false);
        addMessage({ type: "success", content: "子任务已添加" });
      }
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "添加子任务失败" });
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
      addMessage({ type: "error", content: error.message || "更新状态失败" });
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const response = await api.scheduler.deleteSubtask(taskId, subtaskId);
      if (response.success) {
        setSubtasks(subtasks.filter((st) => st.id !== subtaskId));
        addMessage({ type: "success", content: "子任务已删除" });
      }
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "删除子任务失败" });
    }
  };

  const completedCount = subtasks.filter(
    (st) => st.status === "completed",
  ).length;
  const progress =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
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
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
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
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
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
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus
              />
              <textarea
                value={newSubtask.description}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, description: e.target.value })
                }
                placeholder="描述（可选）"
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                rows={2}
              />
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
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                    });
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
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
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-cyan-500 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      subtask.status === "completed"
                        ? "text-slate-500 dark:text-slate-400 line-through"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {subtask.title}
                  </p>
                  {subtask.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {subtask.description}
                    </p>
                  )}
                  {subtask.estimated_duration && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      {subtask.estimated_duration} 分钟
                    </p>
                  )}
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
                  className="mt-2 text-sm text-cyan-500 hover:text-cyan-600"
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
