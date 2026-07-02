import React, { useState, useMemo, useEffect } from "react";
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
} from "../hooks/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { Network, Star, Clock } from "lucide-react";
import { message } from "../utils/messageHelper";
import { parseMarkdownToGraph } from "../utils/markdownParser";
import { parseOpmlToGraph } from "../utils/opmlParser";
import { ConfirmationModal, SkeletonCard } from "../components/common";
import { AutoGraphGenerator } from "../components/AutoGraph/AutoGraphGenerator";
import { useTheme, useIsMobile } from "../hooks";
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

function formatRelativeTime(dateStr: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return t("dashboard.recent.justNow");

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t("dashboard.recent.justNow");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("dashboard.recent.minutesAgo", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("dashboard.recent.hoursAgo", { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 30) return t("dashboard.recent.daysAgo", { count: days });

  const months = Math.floor(days / 30);
  return t("dashboard.recent.monthsAgo", { count: months });
}

export const Dashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile, isTablet } = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: graphsData, isLoading, error } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const batchDeleteGraphsMutation = useBatchDeleteGraphsMutation();
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

  const handleBatchDelete = () => {
    if (filters.selectedIds.size === 0) return;
    setDeleteConfirm({
      isOpen: true,
      id: "",
      title: `${filters.selectedIds.size} 个图谱`,
    });
  };

  const handleConfirmBatchDelete = () => {
    const ids = Array.from(filters.selectedIds);
    batchDeleteGraphsMutation.mutate(ids, {
      onSuccess: () => {
        message.success(`已将 ${ids.length} 个图谱移至回收站`);
        filters.clearSelection();
        filters.setIsSelectMode(false);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      },
      onError: (err: unknown) => {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "批量删除失败";
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
      deleteGraphMutation.mutate(deleteConfirm.id, {
        onSuccess: () => {
          message.success("图谱删除成功");
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onError: (err: unknown) => {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "删除失败";
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
          message.success(currentFavorite ? "已取消收藏" : "收藏成功");
        },
        onError: (err: unknown) => {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "操作失败";
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
        message.success("导入成功!");
      } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "格式错误";
        message.error(`导入失败: ${errorMessage}`);
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
            className={`grid gap-3 sm:gap-4 lg:gap-6 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}
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
      <div className="p-8 text-red-600">
        错误: {(error as Error).message || "加载图谱失败"}
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
                    {formatRelativeTime(graph.updated_at, t)}
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
              className={`w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto ${isMobile ? "rounded-none" : "rounded-2xl"} shadow-2xl`}
            >
              <AutoGraphGenerator
                onClose={() => setIsAIGeneratorOpen(false)}
                onGraphGenerated={(nodes, _edges) => {
                  setIsAIGeneratorOpen(false);
                  queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
                  queryClient.invalidateQueries({
                    queryKey: ["dashboardStats"],
                  });
                  message.success(`成功生成 ${nodes.length} 个节点！`);
                }}
              />
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
          className={`grid gap-3 sm:gap-4 lg:gap-6 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}
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
                      className={`border-b ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-100 bg-gray-50"}`}
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
          title="删除图谱"
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
