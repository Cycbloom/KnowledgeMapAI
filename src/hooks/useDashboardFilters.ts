import { useState, useMemo, useEffect, useRef } from "react";
import { usePersistedListState } from "./common/usePersistedListState";
import { useSearch } from "./common/useSearch";
import { useUrlSearchParams } from "./common/useUrlSearchParams";
import type { Graph } from "@shared/types";
import type { SearchResult } from "../services/api/search";

interface UseDashboardFiltersOptions {
  isMobile: boolean;
  graphs: Graph[];
}

export type ViewMode = "card" | "list";
export type SortBy = "updatedAt" | "createdAt" | "title" | "nodeCount";
export type StatusFilter = "all" | "active" | "archived";
export type TimeRangeFilter = "all" | "today" | "week" | "month";

// Activity threshold: graphs not updated in 30 days are considered "archived"
const ARCHIVED_THRESHOLD_DAYS = 30;

function getGraphTimestamp(graph: Graph): number {
  const dateStr = graph.updated_at ?? graph.created_at;
  return dateStr ? new Date(dateStr).getTime() : 0;
}

function isWithinDays(timestamp: number, days: number): boolean {
  if (timestamp === 0) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
}

export interface UseDashboardFiltersReturn {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: "keyword" | "semantic";
  setSearchMode: (mode: "keyword" | "semantic") => void;
  isSearching: boolean;
  searchResults: SearchResult | null;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;

  // Filter
  selectedFilterTags: string[];
  setSelectedFilterTags: (tags: string[]) => void;
  filteredGraphs: Graph[];

  // Sort & Filter
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  timeRangeFilter: TimeRangeFilter;
  setTimeRangeFilter: (filter: TimeRangeFilter) => void;

  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  paginatedGraphs: Graph[];
  graphsPerPage: number;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Selection
  isSelectMode: boolean;
  setIsSelectMode: (mode: boolean) => void;
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  selectedCount: number;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  enterSelectMode: () => void;
  exitSelectMode: () => void;

  // More menu
  showMoreMenu: boolean;
  setShowMoreMenu: (show: boolean) => void;
  moreMenuRef: React.RefObject<HTMLDivElement>;

  // FAB menu
  showFABMenu: boolean;
  setShowFABMenu: (show: boolean) => void;
  fabMenuRef: React.RefObject<HTMLDivElement>;
}

