import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  RefreshCw,
  Network,
  BookOpen,
  Layers,
  ArrowRightLeft,
  Globe,
  MoreHorizontal,
  ChevronDown,
  Filter,
  Palette,
  Tags,
  Settings,
} from "lucide-react";
import type { GraphMapFilterMode } from "../../types";
import { useIsMobile } from "../../hooks";
import type { DomainTreeNode } from "@shared/types/graph";
import { DomainFilter } from "./DomainFilter";

interface GraphMapToolbarProps {
  onBack: () => void;
  onRefresh: () => void;
  onDomainGenerate: () => void;
  onAutoClassify: () => void;
  onOpenStyleSettings: () => void;
  filterMode: GraphMapFilterMode;
  onFilterChange: (mode: GraphMapFilterMode) => void;
  graphCount: number;
  relationCount: number;
  isLoading?: boolean;
  fromGraphId?: string | null;
  fromGraphTitle?: string;
  onReturnToGraph?: () => void;
  domains?: DomainTreeNode[];
  selectedDomainIds?: Set<string>;
  onDomainSelectionChange?: (ids: Set<string>) => void;
  hoveredDomainId?: string | null;
  onHoverDomainChange?: (id: string | null) => void;
  onManageDomains?: () => void;
}

const GraphMapToolbarComponent: React.FC<GraphMapToolbarProps> = ({
  onBack,
  onRefresh,
  onDomainGenerate,
  onAutoClassify,
  onOpenStyleSettings,
  filterMode,
  onFilterChange,
  graphCount,
  relationCount,
  isLoading = false,
  fromGraphId,
  fromGraphTitle,
  onReturnToGraph,
  domains,
  selectedDomainIds,
  onDomainSelectionChange,
  hoveredDomainId,
  onHoverDomainChange,
  onManageDomains,
}) => {
  const { t } = useTranslation();
  const deviceInfo = useIsMobile();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isMobile = deviceInfo.isMobile;
  const isCompact = deviceInfo.screenWidth < 1280;

  const filterOptions: Array<{
    value: GraphMapFilterMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "all",
      label: t("graphMap.filter.all"),
      icon: <Layers className="w-4 h-4" />,
    },
    {
      value: "prerequisite",
      label: t("graphMap.filter.prerequisite"),
      icon: <Network className="w-4 h-4" />,
    },
    {
      value: "extension",
      label: t("graphMap.filter.extension"),
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      value: "related",
      label: t("graphMap.filter.related"),
      icon: <Network className="w-4 h-4" />,
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentFilter = filterOptions.find((f) => f.value === filterMode);

  const renderFilterButtonGroup = () => {
    if (isMobile) {
      return (
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Filter className="w-4 h-4" />
            <span className="max-w-[80px] truncate">
              {currentFilter?.label}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-500 z-50 min-w-[140px]">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onFilterChange(option.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                    filterMode === option.value
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {currentFilter?.icon}
            <span>{currentFilter?.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-500 z-50 min-w-[140px]">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onFilterChange(option.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                    filterMode === option.value
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterMode === option.value
                ? "bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    );
  };

  const renderActionButtons = () => {
    if (isMobile) {
      return (
        <div className="flex items-center gap-1">
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              aria-label={t("common.more")}
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>
            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-500 z-50 min-w-[160px]">
                <button
                  onClick={() => {
                    onRefresh();
                    setShowMoreMenu(false);
                  }}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 first:rounded-t-lg"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  {t("graphMap.toolbar.refresh")}
                </button>
                <button
                  onClick={() => {
                    onDomainGenerate();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                  <Globe className="w-4 h-4" />
                  {t("graphMap.toolbar.domainGenerate")}
                </button>
                <button
                  onClick={() => {
                    onAutoClassify();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                  <Tags className="w-4 h-4" />
                  {t("graphMap.toolbar.autoClassify")}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            title={t("graphMap.toolbar.refresh")}
            aria-label={t("graphMap.toolbar.refresh")}
          >
            <RefreshCw
              className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
          <button
            onClick={onDomainGenerate}
            className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
            title={t("graphMap.toolbar.domainGenerate")}
            aria-label={t("graphMap.toolbar.domainGenerate")}
          >
            <Globe className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={onAutoClassify}
            className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
            title={t("graphMap.toolbar.autoClassify")}
            aria-label={t("graphMap.toolbar.autoClassify")}
          >
            <Tags className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={onOpenStyleSettings}
            className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
            title={t("graphStyleSettings.title")}
            aria-label={t("graphStyleSettings.title")}
          >
            <Palette className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title={t("graphMap.toolbar.refresh")}
          aria-label={t("graphMap.toolbar.refresh")}
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>

        <button
          onClick={onDomainGenerate}
          className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          title={t("graphMap.toolbar.domainGenerate")}
          aria-label={t("graphMap.toolbar.domainGenerate")}
        >
          <Globe className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          onClick={onAutoClassify}
          className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          title={t("graphMap.toolbar.autoClassify")}
          aria-label={t("graphMap.toolbar.autoClassify")}
        >
          <Tags className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          onClick={onOpenStyleSettings}
          className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          title={t("graphStyleSettings.title")}
          aria-label={t("graphStyleSettings.title")}
        >
          <Palette className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <div
      role="toolbar"
      aria-label={t("common.aria.toolbar.graphMap")}
      className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-2 sm:px-4 gap-2"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <button
          onClick={onBack}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          title={t("common.back")}
          aria-label={t("common.back")}
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <Network className="w-5 h-5 text-primary-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {t("graphMap.title")}
          </h1>
        </div>

        {!isMobile && (
          <>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden lg:block flex-shrink-0" />

            <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:flex items-center whitespace-nowrap flex-shrink-0 gap-1.5">
              <span className="flex items-center gap-1">
                <Network className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {t("graphMap.stats.graphCount", { count: graphCount })}
                </span>
              </span>
              <span className="mx-0.5">·</span>
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {t("graphMap.stats.relationCount", { count: relationCount })}
                </span>
              </span>
            </div>

            {fromGraphId && onReturnToGraph && (
              <>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden xl:block flex-shrink-0" />
                <button
                  onClick={onReturnToGraph}
                  className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors text-sm font-medium max-w-[120px]"
                  title={fromGraphTitle || ""}
                >
                  <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{fromGraphTitle || ""}</span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {renderFilterButtonGroup()}
        {domains && domains.length > 0 && (
          <DomainFilter
            domains={domains}
            selectedDomainIds={selectedDomainIds || new Set()}
            onSelectionChange={onDomainSelectionChange || (() => {})}
            hoveredDomainId={hoveredDomainId}
            onHoverDomainChange={onHoverDomainChange}
          />
        )}
        {renderActionButtons()}
        {onManageDomains && domains && domains.length > 0 && (
          <button
            onClick={onManageDomains}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors rounded-lg"
            title={t("graphMap.toolbar.manageDomains")}
            aria-label={t("graphMap.toolbar.manageDomains")}
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

const areEqual = (prev: GraphMapToolbarProps, next: GraphMapToolbarProps) => {
  return (
    prev.filterMode === next.filterMode &&
    prev.graphCount === next.graphCount &&
    prev.relationCount === next.relationCount &&
    prev.isLoading === next.isLoading &&
    prev.fromGraphId === next.fromGraphId &&
    prev.fromGraphTitle === next.fromGraphTitle &&
    prev.onBack === next.onBack &&
    prev.onRefresh === next.onRefresh &&
    prev.onDomainGenerate === next.onDomainGenerate &&
    prev.onAutoClassify === next.onAutoClassify &&
    prev.onOpenStyleSettings === next.onOpenStyleSettings &&
    prev.onFilterChange === next.onFilterChange &&
    prev.onReturnToGraph === next.onReturnToGraph &&
    prev.onManageDomains === next.onManageDomains &&
    prev.domains === next.domains &&
    prev.selectedDomainIds === next.selectedDomainIds &&
    prev.onDomainSelectionChange === next.onDomainSelectionChange &&
    prev.hoveredDomainId === next.hoveredDomainId
  );
};

export const GraphMapToolbar = React.memo(GraphMapToolbarComponent, areEqual);
