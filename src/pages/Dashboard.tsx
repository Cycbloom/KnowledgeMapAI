import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGraphs, useDashboardStats, queryKeys } from "../hooks/queries";
import {
  useImportGraphMutation,
  useDeleteGraphMutation,
  useToggleFavoriteMutation,
  usePrefetchGraph,
  useBatchDeleteGraphsMutation,
  useRestoreGraphMutation,
  useBatchRestoreGraphsMutation,
} from "../hooks/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { Network, Star, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import { message } from "../utils/messageHelper";
import { parseMarkdownToGraph } from "../utils/markdownParser";
import { parseOpmlToGraph } from "../utils/opmlParser";
import { formatDate } from "@/utils/formatters";
import { ConfirmationModal, SkeletonCard, ErrorBoundary } from "../components/common";
import { AutoGraphGenerator } from "../components/AutoGraph/AutoGraphGenerator";
import { useTheme, useIsMobile } from "../hooks";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import { useDashboardFilters } from "../hooks/useDashboardFilters";
import { useRecentGraphs } from "../hooks/useRecentGraphs";
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
  const { data: graphsData, isLoading, error, refetch } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const batchDeleteGraphsMutation = useBatchDeleteGraphsMutation();
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

  const aiGeneratorRef = useFocusTrap<HTMLDivElement>({ enabled: isAIGeneratorOpen });
  useEscapeKey(() => setIsAIGeneratorOpen(false), isAIGeneratorOpen);

  const [contextMenuGraph, setContextMenuGraph] = useState<Graph | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  const handleUndoDeleteGraph = useCallback(
    async (id: string) => {
      try {
        await restoreGraphMutation.mutateAsync(id);
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
        message.success(t("dashboard.undo.restored"));
      } catch (err: unknown) {
        console.error(err);
        message.error(t("dashboard.undo.restoreFailed"));
      }
    },
    [restoreGraphMutation, queryClient, t],
  );

  const handleUndoBatchDeleteGraphs = useCallback(
    async (ids: string[]) => {
      try {
        await batchRestoreGraphsMutation.mutateAsync(ids);
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
        message.success(t("dashboard.undo.restored"));
      } catch (err: unknown) {
        console.error(err);
        message.error(t("dashboard.undo.restoreFailed"));
      }
    },
    [batchRestoreGraphsMutation, queryClient, t],
  );

  const handleBatchDelete = () => {
    if (filters.selectedIds.size === 0) return;
    setDeleteConfirm({
      isOpen: true,
      id: "",
      title: `${filters.selectedIds.size} 个图谱`,
    });
  };

  const handleConfirmBatchDelete = () => {
    const deletedIds = Array.from(filters.selectedIds);
    batchDeleteGraphsMutation.mutate(deletedIds, {
      onSuccess: () => {
        message.success(
          t("dashboard.undo.deletedMany", { count: deletedIds.length }),
          {
            duration: 5000,
            action: {
              label: t("common.undo"),
              onClick: () => {
                void handleUndoBatchDeleteGraphs(deletedIds);
              },
            },
          },
        );
        filters.clearSelection();
        filters.setIsSelectMode(false);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      },
      onError: (err: unknown) => {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : t("dashboard.batchDeleteFailed");
        message.error(errorMessage);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeleteGraph = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      const { id, title } = deleteConfirm;
      deleteGraphMutation.mutate(id, {
        onSuccess: () => {
          message.success(
            t("dashboard.undo.deletedOne", { title }),
            {
              duration: 5000,
              action: {
                label: t("common.undo"),
                onClick: () => {
                  void handleUndoDeleteGraph(id);
                },
              },
            },
          );
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onError: (err: unknown) => {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : t("dashboard.deleteFailed");
          message.error(errorMessage);
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
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
          message.success(currentFavorite ? t("dashboard.favoriteRemoved") : t("dashboard.favoriteAdded"));
        },
        onError: (err: unknown) => {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : t("dashboard.operationFailed");
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
        message.success(t("dashboard.importSuccess"));
      } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : t("dashboard.formatError");
        message.error(t("dashboard.importFailed", { message: errorMessage }));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleOpenAIGenerator = () => {
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

  if (isLoading)
    return (
      <div
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
    );
  if (error)
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400 mb-4">{t('dashboard.loadError')}</p>
        <button
          type="button"
          onClick={() => { void refetch(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );

  return (
    <div
      className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-4 lg:space-y-6">
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
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              <Clock size={16} />
              {t("dashboard.recent.title")}
            </h3>
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
              className={`w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto ${isMobile ? "rounded-none" : "rounded-2xl"} shadow-2xl`}
            >
              <ErrorBoundary
                fallbackRender={(error, resetErrorBoundary) => (
                  <div className="p-6 border border-red-300 rounded-2xl bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-center">
                    <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-400 font-medium">
                      <AlertTriangle size={20} />
                      <span>AI 生成面板出错</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-2 break-words">
                      {error.message}
                    </p>
                    <button
                      onClick={resetErrorBoundary}
                      className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    >
                      重试
                    </button>
                  </div>
                )}
              >
                <AutoGraphGenerator
                  onClose={() => setIsAIGeneratorOpen(false)}
                  onGraphGenerated={(nodes, _edges) => {
                    setIsAIGeneratorOpen(false);
                    queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.dashboardStats,
                    });
                    message.success(t("dashboard.nodesGenerated", { count: nodes.length }));
                  }}
                />
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
            isBatchDeleting={batchDeleteGraphsMutation.isPending}
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
              className={`col-span-full flex flex-col items-center justify-center py-16 sm:py-20 rounded-3xl border-2 border-dashed ${
                isDark
                  ? "border-slate-800 bg-slate-800/30"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div
                className={`p-6 rounded-full mb-4 ${isDark ? "bg-slate-800 text-slate-600" : "bg-white text-gray-300"}`}
              >
                <Network size={48} />
              </div>
              <h3
                className={`text-lg sm:text-xl font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-900"}`}
              >
                {filters.searchQuery
                  ? t("dashboard.empty.noResults")
                  : t("dashboard.empty.startJourney")}
              </h3>
              <p
                className={`text-center max-w-md mb-6 sm:mb-8 px-4 text-sm ${isDark ? "text-slate-500" : "text-gray-500"}`}
              >
                {filters.searchQuery
                  ? t("dashboard.empty.tryDifferent")
                  : t("dashboard.empty.createOrImport")}
              </p>
              {!filters.searchQuery && (
                <button
                  onClick={handleOpenAIGenerator}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium hover:from-primary-600 hover:to-primary-600 transition-colors shadow-lg"
                >
                  {t("dashboard.empty.createFirst")}
                </button>
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
                <table className="w-full">
                  <thead>
                    <tr
                      className={`sticky top-0 z-10 border-b ${
                        isDark
                          ? "border-slate-700 bg-slate-800"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      {filters.isSelectMode && (
                        <th className="w-12 px-4 py-3">
                          <button
                            onClick={filters.toggleSelectAll}
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
                      <th className={`text-left px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.title")}
                      </th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden lg:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.description")}
                      </th>
                      <th className={`text-center px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.nodes")}
                      </th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden md:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.createdAt")}
                      </th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden xl:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.updatedAt")}
                      </th>
                      <th className={`text-right px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                        {t("dashboard.list.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filters.paginatedGraphs.map((graph) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
              {isMobile && (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filters.paginatedGraphs.map((graph) => (
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
                  ))}
                </div>
              )}
            </div>
          ) : (
            filters.paginatedGraphs.map((graph, index) => (
              <DashboardGraphCard
                key={graph.id || index}
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
              />
            ))
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
          message={`确定要删除图谱 "${deleteConfirm.title}" 吗？此操作将永久删除所有相关的节点和关系，无法撤销。`}
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
  );
};
