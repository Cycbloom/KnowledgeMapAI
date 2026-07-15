import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTasks } from "../hooks/queries";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import {
  useRetryTaskMutation,
  useDeleteTaskMutation,
} from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { ConfirmationModal, Skeleton } from "../components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { asyncConfirm } from "../utils/asyncConfirm";
import { formatDate } from "@/utils/formatters";
import { copyToClipboard } from "@/utils/clipboard";
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
  ChevronLeft,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    case "in_progress":
      return "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700";
    case "pending":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "cancelled":
      return <XCircle className="w-4 h-4" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case "pending":
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: string, t: (key: string) => string) => {
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
    default:
      return type;
  }
};

const FilterTab = ({
  label,
  value,
  current,
  onClick,
  count,
}: {
  label: string;
  value: string;
  current: string;
  onClick: (v: string) => void;
  count?: number;
}) => (
  <button
    onClick={() => onClick(value)}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
      current === value
        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
        : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
    }`}
  >
    {label}
    {count !== undefined && (
      <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    )}
  </button>
);

export const Tasks = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const limit = 10;

  const { data, isLoading, error, refetch, isFetching } = useTasks(
    !!token,
    filter,
    limit,
    (page - 1) * limit,
  );

  const { data: allData } = useTasks(!!token, "all", 1, 0);
  const { data: pendingData } = useTasks(!!token, "pending", 1, 0);
  const { data: inProgressData } = useTasks(!!token, "in_progress", 1, 0);
  const { data: completedData } = useTasks(!!token, "completed", 1, 0);
  const { data: cancelledData } = useTasks(!!token, "cancelled", 1, 0);

  const statusCounts = useMemo(() => {
    const getCount = (d: typeof allData): number | undefined => {
      if (d && typeof d === "object" && "total" in d) {
        return typeof d.total === "number" ? d.total : 0;
      }
      return undefined;
    };
    return {
      all: getCount(allData),
      pending: getCount(pendingData),
      in_progress: getCount(inProgressData),
      completed: getCount(completedData),
      cancelled: getCount(cancelledData),
    } as Record<string, number | undefined>;
  }, [allData, pendingData, inProgressData, completedData, cancelledData]);

  useEffect(() => {
    if (error) {
      console.error("Failed to load tasks:", error);
    }
  }, [error]);

  const retryMutation = useRetryTaskMutation();
  const deleteMutation = useDeleteTaskMutation();
  const { tasks, total } = useMemo(() => {
    if (data && typeof data === "object" && "tasks" in data) {
      return {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        total: typeof data.total === "number" ? data.total : 0,
      };
    }
    return { tasks: [], total: 0 };
  }, [data]);

  const totalPages = Math.ceil(total / limit);

  const filteredTasks = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return tasks;
    const query = debouncedSearchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const title = (task.title || getTypeLabel(task.task_type, t)).toLowerCase();
      return title.includes(query);
    });
  }, [tasks, debouncedSearchQuery, t]);

  const handleFilterChange = (v: string) => {
    setFilter(v);
    setPage(1);
  };

  const handleRetry = async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("tasks.taskRetried"),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("tasks.retryFailed");
      frontendEventBus.publish("message_show", {
        type: "error",
        content: message,
      });
    }
  };

  const handleDeleteClick = (taskId: string) => {
    setDeleteId(taskId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("tasks.taskDeleted"),
      });
      setDeleteId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("tasks.deleteFailed");
      frontendEventBus.publish("message_show", {
        type: "error",
        content: message,
      });
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

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await asyncConfirm({
      title: t("tasks.batchDelete"),
      message: t("tasks.batchDeleteConfirm", { count: selectedIds.size }),
      isDangerous: true,
    });

    if (!confirmed) return;

    setIsBatchDeleting(true);
    let successCount = 0;
    let failCount = 0;

    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map(async (id) => {
        try {
          await deleteMutation.mutateAsync(id);
          successCount++;
        } catch {
          failCount++;
        }
      }),
    );

    setIsBatchDeleting(false);
    setSelectedIds(new Set());
    setIsSelectMode(false);

    if (failCount === 0) {
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("tasks.batchDeleteSuccess", { count: successCount }),
      });
    } else {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("tasks.batchDeletePartial", {
          success: successCount,
          fail: failCount,
        }),
      });
    }
  }, [selectedIds, deleteMutation, t]);

  const handleExport = () => {
    if (!tasks || tasks.length === 0) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("tasks.noTasksToExport"),
      });
      return;
    }

    // Add BOM for Excel compatibility with UTF-8
    const BOM = "\uFEFF";
    const header = "ID,Title,Type,Status,Created At,Updated At\n";
    const rows = tasks
      .map((task) => {
        const title = task.title || getTypeLabel(task.task_type, t);
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

    frontendEventBus.publish("message_show", {
      type: "success",
      content: t("tasks.tasksExported"),
    });
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
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
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isSelectMode ? t("tasks.exitSelectMode") : t("tasks.selectMode")}</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title="Export as CSV"
          >
            <Download className="w-4 h-4" />
            <span>{t("tasks.export")}</span>
          </button>
          <button
            onClick={() => refetch()}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
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

      <div className="flex items-center gap-2 mb-6 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-x-auto">
        <FilterTab
          label={t("tasks.allTasks")}
          value="all"
          current={filter}
          onClick={handleFilterChange}
          count={statusCounts.all}
        />
        <FilterTab
          label={t("tasks.inProgress")}
          value="in_progress"
          current={filter}
          onClick={handleFilterChange}
          count={statusCounts.in_progress}
        />
        <FilterTab
          label={t("tasks.completed")}
          value="completed"
          current={filter}
          onClick={handleFilterChange}
          count={statusCounts.completed}
        />
        <FilterTab
          label={t("tasks.failed")}
          value="cancelled"
          current={filter}
          onClick={handleFilterChange}
          count={statusCounts.cancelled}
        />
        <FilterTab
          label={t("tasks.pending")}
          value="pending"
          current={filter}
          onClick={handleFilterChange}
          count={statusCounts.pending}
        />
        <div className="relative ml-auto flex-shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
            size={16}
          />
          <input
            type="text"
            placeholder={t("tasks.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-10 py-2 rounded-lg text-sm border focus:ring-2 focus:ring-primary-500 outline-none transition-all w-48 bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
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
      </div>

      {error ? (
        <div className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{t("tasks.loadTasksFailed")}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t("tasks.retry")}
          </button>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowErrorDetails((prev) => !prev)}
              className="text-xs text-red-500 dark:text-red-400 hover:underline"
            >
              {t("tasks.errorDetails")}
            </button>
            {showErrorDetails && (
              <pre className="mt-2 mx-auto max-w-full overflow-x-auto text-left text-xs bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 p-3 rounded border border-red-100 dark:border-red-900/20 whitespace-pre-wrap break-words">
                {(error as Error).message}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && !isFetching && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700 flex items-center gap-3"
                >
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredTasks.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
              <EmptyState
                icon={<Inbox className="w-12 h-12 text-gray-300 dark:text-slate-600" />}
                title={debouncedSearchQuery.trim() ? t("tasks.noSearchResults") : t("tasks.noTasks")}
                description={t("tasks.emptyDesc")}
              />
            </div>
          )}

          {!isLoading && filteredTasks.length > 0 && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                {filteredTasks.map((task) => {
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
                    <div
                      key={task.id}
                      className={`p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        selectedIds.has(task.id) ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {isSelectMode && (
                          <button
                            onClick={() => toggleTaskSelection(task.id)}
                            className="mt-1 flex-shrink-0 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                          >
                            {selectedIds.has(task.id) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400 dark:text-slate-500" />
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
                              {task.title || getTypeLabel(task.task_type, t)}
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
                              <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded text-xs break-words border border-red-100 dark:border-red-900/20">
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

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            {task.status === "cancelled" && (
                              <button
                                onClick={() => handleRetry(task.id)}
                                disabled={retryMutation.isPending}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                                title={t("tasks.retry")}
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

                            <button
                              onClick={() => handleDeleteClick(task.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title={t("tasks.deleteTask")}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          {graphId && (
                            <button
                              onClick={() => navigate(`/graph/${graphId}`)}
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              {t("tasks.openGraph")}
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
                                className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-primary-200 dark:border-primary-800/50 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              >
                                {t("tasks.reviewQuestions")}
                              </button>
                            )}

                          {task.status === "completed" &&
                            graphId &&
                            task.task_type === "expand_graph" && (
                              <button
                                onClick={() => {
                                  navigate(`/graph/${graphId}`);
                                  frontendEventBus.publish("message_show", {
                                    type: "info",
                                    content:
                                      "已打开图谱：如未自动刷新，请稍等或手动刷新页面",
                                  });
                                }}
                                className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
                              >
                                {t("tasks.viewResult")}
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
                                  frontendEventBus.publish("message_show", {
                                    type: "success",
                                    content:
                                      "进入学习模式：可开始复习生成的题目",
                                  });
                                }}
                                className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
                              >
                                {t("tasks.startLearning")}
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t("tasks.showing", {
                      start: (page - 1) * limit + 1,
                      end: Math.min(page * limit, total),
                      total: total,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronLeft
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - page) <= 1,
                        )
                        .map((p, i, arr) => (
                          <React.Fragment key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && (
                              <span className="text-gray-400">...</span>
                            )}
                            <button
                              onClick={() => setPage(p)}
                              className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                                page === p
                                  ? "bg-primary-600 text-white"
                                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="p-2 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronRight
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isSelectMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("tasks.selectedCount", { count: selectedIds.size })}
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              {t("tasks.selectAll")}
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
              <span>{t("tasks.batchDelete")}</span>
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
  );
};
