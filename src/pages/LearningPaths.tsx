import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  XCircle,
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
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useTheme } from "../hooks";
import { formatDurationMinutes, formatDate as formatDateUtil } from "../utils/formatters";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { SkeletonCard } from "@/components/common";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

type PathStatus = LearningPathStatus | "all";

const statusConfig: Record<
  PathStatus,
  { labelKey: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  all: {
    labelKey: "learningPaths.status.all",
    color: "text-gray-600 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-slate-700",
    icon: <Route size={16} />,
  },
  active: {
    labelKey: "learningPaths.status.active",
    color: "text-primary-600 dark:text-primary-400",
    bgColor: "bg-primary-50 dark:bg-primary-900/20",
    icon: <Play size={16} />,
  },
  completed: {
    labelKey: "learningPaths.status.completed",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    icon: <CheckCircle2 size={16} />,
  },
  paused: {
    labelKey: "learningPaths.status.paused",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    icon: <Pause size={16} />,
  },
  archived: {
    labelKey: "learningPaths.status.archived",
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
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: paths, isLoading } = useLearningPaths();
  const createMutation = useCreateLearningPathMutation();
  const updateMutation = useUpdateLearningPathMutation();
  const deleteMutation = useDeleteLearningPathMutation();

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [selectedStatus, setSelectedStatus] = useState<PathStatus>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [newPathTitle, setNewPathTitle] = useState("");
  const [newPathDescription, setNewPathDescription] = useState("");
  const [newPathGoal, setNewPathGoal] = useState("");
  const [newPathDailyMinutes, setNewPathDailyMinutes] = useState(30);
  const [newPathTargetDate, setNewPathTargetDate] = useState("");

  const filteredPaths = (paths as LearningPathItem[] | undefined)?.filter((path) => {
    const matchesSearch =
      path.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      (path.description &&
        path.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
      (path.goal && path.goal.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));
    const matchesStatus =
      selectedStatus === "all" || path.status === selectedStatus;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (paths) {
      for (const path of paths as LearningPathItem[]) {
        counts[path.status] = (counts[path.status] ?? 0) + 1;
      }
    }
    return counts;
  }, [paths]);

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
      frontendEventBus.publish("message_show", { type: "success", content: t("learningPaths.messages.createSuccess") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("learningPaths.messages.createFailed");
      frontendEventBus.publish("message_show", {
        type: "error",
        content: message,
      });
    }
  };

  const handleDeletePath = async (path: LearningPathItem) => {
    if (!await asyncConfirm({ title: t("learningPaths.actions.delete"), message: t("learningPaths.messages.deleteConfirm", { title: path.title }), isDangerous: true })) return;

    try {
      await deleteMutation.mutateAsync(path.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("learningPaths.messages.deleteSuccess") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("learningPaths.messages.deleteFailed");
      frontendEventBus.publish("message_show", { type: "error", content: message });
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
      frontendEventBus.publish("message_show", { type: "success", content: t("learningPaths.messages.statusUpdated") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("learningPaths.messages.statusUpdateFailed");
      frontendEventBus.publish("message_show", { type: "error", content: message });
    }
  };

  const handleViewPath = (pathId: string) => {
    navigate(`/learning-paths/${pathId}`);
  };

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-primary-500";
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
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-500 rounded-xl">
              <Route className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {t("learningPaths.title")}
              </h1>
              <p className="text-sm text-gray-500">{t("learningPaths.subtitle")}</p>
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
            className="px-5 py-2.5 rounded-xl flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg transition-all font-medium"
          >
            <Plus size={20} />
            <span>{t("learningPaths.actions.newPath")}</span>
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
              placeholder={t("learningPaths.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border outline-none transition-all ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  : "bg-white border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="清除"
                title="清除"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {(Object.keys(statusConfig) as PathStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  selectedStatus === status
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {statusConfig[status].icon}
                <span>{t(statusConfig[status].labelKey)}</span>
                {!isLoading && statusCounts[status] !== undefined && (
                  <span className="ml-1 text-xs opacity-70">({statusCounts[status]})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredPaths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Route className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">
              {searchQuery || selectedStatus !== "all"
                ? t("learningPaths.empty.noResults")
                : t("learningPaths.empty.noPaths")}
            </p>
            <p className="text-sm mb-4">
              {searchQuery || selectedStatus !== "all"
                ? t("learningPaths.empty.tryDifferent")
                : t("learningPaths.empty.createFirst")}
            </p>
            {!searchQuery && selectedStatus === "all" && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
              >
                {t("learningPaths.actions.createPath")}
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
                          {t(statusConfig[path.status].labelKey)}
                        </span>
                        {path.ai_generated && (
                          <span className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
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
                    title={t("learningPaths.actions.delete")}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>

                <p
                  className={`text-sm mb-4 line-clamp-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
                >
                  {path.description || path.goal || t("learningPaths.card.noDescription")}
                </p>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">{t("learningPaths.card.progress")}</span>
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
                    <span>{t("learningPaths.card.nodes", { count: path.node_count ?? 0 })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={14} />
                    <span>{formatDurationMinutes(path.total_estimated_time, { emptyText: '0分钟' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <TrendingUp size={14} />
                    <span>{formatDurationMinutes(path.daily_minutes_target, { emptyText: '0分钟' })}</span>
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
                      {t("learningPaths.actions.pause")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(path, "completed");
                      }}
                      className="flex-1 py-2 rounded-xl font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      {t("learningPaths.actions.complete")}
                    </button>
                  </div>
                )}

                {path.status === "paused" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(path, "active");
                    }}
                    className="w-full py-2 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    {t("learningPaths.actions.continue")}
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
              <h3 className="text-xl font-bold">{t("learningPaths.createDialog.title")}</h3>
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
                  {t("learningPaths.createDialog.pathName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPathTitle}
                  onChange={(e) => setNewPathTitle(e.target.value)}
                  placeholder={t("learningPaths.createDialog.pathNamePlaceholder")}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {t("learningPaths.createDialog.description")} ({t("common.optional")})
                </label>
                <textarea
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
                  placeholder={t("learningPaths.createDialog.descriptionPlaceholder")}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {t("learningPaths.createDialog.goal")} ({t("common.optional")})
                </label>
                <input
                  type="text"
                  value={newPathGoal}
                  onChange={(e) => setNewPathGoal(e.target.value)}
                  placeholder={t("learningPaths.createDialog.goalPlaceholder")}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learningPaths.createDialog.dailyStudyTime")}
                  </label>
                  <select
                    value={newPathDailyMinutes}
                    onChange={(e) => setNewPathDailyMinutes(Number(e.target.value))}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    }`}
                  >
                    <option value={15}>{t("learningPaths.time.minutes", { count: 15 })}</option>
                    <option value={30}>{t("learningPaths.time.minutes", { count: 30 })}</option>
                    <option value={45}>{t("learningPaths.time.minutes", { count: 45 })}</option>
                    <option value={60}>{t("learningPaths.time.hours", { count: 1 })}</option>
                    <option value={90}>{t("learningPaths.time.hours", { count: 1.5 })}</option>
                    <option value={120}>{t("learningPaths.time.hours", { count: 2 })}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learningPaths.createDialog.targetDate")}
                  </label>
                  <input
                    type="date"
                    value={newPathTargetDate}
                    onChange={(e) => setNewPathTargetDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={createMutation.isPending || !newPathTitle.trim()}
                >
                  {createMutation.isPending ? t("learningPaths.createDialog.creating") : t("learningPaths.createDialog.createNow")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
