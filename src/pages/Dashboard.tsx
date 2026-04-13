import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { useGraphs, useDashboardStats, queryKeys } from "../hooks/queries";
import {
  useCreateGraphMutation,
  useImportGraphMutation,
  useDeleteGraphMutation,
  useCreateGraphFromTemplateMutation,
  useToggleFavoriteMutation,
  usePrefetchGraph,
  useBatchDeleteGraphsMutation,
} from "../hooks/mutations";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Plus,
  BookOpen,
  Upload,
  Trash2,
  BarChart,
  Search,
  Network,
  ArrowRight,
  Sparkles,
  Tag,
  X,
  Star,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  LayoutGrid,
  List,
  Clock,
  Calendar,
} from "lucide-react";
import { useMessageStore } from "../store/useMessageStore";
import { parseMarkdownToGraph } from "../utils/markdownParser";
import { parseOpmlToGraph } from "../utils/opmlParser";
import { ConfirmationModal, SearchResults } from "../components/common";
import { TemplateSelector } from "../components/Templates/TemplateSelector";
import { AutoGraphGenerator } from "../components/AutoGraph/AutoGraphGenerator";
import { Template } from "../types";
import { useTheme, useIsMobile, useTopicCheck, useSearch } from "../hooks";
import { api } from "../services/api";

