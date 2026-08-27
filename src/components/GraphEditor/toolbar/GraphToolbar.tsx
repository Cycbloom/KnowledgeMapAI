import React, { useState, useEffect, useRef, useCallback, useId, useMemo, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Undo,
  Redo,
  List,
  Search,
  Sparkles,
  MessageSquare,
  Plus,
  Eraser,
  Trash2,
  Navigation,
  Grid,
  Settings,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Download,
  MoreHorizontal,
  ChevronDown,
  RefreshCw,
  HelpCircle,
  User,
  GraduationCap,
  Share2,
  Network,
  GitBranch,
  Clock,
  Palette,
  BookOpen,
  BarChart3,
  Layers,
  MonitorPlay,
  Headphones,
  Activity,
  Brain,
  ChevronRight,
  Globe,
  Keyboard,
  X,
  Eye,
  EyeOff,
  LayoutGrid,
  Map as MapIcon,
  GitMerge,
  History,
  FileQuestion,
  FileText,
  ScanSearch,
  ZoomIn,
  ZoomOut,
  Spline,
  type LucideIcon,
} from "lucide-react";
import { useTheme, useIsMobile } from "../../../hooks";
import { useEscapeKey, useShortcutLabel } from "../../../hooks/common";
import { ShortcutHint } from "../../common/ShortcutHint";
import { GraphSwitcher } from "./GraphSwitcher";
import { NodeLanguageSwitcher } from "../NodeLanguageSwitcher";
import {
  Node,
  ColorScheme,
  LinkStyle,
  LinkAnimation,
  GraphViewMode,
  GraphColorMode,
} from "../../../types";

interface GraphToolbarProps {
  // Navigation & History
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // View
  title: string;
  sidebarMode: "none" | "create" | "edit" | "outline" | "detail";
  setSidebarMode: (
    mode: "none" | "create" | "edit" | "outline" | "detail",
  ) => void;
  viewMode: GraphViewMode;
  setViewMode: (mode: GraphViewMode) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  isFocusMode: boolean;
  setIsFocusMode: (mode: boolean) => void;

  // Tools
  aiEnabled?: boolean;
  onAIExpand?: () => void;
  onBranchExplore?: () => void;
  onBackgroundTask?: (type: "expand_graph" | "batch_generate_questions") => void;
  onGenerateQuestions?: () => void;
  onImportOutline?: () => void;
  onFindSimilarNodes?: () => void;
  onSmartStyle?: () => void;
  onTranslateNodes?: () => void;

  // Semantic Embedding Generation
  onGenerateEmbeddings?: () => void;
  isGeneratingEmbeddings?: boolean;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  ragChatWidth?: number;
  isTutorMode?: boolean;
  onToggleTutorMode?: () => void;
  isPathfindingMode: boolean;
  setIsPathfindingMode: (mode: boolean) => void;
  pathfindingState: {
    startNode: Node | null;
    endNode: Node | null;
    pathLength: number;
    reset: () => void;
  };
  isExplorationMode: boolean;
  setIsExplorationMode: (mode: boolean) => void;
  coloringMode: GraphColorMode;
  setColoringMode: (mode: GraphColorMode) => void;
  isTimelineVisible: boolean;
  setIsTimelineVisible: (visible: boolean) => void;

  // Edit
  onAddNode: () => void;
  isDeleteMode: boolean;
  setIsDeleteMode: (mode: boolean) => void;
  selectedNodeIds: Set<string>;
  onDeleteSelected: () => void;
  onBatchDelete: () => void;
  batchDeleteProgress?: { completed: number; total: number } | null;
  onBatchColorUpdate?: (color: string) => void;
  onBatchLevelUpdate?: (level: string) => void;

  // Style Settings
  isStyleSettingsOpen: boolean;
  setIsStyleSettingsOpen: (open: boolean) => void;
  colorScheme: string;
  setColorScheme: (scheme: ColorScheme) => void;
  linkStyle: string;
  setLinkStyle: (style: LinkStyle) => void;
  linkAnimation: string;
  setLinkAnimation: (animation: LinkAnimation) => void;

  // Settings & Export
  onOpenSettings: () => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (open: boolean) => void;
  exportActions: {
    onMarkdown: () => void;
    onPPT: () => void;
    onPDF: () => void;
    onJSON: () => void;
    onImage: () => void;
    onAnki: () => void;
    onDeleteGraph: () => void;
  };
  onRefresh?: () => void;
  onOpenHelp?: () => void;
  onOpenShortcutSettings?: () => void;
  onReplayTutorial?: () => void;
  dataTour?: string;
  onShare?: () => void;
  onOpenAnalysis?: () => void;
  onOpenConceptAggregation?: () => void;

  // Presentation
  onTogglePresentation?: () => void;
  onTogglePodcast?: () => void;

  // Mobile Preview Mode
  isMobilePreviewMode?: boolean;
  setIsMobilePreviewMode?: (mode: boolean) => void;

  // RAG Chat Panel
  isRAGChatOpen?: boolean;

  // Read-only mode
  isReadOnly?: boolean;

  isVersionHistoryOpen?: boolean;
  setIsVersionHistoryOpen?: (open: boolean) => void;

  // Region Control (Quadrant View)
  regions?: Array<{
    id: string;
    name: string;
    color: string;
    icon?: string;
    nodes: Array<{ id: string }>;
  }>;
  collapsedRegions?: string[];
  onRegionToggle?: (regionId: string) => void;

  // Graph Switcher
  currentGraphId?: string;
  currentGraphTitle?: string;

  // Zoom controls
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;

  // Edge display mode
  edgeDisplayMode?: "full" | "simplified" | "hidden";
  setEdgeDisplayMode?: (mode: "full" | "simplified" | "hidden") => void;
}

function areEqual(prev: GraphToolbarProps, next: GraphToolbarProps): boolean {
  // 1. Deep comparison for complex types where shallow equality is insufficient

  // selectedNodeIds: Set<string> - new Set instance may have same values
  if (prev.selectedNodeIds !== next.selectedNodeIds) {
    if (prev.selectedNodeIds.size !== next.selectedNodeIds.size) return false;
    for (const id of prev.selectedNodeIds) {
      if (!next.selectedNodeIds.has(id)) return false;
    }
  }

  // pathfindingState: object with nested values
  if (prev.pathfindingState !== next.pathfindingState) {
    if (
      prev.pathfindingState.startNode !== next.pathfindingState.startNode ||
      prev.pathfindingState.endNode !== next.pathfindingState.endNode ||
      prev.pathfindingState.pathLength !== next.pathfindingState.pathLength ||
      prev.pathfindingState.reset !== next.pathfindingState.reset
    )
      {return false;}
  }

  // exportActions: object with function properties
  if (prev.exportActions !== next.exportActions) {
    if (
      prev.exportActions.onMarkdown !== next.exportActions.onMarkdown ||
      prev.exportActions.onPPT !== next.exportActions.onPPT ||
      prev.exportActions.onPDF !== next.exportActions.onPDF ||
      prev.exportActions.onJSON !== next.exportActions.onJSON ||
      prev.exportActions.onImage !== next.exportActions.onImage ||
      prev.exportActions.onAnki !== next.exportActions.onAnki ||
      prev.exportActions.onDeleteGraph !== next.exportActions.onDeleteGraph
    )
      {return false;}
  }

  // regions: array of objects
  if (prev.regions !== next.regions) {
    const p = prev.regions;
    const n = next.regions;
    if (!p || !n) return p === n;
    if (p.length !== n.length) return false;
    for (let i = 0; i < p.length; i++) {
      if (p[i] !== n[i]) {
        if (
          p[i].id !== n[i].id ||
          p[i].name !== n[i].name ||
          p[i].color !== n[i].color ||
          p[i].nodes !== n[i].nodes
        )
          {return false;}
      }
    }
  }

  // collapsedRegions: string[]
  if (prev.collapsedRegions !== next.collapsedRegions) {
    const p = prev.collapsedRegions;
    const n = next.collapsedRegions;
    if (!p || !n) return p === n;
    if (p.length !== n.length) return false;
    for (let i = 0; i < p.length; i++) {
      if (p[i] !== n[i]) return false;
    }
  }

  // 2. Shallow comparison for all remaining props (primitives & stable references)
  const specialKeys = new Set([
    "selectedNodeIds",
    "pathfindingState",
    "exportActions",
    "regions",
    "collapsedRegions",
  ]);

  const keys = Object.keys(prev) as (keyof GraphToolbarProps)[];
  for (const key of keys) {
    if (specialKeys.has(key)) continue;
    if (prev[key] !== next[key]) return false;
  }

  return true;
}

