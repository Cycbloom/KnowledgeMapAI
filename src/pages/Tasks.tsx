import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useTasks } from "../hooks/queries";
import { useDebouncedSearch } from "@/hooks/common/useDebouncedSearch";
import {
  useRetryTaskMutation,
  useDeleteTaskMutation,
  usePauseTaskMutation,
  useResumeTaskMutation,
  useCancelTaskMutation,
} from "../hooks/mutations";
import { usePersistedListState } from "../hooks/common/usePersistedListState";
import { useScrollRestoration } from "../hooks/common/useScrollRestoration";
import { useStore } from "../store/useStore";
import { usePullToRefresh } from "../hooks/gesture/usePullToRefresh";
import { ConfirmationModal, Skeleton, FirstRunHint, FilterTabs, SearchInput } from "../components/common";
import { VirtualList } from "../components/common/VirtualList";
import { EmptyState } from "@/components/common/EmptyState";
import { TaskProgressBar } from "@/components/common/TaskProgressBar";
import { mapToRuntimeProgress } from "@/hooks/scheduler/useTaskEvents";
import type { Task, TaskRuntimeProgress } from "@shared/types";
import { asyncConfirm } from "../utils/asyncConfirm";
import { formatDate } from "@/utils/formatters";
import { copyToClipboard } from "@/utils/clipboard";
import { message } from "../utils/messageHelper";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Inbox,
  RefreshCw,
  ArrowRight,
  Trash2,
  RotateCw,
  Download,
  CheckSquare,
  Square,
  X,
  Pause,
  Play,
  Ban,
  ExternalLink,
  FileQuestion,
  Eye,
  GraduationCap,
  GitMerge,
} from "lucide-react";

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    case "failed":
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    case "paused":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    case "running":
    case "in_progress":
      return "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700";
    case "pending":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-500";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "failed":
    case "cancelled":
      return <XCircle className="w-4 h-4" />;
    case "paused":
      return <Pause className="w-4 h-4" />;
    case "running":
    case "in_progress":
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case "pending":
    default:
      return <Clock className="w-4 h-4" />;
  }
};

/**
 * 把 DB runtime_progress（JSONB，字段名沿用 processor 命名：progress/current_node/processed/total）
 * 统一映射为前端 TaskRuntimeProgress（percent/current/completed/total），
 * 并在任务处于运行状态但无任何进度字段时，提供一个最小的 indeterminate 占位，
 * 确保 TaskProgressBar 不会直接 return null（用户看不到任何进度条）。
 */
const resolveTaskRuntimeProgress = (
  task: Pick<Task, "status" | "runtime_progress" | "task_type" | "title">,
): TaskRuntimeProgress | undefined => {
  const mapped = mapToRuntimeProgress(task.runtime_progress);
  const isRunning = task.status === "in_progress" || task.status === "running";
  if (!isRunning) return mapped;
  if (mapped) return mapped;

  const fallbackLabel =
    task.task_type === "generate_questions" ||
    task.task_type === "batch_generate_cards"
      ? "正在初始化题目生成流程…"
      : task.task_type === "ai_generation"
        ? "正在准备 AI 生成…"
        : "准备处理中…";

  return {
    stage: "preparing",
    stageLabel: fallbackLabel,
  };
};

const getTypeLabel = (type: string, t: TFunction) => {
  switch (type) {
    case "ai_generation":
    case "generate_questions":
      return t("tasks.autoGenerateQuestions");
    case "batch_generate_questions":
      return t("tasks.batchGenerateQuestions");
    case "graph_expansion":
    case "expand_graph":
      return t("tasks.autoExpandGraph");
    case "recursive_graph_generation":
      return t("tasks.recursiveGraphGeneration");
    case "infinite_graph_expansion":
      return t("tasks.infiniteExpansion");
    case "knowledge_sync":
    case "embedding_generation":
      return t("tasks.embeddingGeneration");
    case "review_generation":
      return t("tasks.reviewGeneration");
    case "translate_nodes":
      return t("tasks.translateNodes");
    case "discover_node_relations":
      return t("tasks.discoverNodeRelations");
    default:
      return type;
  }
};

/**
 * 统一解析任务显示名：
 * - title 通常是具体 processor 类型字符串（如 translate_nodes / generate_questions），
 *   通过 getTypeLabel 映射为翻译后的标签；
 * - 若 title 是用户自定义名字，getTypeLabel 默认原样返回；
 * - title 为空时回退到粗粒度 task_type。
 */
