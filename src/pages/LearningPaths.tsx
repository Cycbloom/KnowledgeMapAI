import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLearningPaths } from "../hooks/queries/useLearningPathQueries";
import {
  useCreateLearningPathMutation,
  useDeleteLearningPathMutation,
  useUpdateLearningPathMutation,
} from "../hooks/mutations/useLearningPathMutations";
import { LearningPathStatus } from "../services/api/learningPaths";
import {
  Plus,
  Trash2,
  Search,
  X,
  Route,
  Clock,
  Target,
  Calendar,
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  Archive,
  TrendingUp,
} from "lucide-react";
import { useMessageStore } from "../store/useMessageStore";
import { useTheme } from "../hooks";

type PathStatus = LearningPathStatus | "all";

const statusConfig: Record<
  PathStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  all: {
    label: "全部",
    color: "text-gray-600 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-slate-700",
    icon: <Route size={16} />,
  },
  active: {
    label: "进行中",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    icon: <Play size={16} />,
  },
  completed: {
    label: "已完成",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    icon: <CheckCircle2 size={16} />,
  },
  paused: {
    label: "已暂停",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    icon: <Pause size={16} />,
  },
  archived: {
    label: "已归档",
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-slate-700",
    icon: <Archive size={16} />,
  },
};

interface LearningPathItem {
  id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  total_estimated_time: number;
  ai_generated: boolean;
  status: LearningPathStatus;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  node_count?: number;
  completed_node_count?: number;
  progress_percentage?: number;
}