export const Dashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile, isTablet } = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: graphsData, isLoading, error } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const createGraphMutation = useCreateGraphMutation();
  const createGraphFromTemplateMutation = useCreateGraphFromTemplateMutation();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const batchDeleteGraphsMutation = useBatchDeleteGraphsMutation();
  const prefetchGraph = usePrefetchGraph();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { addMessage } = useMessageStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFABMenu, setShowFABMenu] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"card" | "list">(() => {
    const saved = localStorage.getItem("dashboard-view-mode");
    return (saved === "card" || saved === "list") ? saved : "card";
  });
  const graphsPerPage = isMobile ? 6 : viewMode === "list" ? 15 : 9;

  useEffect(() => {
    localStorage.setItem("dashboard-view-mode", viewMode);
  }, [viewMode]);

  const {
    isChecking,
    isDuplicate,
    similarGraphs,
    checkTopic,
    reset: resetTopicCheck,
  } = useTopicCheck({ debounceMs: 500 });
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    mode: searchMode,
    setMode: setSearchMode,
    isSearching,
    results: searchResults,
  } = useSearch({ debounceMs: 300 });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const fabMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const state = location.state as { templateId?: string } | null;
    if (state?.templateId) {
      api.templates
        .get(state.templateId)
        .then((template) => {
          setSelectedTemplate(template);
          setNewTitle(template.name);
          setNewDescription(template.description || "");
          setIsCreating(true);
        })
        .catch((err) => {
          console.error("Failed to load template:", err);
          addMessage({ type: "error", content: "加载模板失败" });
        });
      window.history.replaceState({}, document.title);
    }
  }, [location.state, addMessage]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (newTitle.trim().length >= 2) {
      checkTopic(newTitle);
    } else {
      resetTopicCheck();
    }
  }, [newTitle, checkTopic, resetTopicCheck]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setShowMoreMenu(false);
      }
      if (
        fabMenuRef.current &&
        !fabMenuRef.current.contains(event.target as Node)
      ) {
        setShowFABMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const graphs = useMemo(
    () => (Array.isArray(graphsData) ? graphsData : []),
    [graphsData],
  );

  const filteredGraphs = useMemo(() => {
    let result = graphs;

    if (selectedFilterTags.length > 0) {
      result = result.filter((g) => {
        const graphTags = g.tags || [];
        return selectedFilterTags.some((tag) => graphTags.includes(tag));
      });
    }

    return result;
  }, [graphs, selectedFilterTags]);

  const totalPages = Math.ceil(filteredGraphs.length / graphsPerPage);
  const paginatedGraphs = useMemo(() => {
    const start = (currentPage - 1) * graphsPerPage;
    return filteredGraphs.slice(start, start + graphsPerPage);
  }, [filteredGraphs, currentPage, graphsPerPage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      setFormError(null);
      if (selectedTemplate) {
        await createGraphFromTemplateMutation.mutateAsync({
          template_id: selectedTemplate.id,
          title: newTitle,
          description: newDescription,
        });
      } else {
        await createGraphMutation.mutateAsync({
          title: newTitle,
          description: newDescription,
        });
      }
      setNewTitle("");
      setNewDescription("");
      setSelectedTemplate(null);
      setIsCreating(false);
      addMessage({ type: "success", content: "创建成功!" });
    } catch (err: unknown) {
      console.error("创建图谱失败:", err);
      const message = err instanceof Error ? err.message : "创建图谱失败";
      setFormError(message);
      addMessage({ type: "error", content: message });
    }
  };

  const handleOpenTemplateSelector = () => {
    setIsTemplateSelectorOpen(true);
    setShowMoreMenu(false);
    setShowFABMenu(false);
  };

  const isAllSelected =
    paginatedGraphs.length > 0 &&
    paginatedGraphs.every((g) => selectedIds.has(g.id));
  const isPartialSelected =
    paginatedGraphs.some((g) => selectedIds.has(g.id)) && !isAllSelected;
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
      setSelectedIds(new Set(paginatedGraphs.map((g) => g.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const enterSelectMode = () => {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({
      isOpen: true,
      id: "",
      title: `${selectedIds.size} 个图谱`,
    });
  };

  const handleConfirmBatchDelete = () => {
    const ids = Array.from(selectedIds);
    batchDeleteGraphsMutation.mutate(ids, {
      onSuccess: () => {
        addMessage({
          type: "success",
          content: `已将 ${ids.length} 个图谱移至回收站`,
        });
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      },
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : "批量删除失败";
        addMessage({ type: "error", content: message });
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleSelectTemplate = (template: Template | null) => {
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);
    setIsCreating(true);
    if (template) {
      setNewTitle(template.name);
      setNewDescription(template.description || "");
    }
  };

  const handleDeleteGraph = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      deleteGraphMutation.mutate(deleteConfirm.id, {
        onSuccess: () => {
          addMessage({ type: "success", content: "图谱删除成功" });
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onError: (err: unknown) => {
          console.error(err);
          const message = err instanceof Error ? err.message : "删除失败";
          addMessage({ type: "error", content: message });
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else if (selectedIds.size > 0) {
      handleConfirmBatchDelete();
    }
  };

  const handleToggleFavorite = (id: string, currentFavorite: boolean) => {
    toggleFavoriteMutation.mutate(
      { id, is_favorite: !currentFavorite },
      {
        onSuccess: () => {
          addMessage({
            type: "success",
            content: currentFavorite ? "已取消收藏" : "收藏成功",
          });
        },
        onError: (err: unknown) => {
          console.error(err);
          const message = err instanceof Error ? err.message : "操作失败";
          addMessage({ type: "error", content: message });
        },
      },
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setShowMoreMenu(false);
    setShowFABMenu(false);
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
        addMessage({ content: "导入成功!", type: "success" });
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "格式错误";
        addMessage({ content: `导入失败: ${message}`, type: "error" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleOpenAIGenerator = () => {
    setIsAIGeneratorOpen(true);
    setShowMoreMenu(false);
    setShowFABMenu(false);
  };

  if (isLoading)
    return (
      <div
        className={`min-h-full flex items-center justify-center p-8 ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        正在加载图谱...
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
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-6 lg:space-y-10">
        {/* Header Section */}
        <div className="space-y-4 lg:space-y-6">
          {/* Row 1: Title + Stats Overview */}
          <div className="flex flex-col gap-4 lg:gap-6">
            <div className="space-y-1 flex-shrink-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {t('dashboard.title')}
              </h1>
              <p
                className={`${isDark ? "text-slate-400" : "text-gray-500"} text-xs sm:text-sm md:text-base`}
              >
                {t('dashboard.subtitle')}
              </p>
            </div>

            {/* Stats Overview - Compact */}
            {statsData && (
              <div
                className={`flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 rounded-xl border ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700"
                    : "bg-white border-gray-100 shadow-sm"
                }`}
              >
                <div
                  className={`p-2 sm:p-2.5 rounded-lg ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"} flex-shrink-0`}
                >
                  <BarChart size={isMobile ? 18 : 20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs sm:text-sm ${isDark ? "text-slate-300" : "text-gray-700"} leading-relaxed`}
                  >
                    {isMobile ? (
                      <>
                        <span className="font-semibold">{graphs.length}</span>{" "}
                        {t('dashboard.stats.graphs')} ·{" "}
                        <span className="font-semibold">
                          {graphs.reduce(
                            (acc, g) => acc + (g.nodes_count || 0),
                            0,
                          )}
                        </span>{" "}
                        {t('dashboard.stats.nodes')}
                      </>
                    ) : (
                      <>
                        {t('dashboard.stats.created')}{" "}
                        <span className="font-semibold">{graphs.length}</span>{" "}
                        {t('dashboard.stats.graphsUnit')}，{t('dashboard.stats.contains')}{" "}
                        <span className="font-semibold">
                          {graphs.reduce(
                            (acc, g) => acc + (g.nodes_count || 0),
                            0,
                          )}
                        </span>{" "}
                        {t('dashboard.stats.nodesUnit')}{t('dashboard.stats.keepGoing')}
                      </>
                    )}
                  </p>
                </div>
                <Link
                  to="/statistics"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ${
                    isDark
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {t('dashboard.stats.statistics')}
                  <ArrowRight size={12} className="hidden sm:block" />
                </Link>
              </div>
            )}
          </div>

          {/* Row 2: Search + Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Search Box */}
            <div className="relative flex-1 min-w-0">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                size={18}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('dashboard.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() =>
                  searchQuery.length >= 2 && setShowSearchResults(true)
                }
                className={`w-full pl-10 pr-20 sm:pr-24 py-2.5 sm:py-2.5 rounded-xl border outline-none transition-all text-sm ${
                  isDark
                    ? "bg-slate-800 border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder:text-slate-500"
                    : "bg-white border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm placeholder:text-gray-400"
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => setSearchMode("keyword")}
                  className={`px-2 py-1.5 sm:py-1 text-xs rounded-md transition-colors min-h-[32px] min-w-[44px] sm:min-w-0 ${
                    searchMode === "keyword"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  {t('dashboard.search.keyword')}
                </button>
                <button
                  onClick={() => setSearchMode("semantic")}
                  className={`px-2 py-1.5 sm:py-1 text-xs rounded-md transition-colors flex items-center gap-1 min-h-[32px] min-w-[44px] sm:min-w-0 justify-center ${
                    searchMode === "semantic"
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  <Sparkles size={12} />
                  <span className="hidden sm:inline">{t('dashboard.search.semantic')}</span>
                </button>
              </div>

              {showSearchResults && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSearchResults(false)}
                  />
                  <div
                    className={`absolute top-full left-0 right-0 mt-2 z-50 ${
                      isMobile ? "mx-0" : ""
                    }`}
                  >
                    <SearchResults
                      results={searchResults}
                      isSearching={isSearching}
                      query={searchQuery}
                      onClose={() => setShowSearchResults(false)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons - Desktop & Tablet */}
            {!isMobile && (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap lg:flex-nowrap">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".json,.md,.opml"
                />

                {/* View Toggle - integrated into action buttons */}
                <div
                  className={`flex items-center rounded-xl border overflow-hidden ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-gray-200 shadow-sm"
                  }`}
                >
                  <button
                    onClick={() => setViewMode("card")}
                    className={`p-2.5 min-h-[44px] min-w-[44px] transition-all ${
                      viewMode === "card"
                        ? isDark
                          ? "bg-blue-600 text-white"
                          : "bg-blue-500 text-white"
                        : isDark
                          ? "text-slate-400 hover:text-slate-300"
                          : "text-gray-400 hover:text-gray-600"
                    }`}
                    title={t('dashboard.view.cardView')}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2.5 min-h-[44px] min-w-[44px] transition-all ${
                      viewMode === "list"
                        ? isDark
                          ? "bg-blue-600 text-white"
                          : "bg-blue-500 text-white"
                        : isDark
                          ? "text-slate-400 hover:text-slate-300"
                          : "text-gray-400 hover:text-gray-600"
                    }`}
                    title={t('dashboard.view.listView')}
                  >
                    <List size={18} />
                  </button>
                </div>

                {!isSelectMode && (
                  <button
                    onClick={enterSelectMode}
                    className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
                    }`}
                    title={t('dashboard.actions.select')}
                  >
                    <CheckSquare size={16} />
                    <span className="hidden lg:inline">{t('dashboard.actions.select')}</span>
                  </button>
                )}

                {isSelectMode && (
                  <button
                    onClick={exitSelectMode}
                    className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                      isDark
                        ? "bg-red-900/30 border-red-800 text-red-400 hover:bg-red-900/50"
                        : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                    }`}
                    title={t('dashboard.actions.cancelSelect')}
                  >
                    <X size={16} />
                    <span className="hidden lg:inline">{t('dashboard.actions.cancel')}</span>
                  </button>
                )}

                <button
                  onClick={handleImportClick}
                  disabled={importGraphMutation.isPending}
                  className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
                  } disabled:opacity-50`}
                  title={t('dashboard.actions.import')}
                >
                  <Upload size={16} />
                  <span className="hidden lg:inline">
                    {importGraphMutation.isPending ? t('dashboard.actions.importing') : t('dashboard.actions.import')}
                  </span>
                </button>

                <Link
                  to="/graph-map"
                  className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
                  }`}
                  title={t('dashboard.actions.graphMap')}
                >
                  <Network size={16} />
                  <span className="hidden lg:inline">{t('dashboard.actions.graphMap')}</span>
                </Link>

                <button
                  onClick={handleOpenTemplateSelector}
                  className="px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all text-sm font-medium min-h-[44px]"
                  title={t('dashboard.actions.newGraph')}
                >
                  <Plus size={16} />
                  <span className="hidden lg:inline">{t('dashboard.actions.newGraph')}</span>
                </button>

                <button
                  onClick={handleOpenAIGenerator}
                  className="px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md transition-all text-sm font-medium min-h-[44px]"
                  title={t('dashboard.actions.aiGenerate')}
                >
                  <Sparkles size={16} />
                  <span className="hidden lg:inline">{t('dashboard.actions.aiGenerate')}</span>
                </button>
              </div>
            )}

            {/* Action Buttons - Mobile */}
            {isMobile && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".json,.md,.opml"
                />

                <button
                  onClick={handleOpenTemplateSelector}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all text-sm font-medium"
                >
                  <Plus size={18} />
                  <span>{t('dashboard.actions.newGraph')}</span>
                </button>

                <button
                  onClick={handleOpenAIGenerator}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md transition-all text-sm font-medium"
                >
                  <Sparkles size={18} />
                  <span>{t('dashboard.actions.aiGenerate')}</span>
                </button>

                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2.5 rounded-xl flex items-center justify-center border transition-all ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
                    }`}
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  {showMoreMenu && (
                    <div
                      className={`absolute right-0 top-full mt-2 w-40 rounded-xl border shadow-lg z-50 overflow-hidden ${
                        isDark
                          ? "bg-slate-800 border-slate-700"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      {!isSelectMode && (
                        <button
                          onClick={() => {
                            enterSelectMode();
                            setShowMoreMenu(false);
                          }}
                          className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                            isDark
                              ? "text-slate-300 hover:bg-slate-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <CheckSquare size={18} />
                          <span>{t('dashboard.actions.select')}</span>
                        </button>
                      )}

                      {isSelectMode && (
                        <button
                          onClick={() => {
                            exitSelectMode();
                            setShowMoreMenu(false);
                          }}
                          className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                            isDark
                              ? "text-red-400 hover:bg-red-900/30"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <X size={18} />
                          <span>{t('dashboard.actions.cancelSelect')}</span>
                        </button>
                      )}

                      <button
                        onClick={handleImportClick}
                        disabled={importGraphMutation.isPending}
                        className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                          isDark
                            ? "text-slate-300 hover:bg-slate-700"
                            : "text-gray-700 hover:bg-gray-50"
                        } disabled:opacity-50`}
                      >
                        <Upload size={18} />
                        <span>
                          {importGraphMutation.isPending ? t('dashboard.actions.importing') : t('dashboard.actions.import')}
                        </span>
                      </button>

                      <Link
                        to="/graph-map"
                        onClick={() => setShowMoreMenu(false)}
                        className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                          isDark
                            ? "text-slate-300 hover:bg-slate-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Network size={18} />
                        <span>{t('dashboard.actions.graphMap')}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tag Cloud Section */}
        <TagCloudSection
          isDark={isDark}
          isMobile={isMobile}
          selectedTags={selectedFilterTags}
          onTagsChange={(tags) => {
            setSelectedFilterTags(tags);
            setCurrentPage(1);
          }}
        />

        {/* Create Graph Modal/Form */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className={`w-full ${isMobile ? "inset-0 rounded-none" : "max-w-md rounded-2xl"} shadow-2xl ${isMobile ? "h-full" : ""} flex flex-col ${
                isDark
                  ? "bg-slate-800 border-slate-700" +
                    (isMobile ? "" : " border")
                  : "bg-white"
              }`}
            >
              <div
                className={`flex justify-between items-center p-4 md:p-6 border-b ${isDark ? "border-slate-700" : "border-gray-100"} ${isMobile ? "sticky top-0 z-10" : ""}`}
              >
                <h3 className="text-lg md:text-xl font-bold">
                  {selectedTemplate ? t('dashboard.create.fromTemplate') : t('dashboard.create.title')}
                </h3>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedTemplate(null);
                  }}
                  className={`p-2 rounded-full hover:bg-opacity-10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${isDark ? "hover:bg-white text-slate-400" : "hover:bg-black text-gray-400"}`}
                >
                  <X size={24} />
                </button>
              </div>

              <div
                className={`flex-1 overflow-y-auto ${isMobile ? "p-4" : "p-6 md:p-8"}`}
              >
                {selectedTemplate && (
                  <div
                    className={`mb-6 p-4 rounded-xl ${isDark ? "bg-slate-700" : "bg-blue-50"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-600 text-white">
                        {selectedTemplate.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t('dashboard.create.nodeCount', { count: selectedTemplate.nodes?.length ?? 0 })}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}
                    >
                      {selectedTemplate.description || t('dashboard.create.noDescription')}
                    </p>
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {t('dashboard.create.graphName')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder={t('dashboard.create.namePlaceholder')}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-base ${
                          isDuplicate
                            ? "border-amber-500 focus:ring-amber-500"
                            : isDark
                              ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        }`}
                        autoFocus
                      />
                      {isChecking && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                      )}
                    </div>
                    {isDuplicate && similarGraphs.length > 0 && (
                      <div
                        className={`p-3 rounded-lg flex items-start gap-2 ${
                          isDark
                            ? "bg-amber-900/30 text-amber-300"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">{t('dashboard.create.duplicateTopic')}</p>
                          <p className="mt-1">
                            {t('dashboard.create.similarTo', { title: similarGraphs[0].title, similarity: (similarGraphs[0].similarity * 100).toFixed(1) })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {t('dashboard.create.description')}（{t('dashboard.create.optional')}）
                    </label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder={t('dashboard.create.descriptionPlaceholder')}
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none text-base ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      }`}
                      rows={4}
                    />
                  </div>

                  {formError && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                      <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
                      {formError}
                    </div>
                  )}
                </form>
              </div>

              <div
                className={`flex gap-3 p-4 md:p-6 border-t ${isDark ? "border-slate-700" : "border-gray-100"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedTemplate(null);
                    resetTopicCheck();
                  }}
                  className={`flex-1 min-h-[48px] px-4 py-3 rounded-xl font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t('dashboard.actions.cancel')}
                </button>
                <button
                  type="submit"
                  onClick={handleCreate}
                  className="flex-1 min-h-[48px] px-4 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={
                    createGraphMutation.isPending ||
                    createGraphFromTemplateMutation.isPending ||
                    !newTitle ||
                    isChecking ||
                    isDuplicate
                  }
                >
                  {createGraphMutation.isPending ||
                  createGraphFromTemplateMutation.isPending
                    ? t('dashboard.create.creating')
                    : t('dashboard.create.createNow')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Selector Modal */}
        {isTemplateSelectorOpen && (
          <TemplateSelector
            onSelectTemplate={handleSelectTemplate}
            onCancel={() => setIsTemplateSelectorOpen(false)}
          />
        )}

        {/* AI Graph Generator Modal */}
        {isAIGeneratorOpen && (
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
                  addMessage({
                    type: "success",
                    content: `成功生成 ${nodes.length} 个节点！`,
                  });
                }}
              />
            </div>
          </div>
        )}

        {/* Graphs Grid */}
        {/* Batch Operations Toolbar */}
        {isSelectMode && filteredGraphs.length > 0 && (
          <div
            className={`flex items-center gap-4 p-3 rounded-xl ${
              isDark ? "bg-slate-800" : "bg-white border border-gray-200"
            }`}
          >
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
                isDark
                  ? "hover:bg-slate-700 text-slate-300"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-500" />
              ) : isPartialSelected ? (
                <div className="w-5 h-5 rounded border-2 border-blue-500 bg-blue-500/30 flex items-center justify-center">
                  <div className="w-2.5 h-0.5 bg-blue-500 rounded" />
                </div>
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-sm">
                {isAllSelected ? t('dashboard.batch.deselectAll') : t('dashboard.batch.selectAll')}
              </span>
            </button>

            {selectedCount > 0 && (
              <>
                <span
                  className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t('dashboard.batch.selected', { count: selectedCount })}
                </span>
                <div className="flex-1" />
                <button
                  onClick={handleBatchDelete}
                  disabled={batchDeleteGraphsMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isDark
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  } disabled:opacity-50`}
                >
                  <Trash2 size={16} />
                  {batchDeleteGraphsMutation.isPending ? t('dashboard.batch.deleting') : t('dashboard.batch.batchDelete')}
                </button>
                <button
                  onClick={clearSelection}
                  className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
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

        <div
          className={`grid gap-3 sm:gap-4 lg:gap-6 ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}
        >
          {filteredGraphs.length === 0 ? (
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
                {searchQuery ? t('dashboard.empty.noResults') : t('dashboard.empty.startJourney')}
              </h3>
              <p
                className={`text-center max-w-md mb-6 sm:mb-8 px-4 text-sm ${isDark ? "text-slate-500" : "text-gray-500"}`}
              >
                {searchQuery
                  ? t('dashboard.empty.tryDifferent')
                  : t('dashboard.empty.createOrImport')}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {t('dashboard.empty.createFirst')}
                </button>
              )}
            </div>
          ) : viewMode === "list" ? (
            <div className={`col-span-full rounded-2xl border overflow-hidden ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200 shadow-sm"
            }`}>
              <div className={`overflow-x-auto ${isMobile ? "hidden" : ""}`}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-100 bg-gray-50"}`}>
                      {isSelectMode && (
                        <th className="w-12 px-4 py-3">
                          <button
                            onClick={toggleSelectAll}
                            className={`flex items-center justify-center w-5 h-5 rounded ${
                              isAllSelected
                                ? "bg-blue-500 text-white"
                                : isPartialSelected
                                  ? "bg-blue-500/30 border-2 border-blue-500"
                                  : isDark
                                    ? "border border-slate-600"
                                    : "border border-gray-300"
                            }`}
                          >
                            {isAllSelected && <Check size={14} />}
                            {isPartialSelected && <div className="w-2 h-0.5 bg-blue-500 rounded" />}
                          </button>
                        </th>
                      )}
                      <th className={`text-left px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.title')}</th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden lg:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.description')}</th>
                      <th className={`text-center px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.nodes')}</th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden md:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.createdAt')}</th>
                      <th className={`text-left px-4 py-3 text-sm font-semibold hidden xl:table-cell ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.updatedAt')}</th>
                      <th className={`text-right px-4 py-3 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>{t('dashboard.list.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGraphs.map((graph) => (
                      <tr
                        key={graph.id}
                        onMouseEnter={() => prefetchGraph(graph.id)}
                        className={`border-b transition-colors cursor-pointer ${
                          isDark
                            ? "border-slate-700 hover:bg-slate-700/50"
                            : "border-gray-100 hover:bg-gray-50"
                        } ${
                          isSelectMode && selectedIds.has(graph.id)
                            ? isDark
                              ? "bg-blue-900/20"
                              : "bg-blue-50"
                            : ""
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleSelect(graph.id);
                          } else {
                            navigate(`/learning?graph_id=${graph.id}`);
                          }
                        }}
                      >
                        {isSelectMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleSelect(graph.id)}
                              className={`flex items-center justify-center w-5 h-5 rounded ${
                                selectedIds.has(graph.id)
                                  ? "bg-blue-500 text-white"
                                  : isDark
                                    ? "border border-slate-600 hover:border-blue-500"
                                    : "border border-gray-300 hover:border-blue-500"
                              }`}
                            >
                              {selectedIds.has(graph.id) && <Check size={14} />}
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              isDark
                                ? "bg-indigo-900/30 text-indigo-400"
                                : "bg-indigo-50 text-indigo-600"
                            }`}>
                              <BookOpen size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium truncate ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                                  {graph.title}
                                </span>
                                {graph.is_favorite && (
                                  <Star size={14} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 hidden lg:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          <span className="line-clamp-1 text-sm">{graph.description || t('dashboard.card.noDescription')}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className={`flex items-center justify-center gap-1 text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                            <Network size={14} />
                            <span>{graph.nodes_count || 0}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 hidden md:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar size={14} />
                            <span>{graph.created_at ? new Date(graph.created_at).toLocaleDateString("zh-CN") : "-"}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 hidden xl:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock size={14} />
                            <span>{graph.updated_at ? new Date(graph.updated_at).toLocaleDateString("zh-CN") : "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/graph/${graph.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                isDark
                                  ? "text-slate-400 hover:bg-indigo-900/30 hover:text-indigo-400"
                                  : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                              }`}
                              title={t('dashboard.card.openMindMap')}
                            >
                              <Network size={16} />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleFavorite(graph.id, graph.is_favorite || false);
                              }}
                              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                graph.is_favorite
                                  ? "text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                                  : isDark
                                    ? "text-slate-400 hover:bg-yellow-900/30 hover:text-yellow-400"
                                    : "text-gray-400 hover:bg-yellow-50 hover:text-yellow-500"
                              }`}
                              title={graph.is_favorite ? t('dashboard.card.unfavorite') : t('dashboard.card.favorite')}
                            >
                              <Star size={16} fill={graph.is_favorite ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteGraph(graph.id, graph.title);
                              }}
                              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                isDark
                                  ? "text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                                  : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                              }`}
                              title={t('dashboard.card.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isMobile && (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {paginatedGraphs.map((graph) => (
                    <div
                      key={graph.id}
                      className={`p-3 sm:p-4 transition-colors ${
                        isSelectMode && selectedIds.has(graph.id)
                          ? isDark
                            ? "bg-blue-900/20"
                            : "bg-blue-50"
                          : ""
                      }`}
                      onClick={() => {
                        if (isSelectMode) {
                          toggleSelect(graph.id);
                        } else {
                          navigate(`/learning?graph_id=${graph.id}`);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {isSelectMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(graph.id);
                            }}
                            className={`flex items-center justify-center w-6 h-6 rounded mt-1 ${
                              selectedIds.has(graph.id)
                                ? "bg-blue-500 text-white"
                                : isDark
                                  ? "border border-slate-600"
                                  : "border border-gray-300"
                            }`}
                          >
                            {selectedIds.has(graph.id) && <Check size={14} />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium text-sm sm:text-base ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                              {graph.title}
                            </span>
                            {graph.is_favorite && (
                              <Star size={14} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
                            )}
                          </div>
                          <p className={`text-xs sm:text-sm mb-2 line-clamp-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                            {graph.description || t('dashboard.card.noDescription')}
                          </p>
                          <div className="flex items-center gap-3 text-xs">
                            <div className={`flex items-center gap-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                              <Network size={12} />
                              <span>{graph.nodes_count || 0} {t('dashboard.card.nodes')}</span>
                            </div>
                            <div className={`flex items-center gap-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                              <Calendar size={12} />
                              <span>{graph.created_at ? new Date(graph.created_at).toLocaleDateString("zh-CN") : "-"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/graph/${graph.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-indigo-900/30"
                                : "text-gray-400 hover:bg-indigo-50"
                            }`}
                          >
                            <Network size={18} />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGraph(graph.id, graph.title);
                            }}
                            className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-red-900/30"
                                : "text-gray-400 hover:bg-red-50"
                            }`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            paginatedGraphs.map((graph, index) => (
              <div
                key={graph.id || index}
                onMouseEnter={() => prefetchGraph(graph.id)}
                className={`group relative rounded-2xl transition-all duration-300 ${
                  isSelectMode
                    ? selectedIds.has(graph.id)
                      ? isDark
                        ? "bg-blue-900/20 border-2 border-blue-500"
                        : "bg-blue-50 border-2 border-blue-400"
                      : isDark
                        ? "bg-slate-800 border border-slate-700 hover:border-slate-600"
                        : "bg-white border border-gray-100 hover:border-gray-200"
                    : "hover:-translate-y-1"
                } ${
                  !isSelectMode && (isDark
                    ? "bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-xl hover:shadow-black/20"
                    : "bg-white border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5")
                }`}
              >
                {/* Selection Checkbox - Select Mode */}
                {isSelectMode && (
                  <div
                    className="absolute top-3 left-3 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(graph.id);
                    }}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                        selectedIds.has(graph.id)
                          ? "bg-blue-500 text-white"
                          : isDark
                            ? "bg-slate-700 border border-slate-600 hover:border-blue-500"
                            : "bg-white border border-gray-300 hover:border-blue-500"
                      }`}
                    >
                      {selectedIds.has(graph.id) && <Check size={14} />}
                    </div>
                  </div>
                )}

                {/* Card Content */}
                <div
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelect(graph.id);
                    } else {
                      navigate(`/learning?graph_id=${graph.id}`);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (isSelectMode) {
                        toggleSelect(graph.id);
                      } else {
                        navigate(`/learning?graph_id=${graph.id}`);
                      }
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="block p-4 sm:p-6 h-full flex flex-col cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div
                      className={`p-2.5 sm:p-3.5 rounded-xl transition-colors ${
                        isSelectMode && selectedIds.has(graph.id)
                          ? "bg-blue-500 text-white"
                          : isDark
                            ? "bg-indigo-900/30 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white"
                            : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                      }`}
                    >
                      <BookOpen size={isMobile ? 20 : 24} />
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Hover Actions - Desktop (not in select mode) */}
                      {!isMobile && !isSelectMode && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                          <Link
                            to={`/graph/${graph.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-indigo-900/30 hover:text-indigo-400"
                                : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                            }`}
                            title={t('dashboard.card.openMindMap')}
                          >
                            <Network size={18} />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteGraph(graph.id, graph.title);
                            }}
                            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                                : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                            }`}
                            title={t('dashboard.card.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                          {!graph.is_favorite && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleFavorite(graph.id, false);
                              }}
                              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                isDark
                                  ? "text-slate-400 hover:bg-yellow-900/30 hover:text-yellow-400"
                                  : "text-gray-400 hover:bg-yellow-50 hover:text-yellow-500"
                              }`}
                              title={t('dashboard.card.favorite')}
                            >
                              <Star size={18} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Actions - Mobile (always visible) */}
                      {isMobile && (
                        <>
                          <Link
                            to={`/graph/${graph.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-indigo-900/30 hover:text-indigo-400"
                                : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                            }`}
                            title={t('dashboard.card.openMindMap')}
                          >
                            <Network size={18} />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteGraph(graph.id, graph.title);
                            }}
                            className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              isDark
                                ? "text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                                : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                            }`}
                            title={t('dashboard.card.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}

                      {/* Favorite Star - Always visible when favorited */}
                      {graph.is_favorite && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(graph.id, true);
                          }}
                          className={`p-2 rounded-lg text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors ${isMobile ? "min-h-[44px] min-w-[44px] flex items-center justify-center" : ""}`}
                          title={t('dashboard.card.unfavorite')}
                        >
                          <Star size={18} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3
                    className={`text-base sm:text-xl font-bold mb-2 line-clamp-1 group-hover:text-blue-500 transition-colors ${
                      isDark ? "text-slate-100" : "text-gray-900"
                    }`}
                  >
                    {graph.title}
                  </h3>

                  <p
                    className={`text-xs sm:text-sm line-clamp-2 mb-4 sm:mb-6 flex-grow ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    {graph.description || t('dashboard.card.noDescription')}
                  </p>

                  <div
                    className={`pt-3 sm:pt-4 mt-auto border-t flex items-center justify-between ${
                      isDark ? "border-slate-700" : "border-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className={`flex items-center gap-1.5 text-xs font-medium ${
                          isDark ? "text-slate-400" : "text-gray-500"
                        }`}
                      >
                        <Network size={14} />
                        <span>{graph.nodes_count || 0} {t('dashboard.card.nodes')}</span>
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                        isDark
                          ? "text-indigo-400 group-hover:text-indigo-300"
                          : "text-indigo-600 group-hover:text-indigo-700"
                      }`}
                    >
                      <span>{t('dashboard.card.enterOutline')}</span>
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 sm:mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 rounded-xl transition-all flex items-center justify-center ${
                currentPage === 1
                  ? "opacity-30 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-slate-800 text-slate-300"
                    : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Desktop: Show page numbers */}
            {!isMobile && (
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                            currentPage === page
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                              : isDark
                                ? "hover:bg-slate-800 text-slate-400"
                                : "hover:bg-gray-100 text-gray-500"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      (page === currentPage - 2 && page > 1) ||
                      (page === currentPage + 2 && page < totalPages)
                    ) {
                      return (
                        <span key={page} className="px-1 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  },
                )}
              </div>
            )}

            {/* Mobile: Show current page text */}
            {isMobile && (
              <div
                className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-600"}`}
              >
                {currentPage} / {totalPages}
              </div>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 rounded-xl transition-all flex items-center justify-center ${
                currentPage === totalPages
                  ? "opacity-30 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-slate-800 text-slate-300"
                    : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

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
        <div className="fixed bottom-20 right-6 z-40" ref={fabMenuRef}>
          {/* FAB Menu */}
          {showFABMenu && (
            <div className="absolute bottom-20 right-0 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={handleOpenTemplateSelector}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg whitespace-nowrap ${
                  isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900"
                }`}
              >
                <div className="p-1.5 rounded-lg bg-blue-500 text-white">
                  <Plus size={16} />
                </div>
                <span className="text-sm font-medium">新建图谱</span>
              </button>

              <button
                onClick={handleOpenAIGenerator}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg whitespace-nowrap ${
                  isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900"
                }`}
              >
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                  <Sparkles size={16} />
                </div>
                <span className="text-sm font-medium">AI 生成</span>
              </button>

              <button
                onClick={handleImportClick}
                disabled={importGraphMutation.isPending}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg whitespace-nowrap ${
                  isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900"
                } disabled:opacity-50`}
              >
                <div className="p-1.5 rounded-lg bg-green-500 text-white">
                  <Upload size={16} />
                </div>
                <span className="text-sm font-medium">
                  {importGraphMutation.isPending ? "导入中..." : "导入"}
                </span>
              </button>
            </div>
          )}

          {/* FAB Button */}
          <button
            onClick={() => setShowFABMenu(!showFABMenu)}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
              showFABMenu
                ? "rotate-45 bg-red-500 text-white"
                : "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
            }`}
          >
            <Plus size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

const TAG_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
];

const getTagColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

const TagCloudSection = ({
  isDark,
  isMobile,
  selectedTags,
  onTagsChange,
}: {
  isDark: boolean;
  isMobile: boolean;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}) => {
  const [showAll, setShowAll] = useState(false);

  const { data: tagsData } = useQuery({
    queryKey: ["graphTags"],
    queryFn: async () => {
      const res = await api.graphs.getTags();
      return res.tags || [];
    },
  });

  const allTags = useMemo(() => {
    return tagsData || [];
  }, [tagsData]);

  const maxCount = useMemo(() => {
    return Math.max(
      ...allTags.map((t: { name: string; count: number }) => t.count),
      1,
    );
  }, [allTags]);

  const defaultDisplayCount = isMobile ? 10 : 20;

  const displayedTags = useMemo(() => {
    return showAll ? allTags : allTags.slice(0, defaultDisplayCount);
  }, [allTags, showAll, defaultDisplayCount]);

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearSelection = () => {
    onTagsChange([]);
  };

  if (!allTags || allTags.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-6 ${
        isDark
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`p-2 sm:p-2.5 rounded-xl ${isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-600"}`}
          >
            <Tag size={isMobile ? 18 : 20} />
          </div>
          <div>
            <h3
              className={`text-base sm:text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}
            >
              标签云
            </h3>
            <p
              className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              共 {allTags.length} 个标签
            </p>
          </div>
        </div>

        {selectedTags.length > 0 && (
          <button
            onClick={clearSelection}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-0 ${
              isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <X size={14} />
            <span className="hidden sm:inline">清除筛选</span>
            <span className="sm:hidden">清除</span>
            <span>({selectedTags.length})</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {displayedTags.map((tag: { name: string; count: number }) => {
          const isSelected = selectedTags.includes(tag.name);
          const size = isMobile ? 0.75 : 0.75 + (tag.count / maxCount) * 0.5;

          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className={`
                inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full
                transition-all hover:scale-105 min-h-[36px] sm:min-h-0
                ${
                  isSelected
                    ? `${getTagColor(tag.name)} text-white shadow-lg ring-2 ring-white ring-opacity-50`
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
              style={{ fontSize: `${size}rem` }}
            >
              <span className="font-medium">{tag.name}</span>
              <span
                className={`text-xs ${isSelected ? "text-white/80" : isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>

      {allTags.length > defaultDisplayCount && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`mt-3 sm:mt-4 w-full py-2 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
            isDark
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {showAll ? "收起" : `查看全部 ${allTags.length} 个标签`}
        </button>
      )}
    </div>
  );
};
