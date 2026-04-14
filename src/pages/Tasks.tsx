import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTasks } from "../hooks/queries";
import {
  useRetryTaskMutation,
  useDeleteTaskMutation,
} from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { useMessageStore } from "../store/useMessageStore";
import { ConfirmationModal } from "../components/common";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  ArrowRight,
  Trash2,
  RotateCw,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const getStringOrUnknown = (value: unknown, fallback: string = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
};

const getNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  return undefined;
};

const formatTime = (iso?: string) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "processing":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "failed":
      return <XCircle className="w-4 h-4" />;
    case "processing":
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case "pending":
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: string, t: (key: string) => string) => {
  switch (type) {
    case "generate_questions":
      return t("tasks.autoGenerateQuestions");
    case "batch_generate_questions":
      return t("tasks.batchGenerateQuestions");
    case "expand_graph":
      return t("tasks.autoExpandGraph");
    case "recursive_graph_generation":
      return t("tasks.recursiveGraphGeneration");
    case "infinite_graph_expansion":
      return t("tasks.infiniteExpansion");
    case "embedding_generation":
      return t("tasks.embeddingGeneration");
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
        ? "bg-blue-100 text-blue-700"
        : "text-gray-600 hover:bg-gray-100"
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
  const { addMessage } = useMessageStore();
  const [filter, setFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error, refetch, isFetching } = useTasks(
    !!token,
    filter,
    limit,
    (page - 1) * limit,
  );
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

  const handleFilterChange = (v: string) => {
    setFilter(v);
    setPage(1);
  };

  const handleRetry = async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      addMessage({ type: "success", content: t("tasks.taskRetried") });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || t("tasks.retryFailed") });
    }
  };

  const handleDeleteClick = (taskId: string) => {
    setDeleteId(taskId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      addMessage({ type: "success", content: t("tasks.taskDeleted") });
      setDeleteId(null);
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || t("tasks.deleteFailed") });
    }
  };

  const handleExport = () => {
    if (!tasks || tasks.length === 0) {
      addMessage({ type: "warning", content: t("tasks.noTasksToExport") });
      return;
    }

    // Add BOM for Excel compatibility with UTF-8
    const BOM = "\uFEFF";
    const header = "ID,Name,Type,Status,Created At,Updated At,Error\n";
    const rows = tasks
      .map((task) => {
        const name = task.name || getTypeLabel(task.type, t);
        // Escape quotes by doubling them
        const escapedName = name ? name.replace(/"/g, '""') : "";
        const error = task.error ? task.error.replace(/"/g, '""') : "";

        return `${task.id},"${escapedName}",${task.type},${task.status},${task.created_at},${task.updated_at},"${error}"`;
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

    addMessage({ type: "success", content: t("tasks.tasksExported") });
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
            <span>{isFetching ? t("tasks.refreshing") : t("tasks.refresh")}</span>
          </button>
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
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
        />
        <FilterTab
          label={t("tasks.inProgress")}
          value="processing"
          current={filter}
          onClick={handleFilterChange}
        />
        <FilterTab
          label={t("tasks.completed")}
          value="completed"
          current={filter}
          onClick={handleFilterChange}
        />
        <FilterTab
          label={t("tasks.failed")}
          value="failed"
          current={filter}
          onClick={handleFilterChange}
        />
        <FilterTab
          label={t("tasks.pending")}
          value="pending"
          current={filter}
          onClick={handleFilterChange}
        />
      </div>

      {error ? (
        <div className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{t("tasks.loadTasksFailed", { error: (error as Error).message })}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("tasks.retry")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && !isFetching && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>{t("tasks.loading")}</p>
            </div>
          )}

          {!isLoading && tasks.length === 0 && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
              <p>{t("tasks.noTasks")}</p>
            </div>
          )}

          {!isLoading && tasks.length > 0 && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                {tasks.map((task) => {
                  const graphId = task.payload?.graph_id;
                  const nodeId = task.payload?.node_id;
                  const resultTitles = Array.isArray(task.result?.nodeTitles)
                    ? task.result.nodeTitles
                    : [];
                  const showResult =
                    task.status === "completed" &&
                    (task.type === "expand_graph" ||
                      task.type === "generate_questions" ||
                      task.type === "batch_generate_questions" ||
                      task.type === "embedding_generation" ||
                      task.type === "infinite_graph_expansion");

                  return (
                    <div
                      key={task.id}
                      className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(task.status)}`}
                            >
                              {getStatusIcon(task.status)}
                              <span>{task.status}</span>
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {task.name || getTypeLabel(task.type, t)}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              #{task.id.slice(0, 8)}
                            </span>
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 pl-1">
                            {task.status === "processing" &&
                              task.result?.progress !== undefined && (
                                <div className="mt-2 w-full max-w-md bg-slate-100 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                                    <span className="flex items-center gap-2">
                                      <Loader2
                                        size={12}
                                        className="animate-spin text-blue-500"
                                      />
                                      {t("tasks.processing")}{" "}
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {getStringOrUnknown(
                                          task.result.current_node,
                                          t("tasks.preparing"),
                                        )}
                                      </span>
                                    </span>
                                    <span>
                                      {getNumberOrUndefined(
                                        task.result.progress,
                                      ) ?? 0}
                                      %
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden shadow-inner">
                                    <div
                                      className="bg-blue-500 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                      style={{
                                        width: `${getNumberOrUndefined(task.result.progress) ?? 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {t("tasks.created")}{" "}
                                {formatTime(task.created_at)}
                              </span>
                              {task.updated_at !== task.created_at && (
                                <span>{t("tasks.updated")} {formatTime(task.updated_at)}</span>
                              )}
                            </div>

                            {task.error && (
                              <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded text-xs break-words border border-red-100 dark:border-red-900/20">
                                <strong>{t("tasks.error")}</strong>
                                {task.error}
                              </div>
                            )}

                            {showResult &&
                              task.type === "expand_graph" &&
                              resultTitles.length > 0 && (
                                <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                  <span className="font-medium">
                                    {t("tasks.newNodes")}
                                  </span>
                                  {resultTitles.slice(0, 6).join("、")}
                                  {resultTitles.length > 6
                                    ? t("tasks.etc", { count: resultTitles.length })
                                    : ""}
                                </div>
                              )}

                            {showResult &&
                              task.type === "generate_questions" &&
                              typeof task.result?.count === "number" && (
                                <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                  <span className="font-medium">
                                    {t("tasks.cardsGenerated")}
                                  </span>{" "}
                                  {task.result.count} {t("tasks.cards")}
                                </div>
                              )}

                            {showResult &&
                              task.type === "batch_generate_questions" &&
                              typeof task.result?.totalCards === "number" && (
                                <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                  <span className="font-medium">
                                    {t("tasks.batchGenerateComplete")}
                                  </span>{" "}
                                  {t("tasks.totalCardsGenerated", { count: task.result.totalCards })}
                                </div>
                              )}

                            {showResult &&
                              task.type === "infinite_graph_expansion" &&
                              task.result?.total_graphs_created !== undefined && (
                                <div className="text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10 p-2 rounded text-xs border border-purple-100/50 dark:border-purple-900/20">
                                  <span className="font-medium">
                                    {t("tasks.expansionComplete")}
                                  </span>
                                  {t("tasks.createdGraphsAndNodes", {
                                    graphs: getNumberOrUndefined(task.result.total_graphs_created) ?? 0,
                                    nodes: getNumberOrUndefined(task.result.total_nodes_created) ?? 0
                                  })}
                                </div>
                              )}

                            {showResult &&
                              task.type === "embedding_generation" &&
                              typeof task.result?.processed === "number" && (
                                <div className="text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 p-2 rounded text-xs border border-indigo-100/50 dark:border-indigo-900/20">
                                  <span className="font-medium">
                                    {t("tasks.embeddingComplete")}
                                  </span>
                                  {t("tasks.successCount", { count: getNumberOrUndefined(task.result.processed) ?? 0 })}
                                  {(getNumberOrUndefined(task.result.failed) ?? 0) > 0 &&
                                    t("tasks.failedCount", { count: getNumberOrUndefined(task.result.failed) })}
                                </div>
                              )}

                            {task.status === "processing" &&
                              task.type === "embedding_generation" &&
                              task.result?.progress !== undefined && (
                                <div className="text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-2">
                                  <span className="font-medium">{t("tasks.progress")}</span>
                                  <span>
                                    {getNumberOrUndefined(task.result.processed) ??
                                      0}{" "}
                                    / {getStringOrUnknown(task.result.total, "?")}
                                  </span>
                                </div>
                              )}

                            {task.status === "processing" &&
                              task.type === "infinite_graph_expansion" &&
                              task.result?.current_depth !== undefined && (
                                <div className="text-purple-600 dark:text-purple-400 text-xs flex items-center gap-2">
                                  <span className="font-medium">{t("tasks.depth")}</span>
                                  <span>
                                    {getNumberOrUndefined(
                                      task.result.current_depth,
                                    ) ?? 0}{" "}
                                    /{" "}
                                    {getNumberOrUndefined(task.result.max_depth) ??
                                      2}
                                  </span>
                                  {task.result.total_graphs_created !==
                                    undefined && (
                                    <>
                                      <span className="text-gray-300 dark:text-gray-600">
                                        |
                                      </span>
                                      <span>
                                        {t("tasks.graphsCreated", {
                                          count: getNumberOrUndefined(task.result.total_graphs_created) ?? 0
                                        })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            {task.status === "failed" && (
                              <button
                                onClick={() => handleRetry(task.id)}
                                disabled={retryMutation.isPending}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
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

                          {task.type === "generate_questions" && nodeId && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/study?node_id=${encodeURIComponent(nodeId)}`,
                                )
                              }
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              {t("tasks.reviewQuestions")}
                            </button>
                          )}

                          {task.status === "completed" &&
                            graphId &&
                            task.type === "expand_graph" && (
                              <button
                                onClick={() => {
                                  navigate(`/graph/${graphId}`);
                                  addMessage({
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
                            task.type === "generate_questions" &&
                            nodeId && (
                              <button
                                onClick={() => {
                                  navigate(
                                    `/study?node_id=${encodeURIComponent(nodeId)}`,
                                  );
                                  addMessage({
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

                          {task.status === "completed" &&
                            task.type === "infinite_graph_expansion" &&
                            typeof task.result?.source_graph_id === "string" &&
                            task.result.source_graph_id && (
                              <button
                                onClick={() => {
                                  navigate(
                                    `/graph-map?from=${String(task.result.source_graph_id)}`,
                                  );
                                  addMessage({
                                    type: "success",
                                    content:
                                      "已打开图谱地图，可查看扩展的知识网络",
                                  });
                                }}
                                className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200 dark:shadow-none transition-colors"
                              >
                                {t("tasks.viewKnowledgeNetwork")}
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
                      total: total
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
                                  ? "bg-blue-600 text-white"
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