export function useDashboardFilters({
  isMobile,
  graphs,
}: UseDashboardFiltersOptions): UseDashboardFiltersReturn {
  const [currentPage, setCurrentPage] = usePersistedListState<number>(
    "dashboard-page",
    1,
  );
  const [selectedFilterTags, setSelectedFilterTags] = usePersistedListState<
    string[]
  >("dashboard-tags", []);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFABMenu, setShowFABMenu] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = usePersistedListState<SortBy>(
    "dashboard-sortBy",
    "updatedAt",
  );
  const [statusFilter, setStatusFilter] = usePersistedListState<StatusFilter>(
    "dashboard-statusFilter",
    "all",
  );
  const [timeRangeFilter, setTimeRangeFilter] = usePersistedListState<
    TimeRangeFilter
  >("dashboard-timeRangeFilter", "all");
  const [viewMode, setViewMode] = usePersistedListState<ViewMode>(
    "dashboard-view-mode",
    "card",
  );

  // URL 查询参数双向同步：viewMode / sortBy / statusFilter / timeRangeFilter
  // - 默认值不写入 URL（serialize 返回 undefined）
  // - mount 时 URL 优先于 localStorage（useUrlSearchParams 内部一次性同步）
  // - popstate（浏览器后退）反向更新 state
  type DashboardUrlSyncState = {
    viewMode: ViewMode;
    sortBy: SortBy;
    statusFilter: StatusFilter;
    timeRangeFilter: TimeRangeFilter;
  };
  useUrlSearchParams<DashboardUrlSyncState>(
    { viewMode, sortBy, statusFilter, timeRangeFilter },
    (partial) => {
      if (partial.viewMode !== undefined) setViewMode(partial.viewMode);
      if (partial.sortBy !== undefined) setSortBy(partial.sortBy);
      if (partial.statusFilter !== undefined) {
        setStatusFilter(partial.statusFilter);
      }
      if (partial.timeRangeFilter !== undefined) {
        setTimeRangeFilter(partial.timeRangeFilter);
      }
    },
    {
      fields: [
        {
          key: "viewMode",
          urlParam: "view",
          serialize: (v) => (v === "card" ? undefined : String(v)),
          deserialize: (s) =>
            s === "list" || s === "card" ? (s as ViewMode) : undefined,
        },
        {
          key: "sortBy",
          urlParam: "sort",
          serialize: (v) => (v === "updatedAt" ? undefined : String(v)),
          deserialize: (s) => {
            if (
              s === "updatedAt" ||
              s === "createdAt" ||
              s === "title" ||
              s === "nodeCount"
            ) {
              return s as SortBy;
            }
            return undefined;
          },
        },
        {
          key: "statusFilter",
          urlParam: "status",
          serialize: (v) => (v === "all" ? undefined : String(v)),
          deserialize: (s) => {
            if (s === "all" || s === "active" || s === "archived") {
              return s as StatusFilter;
            }
            return undefined;
          },
        },
        {
          key: "timeRangeFilter",
          urlParam: "timeRange",
          serialize: (v) => (v === "all" ? undefined : String(v)),
          deserialize: (s) => {
            if (s === "all" || s === "today" || s === "week" || s === "month") {
              return s as TimeRangeFilter;
            }
            return undefined;
          },
        },
      ],
    },
  );

  const graphsPerPage = isMobile ? 6 : viewMode === "list" ? 15 : 9;

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
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

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

  const filteredGraphs = useMemo(() => {
    let result = graphs;

    // Tag filter
    if (selectedFilterTags.length > 0) {
      result = result.filter((g) => {
        const graphTags = ((g as unknown) as { tags?: string[] }).tags || [];
        return selectedFilterTags.some((tag) => graphTags.includes(tag));
      });
    }

    // Status filter: active = updated within 30 days, archived = older
    if (statusFilter !== "all") {
      result = result.filter((g) => {
        const ts = getGraphTimestamp(g);
        const isActive = isWithinDays(ts, ARCHIVED_THRESHOLD_DAYS);
        return statusFilter === "active" ? isActive : !isActive;
      });
    }

    // Time range filter
    if (timeRangeFilter !== "all") {
      const daysMap: Record<Exclude<TimeRangeFilter, "all">, number> = {
        today: 1,
        week: 7,
        month: 30,
      };
      const days = daysMap[timeRangeFilter];
      result = result.filter((g) => isWithinDays(getGraphTimestamp(g), days));
    }

    // Sort: favorites first (primary), then by user-selected sortBy (secondary)
    result = [...result].sort((a, b) => {
      const aFav = a.is_favorite ? 0 : 1;
      const bFav = b.is_favorite ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      switch (sortBy) {
        case "createdAt": {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        }
        case "title": {
          const aTitle = (a.title ?? "").toLowerCase();
          const bTitle = (b.title ?? "").toLowerCase();
          return aTitle.localeCompare(bTitle);
        }
        case "nodeCount": {
          const aCount = a.nodes_count ?? 0;
          const bCount = b.nodes_count ?? 0;
          return bCount - aCount;
        }
        case "updatedAt":
        default: {
          const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bDate - aDate;
        }
      }
    });

    return result;
  }, [graphs, selectedFilterTags, sortBy, statusFilter, timeRangeFilter]);

  const totalPages = Math.ceil(filteredGraphs.length / graphsPerPage);
  const paginatedGraphs = useMemo(() => {
    const start = (currentPage - 1) * graphsPerPage;
    return filteredGraphs.slice(start, start + graphsPerPage);
  }, [filteredGraphs, currentPage, graphsPerPage]);

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

  return {
    // Search
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    isSearching,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    searchInputRef,

    // Filter
    selectedFilterTags,
    setSelectedFilterTags,
    filteredGraphs,

    // Sort & Filter
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter,
    timeRangeFilter,
    setTimeRangeFilter,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedGraphs,
    graphsPerPage,

    // View mode
    viewMode,
    setViewMode,

    // Selection
    isSelectMode,
    setIsSelectMode,
    selectedIds,
    isAllSelected,
    isPartialSelected,
    selectedCount,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    enterSelectMode,
    exitSelectMode,

    // More menu
    showMoreMenu,
    setShowMoreMenu,
    moreMenuRef,

    // FAB menu
    showFABMenu,
    setShowFABMenu,
    fabMenuRef,
  };
}