/**
 * 工具栏下拉相关组件的共享上下文。
 * 这些组件必须定义在模块顶层（而非 GraphToolbarBase 渲染函数体内），
 * 否则每次工具栏重渲染（如画布滚轮缩放更新 zoomLevel）都会导致组件被卸载重建，
 * 下拉框的入场动画（animate-in fade-in zoom-in-95）逐帧重放，产生视觉闪动。
 */
type ToolbarDropdownId = "edit" | "ai" | "system" | "view";

interface ToolbarContextValue {
  openDropdown: ToolbarDropdownId | null;
  setOpenDropdown: React.Dispatch<React.SetStateAction<ToolbarDropdownId | null>>;
  isDark: boolean;
}

const ToolbarContext = createContext<ToolbarContextValue | null>(null);

const useToolbarContext = (): ToolbarContextValue => {
  const ctx = useContext(ToolbarContext);
  if (!ctx) {
    throw new Error("Toolbar dropdown components must be used within ToolbarContext.Provider");
  }
  return ctx;
};

const Divider = () => {
  const { isDark } = useToolbarContext();
  return (
    <div className={`w-px h-6 mx-1 flex-shrink-0 ${isDark ? "bg-slate-600" : "bg-gray-300"}`} />
  );
};

const MenuItem = ({
  onClick,
  icon: Icon,
  label,
  active,
  colorClass,
  activeClass,
  disabled,
  children,
  keepOpenOnChildClick,
  keepDropdownOpen,
  subMenuOpen,
  onSubMenuToggle,
  shortcutHint,
}: {
  onClick?: () => void;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  active?: boolean;
  colorClass?: string;
  activeClass?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  keepOpenOnChildClick?: boolean;
  keepDropdownOpen?: boolean;
  subMenuOpen?: boolean;
  onSubMenuToggle?: () => void;
  shortcutHint?: string | null;
}) => {
  const { isDark, setOpenDropdown } = useToolbarContext();
  const [internalSubMenuOpen, setInternalSubMenuOpen] = useState(false);
  const [subMenuPosition, setSubMenuPosition] = useState({
    horizontal: "right" as "right" | "left",
    maxHeight: undefined as number | undefined,
  });
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const isOpen =
    keepOpenOnChildClick && subMenuOpen !== undefined
      ? subMenuOpen
      : internalSubMenuOpen;

  const handleToggle = keepOpenOnChildClick
    ? onSubMenuToggle || (() => setInternalSubMenuOpen(!internalSubMenuOpen))
    : undefined;

  // 检测子菜单位置和可用空间
  useEffect(() => {
    if (isOpen && menuContainerRef.current) {
      const rect = menuContainerRef.current.getBoundingClientRect();
      const submenuWidth = 192; // w-48 = 12rem = 192px
      const padding = 8;

      // 水平方向：右侧空间不足则翻转到左侧
      const horizontal: "right" | "left" =
        rect.right + submenuWidth > window.innerWidth ? "left" : "right";

      // 垂直方向：计算可用高度，确保不超出视口底部
      const availableHeight = window.innerHeight - rect.top - padding;
      const maxHeight = availableHeight < 400 ? availableHeight : undefined;

      setSubMenuPosition({ horizontal, maxHeight });
    }
  }, [isOpen]);

  // 清理关闭定时器
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleOpen = useCallback(() => {
    if (children && !keepOpenOnChildClick) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      setInternalSubMenuOpen(true);
    }
  }, [children, keepOpenOnChildClick]);

  const handleClose = useCallback(() => {
    if (children && !keepOpenOnChildClick) {
      closeTimerRef.current = setTimeout(() => {
        setInternalSubMenuOpen(false);
      }, 150);
    }
  }, [children, keepOpenOnChildClick]);

  return (
    <div
      ref={menuContainerRef}
      className="relative w-full"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <button
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (children && keepOpenOnChildClick) {
            handleToggle?.();
          } else if (!children) {
            onClick?.();
            if (!keepDropdownOpen) {
              setOpenDropdown(null);
            }
          }
        }}
        aria-pressed={active}
        className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          disabled
            ? isDark
              ? "text-slate-600 cursor-not-allowed"
              : "text-gray-300 cursor-not-allowed"
            : active
              ? activeClass ||
                (isDark
                  ? "bg-primary-900/30 text-primary-400"
                  : "bg-primary-50 text-primary-600")
              : `${isDark ? "hover:bg-slate-700" : "hover:bg-gray-50"} ${colorClass || (isDark ? "text-gray-300" : "text-gray-700")}`
        }`}
      >
        <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
        <span className="flex-grow text-left font-medium">{label}</span>
        {shortcutHint && (
          <kbd
            className={`hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border mr-1 ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-400"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            {shortcutHint}
          </kbd>
        )}
        {children && (
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={`opacity-50 transition-transform ${isOpen && keepOpenOnChildClick ? "rotate-90" : ""}`}
          />
        )}
      </button>

      {children && isOpen && (
        <div
          className={`absolute top-0 ${
            subMenuPosition.horizontal === "right"
              ? "left-full ml-1"
              : "right-full mr-1"
          } p-2 rounded-xl shadow-2xl border w-48 z-50 flex flex-col gap-1 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-gray-100"
              : "bg-white border-gray-200 text-gray-800"
          } animate-in fade-in ${
            subMenuPosition.horizontal === "right"
              ? "slide-in-from-left-2"
              : "slide-in-from-right-2"
          } duration-150`}
          style={{
            maxHeight: subMenuPosition.maxHeight
              ? `${subMenuPosition.maxHeight}px`
              : undefined,
            overflowY: subMenuPosition.maxHeight ? "auto" : undefined,
          }}
          onClick={(e) => {
            if (keepOpenOnChildClick) {
              e.stopPropagation();
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const DropdownButton = ({
  id,
  icon: Icon,
  label,
  children,
  active,
}: {
  id: ToolbarDropdownId;
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  active?: boolean;
}) => {
  const { openDropdown, setOpenDropdown, isDark } = useToolbarContext();
  const [dropdownPosition, setDropdownPosition] = useState({
    horizontal: "left" as "left" | "right",
    vertical: "below" as "below" | "above",
    maxHeight: undefined as number | undefined,
  });
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const dropdownContentId = useId();

  useEffect(() => {
    if (openDropdown === id && dropdownContainerRef.current) {
      const rect = dropdownContainerRef.current.getBoundingClientRect();
      const dropdownWidth = 224; // w-56 = 14rem = 224px
      const dropdownMaxHeight = 400; // 预估最大高度
      const padding = 8;

      // 水平方向：右侧空间不足则右对齐
      const horizontal: "left" | "right" =
        rect.left + dropdownWidth > window.innerWidth ? "right" : "left";

      // 垂直方向：下方空间不足则翻转到上方
      const spaceBelow = window.innerHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      const vertical: "below" | "above" =
        spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow
          ? "above"
          : "below";

      // 计算最大高度，确保不超出视口
      const availableHeight = vertical === "below" ? spaceBelow : spaceAbove;
      const maxHeight =
        availableHeight < dropdownMaxHeight ? availableHeight : undefined;

      setDropdownPosition({ horizontal, vertical, maxHeight });
    }
  }, [openDropdown, id]);

  return (
    <div
      ref={dropdownContainerRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
        aria-haspopup="menu"
        aria-expanded={openDropdown === id}
        aria-controls={dropdownContentId}
        className={`flex items-center space-x-1 px-2 py-1.5 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          active || openDropdown === id
            ? isDark
              ? "bg-primary-900/40 text-primary-400"
              : "bg-primary-50 text-primary-600"
            : isDark
              ? "text-gray-300 hover:bg-slate-700"
              : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon size={20} aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-200 ${openDropdown === id ? "rotate-180" : ""}`}
        />
      </button>

      {openDropdown === id && (
        <div
          id={dropdownContentId}
          className={`absolute ${
            dropdownPosition.vertical === "below"
              ? "top-full mt-2"
              : "bottom-full mb-2"
          } ${
            dropdownPosition.horizontal === "left" ? "left-0" : "right-0"
          } p-2 rounded-xl shadow-2xl border w-56 z-50 flex flex-col gap-1 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-gray-100"
              : "bg-white border-gray-200 text-gray-800"
          } animate-in fade-in zoom-in-95 duration-150`}
          style={{
            maxHeight: dropdownPosition.maxHeight
              ? `${dropdownPosition.maxHeight}px`
              : undefined,
            overflowY: dropdownPosition.maxHeight ? "auto" : undefined,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const BatchMenu = ({
  selectedNodeIds,
  onBatchDelete,
  batchDeleteProgress,
  onBatchColorUpdate,
  onBatchLevelUpdate,
}: {
  selectedNodeIds: Set<string>;
  onBatchDelete: () => void;
  batchDeleteProgress?: { completed: number; total: number } | null;
  onBatchColorUpdate?: (color: string) => void;
  onBatchLevelUpdate?: (level: string) => void;
}) => {
  const { isDark } = useToolbarContext();
  const { t } = useTranslation();
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
  const batchMenuId = useId();

  if (selectedNodeIds.size <= 1) return null;

  return (
    <div
      className="relative"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setIsBatchMenuOpen(!isBatchMenuOpen)}
        aria-expanded={isBatchMenuOpen}
        aria-haspopup="menu"
        aria-controls={batchMenuId}
        aria-label={t("graphEditor.toolbar.batchMenu")}
        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          isBatchMenuOpen
            ? "bg-primary-600 text-white"
            : isDark
              ? "bg-primary-900/40 text-primary-300 border border-primary-800/50 hover:bg-primary-800/60"
              : "bg-primary-50 text-primary-600 border border-primary-100 hover:bg-primary-100"
        }`}
        title={t("graphEditor.toolbar.batchOperations")}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        <span className="text-xs font-bold">
          {t("graphEditor.toolbar.batchCount", { count: selectedNodeIds.size })}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${isBatchMenuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isBatchMenuOpen && (
        <div
          id={batchMenuId}
          className={`absolute top-full left-0 mt-2 shadow-2xl rounded-xl border w-60 py-2 z-50 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-gray-100"
              : "bg-white border-gray-200 text-gray-800"
          } animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
            <span>{t("graphEditor.toolbar.batchOperations")}</span>
            <span className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {t("graphEditor.toolbar.nodeCount", { count: selectedNodeIds.size })}
            </span>
          </div>
          <div className="border-t my-1 border-gray-100 dark:border-slate-500"></div>

          {/* Batch Color */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-2.5 font-bold flex items-center gap-1.5">
              <div className="w-1 h-3 bg-primary-500 rounded-full"></div>
              {t("graphEditor.toolbar.modifyColor")}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                "var(--primary-500)",
                "#10B981",
                "#F59E0B",
                "#EF4444",
                "var(--tertiary-500)",
                "#EC4899",
                "var(--slate-500)",
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onBatchColorUpdate?.(color);
                    setIsBatchMenuOpen(false);
                  }}
                  className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white dark:hover:border-slate-400 hover:scale-125 transition-all shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="border-t my-1 border-gray-100 dark:border-slate-500"></div>

          {/* Batch Level */}
          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-500 mb-2.5 font-bold flex items-center gap-1.5">
              <div className="w-1 h-3 bg-green-500 rounded-full"></div>
              {t("graphEditor.toolbar.modifyLevel")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "root", label: t("graphEditor.toolbar.levelRoot") },
                { id: "core", label: t("graphEditor.toolbar.levelCore") },
                { id: "sub", label: t("graphEditor.toolbar.levelSub") },
                { id: "normal", label: t("graphEditor.toolbar.levelNormal") },
                { id: "leaf", label: t("graphEditor.toolbar.levelLeaf") },
              ].map((level) => (
                <button
                  key={level.id}
                  onClick={() => {
                    onBatchLevelUpdate?.(level.id);
                    setIsBatchMenuOpen(false);
                  }}
                  className={`px-2 py-1.5 text-[10px] rounded-lg border font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-50"} ${isDark ? "border-slate-700 text-gray-300" : "border-gray-200 text-gray-600"}`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t my-1 border-gray-100 dark:border-slate-500"></div>
          <div className="px-2 pt-1">
            <button
              onClick={() => {
                onBatchDelete();
                setIsBatchMenuOpen(false);
              }}
              disabled={!!batchDeleteProgress}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>
                {batchDeleteProgress
                  ? t('tasks.progress.deleting', {
                      completed: batchDeleteProgress.completed,
                      total: batchDeleteProgress.total,
                    })
                  : t('graphEditor.toolbar.batchDeleteSelected')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const GraphToolbarBase: React.FC<GraphToolbarProps> = ({
  onBack,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  sidebarMode,
  setSidebarMode,
  viewMode,
  setViewMode,
  showGrid,
  setShowGrid,
  isFocusMode,
  setIsFocusMode,
  aiEnabled,
  onAIExpand,
  onBranchExplore,
  onBackgroundTask,
  onGenerateQuestions,
  onImportOutline,
  onFindSimilarNodes,
  onSmartStyle,
  onTranslateNodes,
  onGenerateEmbeddings,
  isGeneratingEmbeddings,
  isChatOpen,
  setIsChatOpen,
  isPathfindingMode,
  setIsPathfindingMode,
  pathfindingState,
  onAddNode,
  isDeleteMode,
  setIsDeleteMode,
  selectedNodeIds,
  onDeleteSelected,
  onBatchDelete,
  batchDeleteProgress,
  onBatchColorUpdate,
  onBatchLevelUpdate,
  isStyleSettingsOpen,
  setIsStyleSettingsOpen,
  colorScheme: _colorScheme,
  setColorScheme: _setColorScheme,
  linkStyle: _linkStyle,
  setLinkStyle: _setLinkStyle,
  linkAnimation: _linkAnimation,
  setLinkAnimation: _setLinkAnimation,
  onOpenSettings,
  isExportMenuOpen: _isExportMenuOpen,
  setIsExportMenuOpen: _setIsExportMenuOpen,
  exportActions,
  onRefresh,
  onOpenHelp,
  onOpenShortcutSettings,
  onReplayTutorial,
  dataTour,
  onShare,
  isExplorationMode,
  setIsExplorationMode,
  coloringMode,
  setColoringMode,
  isTimelineVisible,
  setIsTimelineVisible,
  isTutorMode: _isTutorMode,
  onToggleTutorMode: _onToggleTutorMode,
  onOpenAnalysis,
  onOpenConceptAggregation,
  onTogglePresentation,
  onTogglePodcast,
  isMobilePreviewMode,
  setIsMobilePreviewMode,
  isRAGChatOpen,
  ragChatWidth = 420,
  isReadOnly = false,
  isVersionHistoryOpen,
  setIsVersionHistoryOpen,
  regions,
  collapsedRegions,
  onRegionToggle,
  currentGraphId,
  currentGraphTitle,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  edgeDisplayMode = "full",
  setEdgeDisplayMode,
}) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile } = useIsMobile();
  const { t } = useTranslation();
  // 预构建折叠区域集合，将渲染路径的折叠判断由 O(regions*collapsedRegions) 降为 O(1)
  const collapsedRegionSet = useMemo(
    () => new Set(collapsedRegions ?? []),
    [collapsedRegions]
  );
  const [openDropdown, setOpenDropdown] = useState<
    "edit" | "ai" | "system" | "view" | null
  >(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<
    "ai" | "view" | "more" | null
  >(null);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

  useEffect(() => {
    if (openDropdown !== "view") {
      setIsSubMenuOpen(false);
    }
  }, [openDropdown]);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEscapeKey(() => setOpenDropdown(null), !!openDropdown);

  // 供模块级下拉组件消费的上下文值（必须保持引用稳定，避免无关重渲染）
  const toolbarContextValue = useMemo(
    () => ({ openDropdown, setOpenDropdown, isDark }),
    [openDropdown, isDark]
  );

  // Shortcut labels for dropdown menu items
  const searchShortcut = useShortcutLabel("search");
  const toggleGridShortcut = useShortcutLabel("toggle-grid");
  const toggleFocusModeShortcut = useShortcutLabel("toggle-focus-mode");
  const toggleThemeShortcut = useShortcutLabel("toggle-theme");
  const toggleDeleteModeShortcut = useShortcutLabel("toggle-delete-mode");
  const togglePathfindingShortcut = useShortcutLabel("toggle-pathfinding-mode");
  const toggleExplorationShortcut = useShortcutLabel("toggle-exploration-mode");
  const aiChatShortcut = useShortcutLabel("ai-chat");
  const aiExpandShortcut = useShortcutLabel("ai-expand");
  const settingsShortcut = useShortcutLabel("settings");
  const helpShortcut = useShortcutLabel("help");
  const exportShortcut = useShortcutLabel("export");
  const viewMindmapShortcut = useShortcutLabel("view-mindmap");
  const viewTimelineShortcut = useShortcutLabel("view-timeline");
  const viewTreeShortcut = useShortcutLabel("view-tree");
  const viewPlanetShortcut = useShortcutLabel("view-planet");

  const themeClasses = {
    container: isDark
      ? "bg-slate-800/90 border-slate-700 text-gray-100"
      : "bg-white/90 border-gray-200 text-gray-800",
    button: {
      default: isDark
        ? "text-gray-300 hover:bg-slate-700"
        : "text-gray-600 hover:bg-gray-100",
      active: isDark
        ? "bg-primary-900/50 text-primary-400"
        : "bg-primary-50 text-primary-600",
      disabled: isDark
        ? "text-slate-600 cursor-not-allowed"
        : "text-gray-300 cursor-not-allowed",
    },
    divider: isDark ? "bg-slate-600" : "bg-gray-300",
    input: isDark
      ? "bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:ring-primary-500"
      : "bg-white border-gray-300 text-gray-800",
    dropdown: isDark
      ? "bg-slate-800 border-slate-700 text-gray-100"
      : "bg-white border-gray-200 text-gray-800",
    itemHover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-50",
  };

  // 注意：以渲染函数（小写 + 直接调用）而非内联组件形式使用，
  // 避免每次工具栏重渲染时被当作新组件类型卸载重建（导致动画重放/状态丢失）。
  const renderMobileBottomNav = () => {
    const navItems = [
      { icon: ArrowLeft, label: t("graphEditor.toolbar.back"), onClick: onBack },
      { icon: Plus, label: t("graphEditor.toolbar.add"), onClick: onAddNode },
      {
        icon: isMobilePreviewMode ? Eye : EyeOff,
        label: isMobilePreviewMode ? t("graphEditor.toolbar.preview") : t("graphEditor.toolbar.details"),
        onClick: () => setIsMobilePreviewMode?.(!isMobilePreviewMode),
        active: isMobilePreviewMode,
      },
      {
        icon: Sparkles,
        label: "AI",
        onClick: () => setMobileMenuOpen(mobileMenuOpen === "ai" ? null : "ai"),
        active: isChatOpen || isPathfindingMode,
      },
      {
        icon: MoreHorizontal,
        label: t("graphEditor.toolbar.more"),
        onClick: () =>
          setMobileMenuOpen(mobileMenuOpen === "more" ? null : "more"),
      },
    ];

    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 ${
          isDark
            ? "bg-slate-900/95 border-slate-700"
            : "bg-white/95 border-gray-200"
        } border-t backdrop-blur-lg pb-[var(--safe-area-inset-bottom)]`}
      >
        <div className="flex justify-around items-center h-14 px-1">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                item.active ||
                (mobileMenuOpen !== null &&
                  navItems.find((n) => n.label === item.label)?.onClick ===
                    item.onClick)
                  ? isDark
                    ? "text-primary-400 bg-slate-800"
                    : "text-primary-600 bg-primary-50"
                  : isDark
                    ? "text-gray-400 active:bg-slate-800"
                    : "text-gray-600 active:bg-gray-100"
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <item.icon size={20} aria-hidden="true" />
              <span className="text-[10px] mt-0.5 font-medium">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  interface MobileMenuItem {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    active?: boolean;
    color?: string;
    disabled?: boolean;
    show?: boolean;
  }

  const renderMobileBottomSheet = ({
    type,
    onClose,
  }: {
    type: "ai" | "view" | "more";
    onClose: () => void;
  }) => {
    const menuItems: Record<"ai" | "view" | "more", MobileMenuItem[]> = {
      ai: [
        {
          icon: Navigation,
          label: t("graphEditor.toolbar.intelligentExpand"),
          onClick: () => {
            if (selectedNodeIds.size === 1 && onAIExpand) {
              onAIExpand();
            }
            onClose();
          },
          disabled: selectedNodeIds.size !== 1,
          color: "text-green-500",
        },
        {
          icon: MessageSquare,
          label: t("graphEditor.toolbar.intelligentQnA"),
          onClick: () => {
            setIsChatOpen(!isChatOpen);
            onClose();
          },
          active: isChatOpen,
          color: "text-primary-500",
        },
        {
          icon: Navigation,
          label: isPathfindingMode ? t("graphEditor.toolbar.exitPathfinding") : t("graphEditor.toolbar.pathfinding"),
          onClick: () => {
            setIsPathfindingMode(!isPathfindingMode);
            pathfindingState.reset();
            onClose();
          },
          active: isPathfindingMode,
        },
      ],
      view: [
        {
          icon: GraduationCap,
          label: t("graphEditor.toolbar.outlineLearningMode"),
          onClick: () => {
            navigate(`/learning?graph_id=${id}`);
            onClose();
          },
          color: "text-primary-600",
        },
        {
          icon: Network,
          label: t("graphEditor.toolbar.mindmap"),
          onClick: () => {
            setViewMode("mindmap");
            onClose();
          },
          active: viewMode === "mindmap",
          color: "text-primary-600",
        },
        {
          icon: Clock,
          label: t("graphEditor.toolbar.timeline"),
          onClick: () => {
            setViewMode("timeline");
            onClose();
          },
          active: viewMode === "timeline",
          color: "text-primary-600",
        },
        {
          icon: GitBranch,
          label: t("graphEditor.toolbar.treeView"),
          onClick: () => {
            setViewMode("tree");
            onClose();
          },
          active: viewMode === "tree",
          color: "text-primary-600",
        },
        {
          icon: Globe,
          label: t("graphEditor.toolbar.knowledgePlanet"),
          onClick: () => {
            setViewMode("planet");
            onClose();
          },
          active: viewMode === "planet",
          color: "text-primary-600",
        },
        {
          icon: MapIcon,
          label: t("graphEditor.toolbar.semantic"),
          onClick: () => {
            setViewMode("semantic");
            onClose();
          },
          active: viewMode === "semantic",
          color: "text-primary-600",
        },
        {
          icon: LayoutGrid,
          label: t("graphEditor.toolbar.quadrant"),
          onClick: () => {
            setViewMode("quadrant");
            onClose();
          },
          active: viewMode === "quadrant",
          color: "text-primary-600",
        },
        {
          icon: List,
          label: t("graphEditor.toolbar.sidebarOutline"),
          onClick: () => {
            setSidebarMode(sidebarMode === "outline" ? "none" : "outline");
            onClose();
          },
          active: sidebarMode === "outline",
        },
        {
          icon: GitBranch,
          label: isExplorationMode ? t("graphEditor.toolbar.exitExplorationMode") : t("graphEditor.toolbar.explorationMode"),
          onClick: () => {
            setIsExplorationMode(!isExplorationMode);
            onClose();
          },
          active: isExplorationMode,
          color: "text-primary-600",
        },
        {
          icon: Grid,
          label: showGrid ? t("graphEditor.toolbar.hideGrid") : t("graphEditor.toolbar.showGrid"),
          onClick: () => {
            setShowGrid(!showGrid);
            onClose();
          },
          active: showGrid,
        },
        {
          icon: Maximize,
          label: t("graphEditor.toolbar.focusMode"),
          onClick: () => {
            setIsFocusMode(true);
            onClose();
          },
        },
      ],
      more: [
        {
          icon: Settings,
          label: t("graphEditor.toolbar.graphSettings"),
          onClick: () => {
            onOpenSettings();
            onClose();
          },
        },
        {
          icon: Palette,
          label: t("graphEditor.toolbar.styleSettings"),
          onClick: () => {
            setIsStyleSettingsOpen(true);
            onClose();
          },
          active: isStyleSettingsOpen,
        },
        {
          icon: isDark ? Sun : Moon,
          label: isDark ? t("graphEditor.toolbar.lightMode") : t("graphEditor.toolbar.darkMode"),
          onClick: () => {
            toggleTheme();
            onClose();
          },
        },
        {
          icon: Download,
          label: t("graphEditor.toolbar.exportMarkdownAction"),
          onClick: () => {
            exportActions.onMarkdown();
            onClose();
          },
        },
        {
          icon: BookOpen,
          label: t("graphEditor.toolbar.exportAnkiAction"),
          onClick: () => {
            exportActions.onAnki();
            onClose();
          },
        },
        {
          icon: Download,
          label: t("graphEditor.toolbar.exportPDFAction"),
          onClick: () => {
            exportActions.onPDF();
            onClose();
          },
        },
        {
          icon: Download,
          label: t("graphEditor.toolbar.exportJSONAction"),
          onClick: () => {
            exportActions.onJSON();
            onClose();
          },
        },
        {
          icon: Download,
          label: t("graphEditor.toolbar.exportImageAction"),
          onClick: () => {
            exportActions.onImage();
            onClose();
          },
        },
        {
          icon: Share2,
          label: t("graphEditor.toolbar.shareGraph"),
          onClick: () => {
            onShare?.();
            onClose();
          },
          show: !!onShare,
        },
        {
          icon: HelpCircle,
          label: t("graphEditor.toolbar.helpGuide"),
          onClick: () => {
            onOpenHelp?.();
            onClose();
          },
          show: !!onOpenHelp,
        },
        {
          icon: RefreshCw,
          label: t("graphEditor.toolbar.refreshData"),
          onClick: () => {
            onRefresh?.();
            onClose();
          },
          show: !!onRefresh,
        },
        {
          icon: Trash2,
          label: t("graphEditor.toolbar.deleteGraph"),
          onClick: () => {
            exportActions.onDeleteGraph();
            onClose();
          },
          color: "text-red-500",
        },
      ].filter((item) => item.show !== false),
    };

    const items = menuItems[type];

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal-overlay"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40" />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`absolute bottom-0 left-0 right-0 rounded-t-2xl ${
            isDark ? "bg-slate-900" : "bg-white"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div
              className={`w-10 h-1 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-300"}`}
            />
          </div>
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <h3
                className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {type === "ai"
                  ? t("graphEditor.toolbar.aiAssistantSheet")
                  : type === "view"
                    ? t("graphEditor.toolbar.viewOptions")
                    : t("graphEditor.toolbar.moreFunctions")}
              </h3>
              <button
                onClick={onClose}
                className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
                aria-label={t("graphEditor.toolbar.closeMenu")}
              >
                <X
                  size={18}
                  aria-hidden="true"
                  className={isDark ? "text-gray-400" : "text-gray-500"}
                />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pb-8">
            <div className="px-2 py-2 space-y-1">
              {items.map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-4 min-h-[52px] rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                    item.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : item.active
                        ? isDark
                          ? "bg-primary-900/30 text-primary-400"
                          : "bg-primary-50 text-primary-600"
                        : isDark
                          ? "hover:bg-slate-800 active:bg-slate-700"
                          : "hover:bg-gray-50 active:bg-gray-100"
                  } ${item.color || (isDark ? "text-gray-300" : "text-gray-700")}`}
                  aria-label={item.label}
                >
                  <item.icon size={22} aria-hidden="true" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </motion.div>
      </motion.div>
    );
  };

  // Render logic based on responsive state
  if (isFocusMode) {
    if (isMobile) {
      return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setIsFocusMode(false)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md transition-all shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              isDark
                ? "bg-slate-800/90 hover:bg-slate-700 text-white"
                : "bg-white/90 hover:bg-gray-100 text-gray-800"
            }`}
            title={t("graphEditor.toolbar.exitFocusModeTitle")}
          >
            <Minimize size={18} aria-hidden="true" />
            <span className="text-sm font-medium">{t("graphEditor.toolbar.exitFocusMode")}</span>
          </button>
        </div>
      );
    }
    return (
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => setIsFocusMode(false)}
          className={`p-2 rounded-full backdrop-blur-sm transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
            isDark
              ? "bg-slate-800/20 hover:bg-slate-800/90 text-white hover:text-primary-400"
              : "bg-white/20 hover:bg-white/90 text-white hover:text-gray-800"
          }`}
          title={t("graphEditor.toolbar.exitFocusModeTitle")}
          aria-label={t("graphEditor.toolbar.exitFocusModeAria")}
        >
          <Minimize size={18} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        {renderMobileBottomNav()}
        <AnimatePresence>
          {mobileMenuOpen &&
            renderMobileBottomSheet({
              type: mobileMenuOpen,
              onClose: () => setMobileMenuOpen(null),
            })}
        </AnimatePresence>
      </>
    );
  }

  // Desktop Layout - Priority Sorted with Dropdowns
  return (
    <ToolbarContext.Provider value={toolbarContextValue}>
    <div
      data-tour={dataTour}
      role="toolbar"
      aria-label={t("common.aria.toolbar.graph")}
      className={`absolute top-4 left-4 p-2 rounded-xl shadow-lg flex items-center space-x-2 z-30 backdrop-blur-md border transition-transform duration-300 ${themeClasses.container}`}
      style={{
        transform: isRAGChatOpen ? `translateX(${ragChatWidth}px)` : undefined,
      }}
    >
      {/* 1. Navigation & Basic Info (Always visible) */}
      <div className="flex items-center">
        <ShortcutHint actionId="navigate-back">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${themeClasses.button.default}`}
            title={t("graphEditor.toolbar.back")}
            aria-label={t("graphEditor.toolbar.back")}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        </ShortcutHint>
        <Divider />
        <div className="flex items-center space-x-1 px-1">
          <ShortcutHint actionId="undo">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${!canUndo ? themeClasses.button.disabled : themeClasses.button.default}`}
              title={t("graphEditor.toolbar.undo")}
              aria-label={t("graphEditor.toolbar.undo")}
            >
              <Undo size={18} aria-hidden="true" />
            </button>
          </ShortcutHint>
          <ShortcutHint actionId="redo">
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${!canRedo ? themeClasses.button.disabled : themeClasses.button.default}`}
              title={t("graphEditor.toolbar.redo")}
              aria-label={t("graphEditor.toolbar.redo")}
            >
              <Redo size={18} aria-hidden="true" />
            </button>
          </ShortcutHint>
        </div>
      </div>

      <Divider />

      {/* Graph Switcher */}
      <GraphSwitcher
        currentGraphId={currentGraphId ?? id}
        currentGraphTitle={currentGraphTitle}
      />

      <Divider />

      {/* 2. Edit Tools Dropdown - Hidden in read-only mode */}
      {!isReadOnly && (
        <div className="flex items-center space-x-2">
          <DropdownButton
            id="edit"
            icon={Plus}
            label={t("graphEditor.toolbar.edit")}
            active={isDeleteMode || selectedNodeIds.size > 0}
          >
            <MenuItem
              onClick={onAddNode}
              icon={Plus}
              label={t("graphEditor.toolbar.addNode")}
              colorClass="text-primary-500"
            />
            <MenuItem
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              icon={Eraser}
              label={
                isDeleteMode
                  ? t("graphEditor.toolbar.exitDeleteMode")
                  : t("graphEditor.toolbar.deleteMode")
              }
              active={isDeleteMode}
              activeClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              shortcutHint={toggleDeleteModeShortcut}
            />
            <MenuItem
              onClick={onDeleteSelected}
              disabled={selectedNodeIds.size !== 1}
              icon={Trash2}
              label={t("graphEditor.toolbar.deleteSelectedNode")}
              colorClass="text-red-500"
            />
          </DropdownButton>

          {/* Share Button */}
          {onShare && (
            <button
              onClick={onShare}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                isDark
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-800/60"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              }`}
              title={t("graphEditor.toolbar.shareGraph")}
              aria-label={t("graphEditor.toolbar.shareGraph")}
            >
              <Share2 size={16} aria-hidden="true" />
              <span className="text-xs font-bold hidden xl:inline">
                {t("graphEditor.toolbar.share")}
              </span>
            </button>
          )}

          {/* AI Expand Shortcut - Visible when 1 node selected */}
          {selectedNodeIds.size === 1 && onAIExpand && (
            <button
              onClick={onAIExpand}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm animate-in fade-in zoom-in-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                isDark
                  ? "bg-primary-900/40 text-primary-300 border border-primary-700/50 hover:bg-primary-800/60"
                  : "bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
              }`}
              title={t("graphEditor.toolbar.aiExpandTitle")}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span className="text-xs font-bold">
                {t("graphEditor.toolbar.infiniteExpand")}
              </span>
            </button>
          )}

          {/* Branch Explore Shortcut - Visible when exploration mode and 1 node selected */}
          {isExplorationMode &&
            selectedNodeIds.size === 1 &&
            onBranchExplore && (
              <button
                onClick={onBranchExplore}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm animate-in fade-in zoom-in-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                  isDark
                    ? "bg-primary-900/40 text-primary-300 border border-primary-700/50 hover:bg-primary-800/60"
                    : "bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
                }`}
                title={t("graphEditor.toolbar.branchSuggestionTitle")}
              >
                <GitBranch size={16} aria-hidden="true" />
                <span className="text-xs font-bold">
                  {t("graphEditor.toolbar.exploreBranch")}
                </span>
              </button>
            )}

          {selectedNodeIds.size > 1 && (
            <>
              <div
                className={`w-px h-6 mx-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
              />
              <BatchMenu
                selectedNodeIds={selectedNodeIds}
                onBatchDelete={onBatchDelete}
                batchDeleteProgress={batchDeleteProgress}
                onBatchColorUpdate={onBatchColorUpdate}
                onBatchLevelUpdate={onBatchLevelUpdate}
              />
            </>
          )}
        </div>
      )}

      {/* Share Button - Visible in read-only mode */}
      {isReadOnly && onShare && (
        <button
          onClick={onShare}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
            isDark
              ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-800/60"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
          }`}
          title={t("graphEditor.toolbar.shareGraph")}
          aria-label={t("graphEditor.toolbar.shareGraph")}
        >
          <Share2 size={16} aria-hidden="true" />
          <span className="text-xs font-bold hidden xl:inline">
            {t("graphEditor.toolbar.share")}
          </span>
        </button>
      )}

      <Divider />

      {/* 3. AI Tools Dropdown - Hidden in read-only mode */}
      {!isReadOnly && (
        <DropdownButton
          id="ai"
          icon={Sparkles}
          label={t("graphEditor.toolbar.aiAssistant")}
          active={isChatOpen || isPathfindingMode}
        >
          <MenuItem
            onClick={() => {
              if (selectedNodeIds.size === 1 && onAIExpand) {
                onAIExpand();
              }
            }}
            disabled={selectedNodeIds.size !== 1}
            icon={Navigation}
            label={t("graphEditor.toolbar.intelligentExpand")}
            colorClass="text-green-500"
            shortcutHint={aiExpandShortcut}
          />
          <MenuItem
            onClick={() => {
              if (selectedNodeIds.size === 1 && onBackgroundTask) {
                onBackgroundTask("expand_graph");
              }
            }}
            disabled={selectedNodeIds.size !== 1 || !onBackgroundTask}
            icon={Sparkles}
            label={t("graphEditor.toolbar.backgroundExpand")}
            colorClass="text-primary-500"
          />
          <MenuItem
            onClick={onGenerateEmbeddings}
            disabled={!onGenerateEmbeddings || isGeneratingEmbeddings}
            icon={Brain}
            label={t("graphEditor.toolbar.generateEmbeddings")}
            colorClass="text-violet-500"
          />
          <MenuItem
            onClick={() => setIsChatOpen(!isChatOpen)}
            icon={MessageSquare}
            label={t("graphEditor.toolbar.intelligentQnA")}
            active={isChatOpen}
            colorClass="text-primary-500"
            shortcutHint={aiChatShortcut}
          />
          <MenuItem
            onClick={onImportOutline}
            disabled={!onImportOutline}
            icon={FileText}
            label={t("graphEditor.toolbar.importOutline")}
            colorClass="text-cyan-500"
          />
          <MenuItem
            onClick={onFindSimilarNodes}
            disabled={!onFindSimilarNodes}
            icon={ScanSearch}
            label={t("graphEditor.toolbar.findSimilarNodes")}
            colorClass="text-amber-500"
          />
          <MenuItem
            onClick={onSmartStyle}
            disabled={!onSmartStyle}
            icon={Palette}
            label={t("graphEditor.toolbar.smartStyle")}
            colorClass="text-pink-500"
          />
          <MenuItem
            onClick={onTranslateNodes}
            disabled={!onTranslateNodes}
            icon={Globe}
            label={t("graphEditor.toolbar.translateNodes")}
            colorClass="text-violet-500"
          />
          <MenuItem
            onClick={onGenerateQuestions}
            disabled={!onGenerateQuestions || selectedNodeIds.size !== 1}
            icon={FileQuestion}
            label={t("graphEditor.toolbar.generateQuestions")}
            colorClass="text-orange-500"
          />
          <MenuItem
            onClick={() => {
              setIsPathfindingMode(!isPathfindingMode);
              pathfindingState.reset();
            }}
            icon={Navigation}
            label={
              isPathfindingMode
                ? t("graphEditor.toolbar.exitPathfinding")
                : t("graphEditor.toolbar.pathfinding")
            }
            active={isPathfindingMode}
            shortcutHint={togglePathfindingShortcut}
          />
        </DropdownButton>
      )}

      <Divider />

      {/* 4. View Tools Dropdown */}
      <DropdownButton
        id="view"
        icon={List}
        label={t("graphEditor.toolbar.view")}
      >
        <MenuItem
          onClick={() => navigate(`/learning?graph_id=${id}`)}
          icon={GraduationCap}
          label={t("graphEditor.toolbar.outlineLearningMode")}
          colorClass="text-primary-600"
        />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">
            {t("graphEditor.toolbar.viewModes")}
          </div>
          <div className="space-y-1">
            {[
              {
                mode: "mindmap" as const,
                label: t("graphEditor.toolbar.mindmap"),
                icon: Network,
                shortcut: viewMindmapShortcut,
              },
              {
                mode: "timeline" as const,
                label: t("graphEditor.toolbar.timeline"),
                icon: Clock,
                shortcut: viewTimelineShortcut,
              },
              {
                mode: "tree" as const,
                label: t("graphEditor.toolbar.treeView"),
                icon: GitBranch,
                shortcut: viewTreeShortcut,
              },
              {
                mode: "planet" as const,
                label: t("graphEditor.toolbar.knowledgePlanet"),
                icon: Globe,
                shortcut: viewPlanetShortcut,
              },
              {
                mode: "semantic" as const,
                label: t("graphEditor.toolbar.semantic"),
                icon: MapIcon,
              },
              {
                mode: "quadrant" as const,
                label: t("graphEditor.toolbar.quadrant"),
                icon: LayoutGrid,
              },
            ].map(({ mode, label, icon: Icon, shortcut }) => (
              <MenuItem
                key={mode}
                onClick={() => setViewMode(mode)}
                icon={Icon}
                label={label}
                active={viewMode === mode}
                colorClass="text-primary-600"
                shortcutHint={shortcut}
              />
            ))}
          </div>
        </div>
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">
            {t("graphEditor.toolbar.nodeLanguage")}
          </div>
          <NodeLanguageSwitcher />
        </div>
        {viewMode === "quadrant" && regions && regions.length > 0 && (
          <>
            <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
            <MenuItem
              icon={Layers}
              label={t("graphEditor.toolbar.regionControl")}
              keepOpenOnChildClick
              subMenuOpen={isSubMenuOpen}
              onSubMenuToggle={() => setIsSubMenuOpen(!isSubMenuOpen)}
            >
              {regions.map((region) => {
                const isCollapsed = collapsedRegionSet.has(region.id);
                const nodeCount = region.nodes.length;
                return (
                  <button
                    key={region.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegionToggle?.(region.id);
                    }}
                    aria-pressed={!isCollapsed}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                      isDark
                        ? "hover:bg-slate-700 text-gray-300"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        isCollapsed
                          ? "border-gray-400 bg-transparent"
                          : "border-primary-500 bg-primary-500"
                      }`}
                    >
                      {!isCollapsed && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: region.color }}
                    />
                    <span className="flex-1 text-left truncate">
                      {region.icon ? `${region.icon} ` : ""}
                      {region.name}
                    </span>
                    <span
                      className={`text-xs ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      ({nodeCount})
                    </span>
                  </button>
                );
              })}
            </MenuItem>
          </>
        )}
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem
          onClick={() =>
            setSidebarMode(sidebarMode === "outline" ? "none" : "outline")
          }
          icon={List}
          label={t("graphEditor.toolbar.sidebarOutline")}
          active={sidebarMode === "outline"}
        />
        <MenuItem
          onClick={() => setSidebarMode("outline")}
          icon={Search}
          label={t("graphEditor.toolbar.searchNodes")}
          shortcutHint={searchShortcut}
        />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem
          onClick={() => setIsExplorationMode(!isExplorationMode)}
          icon={GitBranch}
          label={
            isExplorationMode
              ? t("graphEditor.toolbar.exitExplorationMode")
              : t("graphEditor.toolbar.explorationMode")
          }
          active={isExplorationMode}
          colorClass="text-primary-600"
          shortcutHint={toggleExplorationShortcut}
        />

        <MenuItem
          keepDropdownOpen
          onClick={() => {
            const nextMode: Record<string, GraphColorMode> = {
              level: "status",
              status: "heatmap",
              heatmap: "decay",
              decay: "level",
            };
            setColoringMode(nextMode[coloringMode] || "level");
          }}
          icon={
            coloringMode === "level"
              ? Layers
              : coloringMode === "status"
                ? Activity
                : coloringMode === "heatmap"
                  ? BarChart3
                  : Brain
          }
          label={
            coloringMode === "level"
              ? t("graphEditor.toolbar.coloringModeLevel")
              : coloringMode === "status"
                ? t("graphEditor.toolbar.coloringModeStatus")
                : coloringMode === "heatmap"
                  ? t("graphEditor.toolbar.coloringModeHeatmap")
                  : t("graphEditor.toolbar.coloringModeDecay")
          }
          colorClass={
            coloringMode === "level"
              ? "text-primary-500"
              : coloringMode === "status"
                ? "text-orange-500"
                : coloringMode === "heatmap"
                  ? "text-red-500"
                  : "text-emerald-500"
          }
        />

        {isExplorationMode && (
          <MenuItem
            onClick={() => setIsTimelineVisible(!isTimelineVisible)}
            icon={Clock}
            label={
              isTimelineVisible
                ? t("graphEditor.toolbar.hideTimeline")
                : t("graphEditor.toolbar.showTimeline")
            }
            active={isTimelineVisible}
            colorClass="text-primary-500"
          />
        )}
        {isExplorationMode && (
          <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        )}
        <MenuItem
          onClick={onTogglePresentation}
          icon={MonitorPlay}
          label={t("graphEditor.toolbar.presentationMode")}
          colorClass="text-orange-500"
          disabled={!onTogglePresentation}
        />
        <MenuItem
          onClick={onTogglePodcast}
          icon={Headphones}
          label={t("graphEditor.toolbar.podcastMode")}
          colorClass="text-pink-500"
          disabled={!onTogglePodcast}
        />
      </DropdownButton>

      <button
        onClick={() => setIsVersionHistoryOpen?.(!isVersionHistoryOpen)}
        className={`flex items-center space-x-1 px-2 py-1.5 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          isVersionHistoryOpen
            ? isDark
              ? "bg-primary-900/40 text-primary-400"
              : "bg-primary-50 text-primary-600"
            : themeClasses.button.default
        }`}
        title={t("graphEditor.toolbar.versionHistory")}
        aria-label={t("graphEditor.toolbar.versionHistory")}
      >
        <History size={18} aria-hidden="true" />
        <span className="text-sm font-medium hidden xl:inline">{t("graphEditor.toolbar.versionHistory")}</span>
      </button>

      {/* Zoom Controls */}
      {onZoomIn && onZoomOut && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            <ShortcutHint actionId="zoom-out">
              <button
                onClick={onZoomOut}
                className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${themeClasses.button.default}`}
                title={t("graphEditor.mindMap.zoomOut")}
                aria-label={t("graphEditor.mindMap.zoomOut")}
              >
                <ZoomOut size={18} aria-hidden="true" />
              </button>
            </ShortcutHint>
            <ShortcutHint actionId="zoom-reset">
              <button
                onClick={() => onZoomReset?.()}
                className={`px-2 py-1 rounded-lg text-xs font-medium tabular-nums min-w-[3.5rem] text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${themeClasses.button.default}`}
                title={t("graphEditor.mindMap.resetView")}
                aria-label={t("graphEditor.mindMap.resetView")}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
            </ShortcutHint>
            <ShortcutHint actionId="zoom-in">
              <button
                onClick={onZoomIn}
                className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${themeClasses.button.default}`}
                title={t("graphEditor.mindMap.zoomIn")}
                aria-label={t("graphEditor.mindMap.zoomIn")}
              >
                <ZoomIn size={18} aria-hidden="true" />
              </button>
            </ShortcutHint>
          </div>
        </>
      )}

      {/* Edge Display Mode Toggle */}
      {setEdgeDisplayMode && (
        <div
          className="relative"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const next: Record<string, "full" | "simplified" | "hidden"> = {
                full: "simplified",
                simplified: "hidden",
                hidden: "full",
              };
              setEdgeDisplayMode(next[edgeDisplayMode] || "full");
            }}
            className={`flex items-center space-x-1 px-2 py-1.5 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              edgeDisplayMode !== "full"
                ? isDark
                  ? "bg-primary-900/40 text-primary-400"
                  : "bg-primary-50 text-primary-600"
                : themeClasses.button.default
            }`}
            title={t("graphEditor.toolbar.edgeDisplayMode")}
            aria-label={t("graphEditor.toolbar.edgeDisplayMode")}
          >
            <Spline size={18} aria-hidden="true" />
            <span className="text-xs font-medium hidden xl:inline">
              {edgeDisplayMode === "full"
                ? t("graphEditor.toolbar.edgeFull")
                : edgeDisplayMode === "simplified"
                  ? t("graphEditor.toolbar.edgeSimplified")
                  : t("graphEditor.toolbar.edgeHidden")}
            </span>
          </button>
        </div>
      )}

      {/* AI Status Badge */}
      {aiEnabled === false && (
        <>
          <Divider />
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all animate-pulse focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              isDark
                ? "bg-amber-900/40 text-amber-300 border border-amber-700/50 hover:bg-amber-800/60"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
            title={t("graphEditor.toolbar.demoModeTitle")}
          >
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span>{t("graphEditor.toolbar.demoMode")}</span>
          </button>
        </>
      )}

      <Divider />

      {/* 5. System & Settings Dropdown */}
      <DropdownButton
        id="system"
        icon={Settings}
        label={t("graphEditor.toolbar.settings")}
      >
        <MenuItem
          onClick={onRefresh}
          icon={RefreshCw}
          label={t("graphEditor.toolbar.refreshData")}
          disabled={!onRefresh}
        />
        <MenuItem
          onClick={onOpenHelp}
          icon={HelpCircle}
          label={t("graphEditor.toolbar.helpGuide")}
          disabled={!onOpenHelp}
          shortcutHint={helpShortcut}
        />
        <MenuItem
          onClick={onReplayTutorial}
          icon={GraduationCap}
          label={t("graphEditor.toolbar.replayTutorial")}
          disabled={!onReplayTutorial}
        />
        <MenuItem
          onClick={onOpenShortcutSettings}
          icon={Keyboard}
          label={t("graphEditor.toolbar.shortcutSettings")}
          disabled={!onOpenShortcutSettings}
        />
        <MenuItem
          onClick={() => navigate("/profile")}
          icon={User}
          label={t("graphEditor.toolbar.personalSettings")}
        />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem
          onClick={() => setIsStyleSettingsOpen(true)}
          icon={Palette}
          label={t("graphEditor.toolbar.styleSettings")}
          active={isStyleSettingsOpen}
        />
        <MenuItem
          onClick={() => setShowGrid(!showGrid)}
          icon={Grid}
          label={
            showGrid
              ? t("graphEditor.toolbar.hideGrid")
              : t("graphEditor.toolbar.showGrid")
          }
          active={showGrid}
          shortcutHint={toggleGridShortcut}
        />
        <MenuItem
          onClick={toggleTheme}
          icon={isDark ? Sun : Moon}
          label={
            isDark
              ? t("graphEditor.toolbar.lightMode")
              : t("graphEditor.toolbar.darkMode")
          }
          shortcutHint={toggleThemeShortcut}
        />
        <MenuItem
          onClick={() => setIsFocusMode(true)}
          icon={Maximize}
          label={t("graphEditor.toolbar.focusMode")}
          shortcutHint={toggleFocusModeShortcut}
        />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem
          onClick={onOpenSettings}
          icon={Settings}
          label={t("graphEditor.toolbar.graphSettings")}
          shortcutHint={settingsShortcut}
        />
        <MenuItem
          onClick={onOpenAnalysis}
          icon={BarChart3}
          label={t("graphEditor.toolbar.graphAnalysis")}
          disabled={!onOpenAnalysis}
        />
        <MenuItem
          onClick={onOpenConceptAggregation}
          icon={GitMerge}
          label={t("graphEditor.toolbar.conceptAggregation")}
          disabled={!onOpenConceptAggregation}
        />

        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>

        <MenuItem icon={Download} label={t("graphEditor.toolbar.exportGraph")} shortcutHint={exportShortcut}>
          <MenuItem
            onClick={exportActions.onMarkdown}
            icon={Download}
            label={t("graphEditor.toolbar.exportMarkdown")}
          />
          <MenuItem
            onClick={exportActions.onPPT}
            icon={Download}
            label={t("graphEditor.toolbar.exportPPT")}
          />
          <MenuItem
            onClick={exportActions.onAnki}
            icon={BookOpen}
            label={t("graphEditor.toolbar.exportAnki")}
          />
          <MenuItem
            onClick={exportActions.onPDF}
            icon={Download}
            label={t("graphEditor.toolbar.exportPDF")}
          />
          <MenuItem
            onClick={exportActions.onJSON}
            icon={Download}
            label={t("graphEditor.toolbar.exportJSON")}
          />
          <MenuItem
            onClick={exportActions.onImage}
            icon={Download}
            label={t("graphEditor.toolbar.exportImage")}
          />
        </MenuItem>

        {/* Delete graph - Hidden in read-only mode */}
        {!isReadOnly && (
          <>
            <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
            <MenuItem
              onClick={exportActions.onDeleteGraph}
              icon={Trash2}
              label={t("graphEditor.toolbar.deleteGraph")}
              colorClass="text-red-500"
            />
          </>
        )}
      </DropdownButton>
    </div>
    </ToolbarContext.Provider>
  );
};

export const GraphToolbar = React.memo(GraphToolbarBase, areEqual);
