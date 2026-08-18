import React, { useEffect, useId, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Search,
  Network,
  ArrowRight,
  Upload,
  MoreHorizontal,
  CheckSquare,
  X,
  LayoutGrid,
  List,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { SearchResults } from "../common";
import type {
  UseDashboardFiltersReturn,
  SortBy,
  StatusFilter,
  TimeRangeFilter,
} from "../../hooks/dashboard/useDashboardFilters";
import type { Graph } from "@shared/types";
import { useMenuNavigation } from "../../hooks";

interface DashboardHeaderProps {
  isDark: boolean;
  isMobile: boolean;
  graphs: Graph[];
  statsData: unknown;
  // 解构 filters，区分 ref 和 state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: "keyword" | "semantic";
  setSearchMode: (mode: "keyword" | "semantic") => void;
  isSearching: boolean;
  searchResults: UseDashboardFiltersReturn["searchResults"];
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  viewMode: UseDashboardFiltersReturn["viewMode"];
  setViewMode: (mode: UseDashboardFiltersReturn["viewMode"]) => void;
  isSelectMode: boolean;
  enterSelectMode: () => void;
  exitSelectMode: () => void;
  moreMenuRef: React.RefObject<HTMLDivElement>;
  showMoreMenu: boolean;
  setShowMoreMenu: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isImporting: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportClick: () => void;
  onOpenAIGenerator: () => void;
  // Sort & Filter
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  timeRangeFilter: TimeRangeFilter;
  setTimeRangeFilter: (filter: TimeRangeFilter) => void;
  // Filter panel expanded state (controlled by parent)
  filterExpanded: boolean;
  setFilterExpanded: (expanded: boolean) => void;
}

const SORT_OPTIONS = [
  { value: "updatedAt", labelKey: "dashboard.sort.updatedAt" },
  { value: "createdAt", labelKey: "dashboard.sort.createdAt" },
  { value: "title", labelKey: "dashboard.sort.title" },
  { value: "nodeCount", labelKey: "dashboard.sort.nodeCount" },
] as const satisfies ReadonlyArray<{ value: SortBy; labelKey: string }>;

const STATUS_OPTIONS = [
  { value: "all", labelKey: "dashboard.filter.statusAll" },
  { value: "active", labelKey: "dashboard.filter.statusActive" },
  { value: "archived", labelKey: "dashboard.filter.statusArchived" },
] as const satisfies ReadonlyArray<{ value: StatusFilter; labelKey: string }>;

const TIME_RANGE_OPTIONS = [
  { value: "all", labelKey: "dashboard.filter.rangeAll" },
  { value: "today", labelKey: "dashboard.filter.rangeToday" },
  { value: "week", labelKey: "dashboard.filter.rangeWeek" },
  { value: "month", labelKey: "dashboard.filter.rangeMonth" },
] as const satisfies ReadonlyArray<{ value: TimeRangeFilter; labelKey: string }>;

// 更多菜单固定 4 项：[0]选择/取消选择 [1]导入 [2]图谱地图 [3]筛选
const MORE_MENU_ITEM_COUNT = 4;

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isDark,
  isMobile,
  graphs,
  statsData,
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  isSearching,
  searchResults,
  showSearchResults,
  setShowSearchResults,
  searchInputRef,
  viewMode,
  setViewMode,
  isSelectMode,
  enterSelectMode,
  exitSelectMode,
  moreMenuRef,
  showMoreMenu,
  setShowMoreMenu,
  fileInputRef,
  isImporting,
  onFileChange,
  onImportClick,
  onOpenAIGenerator,
  sortBy,
  setSortBy,
  statusFilter,
  setStatusFilter,
  timeRangeFilter,
  setTimeRangeFilter,
  filterExpanded,
  setFilterExpanded,
}) => {
  const { t } = useTranslation();
  const moreMenuId = useId();
  const filterPanelId = useId();

  // 预计算节点总数，避免渲染时重复 reduce 遍历 graphs
  const totalNodeCount = useMemo(
    () => graphs.reduce((acc, g) => acc + (g.nodes_count || 0), 0),
    [graphs]
  );

  const handleMoreMenuSelect = (index: number) => {
    const item = document.getElementById(`${moreMenuId}-item-${index}`);
    item?.click();
    setShowMoreMenu(false);
  };

  const { activeIndex: moreActiveIndex, setActiveIndex: setMoreActiveIndex } =
    useMenuNavigation({
      itemCount: MORE_MENU_ITEM_COUNT,
      enabled: showMoreMenu,
      onSelect: handleMoreMenuSelect,
      onClose: () => setShowMoreMenu(false),
    });

  // 补充 Home/End 导航（hook 仅处理 ArrowUp/ArrowDown/Enter/Escape）
  useEffect(() => {
    if (!showMoreMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        e.preventDefault();
        setMoreActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setMoreActiveIndex(MORE_MENU_ITEM_COUNT - 1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showMoreMenu, setMoreActiveIndex]);

  const moreActiveRing = (idx: number) =>
    showMoreMenu && moreActiveIndex === idx
      ? isDark
        ? "ring-2 ring-primary-400 ring-inset"
        : "ring-2 ring-primary-500 ring-inset"
      : "";

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Row 1: Title + Stats Overview */}
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="space-y-1 flex-shrink-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent">
            {t("dashboard.title")}
          </h1>
          <p
            className={`${isDark ? "text-slate-400" : "text-gray-500"} text-xs sm:text-sm md:text-base`}
          >
            {t("dashboard.subtitle")}
          </p>
        </div>

        {/* Stats Overview - Compact */}
        {!!statsData && (
          <div
            className={`flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 rounded-xl border ${
              isDark
                ? "bg-slate-800/50 border-slate-700"
                : "bg-white border-gray-100 shadow-sm"
            }`}
          >
            <div
              className={`p-2 sm:p-2.5 rounded-lg ${isDark ? "bg-primary-500/10 text-primary-400" : "bg-primary-50 text-primary-600"} flex-shrink-0`}
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
                    {t("dashboard.stats.graphs")} ·{" "}
                    <span className="font-semibold">
                      {totalNodeCount}
                    </span>{" "}
                    {t("dashboard.stats.nodes")}
                  </>
                ) : (
                  <>
                    {t("dashboard.stats.created")}{" "}
                    <span className="font-semibold">{graphs.length}</span>{" "}
                    {t("dashboard.stats.graphsUnit")}，
                    {t("dashboard.stats.contains")}{" "}
                    <span className="font-semibold">
                      {totalNodeCount}
                    </span>{" "}
                    {t("dashboard.stats.nodesUnit")}
                    {t("dashboard.stats.keepGoing")}
                  </>
                )}
              </p>
            </div>
            <Link
              to="/statistics"
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ${
                isDark
                  ? "bg-primary-600 text-white hover:bg-primary-500"
                  : "bg-primary-50 text-primary-700 hover:bg-primary-100"
              }`}
            >
              {t("dashboard.stats.statistics")}
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
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            placeholder={t("dashboard.search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() =>
              searchQuery.length >= 2 && setShowSearchResults(true)
            }
            aria-label={t("dashboard.search.placeholder")}
            className={`w-full pl-10 pr-20 sm:pr-24 py-2.5 sm:py-2.5 rounded-xl border outline-none transition-all text-sm ${
              isDark
                ? "bg-slate-800 border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-white placeholder:text-slate-500"
                : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
            }`}
          />
          <div
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1"
          >
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${
                  isDark
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                }`}
                aria-label={t("common.aria.clear")}
                title={t("common.aria.clear")}
              >
                <X size={14} />
              </button>
            )}
            <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label={t("dashboard.search.searchMode")}>
            <button
              onClick={() => setSearchMode("keyword")}
              className={`px-2 py-2.5 sm:py-1 text-xs rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${
                searchMode === "keyword"
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              aria-label={t("dashboard.search.keyword")}
              aria-pressed={searchMode === "keyword"}
            >
              {t("dashboard.search.keyword")}
            </button>
            <button
              onClick={() => setSearchMode("semantic")}
              className={`px-2 py-2.5 sm:py-1 text-xs rounded-md transition-colors flex items-center gap-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center ${
                searchMode === "semantic"
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              aria-label={t("dashboard.search.semantic")}
              aria-pressed={searchMode === "semantic"}
            >
              <Sparkles size={12} aria-hidden="true" />
              <span className="hidden sm:inline">
                {t("dashboard.search.semantic")}
              </span>
            </button>
          </div>
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
              onChange={onFileChange}
              className="hidden"
              accept=".json,.md,.opml"
              aria-label={t("dashboard.actions.import")}
            />

            {/* View Toggle */}
            <div
              className={`flex items-center rounded-xl border overflow-hidden ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 shadow-sm"
              }`}
              role="group"
              aria-label={t("dashboard.view.viewToggle")}
            >
              <button
                onClick={() => setViewMode("card")}
                className={`p-2.5 min-h-[44px] min-w-[44px] transition-all ${
                  viewMode === "card"
                    ? isDark
                      ? "bg-primary-600 text-white"
                      : "bg-primary-500 text-white"
                    : isDark
                      ? "text-slate-400 hover:text-slate-300"
                      : "text-gray-400 hover:text-gray-600"
                }`}
                title={t("dashboard.view.cardView")}
                aria-label={t("dashboard.view.cardView")}
                aria-pressed={viewMode === "card"}
              >
                <LayoutGrid size={18} aria-hidden="true" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 min-h-[44px] min-w-[44px] transition-all ${
                  viewMode === "list"
                    ? isDark
                      ? "bg-primary-600 text-white"
                      : "bg-primary-500 text-white"
                    : isDark
                      ? "text-slate-400 hover:text-slate-300"
                      : "text-gray-400 hover:text-gray-600"
                }`}
                title={t("dashboard.view.listView")}
                aria-label={t("dashboard.view.listView")}
                aria-pressed={viewMode === "list"}
              >
                <List size={18} aria-hidden="true" />
              </button>
            </div>

            {!isSelectMode && (
              <button
                onClick={enterSelectMode}
                className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
                }`}
                title={t("dashboard.actions.select")}
                aria-label={t("dashboard.actions.select")}
              >
                <CheckSquare size={16} aria-hidden="true" />
                <span className="hidden lg:inline">
                  {t("dashboard.actions.select")}
                </span>
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
                title={t("dashboard.actions.cancelSelect")}
                aria-label={t("dashboard.actions.cancelSelect")}
              >
                <X size={16} aria-hidden="true" />
                <span className="hidden lg:inline">
                  {t("dashboard.actions.cancel")}
                </span>
              </button>
            )}

            {/* Filter Toggle */}
            <button
              onClick={() => setFilterExpanded(!filterExpanded)}
              className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                filterExpanded
                  ? isDark
                    ? "bg-primary-600/20 border-primary-500 text-primary-400"
                    : "bg-primary-50 border-primary-300 text-primary-600"
                  : isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
              }`}
              aria-label={t("dashboard.filter.toggle")}
              aria-expanded={filterExpanded}
              aria-controls={filterPanelId}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span className="hidden lg:inline">
                {t("dashboard.filter.toggle")}
              </span>
            </button>

            <button
              onClick={onImportClick}
              disabled={isImporting}
              className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
              } disabled:opacity-50`}
              title={t("dashboard.actions.import")}
              aria-label={t("dashboard.actions.import")}
            >
              <Upload size={16} aria-hidden="true" />
              <span className="hidden lg:inline">
                {isImporting
                  ? t("dashboard.actions.importing")
                  : t("dashboard.actions.import")}
              </span>
            </button>

            <Link
              to="/graph-map"
              className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
              }`}
              title={t("dashboard.actions.graphMap")}
              aria-label={t("dashboard.actions.graphMap")}
            >
              <Network size={16} aria-hidden="true" />
              <span className="hidden lg:inline">
                {t("dashboard.actions.graphMap")}
              </span>
            </Link>

            <button
              onClick={onOpenAIGenerator}
              className="px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-600 hover:to-primary-600 text-white shadow-md transition-all text-sm font-medium min-h-[44px]"
              title={t("dashboard.actions.aiGenerate")}
              aria-label={t("dashboard.actions.aiGenerate")}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span className="hidden lg:inline">
                {t("dashboard.actions.aiGenerate")}
              </span>
            </button>
          </div>
        )}

        {/* Action Buttons - Mobile */}
        {isMobile && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              className="hidden"
              accept=".json,.md,.opml"
              aria-label={t("dashboard.actions.import")}
            />

            <button
              onClick={onOpenAIGenerator}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-600 hover:to-primary-600 text-white shadow-md transition-all text-sm font-medium"
              aria-label={t("dashboard.actions.aiGenerate")}
            >
              <Sparkles size={18} aria-hidden="true" />
              <span>{t("dashboard.actions.aiGenerate")}</span>
            </button>

            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="min-h-[44px] min-w-[44px] px-3 py-2.5 rounded-xl flex items-center justify-center border transition-all"
                aria-label={t("common.more")}
                aria-expanded={showMoreMenu}
                aria-haspopup="menu"
                aria-controls={moreMenuId}
              >
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>

              {showMoreMenu && (
                <div
                  id={moreMenuId}
                  className={`absolute right-0 top-full mt-2 w-40 rounded-xl border shadow-lg z-50 overflow-hidden ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-gray-200"
                  }`}
                  role="menu"
                  aria-activedescendant={`${moreMenuId}-item-${moreActiveIndex}`}
                  tabIndex={-1}
                >
                  {!isSelectMode && (
                    <button
                      id={`${moreMenuId}-item-0`}
                      onClick={() => {
                        enterSelectMode();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${moreActiveRing(0)} ${
                        isDark
                          ? "text-slate-300 hover:bg-slate-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      role="menuitem"
                      tabIndex={-1}
                    >
                      <CheckSquare size={18} aria-hidden="true" />
                      <span>{t("dashboard.actions.select")}</span>
                    </button>
                  )}

                  {isSelectMode && (
                    <button
                      id={`${moreMenuId}-item-0`}
                      onClick={() => {
                        exitSelectMode();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${moreActiveRing(0)} ${
                        isDark
                          ? "text-red-400 hover:bg-red-900/30"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      role="menuitem"
                      tabIndex={-1}
                    >
                      <X size={18} aria-hidden="true" />
                      <span>{t("dashboard.actions.cancelSelect")}</span>
                    </button>
                  )}

                  <button
                    id={`${moreMenuId}-item-1`}
                    onClick={onImportClick}
                    disabled={isImporting}
                    className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${moreActiveRing(1)} ${
                      isDark
                        ? "text-slate-300 hover:bg-slate-700"
                        : "text-gray-700 hover:bg-gray-50"
                    } disabled:opacity-50`}
                    role="menuitem"
                    tabIndex={-1}
                  >
                    <Upload size={18} aria-hidden="true" />
                    <span>
                      {isImporting
                        ? t("dashboard.actions.importing")
                        : t("dashboard.actions.import")}
                    </span>
                  </button>

                  <Link
                    id={`${moreMenuId}-item-2`}
                    to="/graph-map"
                    onClick={() => setShowMoreMenu(false)}
                    className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${moreActiveRing(2)} ${
                      isDark
                        ? "text-slate-300 hover:bg-slate-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    role="menuitem"
                    tabIndex={-1}
                  >
                    <Network size={18} aria-hidden="true" />
                    <span>{t("dashboard.actions.graphMap")}</span>
                  </Link>

                  <button
                    id={`${moreMenuId}-item-3`}
                    onClick={() => {
                      setFilterExpanded(!filterExpanded);
                      setShowMoreMenu(false);
                    }}
                    className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${moreActiveRing(3)} ${
                      filterExpanded
                        ? isDark
                          ? "text-primary-400 hover:bg-primary-900/20"
                          : "text-primary-600 hover:bg-primary-50"
                        : isDark
                          ? "text-slate-300 hover:bg-slate-700"
                          : "text-gray-700 hover:bg-gray-50"
                    }`}
                    role="menuitem"
                    tabIndex={-1}
                  >
                    <SlidersHorizontal size={18} aria-hidden="true" />
                    <span>{t("dashboard.filter.toggle")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter Row (collapsible with animation) */}
      <div
        id={filterPanelId}
        className={`flex flex-wrap items-center gap-3 rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${
          filterExpanded
            ? "max-h-[200px] opacity-100 px-4 py-3 border"
            : "max-h-0 opacity-0 px-0 py-0 border-0 pointer-events-none"
        } ${
          isDark
            ? "bg-primary-900/20 border-primary-800/30"
            : "bg-primary-50 border-primary-100"
        }`}
      >
        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {t("dashboard.sort.label")}
          </span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label={t("dashboard.sort.label")}
              className={`appearance-none pl-3 pr-9 py-1.5 rounded-lg border text-xs font-medium transition-all outline-none focus:ring-2 focus:ring-primary-500 min-h-[36px] ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-slate-200"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-700 dark:text-gray-100 shadow-sm"
              }`}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                isDark ? "text-slate-400" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Divider */}
        <div
          className={`w-px h-6 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
        />

        {/* Status Filter Chips */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("dashboard.filter.statusLabel")}
        >
          <span
            className={`text-xs font-medium mr-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {t("dashboard.filter.statusLabel")}
          </span>
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                  active
                    ? "bg-primary-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-500 shadow-sm"
                }`}
                aria-pressed={active}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div
          className={`w-px h-6 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
        />

        {/* Time Range Filter Chips */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("dashboard.filter.rangeLabel")}
        >
          <span
            className={`text-xs font-medium mr-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {t("dashboard.filter.rangeLabel")}
          </span>
          {TIME_RANGE_OPTIONS.map((opt) => {
            const active = timeRangeFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTimeRangeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                  active
                    ? "bg-primary-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-500 shadow-sm"
                }`}
                aria-pressed={active}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
