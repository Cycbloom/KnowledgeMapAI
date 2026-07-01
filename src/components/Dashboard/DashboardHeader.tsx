import React from "react";
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
} from "lucide-react";
import { SearchResults } from "../common";
import type {
  UseDashboardFiltersReturn,
  SortBy,
  StatusFilter,
  TimeRangeFilter,
} from "../../hooks/useDashboardFilters";
import type { Graph } from "@shared/types";

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
}

const SORT_OPTIONS: { value: SortBy; labelKey: string }[] = [
  { value: "updatedAt", labelKey: "dashboard.sort.updatedAt" },
  { value: "createdAt", labelKey: "dashboard.sort.createdAt" },
  { value: "title", labelKey: "dashboard.sort.title" },
  { value: "nodeCount", labelKey: "dashboard.sort.nodeCount" },
];

const STATUS_OPTIONS: { value: StatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "dashboard.filter.statusAll" },
  { value: "active", labelKey: "dashboard.filter.statusActive" },
  { value: "archived", labelKey: "dashboard.filter.statusArchived" },
];

const TIME_RANGE_OPTIONS: { value: TimeRangeFilter; labelKey: string }[] = [
  { value: "all", labelKey: "dashboard.filter.rangeAll" },
  { value: "today", labelKey: "dashboard.filter.rangeToday" },
  { value: "week", labelKey: "dashboard.filter.rangeWeek" },
  { value: "month", labelKey: "dashboard.filter.rangeMonth" },
];

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
}) => {
  const { t } = useTranslation();

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
                      {graphs.reduce(
                        (acc, g) => acc + (g.nodes_count || 0),
                        0,
                      )}
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
                      {graphs.reduce(
                        (acc, g) => acc + (g.nodes_count || 0),
                        0,
                      )}
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
                : "bg-white border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-sm placeholder:text-gray-400"
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1" role="group" aria-label={t("dashboard.search.searchMode")}>
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
            />

            {/* View Toggle */}
            <div
              className={`flex items-center rounded-xl border overflow-hidden ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-200 shadow-sm"
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
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
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

            <button
              onClick={onImportClick}
              disabled={isImporting}
              className={`px-3 lg:px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium min-h-[44px] ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
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
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
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
              >
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>

              {showMoreMenu && (
                <div
                  className={`absolute right-0 top-full mt-2 w-40 rounded-xl border shadow-lg z-50 overflow-hidden ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-gray-200"
                  }`}
                  role="menu"
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
                      role="menuitem"
                    >
                      <CheckSquare size={18} aria-hidden="true" />
                      <span>{t("dashboard.actions.select")}</span>
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
                      role="menuitem"
                    >
                      <X size={18} aria-hidden="true" />
                      <span>{t("dashboard.actions.cancelSelect")}</span>
                    </button>
                  )}

                  <button
                    onClick={onImportClick}
                    disabled={isImporting}
                    className={`w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                      isDark
                        ? "text-slate-300 hover:bg-slate-700"
                        : "text-gray-700 hover:bg-gray-50"
                    } disabled:opacity-50`}
                    role="menuitem"
                  >
                    <Upload size={18} aria-hidden="true" />
                    <span>
                      {isImporting
                        ? t("dashboard.actions.importing")
                        : t("dashboard.actions.import")}
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
                    role="menuitem"
                  >
                    <Network size={18} aria-hidden="true" />
                    <span>{t("dashboard.actions.graphMap")}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Row 3: Sort + Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label={t("dashboard.sort.label")}
            className={`appearance-none pl-3 pr-9 py-2 rounded-xl border text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-primary-500 min-h-[40px] ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-200"
                : "bg-white border-gray-200 text-gray-700 shadow-sm"
            }`}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
              isDark ? "text-slate-400" : "text-gray-400"
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Status Filter Chips */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("dashboard.filter.statusLabel")}
        >
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
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
                }`}
                aria-pressed={active}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Time Range Filter Chips */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("dashboard.filter.rangeLabel")}
        >
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
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
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
    </div>
  );
};
