import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTrashGraphs } from "../hooks/queries";
import {
  useRestoreGraphMutation,
  usePermanentDeleteGraphMutation,
  useBatchRestoreGraphsMutation,
  useBatchPermanentDeleteGraphsMutation,
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
} from "lucide-react";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { ConfirmationModal } from "../components/common";
import { useTheme } from "../hooks";
import { useNavigate } from "react-router-dom";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";

export const RecycleBin = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: trashData, isLoading, error } = useTrashGraphs();
  const restoreGraphMutation = useRestoreGraphMutation();
  const permanentDeleteGraphMutation = usePermanentDeleteGraphMutation();
  const batchRestoreMutation = useBatchRestoreGraphsMutation();
  const batchPermanentDeleteMutation = useBatchPermanentDeleteGraphsMutation();

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const isAllSelected =
    filteredGraphs.length > 0 &&
    filteredGraphs.every((g) => selectedIds.has(g.id));
  const isPartialSelected =
    filteredGraphs.some((g) => selectedIds.has(g.id)) && !isAllSelected;
  const selectedCount = selectedIds.size;

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

  const handleRestore = async (id: string) => {
    try {
      await restoreGraphMutation.mutateAsync(id);
      frontendEventBus.publish("message_show", { type: "success", content: t("recycleBin.messages.restoreSuccess") });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("recycleBin.messages.restoreFailed");
      frontendEventBus.publish("message_show", { type: "error", content: message });
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
      const message = err instanceof Error ? err.message : t("recycleBin.messages.batchRestoreFailed");
      frontendEventBus.publish("message_show", { type: "error", content: message });
    }
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

  if (isLoading)
    return (
      <div
        className={`min-h-full flex items-center justify-center p-8 ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        {t("recycleBin.loading")}
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-red-600">
        {t("common.error")}: {(error as Error).message || t("recycleBin.loadFailed")}
      </div>
    );

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
              className={`${isDark ? "text-slate-400" : "text-gray-500"} text-lg max-w-xl`}
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
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                size={18}
              />
              <input
                type="text"
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
                  className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
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
            <div
              className={`col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed ${
                isDark
                  ? "border-slate-800 bg-slate-800/30"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div
                className={`p-6 rounded-full mb-4 ${isDark ? "bg-slate-800 text-slate-600" : "bg-white text-gray-300"}`}
              >
                <Trash2 size={48} />
              </div>
              <h3
                className={`text-xl font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-900"}`}
              >
                {searchQuery ? t("recycleBin.noResults") : t("recycleBin.empty")}
              </h3>
              <p
                className={`text-center max-w-md ${isDark ? "text-slate-500" : "text-gray-500"}`}
              >
                {searchQuery
                  ? t("recycleBin.noResultsHint")
                  : t("recycleBin.emptyHint")}
              </p>
              {!searchQuery && (
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5 mt-2">
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
                    isDark ? "text-slate-400" : "text-gray-500"
                  }`}
                >
                  {graph.description || t("recycleBin.noDescription")}
                </p>

                <div
                  className={`pt-4 border-t text-xs ${isDark ? "border-slate-700 text-slate-500" : "border-gray-50 text-gray-400"}`}
                >
                  {t("recycleBin.deletedAt")}: {new Date(((graph as unknown) as { deleted_at?: string }).deleted_at ?? new Date().toISOString()).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

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
