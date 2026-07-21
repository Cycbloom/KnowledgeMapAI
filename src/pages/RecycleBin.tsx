import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTrashGraphs, useTrashNotes } from "../hooks/queries";
import {
  useRestoreGraphMutation,
  usePermanentDeleteGraphMutation,
  useBatchRestoreGraphsMutation,
  useBatchPermanentDeleteGraphsMutation,
  useRestoreNoteMutation,
} from "../hooks/mutations";
import {
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  Square,
  X,
  Info,
  Loader2,
  NotebookPen,
  CalendarDays,
} from "lucide-react";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { ConfirmationModal, SkeletonCard, EmptyState, ErrorState } from "../components/common";
import { useTheme } from "../hooks";
import { useNavigate } from "react-router-dom";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";
import { formatDate } from "../utils/formatters";
import { message } from "@/utils/messageHelper";
import { themeClasses } from "@/utils/themeClasses";
import type { Note, NoteType } from "@shared/types/note";

/** 回收站资源分类：graphs 图谱 / notes 笔记 */
type RecycleBinCategory = "graphs" | "notes";

/** 笔记类型徽章样式：daily 用紫色，note 用蓝色（与 NotesListPage 一致）。 */
const getNoteTypeBadgeClass = (type: NoteType): string => {
  if (type === "daily") {
    return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700";
  }
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
};