const resolveTypeLabel = (
  task: { title?: string | null; task_type?: string },
  t: TFunction,
) => {
  if (task.title) return getTypeLabel(task.title, t);
  return getTypeLabel(task.task_type || "", t);
};

export const Tasks = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useStore();
  const [filter, setFilter] = usePersistedListState<string>("tasks-filter", "all");
  const scrollRef = useScrollRestoration<HTMLDivElement>("tasks-list-scroll", {
    deps: [filter],
  });
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const errorDetailsId = useId();
  const limit = 10;
  // 虚拟列表容器高度：基于视口高度估算可用列表区域，resize 时更新。
  const [listContainerHeight, setListContainerHeight] = useState(() =>
    typeof window !== "undefined"
      ? Math.max(300, window.innerHeight - 360)
      : 600,
  );

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTasks(!!token, filter, limit);

  const { indicator } = usePullToRefresh({
    onRefresh: async () => { await refetch(); },
    containerSelector: "[data-pull-refresh]",
  });

  const { data: allData } = useTasks(!!token, "all", 1, 0);
  const { data: pendingData } = useTasks(!!token, "pending", 1, 0);
  const { data: inProgressData } = useTasks(!!token, "in_progress", 1, 0);
  const { data: pausedData } = useTasks(!!token, "paused", 1, 0);
  const { data: completedData } = useTasks(!!token, "completed", 1, 0);
  const { data: cancelledData } = useTasks(!!token, "cancelled", 1, 0);

  const statusCounts = useMemo(() => {
    const getCount = (d: typeof allData): number | undefined => {
      const firstPage = d?.pages?.[0];
      if (firstPage && typeof firstPage.total === "number") {
        return firstPage.total;
      }
      return undefined;
    };
    return {
      all: getCount(allData),
      pending: getCount(pendingData),
      in_progress: getCount(inProgressData),
      paused: getCount(pausedData),
      completed: getCount(completedData),
      cancelled: getCount(cancelledData),
    } as Record<string, number | undefined>;
  }, [allData, pendingData, inProgressData, pausedData, completedData, cancelledData]);

  useEffect(() => {
    if (error) {
      console.error("Failed to load tasks:", error);
    }
  }, [error]);

  // 虚拟列表容器高度随窗口尺寸变化重新计算。
  useEffect(() => {
    const updateListHeight = () =>
      setListContainerHeight(Math.max(300, window.innerHeight - 360));
    window.addEventListener("resize", updateListHeight);
    return () => window.removeEventListener("resize", updateListHeight);
  }, []);

  const retryMutation = useRetryTaskMutation();
  const deleteMutation = useDeleteTaskMutation();
  const pauseMutation = usePauseTaskMutation();
  const resumeMutation = useResumeTaskMutation();
  const cancelMutation = useCancelTaskMutation();
  const tasks = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.tasks);
  }, [data]);

  const filteredTasks = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return tasks;
    const query = debouncedSearchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const title = (resolveTypeLabel(task, t)).toLowerCase();
      return title.includes(query);
    });
  }, [tasks, debouncedSearchQuery, t]);

  const handleFilterChange = (v: string) => {
    setFilter(v);
  };

  const statusTabs = useMemo(
    () => [
      { value: "all", label: t("tasks.allTasks"), count: statusCounts.all },
      {
        value: "in_progress",
        label: t("tasks.inProgress"),
        count: statusCounts.in_progress,
      },
      {
        value: "completed",
        label: t("tasks.completed"),
        count: statusCounts.completed,
      },
      {
        value: "cancelled",
        label: t("tasks.failed"),
        count: statusCounts.cancelled,
      },
      {
        value: "pending",
        label: t("tasks.pending"),
        count: statusCounts.pending,
      },
      {
        value: "paused",
        label: t("tasks.status.paused"),
        count: statusCounts.paused,
      },
    ] as const,
    [t, statusCounts],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRetry = async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      message.success(t("toast.tasks.taskRetried"));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t("toast.tasks.retryFailed");
      message.error(errMsg);
    }
  };

  const handleDeleteClick = (taskId: string) => {
    setDeleteId(taskId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      message.success(t("toast.tasks.taskDeleted"));
      setDeleteId(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t("toast.tasks.deleteFailed");
      message.error(errMsg);
    }
  };

  const handlePause = async (taskId: string) => {
    try {
      await pauseMutation.mutateAsync(taskId);
      message.success(t("toast.tasks.taskPaused"));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t("toast.tasks.pauseFailed");
      message.error(errMsg);
    }
  };

  const handleResume = async (taskId: string) => {
    try {
      await resumeMutation.mutateAsync(taskId);
      message.success(t("toast.tasks.taskResumed"));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t("toast.tasks.resumeFailed");
      message.error(errMsg);
    }
  };

  const handleCancel = async (taskId: string) => {
    const confirmed = await asyncConfirm({
      title: t("tasks.cancelTask"),
      message: t("tasks.cancelTaskConfirm"),
      isDangerous: true,
    });
    if (!confirmed) return;
    try {
      await cancelMutation.mutateAsync(taskId);
      message.success(t("toast.tasks.taskCancelled"));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t("toast.tasks.cancelFailed");
      message.error(errMsg);
    }
  };

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredTasks.map((task) => task.id)));
  }, [filteredTasks]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected =
    selectedIds.size === filteredTasks.length && filteredTasks.length > 0;
  const isPartialSelected =
    selectedIds.size > 0 && selectedIds.size < filteredTasks.length;

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await asyncConfirm({
      title: t("tasks.batchDelete"),
      message: t("tasks.batchDeleteConfirm", { count: selectedIds.size }),
      isDangerous: true,
    });

    if (!confirmed) return;

    setIsBatchDeleting(true);
    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBatchDeleteProgress({ completed: 0, total });
    let successCount = 0;
    let failCount = 0;

    for (const [index, id] of ids.entries()) {
      try {
        await deleteMutation.mutateAsync(id);
        successCount++;
      } catch {
        failCount++;
      }
      setBatchDeleteProgress({ completed: index + 1, total });
    }

    setBatchDeleteProgress(null);
    setIsBatchDeleting(false);
    setSelectedIds(new Set());
    setIsSelectMode(false);

    if (failCount === 0) {
      message.success(t("toast.tasks.batchDeleteSuccess", { count: successCount }));
    } else {
      message.warning(t("tasks.batchDeletePartial", {
        success: successCount,
        fail: failCount,
      }));
    }
  }, [selectedIds, deleteMutation, t]);

  const handleExport = () => {
    if (!tasks || tasks.length === 0) {
      message.warning(t("toast.tasks.noTasksToExport"));
      return;
    }

    // Add BOM for Excel compatibility with UTF-8
    const BOM = "\uFEFF";
    const header = "ID,Title,Type,Status,Created At,Updated At\n";
    const rows = tasks
      .map((task) => {
        const title = resolveTypeLabel(task, t);
        const escapedTitle = title ? title.replace(/"/g, '""') : "";

        return `${task.id},"${escapedTitle}",${task.task_type},${task.status},${task.created_at},${task.updated_at}`;
      })
      .join("\n");

    const csvContent = BOM + header + rows;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(t("toast.tasks.tasksExported"));
  };

  return (
    <div className="relative h-full">
      {indicator}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300"
        data-pull-refresh
      >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {t("tasks.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            {t("tasks.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectMode}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              isSelectMode
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isSelectMode ? t("tasks.exitSelectMode") : t("tasks.selectMode")}</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title={t("tasks.exportAsCSV")}
          >
            <Download className="w-4 h-4" />
            <span>{t("tasks.export")}</span>
          </button>
          <button
            onClick={() => refetch()}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            disabled={isFetching}
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
            <span>
              {isFetching ? t("tasks.refreshing") : t("tasks.refresh")}
            </span>
          </button>
          <Link
            to="/dashboard"
            className="bg-primary-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary-700 transition-colors"
          >
            <span>{t("tasks.returnToDashboard")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 overflow-x-auto">
        <FilterTabs
          items={statusTabs}
          value={filter}
          onChange={handleFilterChange}
        />
        <div className="relative ml-auto flex-shrink-0">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("tasks.searchPlaceholder")}
            className="w-48"
          />
        </div>
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {t("tasks.resultsCount", { count: filteredTasks.length })}
      </span>

      {error ? (
        <div role="alert" className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{t("toast.tasks.loadTasksFailed")}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-primary-600 dark:text-primary-400 underline"
          >
            {t("tasks.retry")}
          </button>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowErrorDetails((prev) => !prev)}
              className="text-xs text-red-500 dark:text-red-400 underline"
              aria-expanded={showErrorDetails}
              aria-controls={errorDetailsId}
            >
              {t("tasks.errorDetails")}
            </button>
            {showErrorDetails && (
              <pre
                id={errorDetailsId}
                className="mt-2 mx-auto max-w-full overflow-x-auto text-left text-xs bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 p-3 rounded border border-red-100 dark:border-red-900/20 whitespace-pre-wrap break-words"
              >
                {(error as Error).message}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div
          aria-busy={isLoading}
          aria-label={t("common.aria.loadingRegion")}
          className="space-y-4"
        >
          {isLoading && !isFetching && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-500 flex items-center gap-3"
                >
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredTasks.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-500">
              {!debouncedSearchQuery.trim() && (
                <FirstRunHint
                  storageKey="tasks-first-run-hint-dismissed"
                  title={t("tasks.firstRun.title")}
                  description={t("tasks.firstRun.description")}
                  dismissLabel={t("tasks.firstRun.dismiss")}
                  className="max-w-sm mx-auto"
                />
              )}
              <EmptyState
                icon={<Inbox className="w-12 h-12 text-gray-300 dark:text-slate-600" />}
                title={debouncedSearchQuery.trim() ? t("tasks.noSearchResults") : t("tasks.noTasks")}
                description={t("tasks.emptyDesc")}
              />
            </div>
          )}

          {!isLoading && filteredTasks.length > 0 && (
            <>
              <VirtualList
                items={filteredTasks}
                estimateSize={() => 220}
                style={{ height: listContainerHeight }}
                onEndReached={handleEndReached}
                endReachedThreshold={660}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-500"
                renderItem={(task) => {
                  const context = (() => {
                    try {
                      const input = task.input_data || {};
                      return typeof input === "string"
                        ? JSON.parse(input)
                        : input;
                    } catch {
                      return {};
                    }
                  })();
                  const graphId = context.graph_id;
                  const nodeId = context.node_id;

                  return (
                    <div className="border-b border-gray-100 dark:border-slate-500">
                    <div
                      className={`p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        selectedIds.has(task.id) ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {isSelectMode && (
                          <button
                            onClick={() => toggleTaskSelection(task.id)}
                            aria-label={t("tasks.selectRow", { title: resolveTypeLabel(task, t) })}
                            aria-pressed={selectedIds.has(task.id)}
                            className="mt-1 flex-shrink-0 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                          >
                            {selectedIds.has(task.id) ? (
                              <CheckSquare className="w-5 h-5" aria-hidden="true" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(task.status)}`}
                            >
                              {getStatusIcon(task.status)}
                              <span>{t(`tasks.status.${task.status}`)}</span>
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {resolveTypeLabel(task, t)}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(task.id, t("tasks.copy.idCopied"))}
                              className="text-xs text-gray-400 dark:text-gray-500 font-mono hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors"
                              title={t("common.copy.idTooltip")}
                              aria-label={t("common.copy.idTooltip")}
                            >
                              #{task.id.slice(0, 8)}
                            </button>
                          </div>

                          {(task.status === "in_progress" ||
                            task.status === "running" ||
                            task.status === "paused") && (
                            <TaskProgressBar
                              progress={resolveTaskRuntimeProgress(task)}
                              className="mb-2"
                            />
                          )}

                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 pl-1">
                            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {t("tasks.created")}{" "}
                                {formatDate(task.created_at, "short-datetime")}
                              </span>
                              {task.updated_at !== task.created_at && (
                                <span>
                                  {t("tasks.updated")}{" "}
                                  {formatDate(task.updated_at, "relative")}
                                </span>
                              )}
                            </div>

                            {task.error_message && (
                              <div role="alert" className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded text-xs break-words border border-red-100 dark:border-red-900/20">
                                {task.error_message}
                              </div>
                            )}

                            {task.notes && (
                              <div className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/10 p-2 rounded text-xs break-words border border-slate-100 dark:border-slate-900/20">
                                {task.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {task.status === "cancelled" && (
                            <button
                              onClick={() => handleRetry(task.id)}
                              disabled={retryMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                              title={t("tasks.retry")}
                              aria-label={t("tasks.retry")}
                            >
                              <RotateCw
                                size={18}
                                className={
                                  retryMutation.isPending
                                    ? "animate-spin"
                                    : ""
                                }
                              />
                            </button>
                          )}

                          {(task.status === "in_progress" ||
                            task.status === "running" ||
                            task.status === "pending") && (
                            <button
                              onClick={() => handlePause(task.id)}
                              disabled={pauseMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                              title={t("tasks.pauseTask")}
                              aria-label={t("tasks.pauseTask")}
                            >
                              <Pause size={18} />
                            </button>
                          )}

                          {task.status === "paused" && (
                            <button
                              onClick={() => handleResume(task.id)}
                              disabled={resumeMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                              title={t("tasks.resumeTask")}
                              aria-label={t("tasks.resumeTask")}
                            >
                              <Play size={18} />
                            </button>
                          )}

                          {(task.status === "in_progress" ||
                            task.status === "running" ||
                            task.status === "pending" ||
                            task.status === "paused") && (
                            <button
                              onClick={() => handleCancel(task.id)}
                              disabled={cancelMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title={t("tasks.cancelTask")}
                              aria-label={t("tasks.cancelTask")}
                            >
                              <Ban size={18} />
                            </button>
                          )}

                          {task.task_type === "generate_questions" &&
                            nodeId && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/study?node_id=${encodeURIComponent(nodeId)}`,
                                  )
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-primary-200 dark:border-primary-800/50 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                title={t("tasks.reviewQuestions")}
                              >
                                <FileQuestion size={14} />
                                <span>{t("tasks.reviewQuestions")}</span>
                              </button>
                            )}

                          {task.status === "completed" &&
                            graphId &&
                            task.task_type === "expand_graph" && (
                              <button
                                onClick={() => {
                                  navigate(`/graph/${graphId}`);
                                  message.info(t("tasks.openedGraph"));
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
                                title={t("tasks.viewResult")}
                              >
                                <Eye size={14} />
                                <span>{t("tasks.viewResult")}</span>
                              </button>
                            )}

                          {task.status === "completed" &&
                            task.task_type === "generate_questions" &&
                            nodeId && (
                              <button
                                onClick={() => {
                                  navigate(
                                    `/study?node_id=${encodeURIComponent(nodeId)}`,
                                  );
                                  message.success(t("tasks.enterLearningMode"));
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
                                title={t("tasks.startLearning")}
                              >
                                <GraduationCap size={14} />
                                <span>{t("tasks.startLearning")}</span>
                              </button>
                            )}

                          {task.status === "completed" &&
                            graphId &&
                            (task.title === "discover_node_relations" ||
                              task.task_type === "discover_node_relations") && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/graph/${graphId}?relationTask=${task.id}`,
                                  )
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
                                title={t("tasks.continueRelationCreation")}
                              >
                                <GitMerge size={14} />
                                <span>{t("tasks.continueRelationCreation")}</span>
                              </button>
                            )}

                          {graphId && (
                            <button
                              onClick={() => navigate(`/graph/${graphId}`)}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                              title={t("tasks.openGraph")}
                              aria-label={t("tasks.openGraph")}
                            >
                              <ExternalLink size={18} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteClick(task.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title={t("tasks.deleteTask")}
                            aria-label={t("tasks.deleteTask")}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                }}
              />

              {/* 加载更多（无限滚动）指示器 */}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("tasks.refreshing")}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isSelectMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-500 px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("tasks.selectedCount", { count: selectedIds.size })}
            </span>
            <button
              onClick={isAllSelected ? clearSelection : selectAll}
              role="checkbox"
              aria-checked={(isAllSelected
                ? "true"
                : isPartialSelected
                  ? "mixed"
                  : "false") as "true" | "false" | "mixed"}
              aria-label={isAllSelected ? t("tasks.deselectAll") : t("tasks.selectAll")}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              {isAllSelected ? t("tasks.deselectAll") : t("tasks.selectAll")}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isBatchDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>
                {batchDeleteProgress !== null
                  ? t("tasks.progress.deleting", {
                      completed: batchDeleteProgress.completed,
                      total: batchDeleteProgress.total,
                    })
                  : t("tasks.batchDelete")}
              </span>
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>{t("tasks.cancelSelection")}</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title={t("tasks.deleteTask")}
        message={t("tasks.deleteTaskConfirm")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        isDangerous={true}
      />
    </div>
    </div>
  );
};
