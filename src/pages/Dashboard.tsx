import React, { useState, useMemo, useEffect, useId, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGraphs, useDashboardStats, queryKeys } from "../hooks/queries";
import {
  useImportGraphMutation,
  useDeleteGraphMutation,
  useToggleFavoriteMutation,
  usePrefetchGraph,
  useRestoreGraphMutation,
  useBatchRestoreGraphsMutation,
} from "../hooks/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { Network, Star, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import { message } from "../utils/messageHelper";
import { parseMarkdownToGraph } from "../utils/markdownParser";
import { parseOpmlToGraph } from "../utils/opmlParser";
import { formatDate } from "@/utils/formatters";
import { ConfirmationModal, SkeletonCard, Skeleton, ErrorBoundary, EmptyState, FirstRunHint } from "../components/common";
const AutoGraphGenerator = lazy(() =>
  import("../components/AutoGraph/AutoGraphGenerator").then((module) => ({
    default: module.AutoGraphGenerator,
  })),
);
import { useTheme, useIsMobile } from "../hooks";
import { usePullToRefresh } from "../hooks/gesture/usePullToRefresh";
import { useFocusTrap, useEscapeKey, useFirstRunHint } from "@/hooks/common";
import { useUndoableAction } from "@/hooks/common/useUndoableAction";
import { useDashboardFilters } from "../hooks/dashboard/useDashboardFilters";
import { useRecentGraphs } from "../hooks/queries/useRecentGraphs";
import {
  DashboardHeader,
  TagCloudSection,
  DashboardGraphCard,
  DashboardGraphListItem,
  DashboardBatchActions,
  DashboardPagination,
  DashboardMobileFAB,
  DashboardCardContextMenu,
} from "../components/Dashboard";
import type { Graph } from "@shared/types";