export const RecycleBin = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: trashData, isLoading, isFetching, error, refetch } = useTrashGraphs();
  const restoreGraphMutation = useRestoreGraphMutation();
  const permanentDeleteGraphMutation = usePermanentDeleteGraphMutation();
  const batchRestoreMutation = useBatchRestoreGraphsMutation();
  const batchPermanentDeleteMutation = useBatchPermanentDeleteGraphsMutation();

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // 资源分类：默认展示图谱回收站
  const [category, setCategory] = useState<RecycleBinCategory>("graphs");

  // 笔记回收站查询（仅在切换到 notes 分类时启用，避免无谓请求）
  const {
    data: trashNotesData,
    isLoading: trashNotesLoading,
    isFetching: trashNotesFetching,
    error: trashNotesError,
    refetch: refetchNotes,
  } = useTrashNotes({
    enabled: category === "notes",
  });
  const restoreNoteMutation = useRestoreNoteMutation();

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
    isBatch: boolean;
  }>({
    isOpen: false,
    id: "",
    title: "",
    isBatch: false,
  });

  const graphs = useMemo(
    () => (Array.isArray(trashData) ? trashData : []),
    [trashData],
  );

  const filteredGraphs = useMemo(
    () =>
      graphs.filter(
        (g) =>
          g.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          (g.description &&
            g.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase())),
      ),
    [graphs, debouncedSearchQuery],
  );

  // 笔记回收站列表（trashNotesData 已在 queryFn 内过滤 deletedAt != null）
  const trashNotes = useMemo<Note[]>(
    () => (Array.isArray(trashNotesData) ? trashNotesData : []),
    [trashNotesData],
  );

  const filteredNotes = useMemo(
    () =>
      trashNotes.filter((n) =>
        n.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
      ),
    [trashNotes, debouncedSearchQuery],
  );

  const isAllSelected =
    filteredGraphs.length > 0 &&
    filteredGraphs.every((g) => selectedIds.has(g.id));
  const isPartialSelected =
    filteredGraphs.some((g) => selectedIds.has(g.id)) && !isAllSelected;
  const selectedCount = selectedIds.size;

  // 笔记批量选择状态
  const isAllNotesSelected =
    filteredNotes.length > 0 && selectedNoteIds.size === filteredNotes.length;
  const isPartialNotesSelected =
    selectedNoteIds.size > 0 && selectedNoteIds.size < filteredNotes.length;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGraphs.map((g) => g.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // 笔记批量选择操作
  const toggleNoteSelect = (id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllNotes = () => {
    if (isAllNotesSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(filteredNotes.map((n) => n.id)));
    }
  };

  const clearNoteSelection = () => {
    setSelectedNoteIds(new Set());
  };

  // 切换分类时清空图谱与笔记的选择状态，避免跨分类残留
  const handleCategoryChange = (next: RecycleBinCategory) => {
    if (next === category) return;
    setCategory(next);
    setSelectedIds(new Set());
    setSelectedNoteIds(new Set());
  };

  // 笔记恢复：调用 restore 后提示"挂载关系不自动恢复，需重新编辑笔记保存以重建"
  // useRestoreNoteMutation 已失效 ["notes"] 前缀，会自动刷新回收站笔记列表与笔记查询
  const handleRestoreNote = async (note: Note) => {
    try {
      await restoreNoteMutation.mutateAsync(note.id);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("recycleBin.notes.restoreSuccess"),
        duration: 6000,
      });
    } catch (err: unknown) {
      console.error(err);
      message.error(t("recycleBin.restoreFailed"));
      const errorMessage = err instanceof Error ? err.message : t("recycleBin.notes.restoreFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreGraphMutation.mutateAsync(id);
      frontendEventBus.publish("message_show", { type: "success", content: t("recycleBin.messages.restoreSuccess") });
    } catch (err: unknown) {
      console.error(err);
      message.error(t("recycleBin.restoreFailed"));
      const errorMessage = err instanceof Error ? err.message : t("recycleBin.messages.restoreFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;

    try {
      const ids = Array.from(selectedIds);
      await batchRestoreMutation.mutateAsync(ids);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("recycleBin.messages.batchRestoreSuccess", { count: ids.length }),
        action: {
          label: t("recycleBin.messages.view"),
          onClick: () => navigate("/dashboard"),
        },
        duration: 5000,
      });
      setSelectedIds(new Set());
    } catch (err: unknown) {
      console.error(err);
      message.error(t("recycleBin.restoreFailed"));
      const errorMessage = err instanceof Error ? err.message : t("recycleBin.messages.batchRestoreFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  // 笔记批量恢复：useRestoreNoteMutation 已失效 ["notes"] 前缀，
  // 每次 restore 成功后会自动刷新回收站笔记列表，无需手动 invalidate。
  const handleBatchRestoreNotes = async () => {
    if (selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    const results = await Promise.allSettled(
      ids.map((id) => restoreNoteMutation.mutateAsync(id)),
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length === 0) {
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("recycleBin.notes.batch.restored", { count: ids.length }),
      });
    } else {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("recycleBin.notes.batch.partialFailed"),
      });
    }
    setSelectedNoteIds(new Set());
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title, isBatch: false });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({
      isOpen: true,
      id: "",
      title: `${selectedIds.size} ${t("recycleBin.confirmDelete.title").toLowerCase()}`,
      isBatch: true,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.isBatch) {
      const ids = Array.from(selectedIds);
      batchPermanentDeleteMutation.mutate(ids, {
        onSuccess: () => {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("recycleBin.messages.batchDeleteSuccess", { count: ids.length }),
          });
          setSelectedIds(new Set());
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onError: (err: unknown) => {
          console.error(err);
          const message = err instanceof Error ? err.message : t("recycleBin.messages.batchDeleteFailed");
          frontendEventBus.publish("message_show", { type: "error", content: message });
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      if (!deleteConfirm.id) return;

      permanentDeleteGraphMutation.mutate(deleteConfirm.id, {
        onSuccess: () => {
          frontendEventBus.publish("message_show", { type: "success", content: t("recycleBin.messages.deleteSuccess") });
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onError: (err: unknown) => {
          console.error(err);
          const message = err instanceof Error ? err.message : t("recycleBin.messages.deleteFailed");
          frontendEventBus.publish("message_show", { type: "error", content: message });
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
      });
    }
  };

  if (
    (category === "graphs" && isLoading && !isFetching) ||
    (category === "notes" && trashNotesLoading && !trashNotesFetching)
  )
    return (
      <div
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
      >
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  if ((category === "graphs" && error) || (category === "notes" && trashNotesError)) {
    const activeError = category === "graphs" ? error : trashNotesError;
    const handleRetry = category === "graphs" ? refetch : refetchNotes;
    return (
      <ErrorState
        message={(activeError as Error)?.message || t("recycleBin.loadFailed")}
        onRetry={() => handleRetry()}
      />
    );
  }

  return (
    <div
      className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className={`p-1 rounded-full hover:bg-opacity-10 transition-colors ${isDark ? "hover:bg-white" : "hover:bg-black"}`}
              >
                <ArrowLeft
                  size={24}
                  className={isDark ? "text-slate-400" : "text-gray-600"}
                />
              </button>
              <h1 className="text-3xl font-extrabold tracking-tight text-red-500">
                {t("recycleBin.title")}
              </h1>
            </div>
            <p
              className={`${themeClasses.textSecondary(isDark)} text-lg max-w-xl`}
            >
              {t("recycleBin.subtitle")}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
              <Info size={14} />
              {t("recycleBin.autoCleanupHint")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.textMuted(isDark)}`}
                size={18}
              />
              <input
                type="text"
                aria-label={t("common.aria.search")}
                placeholder={t("recycleBin.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all w-full md:w-64 ${
                  isDark
                    ? "bg-slate-800 border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white"
                    : "bg-white border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm"
                }`}
              />
            </div>
          </div>
        </div>

        {/* 分类切换：图谱 / 笔记 */}
        <div
          className={`flex items-center gap-2 p-1.5 rounded-xl overflow-x-auto ${
            isDark ? "bg-slate-800" : "bg-white border border-gray-200"
          }`}
        >
          {(["graphs", "notes"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                category === cat
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                  : isDark
                    ? "text-slate-400 hover:bg-slate-700"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat === "graphs" ? (
                <Trash2 size={14} aria-hidden="true" />
              ) : (
                <NotebookPen size={14} aria-hidden="true" />
              )}
              {cat === "graphs"
                ? t("recycleBin.tabs.graphs")
                : t("recycleBin.tabs.notes")}
            </button>
          ))}
        </div>

        {category === "graphs" && (
          <>
            {filteredGraphs.length > 0 && (
          <div
            className={`flex items-center gap-4 p-3 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}
          >
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                isDark
                  ? "hover:bg-slate-700 text-slate-300"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-primary-500" />
              ) : isPartialSelected ? (
                <div className="w-5 h-5 rounded border-2 border-primary-500 bg-primary-500/30 flex items-center justify-center">
                  <div className="w-2.5 h-0.5 bg-primary-500 rounded" />
                </div>
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-sm">
                {isAllSelected ? t("recycleBin.deselectAll") : t("recycleBin.selectAll")}
              </span>
            </button>

            {selectedCount > 0 && (
              <>
                <span
                  className={`text-sm ${themeClasses.textSecondary(isDark)}`}
                >
                  {t("recycleBin.selected", { count: selectedCount })}
                </span>
                <div className="flex-1" />
                <button
                  onClick={handleBatchRestore}
                  disabled={batchRestoreMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  } disabled:opacity-50`}
                >
                  <RefreshCw size={16} />
                  {t("recycleBin.batchRestore")}
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={batchPermanentDeleteMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  } disabled:opacity-50`}
                >
                  <AlertTriangle size={16} />
                  {t("recycleBin.batchDelete")}
                </button>
                <button
                  onClick={clearSelection}
                  aria-label={t('common.aria.close')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                      ? "hover:bg-slate-700 text-slate-400"
                      : "hover:bg-gray-100 text-gray-500"
                  }`}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGraphs.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={<Trash2 size={48} />}
                title={searchQuery ? t("recycleBin.noResults") : t("recycleBin.empty")}
                description={searchQuery ? t("recycleBin.noResultsHint") : t("recycleBin.emptyHint")}
              />
              {!searchQuery && (
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-1.5 mt-2">
                  <Info size={14} />
                  {t("recycleBin.autoCleanupHint")}
                </p>
              )}
            </div>
          ) : (
            filteredGraphs.map((graph) => (
              <div
                key={graph.id}
                className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                  selectedIds.has(graph.id)
                    ? isDark
                      ? "bg-primary-900/20 border-primary-700"
                      : "bg-primary-50 border-primary-300"
                    : isDark
                      ? "bg-slate-800 border-slate-700 hover:border-red-900/50"
                      : "bg-white border-gray-100 hover:border-red-100 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <button
                    onClick={() => toggleSelect(graph.id)}
                    className={`p-3.5 rounded-xl transition-colors ${
                      selectedIds.has(graph.id)
                        ? isDark
                          ? "bg-primary-900/40 text-primary-400"
                          : "bg-primary-100 text-primary-600"
                        : isDark
                          ? "bg-red-900/20 text-red-400 hover:bg-primary-900/20 hover:text-primary-400"
                          : "bg-red-50 text-red-500 hover:bg-primary-50 hover:text-primary-600"
                    }`}
                  >
                    {selectedIds.has(graph.id) ? (
                      <CheckSquare size={24} />
                    ) : (
                      <Trash2 size={24} />
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(graph.id)}
                      disabled={restoreGraphMutation.isPending}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark
                          ? "text-green-400 hover:bg-green-900/30"
                          : "text-green-600 hover:bg-green-50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={restoreGraphMutation.isPending ? t("recycleBin.restoring") : t("recycleBin.restoreGraph")}
                    >
                      {restoreGraphMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <RefreshCw size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(graph.id, graph.title)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark
                          ? "text-red-400 hover:bg-red-900/30"
                          : "text-red-500 hover:bg-red-50"
                      }`}
                      title={t("recycleBin.permanentDelete")}
                    >
                      <AlertTriangle size={18} />
                    </button>
                  </div>
                </div>

                <h3
                  className={`text-xl font-bold mb-2 line-clamp-1 ${
                    isDark ? "text-slate-100" : "text-gray-900"
                  }`}
                >
                  {graph.title}
                </h3>

                <p
                  className={`text-sm line-clamp-2 mb-4 ${
                    themeClasses.textSecondary(isDark)
                  }`}
                >
                  {graph.description || t("recycleBin.noDescription")}
                </p>

                <div
                  className={`pt-4 border-t text-xs ${isDark ? "border-slate-700 text-slate-500" : "border-gray-50 text-gray-400"}`}
                >
                  {t("recycleBin.deletedAt")}: {formatDate((graph as { deleted_at?: string }).deleted_at, "full-datetime")}
                </div>
              </div>
            ))
          )}
        </div>
          </>
        )}

        {category === "notes" && (
          <>
            {filteredNotes.length > 0 && (
              <div
                className={`flex items-center gap-4 p-3 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}
              >
                <button
                  type="button"
                  onClick={toggleSelectAllNotes}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                    isDark
                      ? "hover:bg-slate-700 text-slate-300"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  {isAllNotesSelected ? (
                    <CheckSquare className="w-5 h-5 text-primary-500" />
                  ) : isPartialNotesSelected ? (
                    <div className="w-5 h-5 rounded border-2 border-primary-500 bg-primary-500/30 flex items-center justify-center">
                      <div className="w-2.5 h-0.5 bg-primary-500 rounded" />
                    </div>
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  <span className="text-sm">
                    {isAllNotesSelected ? t("recycleBin.notes.batch.deselectAll") : t("recycleBin.notes.batch.selectAll")}
                  </span>
                </button>

                {selectedNoteIds.size > 0 && (
                  <>
                    <span
                      className={`text-sm ${themeClasses.textSecondary(isDark)}`}
                    >
                      {t("recycleBin.notes.batch.selected", { count: selectedNoteIds.size })}
                    </span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={handleBatchRestoreNotes}
                      disabled={restoreNoteMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDark
                          ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      } disabled:opacity-50`}
                    >
                      <RefreshCw size={16} />
                      {t("recycleBin.notes.batch.batchRestore")}
                    </button>
                    <button
                      type="button"
                      onClick={clearNoteSelection}
                      aria-label={t('common.aria.close')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark
                          ? "hover:bg-slate-700 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                      }`}
                    >
                      <X size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            {filteredNotes.length === 0 ? (
              <div
                className={`col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed ${
                  isDark
                    ? "border-slate-800 bg-slate-800/30"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <EmptyState
                  icon={
                    <NotebookPen
                      className={`w-12 h-12 ${isDark ? "text-slate-600" : "text-gray-300"}`}
                    />
                  }
                  title={
                    searchQuery
                      ? t("recycleBin.noResults")
                      : t("recycleBin.notes.empty")
                  }
                  description={
                    searchQuery
                      ? t("recycleBin.noResultsHint")
                      : t("recycleBin.notes.emptyHint")
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                      selectedNoteIds.has(note.id)
                        ? isDark
                          ? "bg-primary-900/20 border-primary-700"
                          : "bg-primary-50 border-primary-300"
                        : isDark
                          ? "bg-slate-800 border-slate-700 hover:border-purple-900/50"
                          : "bg-white border-gray-100 hover:border-purple-100 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => toggleNoteSelect(note.id)}
                        className={`p-3.5 rounded-xl transition-colors ${
                          selectedNoteIds.has(note.id)
                            ? isDark
                              ? "bg-primary-900/40 text-primary-400"
                              : "bg-primary-100 text-primary-600"
                            : isDark
                              ? "bg-purple-900/20 text-purple-400 hover:bg-primary-900/20 hover:text-primary-400"
                              : "bg-purple-50 text-purple-500 hover:bg-primary-50 hover:text-primary-600"
                        }`}
                      >
                        {selectedNoteIds.has(note.id) ? (
                          <CheckSquare size={24} />
                        ) : (
                          <NotebookPen size={24} />
                        )}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreNote(note)}
                          disabled={restoreNoteMutation.isPending}
                          className={`p-2 rounded-lg transition-colors ${
                            isDark
                              ? "text-green-400 hover:bg-green-900/30"
                              : "text-green-600 hover:bg-green-50"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={t("recycleBin.notes.restore")}
                        >
                          {restoreNoteMutation.isPending ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <RefreshCw size={18} />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark
                              ? "text-red-400"
                              : "text-red-500"
                          }`}
                          title={t("recycleBin.notes.batch.hardDeleteTooltip")}
                        >
                          <AlertTriangle size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${getNoteTypeBadgeClass(
                          note.type,
                        )}`}
                      >
                        {note.type === "daily" ? (
                          <CalendarDays size={11} aria-hidden="true" />
                        ) : (
                          <NotebookPen size={11} aria-hidden="true" />
                        )}
                        <span>
                          {note.type === "daily"
                            ? t("notes.badges.daily")
                            : t("notes.badges.note")}
                        </span>
                      </span>
                      <h3
                        className={`text-xl font-bold line-clamp-1 ${
                          isDark ? "text-slate-100" : "text-gray-900"
                        }`}
                      >
                        {note.title || t("notes.fields.untitled")}
                      </h3>
                    </div>

                    <div
                      className={`pt-4 border-t text-xs space-y-1 ${
                        isDark
                          ? "border-slate-700 text-slate-500"
                          : "border-gray-50 text-gray-400"
                      }`}
                    >
                      <div>
                        {t("recycleBin.deletedAt")}:{" "}
                        {note.deletedAt
                          ? formatDate(note.deletedAt, "full")
                          : "--"}
                      </div>
                      <div>
                        {t("recycleBin.notes.updatedAt")}:{" "}
                        {formatDate(note.updatedAt, "relative")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p
              className={`text-sm flex items-center gap-1.5 ${
                isDark ? "text-slate-500" : "text-gray-500"
              }`}
            >
              <Info size={14} />
              {t("recycleBin.notes.hardDeleteHint")}
            </p>
          </>
        )}

        <ConfirmationModal
          isOpen={deleteConfirm.isOpen}
          title={deleteConfirm.isBatch ? t("recycleBin.confirmDelete.batchTitle") : t("recycleBin.confirmDelete.title")}
          message={t("recycleBin.confirmDelete.message", {
            target: deleteConfirm.isBatch
              ? `${selectedIds.size} ${t("recycleBin.confirmDelete.title").toLowerCase()}`
              : `"${deleteConfirm.title}"`
          })}
          onConfirm={handleConfirmDelete}
          onClose={() =>
            setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
          }
          isDangerous={true}
          confirmText={t("recycleBin.confirmDelete.confirm")}
        />
      </div>
    </div>
  );
};