export const LearningPaths = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: paths = [], isLoading } = useLearningPaths();
  const createMutation = useCreateLearningPathMutation();
  const updateMutation = useUpdateLearningPathMutation();
  const deleteMutation = useDeleteLearningPathMutation();
  const { addMessage } = useMessageStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PathStatus>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [newPathTitle, setNewPathTitle] = useState("");
  const [newPathDescription, setNewPathDescription] = useState("");
  const [newPathGoal, setNewPathGoal] = useState("");
  const [newPathDailyMinutes, setNewPathDailyMinutes] = useState(30);
  const [newPathTargetDate, setNewPathTargetDate] = useState("");

  const filteredPaths = (paths as LearningPathItem[]).filter((path) => {
    const matchesSearch =
      path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (path.description &&
        path.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (path.goal && path.goal.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      selectedStatus === "all" || path.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathTitle.trim()) return;

    try {
      await createMutation.mutateAsync({
        title: newPathTitle,
        description: newPathDescription || undefined,
        goal: newPathGoal || undefined,
        daily_minutes_target: newPathDailyMinutes,
        target_date: newPathTargetDate || undefined,
      });
      setNewPathTitle("");
      setNewPathDescription("");
      setNewPathGoal("");
      setNewPathDailyMinutes(30);
      setNewPathTargetDate("");
      setIsCreating(false);
      addMessage({ type: "success", content: "学习路径创建成功!" });
    } catch (err: any) {
      addMessage({
        type: "error",
        content: err.message || "创建学习路径失败",
      });
    }
  };

  const handleDeletePath = async (path: LearningPathItem) => {
    if (!confirm(`确定要删除学习路径 "${path.title}" 吗？`)) return;

    try {
      await deleteMutation.mutateAsync(path.id);
      addMessage({ type: "success", content: "学习路径已删除" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "删除学习路径失败" });
    }
  };

  const handleStatusChange = async (
    path: LearningPathItem,
    newStatus: LearningPathStatus
  ) => {
    try {
      await updateMutation.mutateAsync({
        id: path.id,
        data: { status: newStatus },
      });
      addMessage({ type: "success", content: "状态已更新" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "更新状态失败" });
    }
  };

  const handleViewPath = (pathId: string) => {
    navigate(`/learning-paths/${pathId}`);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-blue-500";
    if (percentage >= 25) return "bg-yellow-500";
    return "bg-gray-300";
  };

  return (
    <div
      className={`h-full overflow-y-auto ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
              <Route className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                学习路径
              </h1>
              <p className="text-sm text-gray-500">管理你的学习计划</p>
            </div>
          </div>
          <button
            onClick={() => {
              setNewPathTitle("");
              setNewPathDescription("");
              setNewPathGoal("");
              setNewPathDailyMinutes(30);
              setNewPathTargetDate("");
              setIsCreating(true);
            }}
            className="px-5 py-2.5 rounded-xl flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-medium"
          >
            <Plus size={20} />
            <span>新建路径</span>
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="搜索学习路径..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  : "bg-white border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              }`}
            />
          </div>

          <div className="flex gap-2">
            {(Object.keys(statusConfig) as PathStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  selectedStatus === status
                    ? "bg-blue-600 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {statusConfig[status].icon}
                <span>{statusConfig[status].label}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPaths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Route className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">
              {searchQuery || selectedStatus !== "all"
                ? "未找到匹配的学习路径"
                : "还没有学习路径"}
            </p>
            <p className="text-sm mb-4">
              {searchQuery || selectedStatus !== "all"
                ? "尝试更换搜索条件"
                : "点击上方按钮创建你的第一个学习路径"}
            </p>
            {!searchQuery && selectedStatus === "all" && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                创建学习路径
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPaths.map((path) => (
              <div
                key={path.id}
                className={`rounded-2xl border-2 p-5 transition-all hover:shadow-lg cursor-pointer ${
                  isDark
                    ? "bg-slate-800 border-slate-700 hover:border-slate-600"
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handleViewPath(path.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl ${statusConfig[path.status].bgColor}`}
                    >
                      <div className={statusConfig[path.status].color}>
                        {statusConfig[path.status].icon}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={`font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        {path.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[path.status].bgColor} ${statusConfig[path.status].color}`}
                        >
                          {statusConfig[path.status].label}
                        </span>
                        {path.ai_generated && (
                          <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                            <Sparkles size={12} />
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePath(path);
                    }}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>

                <p
                  className={`text-sm mb-4 line-clamp-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
                >
                  {path.description || path.goal || "暂无描述"}
                </p>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">学习进度</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {path.progress_percentage ?? 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getProgressColor(path.progress_percentage ?? 0)}`}
                      style={{ width: `${path.progress_percentage ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Target size={14} />
                    <span>{path.node_count ?? 0} 个节点</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>{formatTime(path.total_estimated_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <TrendingUp size={14} />
                    <span>每日 {path.daily_minutes_target} 分钟</span>
                  </div>
                  {path.target_date && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={14} />
                      <span>{formatDate(path.target_date)}</span>
                    </div>
                  )}
                </div>

                {path.status === "active" && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(path, "paused");
                      }}
                      className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      暂停
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(path, "completed");
                      }}
                      className="flex-1 py-2 rounded-xl font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      完成
                    </button>
                  </div>
                )}

                {path.status === "paused" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(path, "active");
                    }}
                    className="w-full py-2 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    继续学习
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 ${
              isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">创建学习路径</h3>
              <button
                onClick={() => setIsCreating(false)}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${
                  isDark
                    ? "hover:bg-white text-slate-400"
                    : "hover:bg-black text-gray-400"
                }`}
              >
                <X size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreatePath} className="space-y-5">
              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  路径名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPathTitle}
                  onChange={(e) => setNewPathTitle(e.target.value)}
                  placeholder="例如：React 进阶学习"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  描述（可选）
                </label>
                <textarea
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
                  placeholder="简要描述该学习路径..."
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  学习目标（可选）
                </label>
                <input
                  type="text"
                  value={newPathGoal}
                  onChange={(e) => setNewPathGoal(e.target.value)}
                  placeholder="例如：掌握 React Hooks 和状态管理"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    每日学习时间
                  </label>
                  <select
                    value={newPathDailyMinutes}
                    onChange={(e) => setNewPathDailyMinutes(Number(e.target.value))}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    }`}
                  >
                    <option value={15}>15 分钟</option>
                    <option value={30}>30 分钟</option>
                    <option value={45}>45 分钟</option>
                    <option value={60}>1 小时</option>
                    <option value={90}>1.5 小时</option>
                    <option value={120}>2 小时</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    目标完成日期
                  </label>
                  <input
                    type="date"
                    value={newPathTargetDate}
                    onChange={(e) => setNewPathTargetDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={createMutation.isPending || !newPathTitle.trim()}
                >
                  {createMutation.isPending ? "创建中..." : "立即创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