export const Dashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile, isTablet } = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: graphsData, isLoading, isFetching, error, refetch } = useGraphs();
  const { indicator } = usePullToRefresh({
    onRefresh: async () => { await refetch(); },
    containerSelector: "[data-pull-refresh]",
  });
  const { data: statsData } = useDashboardStats();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const restoreGraphMutation = useRestoreGraphMutation();
  const batchRestoreGraphsMutation = useBatchRestoreGraphsMutation();
  const prefetchGraph = usePrefetchGraph();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { getRecentGraphs, removeRecentGraph } = useRecentGraphs();
  const recentGraphsRaw = useMemo(() => getRecentGraphs(), [getRecentGraphs]);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
  }>({
    isOpen: false,
    id: "",
    title: "",
  });

  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const aiGeneratorTitleId = useId();

  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const aiGeneratorRef = useFocusTrap<HTMLDivElement>({ enabled: isAIGeneratorOpen });
  useEscapeKey(() => setIsAIGeneratorOpen(false), isAIGeneratorOpen);

  const [contextMenuGraph, setContextMenuGraph] = useState<Graph | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // 首次访问提示：仅在未 dismiss 时显示，引导用户创建第一个图谱
  const firstRunHint = useFirstRunHint({
    storageKey: "dashboard-first-run-hint-dismissed",
  });

  const graphs = useMemo(
    () => (Array.isArray(graphsData) ? graphsData : []),
    [graphsData],
  );

  // 图谱列表加载成功后，用其校验最近编辑条目，过滤掉已被删除的死链
  const validGraphIds = useMemo(
    () => new Set(graphs.map((g) => g.id)),
    [graphs],
  );
  const recentGraphs = useMemo(() => {
    // 列表加载中或出错时不过滤，避免误隐藏有效条目
    if (isLoading || error) return recentGraphsRaw;
    return recentGraphsRaw.filter((r) => validGraphIds.has(r.id));
  }, [recentGraphsRaw, validGraphIds, isLoading, error]);

  // 同步清理 localStorage 中已失效的最近编辑条目
  useEffect(() => {
    if (isLoading || error) return;
    const staleIds = recentGraphsRaw
      .filter((r) => !validGraphIds.has(r.id))
      .map((r) => r.id);
    if (staleIds.length > 0) {
      staleIds.forEach((id) => removeRecentGraph(id));
    }
  }, [recentGraphsRaw, validGraphIds, isLoading, error, removeRecentGraph]);

  const filters = useDashboardFilters({ isMobile, graphs });

  // 单个图谱删除：6s 撤销 toast，点击撤销调用 restore API
  const { executeDelete: executeDeleteGraph } = useUndoableAction<
    { id: string; title: string },
    string
  >({
    deleteFn: async ({ id }) => {
      await deleteGraphMutation.mutateAsync(id);
      return id;
    },
    restoreFn: (id: string) =>
      restoreGraphMutation.mutateAsync(id).then(() => undefined),
    deletedMessage: "",
    getDeletedMessage: ({ title }) =>
      t("dashboard.undo.deletedOne", { title }),
    restoredMessage: t("dashboard.undo.restored"),
    restoreFailedMessage: t("dashboard.undo.restoreFailed"),
    onRestored: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });

  // 批量图谱删除：6s 撤销 toast，点击撤销一次性恢复所有
  const { executeDelete: executeBatchDeleteGraphs } = useUndoableAction<
    string[],
    string[]
  >({
    deleteFn: async (ids) => {
      setBatchDeleteProgress({ completed: 0, total: ids.length });
      const deletedIds: string[] = [];
      for (let i = 0; i < ids.length; i++) {
        try {
          await deleteGraphMutation.mutateAsync(ids[i]);
          deletedIds.push(ids[i]);
        } catch (err) {
          console.error(err);
        }
        setBatchDeleteProgress({ completed: i + 1, total: ids.length });
      }
      setBatchDeleteProgress(null);
      if (deletedIds.length === 0) {
        throw new Error(t("toast.dashboard.batchDeleteFailed"));
      }
      return deletedIds;
    },
    restoreFn: (ids: string[]) =>
      batchRestoreGraphsMutation.mutateAsync(ids).then(() => undefined),
    deletedMessage: "",
    getDeletedMessage: (ids) =>
      t("dashboard.undo.deletedMany", { count: ids.length }),
    restoredMessage: t("dashboard.undo.restored"),
    restoreFailedMessage: t("dashboard.undo.restoreFailed"),
    onRestored: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });

  const handleBatchDelete = () => {
    if (filters.selectedIds.size === 0) return;
    setDeleteConfirm({
      isOpen: true,
      id: "",
      title: t("dashboard.graphCounter", { count: filters.selectedIds.size }),
    });
  };

  const handleConfirmBatchDelete = () => {
    const deletedIds = Array.from(filters.selectedIds);
    executeBatchDeleteGraphs(deletedIds)
      .then(() => {
        filters.clearSelection();
        filters.setIsSelectMode(false);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      })
      .catch((err: unknown) => {
        console.error(err);
        const errorMessage =
          err instanceof Error ? err.message : t("toast.dashboard.batchDeleteFailed");
        message.error(errorMessage);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      });
  };

  const handleDeleteGraph = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      const { id, title } = deleteConfirm;
      executeDeleteGraph({ id, title })
        .then(() => {
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        })
        .catch((err: unknown) => {
          console.error(err);
          const errorMessage =
            err instanceof Error ? err.message : t("toast.dashboard.deleteFailed");
          message.error(errorMessage);
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        });
    } else if (filters.selectedIds.size > 0) {
      handleConfirmBatchDelete();
    }
  };

  const handleToggleFavorite = (id: string, currentFavorite: boolean) => {
    toggleFavoriteMutation.mutate(
      { id, is_favorite: !currentFavorite },
      {
        onSuccess: () => {
          message.success(currentFavorite ? t("toast.dashboard.favoriteRemoved") : t("toast.dashboard.favoriteAdded"));
        },
        onError: (err: unknown) => {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : t("toast.dashboard.operationFailed");
          message.error(errorMessage);
        },
      },
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    filters.setShowMoreMenu(false);
    filters.setShowFABMenu(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let importData;

        if (file.name.endsWith(".md")) {
          const parsed = parseMarkdownToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace(".md", ""),
            nodes: parsed.nodes,
            edges: parsed.edges,
          };
        } else if (file.name.endsWith(".opml")) {
          const parsed = parseOpmlToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace(".opml", ""),
            nodes: parsed.nodes,
            edges: parsed.edges,
          };
        } else {
          const data = JSON.parse(content);
          importData = {
            graph_title:
              data.graph?.title ||
              data.graph_title ||
              file.name.replace(".json", ""),
            nodes: data.nodes || [],
            edges: data.edges || [],
          };
        }

        await importGraphMutation.mutateAsync(importData);
        message.success(t("toast.dashboard.importSuccess"));
      } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : t("toast.dashboard.formatError");
        message.error(t("toast.dashboard.importFailed", { message: errorMessage }));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleOpenAIGenerator = () => {
    // 用户已点击 CTA，隐藏首次访问提示
    firstRunHint.dismiss();
    setIsAIGeneratorOpen(true);
    filters.setShowMoreMenu(false);
    filters.setShowFABMenu(false);
  };

  const handleNavigate = (graphId: string) => {
    navigate(`/learning?graph_id=${graphId}`);
  };

  const handleContextMenu = (e: React.MouseEvent, graph: Graph) => {
    e.preventDefault();
    setContextMenuGraph(graph);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuClose = () => {
    setContextMenuGraph(null);
    setContextMenuPosition(null);
  };

  const handleContextMenuToggleFavorite = (id: string) => {
    const graph = graphs.find((g) => g.id === id);
    handleToggleFavorite(id, graph?.is_favorite ?? false);
  };

  const handleContextMenuDelete = (id: string) => {
    const graph = graphs.find((g) => g.id === id);
    handleDeleteGraph(id, graph?.title ?? "");
  };

  if (isLoading && !isFetching)
    {return (
      <div
        aria-busy={isLoading}
        aria-label={t("common.aria.loadingRegion")}
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
      >
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-4 lg:space-y-6">
          <div
            className={`grid gap-3 sm:gap-4 lg:gap-6 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </div>
        </div>
      </div>
    );}
  if (error)
    {return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <p role="alert" className="text-red-600 dark:text-red-400 mb-4">{t('toast.dashboard.loadError')}</p>
        <button
          type="button"
          onClick={() => { void refetch(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );}

  return (
    <div className="relative h-full">
      {indicator}
      <div
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
        data-pull-refresh
      >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-4 lg:space-y-6">
        <h1 className="sr-only">{t('dashboard.title')}</h1>
        {/* Header Section */}
        <DashboardHeader
          isDark={isDark}
          isMobile={isMobile}
          graphs={graphs}
          statsData={statsData}
          searchQuery={filters.searchQuery}
          setSearchQuery={filters.setSearchQuery}
          searchMode={filters.searchMode}
          setSearchMode={filters.setSearchMode}
          isSearching={filters.isSearching}
          searchResults={filters.searchResults}
          showSearchResults={filters.showSearchResults}
          setShowSearchResults={filters.setShowSearchResults}
          searchInputRef={filters.searchInputRef}
          viewMode={filters.viewMode}
          setViewMode={filters.setViewMode}
          isSelectMode={filters.isSelectMode}
          enterSelectMode={filters.enterSelectMode}
          exitSelectMode={filters.exitSelectMode}
          moreMenuRef={filters.moreMenuRef}
          showMoreMenu={filters.showMoreMenu}
          setShowMoreMenu={filters.setShowMoreMenu}
          fileInputRef={fileInputRef}
          isImporting={importGraphMutation.isPending}
          onFileChange={handleFileChange}
          onImportClick={handleImportClick}
          onOpenAIGenerator={handleOpenAIGenerator}
          sortBy={filters.sortBy}
          setSortBy={filters.setSortBy}
          statusFilter={filters.statusFilter}
          setStatusFilter={filters.setStatusFilter}
          timeRangeFilter={filters.timeRangeFilter}
          setTimeRangeFilter={filters.setTimeRangeFilter}
        />

        {/* Recently Edited Section */}
        {recentGraphs.length > 0 && (
          <div>
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              <Clock size={16} />
              {t("dashboard.recent.title")}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {recentGraphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => navigate(`/graph/${graph.id}`)}
                  className={`flex-shrink-0 min-w-[160px] max-w-[220px] p-3 rounded-xl border text-left transition-all hover:shadow-md ${
                    isDark
                      ? "bg-slate-800 border-slate-700 hover:border-primary-500/50"
                      : "bg-white border-gray-200 hover:border-primary-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {graph.is_favorite && (
                      <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate ${isDark ? "text-slate-200" : "text-gray-900"}`}>
                      {graph.topic}
                    </span>
                  </div>
                  <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                    {formatDate(graph.updated_at, "relative")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag Cloud Section */}
        <TagCloudSection
          isDark={isDark}
          isMobile={isMobile}
          selectedTags={filters.selectedFilterTags}
          onTagsChange={(tags) => {
            filters.setSelectedFilterTags(tags);
            filters.setCurrentPage(1);
          }}
        />

        {/* AI Graph Generator Modal */}
        {isAIGeneratorOpen && createPortal(
          <div
            className={`fixed inset-0 z-50 flex ${isMobile ? "" : "items-center justify-center"} p-4 bg-black/50 backdrop-blur-sm`}
          >
            <div
              ref={aiGeneratorRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={aiGeneratorTitleId}
              className={`w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto ${isMobile ? "rounded-none" : "rounded-2xl"} shadow-2xl`}
            >
              <h2 id={aiGeneratorTitleId} className="sr-only">
                {t("autoGraph.title")}
              </h2>
              <ErrorBoundary
                fallbackRender={(error, resetErrorBoundary) => (
                  <div className="p-6 border border-red-300 rounded-2xl bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-center">
                    <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-400 font-medium">
                      <AlertTriangle size={20} />
                      <span>{t("dashboard.aiPanelError")}</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-2 break-words">
                      {error.message}
                    </p>
                    <button
                      onClick={resetErrorBoundary}
                      className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    >
                      {t("common.retry")}
                    </button>
                  </div>
                )}
              >
                <Suspense fallback={<Skeleton variant="text" className="h-64 w-full" />}>
                  <AutoGraphGenerator
                    onClose={() => setIsAIGeneratorOpen(false)}
                    onGraphGenerated={(nodes, _edges) => {
                      setIsAIGeneratorOpen(false);
                      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.dashboardStats,
                      });
                      message.success(t("toast.dashboard.nodesGenerated", { count: nodes.length }));
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>,
          document.body
        )}

        {/* Batch Operations Toolbar */}
        {filters.isSelectMode && filters.filteredGraphs.length > 0 && (
          <DashboardBatchActions
            isDark={isDark}
            isAllSelected={filters.isAllSelected}
            isPartialSelected={filters.isPartialSelected}
            selectedCount={filters.selectedCount}
            isBatchDeleting={batchDeleteProgress !== null}
            batchDeleteProgress={batchDeleteProgress}
            onToggleSelectAll={filters.toggleSelectAll}
            onBatchDelete={handleBatchDelete}
            onClearSelection={filters.clearSelection}
          />
        )}

        {/* Graphs Grid */}
        <div
          className={`grid gap-3 sm:gap-4 lg:gap-6 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
        >
          {filters.filteredGraphs.length === 0 ? (
            <div
              className={`col-span-full rounded-3xl border-2 border-dashed ${
                isDark
                  ? "border-slate-800 bg-slate-800/30"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {filters.searchQuery ? (
                <EmptyState
                  illustration="search"
                  title={t("dashboard.empty.noResults")}
                  description={t("dashboard.empty.tryDifferent")}
                />
              ) : (
                <div className="relative">
                  <EmptyState
                    icon={<Network size={48} />}
                    iconWrapper
                    size="lg"
                    illustration="empty"
                    title={t("dashboard.empty.startJourney")}
                    description={t("dashboard.empty.createOrImport")}
                    action={{
                      label: t("dashboard.empty.createFirst"),
                      onClick: handleOpenAIGenerator,
                    }}
                  />
                  {firstRunHint.isVisible && (
                    <div
                      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-xs px-4 pointer-events-auto"
                    >
                      <FirstRunHint
                        visible={firstRunHint.isVisible}
                        storageKey="dashboard-first-run-hint-dismissed"
                        title={t("dashboard.firstRunHint.title")}
                        description={t("dashboard.firstRunHint.description")}
                        dismissLabel={t("dashboard.firstRunHint.dismiss")}
                        onDismiss={() => firstRunHint.dismiss()}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : filters.viewMode === "list" ? (
            <div
              className={`col-span-full rounded-2xl border overflow-hidden ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-200 shadow-sm"
              }`}
            >
              <div className={`overflow-x-auto ${isMobile ? "hidden" : ""}`}>
                <table
                  className="w-full"
                  aria-label={t("dashboard.list.tableAriaLabel")}
                >
                  <thead>
                    <tr
                      className={`sticky top-0 z-10 border-b ${
                        isDark
                          ? "border-slate-700 bg-slate-800"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      {filters.isSelectMode && (
                        <th scope="col" className="w-12 px-4 py-3">
                          <button
                            onClick={filters.toggleSelectAll}
                            aria-label={t("dashboard.list.selectAllAriaLabel")}
                            aria-pressed={filters.isAllSelected}
                            className={`flex items-center justify-center w-5 h-5 rounded ${
                              filters.isAllSelected
                                ? "bg-primary-500 text-white"
                                : filters.isPartialSelected
                                  ? "bg-primary-500/30 border-2 border-primary-500"
                                  : isDark
                                    ? "border border-slate-600"
                                    : "border border-gray-300"
                            }`}
                          >
                            {filters.isPartialSelected && (
                              <div className="w-2 h-0.5 bg-primary-500 rounded" />
                            )}
                          </button>
                        </th>
                      )}
                      <th scope="col" className={`text-left px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.title")}
                      </th>
                      <th scope="col" className={`text-left px-4 py-3 text-sm font-semibold hidden lg:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.description")}
                      </th>
                      <th scope="col" className={`text-center px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.nodes")}
                      </th>
                      <th scope="col" className={`text-left px-4 py-3 text-sm font-semibold hidden md:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.createdAt")}
                      </th>
                      <th scope="col" className={`text-left px-4 py-3 text-sm font-semibold hidden xl:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.updatedAt")}
                      </th>
                      <th scope="col" className={`text-right px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filters.paginatedGraphs.map((graph, index) => (
                      <motion.tr
                        key={graph.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.2 }}
                      >
                        <DashboardGraphListItem
                          key={graph.id}
                          graph={graph}
                          isDark={isDark}
                          isMobile={isMobile}
                          isSelectMode={filters.isSelectMode}
                          isSelected={filters.selectedIds.has(graph.id)}
                          onToggleSelect={filters.toggleSelect}
                          onNavigate={handleNavigate}
                          onDelete={handleDeleteGraph}
                          onToggleFavorite={handleToggleFavorite}
                          onPrefetch={prefetchGraph}
                          onContextMenu={handleContextMenu}
                          variant="desktop"
                        />
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isMobile && (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filters.paginatedGraphs.map((graph, index) => (
                    <motion.div
                      key={graph.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.2 }}
                    >
                      <DashboardGraphListItem
                        key={graph.id}
                        graph={graph}
                        isDark={isDark}
                        isMobile={isMobile}
                        isSelectMode={filters.isSelectMode}
                        isSelected={filters.selectedIds.has(graph.id)}
                        onToggleSelect={filters.toggleSelect}
                        onNavigate={handleNavigate}
                        onDelete={handleDeleteGraph}
                        onToggleFavorite={handleToggleFavorite}
                        onPrefetch={prefetchGraph}
                        onContextMenu={handleContextMenu}
                        variant="mobile"
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filters.paginatedGraphs.map((graph, index) => (
                <motion.div
                  key={graph.id || index}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  <DashboardGraphCard
                    key={graph.id || index}
                    graph={graph}
                    isDark={isDark}
                    isMobile={isMobile}
                    isSelectMode={filters.isSelectMode}
                    isSelected={filters.selectedIds.has(graph.id)}
                    isMenuOpen={contextMenuGraph?.id === graph.id}
                    onToggleSelect={filters.toggleSelect}
                    onNavigate={handleNavigate}
                    onDelete={handleDeleteGraph}
                    onToggleFavorite={handleToggleFavorite}
                    onPrefetch={prefetchGraph}
                    onContextMenu={handleContextMenu}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Pagination */}
        <DashboardPagination
          isDark={isDark}
          isMobile={isMobile}
          currentPage={filters.currentPage}
          totalPages={filters.totalPages}
          onPageChange={filters.setCurrentPage}
        />

        <ConfirmationModal
          isOpen={deleteConfirm.isOpen}
          title={t("dashboard.deleteGraphTitle")}
          message={t("dashboard.deleteConfirmMessage", { title: deleteConfirm.title })}
          onConfirm={handleConfirmDelete}
          onClose={() =>
            setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
          }
        />
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <DashboardMobileFAB
          isDark={isDark}
          showFABMenu={filters.showFABMenu}
          onToggleFABMenu={() => filters.setShowFABMenu(!filters.showFABMenu)}
          onOpenAIGenerator={handleOpenAIGenerator}
          onImportClick={handleImportClick}
          isImporting={importGraphMutation.isPending}
          fabMenuRef={filters.fabMenuRef}
        />
      )}

      {/* Context Menu */}
      {contextMenuGraph && contextMenuPosition && (
        <DashboardCardContextMenu
          graph={contextMenuGraph}
          position={contextMenuPosition}
          onClose={handleContextMenuClose}
          onToggleFavorite={handleContextMenuToggleFavorite}
          onDelete={handleContextMenuDelete}
        />
      )}
    </div>
    </div>
  );
};
