import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Circle,
  GitBranch,
  Box,
  Leaf,
  Network,
  Sparkles,
  Check,
  X,
  Info,
} from "lucide-react";
import type { NodeLevel } from "../../types";
import { EmptyState } from "../common/EmptyState";

export interface HierarchyNode {
  id: string;
  title: string;
  children?: HierarchyNode[];
  level: NodeLevel;
  confidence?: number;
}

export interface HierarchySuggestion {
  id: string;
  parentId: string;
  childId: string;
  parentTitle: string;
  childTitle: string;
  confidence: number;
  reason?: string;
}

export interface HierarchyTreeViewProps {
  hierarchyData: HierarchyNode[];
  suggestions: HierarchySuggestion[];
  onNodeClick: (nodeId: string) => void;
  onConfirmRelation: (suggestionId: string) => void;
  onRejectRelation: (suggestionId: string) => void;
  onDragDrop?: (parentId: string, childId: string) => void;
  selectedNodeId?: string;
}

const LEVEL_ICONS: Record<NodeLevel, React.ReactNode> = {
  root: <Network size={14} />,
  core: <GitBranch size={14} />,
  sub: <Box size={14} />,
  normal: <Circle size={14} />,
  leaf: <Leaf size={14} />,
};

const LEVEL_LABEL_KEYS = {
  root: "conceptAggregation.hierarchy.level.root",
  core: "conceptAggregation.hierarchy.level.core",
  sub: "conceptAggregation.hierarchy.level.sub",
  normal: "conceptAggregation.hierarchy.level.normal",
  leaf: "conceptAggregation.hierarchy.level.leaf",
} as const satisfies Record<NodeLevel, string>;

const LEVEL_COLORS: Record<NodeLevel, string> = {
  root: "text-purple-500",
  core: "text-red-500",
  sub: "text-amber-500",
  normal: "text-blue-500",
  leaf: "text-emerald-500",
};

const LEVEL_BG_COLORS: Record<NodeLevel, string> = {
  root: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  core: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  sub: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  normal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  leaf: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

type ConfidenceLevel = "high" | "medium" | "low";

function getConfidenceLevel(confidence?: number): ConfidenceLevel {
  if (confidence === undefined) return "high";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

function getConfidenceBorderStyle(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "border-l-2 border-l-slate-300 dark:border-l-slate-600";
    case "medium":
      return "border-l-2 border-l-dashed border-l-slate-300 dark:border-l-slate-600";
    case "low":
      return "border-l-2 border-l-dotted border-l-slate-200 dark:border-l-slate-700";
  }
}

function getConfidenceOpacity(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "opacity-100";
    case "medium":
      return "opacity-80";
    case "low":
      return "opacity-50";
  }
}

interface FlatNode {
  node: HierarchyNode;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
}

function flattenVisibleNodes(
  nodes: HierarchyNode[],
  expandedIds: Set<string>,
  depth = 0,
  parentId: string | null = null,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    result.push({ node, depth, parentId, hasChildren, isExpanded });
    if (hasChildren && isExpanded && node.children) {
      result.push(
        ...flattenVisibleNodes(node.children, expandedIds, depth + 1, node.id),
      );
    }
  }
  return result;
}

interface TreeNodeProps {
  node: HierarchyNode;
  depth: number;
  expandedIds: Set<string>;
  selectedNodeId?: string;
  suggestions: HierarchySuggestion[];
  onToggle: (id: string) => void;
  onNodeClick: (nodeId: string) => void;
  onConfirmRelation: (suggestionId: string) => void;
  onRejectRelation: (suggestionId: string) => void;
  focusedNodeId?: string;
  siblingsCount: number;
  indexInSiblings: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  expandedIds,
  selectedNodeId,
  suggestions,
  onToggle,
  onNodeClick,
  onConfirmRelation,
  onRejectRelation,
  focusedNodeId,
  siblingsCount,
  indexInSiblings,
}) => {
  const { t } = useTranslation();
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isFocused = focusedNodeId === node.id;
  const hasChildren = node.children !== undefined && node.children.length > 0;
  const confidenceLevel = getConfidenceLevel(node.confidence);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipId = useId();
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.focus();
      nodeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isFocused]);

  const nodeSuggestions = useMemo(
    () => suggestions.filter((s) => s.parentId === node.id),
    [suggestions, node.id],
  );

  return (
    <div className="select-none">
      <div
        ref={nodeRef}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-setsize={siblingsCount}
        aria-posinset={indexInSiblings}
        aria-selected={isSelected}
        aria-describedby={tooltipId}
        tabIndex={isFocused ? 0 : -1}
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 ${
          isSelected
            ? "bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500/30"
            : ""
        } ${getConfidenceOpacity(confidenceLevel)}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <ChevronRight size={14} className="text-slate-400" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <span className={`flex-shrink-0 ${LEVEL_COLORS[node.level]}`}>
          {LEVEL_ICONS[node.level]}
        </span>

        <span
          className={`flex-1 text-sm truncate max-w-[180px] ${
            isSelected
              ? "font-medium text-primary-700 dark:text-primary-300"
              : "text-slate-700 dark:text-slate-300"
          }`}
        >
          {node.title}
        </span>

        {node.confidence !== undefined && node.confidence < 1 && (
          <Sparkles
            size={12}
            className={`flex-shrink-0 ${
              confidenceLevel === "high"
                ? "text-amber-500"
                : confidenceLevel === "medium"
                  ? "text-orange-400"
                  : "text-slate-400"
            }`}
          />
        )}

        {hasChildren && (
          <span
            className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full ${LEVEL_BG_COLORS[node.level]}`}
          >
            {node.children?.length}
          </span>
        )}

        <span
          className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${LEVEL_BG_COLORS[node.level]}`}
        >
          {t(LEVEL_LABEL_KEYS[node.level])}
        </span>

        {showTooltip && (
          <div
            role="tooltip"
            id={tooltipId}
            className="absolute z-50 left-full ml-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-500 w-56"
          >
            <div className="space-y-1.5">
              <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
                {node.title}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className={LEVEL_COLORS[node.level]}>
                  {LEVEL_ICONS[node.level]}
                </span>
                <span>{t(LEVEL_LABEL_KEYS[node.level])}</span>
              </div>
              {node.confidence !== undefined && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("conceptAggregation.hierarchy.confidence")}{" "}
                  <span
                    className={
                      confidenceLevel === "high"
                        ? "text-green-500"
                        : confidenceLevel === "medium"
                          ? "text-amber-500"
                          : "text-slate-400"
                    }
                  >
                    {(node.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {hasChildren && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("conceptAggregation.hierarchy.childCount", { count: node.children?.length ?? 0 })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {nodeSuggestions.length > 0 && isExpanded && (
        <div className="ml-6 mr-2 mb-1 space-y-1">
          {nodeSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`flex items-center gap-2 p-2 rounded-lg text-xs border transition-colors ${
                getConfidenceLevel(suggestion.confidence) === "low"
                  ? "border-dotted border-slate-200 dark:border-slate-500 opacity-60"
                  : getConfidenceLevel(suggestion.confidence) === "medium"
                    ? "border-dashed border-amber-200 dark:border-amber-800"
                    : "border-solid border-blue-200 dark:border-blue-800"
              }`}
            >
              <Sparkles
                size={12}
                className="flex-shrink-0 text-amber-500"
              />
              <span className="flex-1 truncate text-slate-600 dark:text-slate-400">
                → {suggestion.childTitle}
              </span>
              <span
                className={`flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                  suggestion.confidence >= 0.85
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : suggestion.confidence >= 0.7
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {(suggestion.confidence * 100).toFixed(0)}%
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmRelation(suggestion.id);
                }}
                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-500 transition-colors"
                title={t("conceptAggregation.hierarchy.confirmRelation")}
                aria-label={t("conceptAggregation.hierarchy.confirmRelation")}
              >
                <Check size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRejectRelation(suggestion.id);
                }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                title={t("conceptAggregation.hierarchy.rejectRelation")}
                aria-label={t("conceptAggregation.hierarchy.rejectRelation")}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={`overflow-hidden ${getConfidenceBorderStyle(confidenceLevel)}`}
          >
            <div className="py-0.5">
              {node.children?.map((child, idx) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  selectedNodeId={selectedNodeId}
                  suggestions={suggestions}
                  onToggle={onToggle}
                  onNodeClick={onNodeClick}
                  onConfirmRelation={onConfirmRelation}
                  onRejectRelation={onRejectRelation}
                  focusedNodeId={focusedNodeId}
                  siblingsCount={node.children?.length ?? 0}
                  indexInSiblings={idx + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const HierarchyTreeView: React.FC<HierarchyTreeViewProps> = ({
  hierarchyData,
  suggestions,
  onNodeClick,
  onConfirmRelation,
  onRejectRelation,
  selectedNodeId,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(undefined);
  const { t } = useTranslation();

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const flatNodes = useMemo(
    () => flattenVisibleNodes(hierarchyData, expandedIds),
    [hierarchyData, expandedIds],
  );

  const effectiveFocusedNodeId = focusedNodeId ?? flatNodes[0]?.node.id;

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatNodes.length === 0) return;
      const focusedIndex = flatNodes.findIndex(
        (fn) => fn.node.id === effectiveFocusedNodeId,
      );
      const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;
      const current = flatNodes[currentIndex];
      if (!current) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = flatNodes[currentIndex + 1];
          if (next) setFocusedNodeId(next.node.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = flatNodes[currentIndex - 1];
          if (prev) setFocusedNodeId(prev.node.id);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (current.hasChildren) {
            if (current.isExpanded) {
              const next = flatNodes[currentIndex + 1];
              if (next && next.depth > current.depth) {
                setFocusedNodeId(next.node.id);
              }
            } else {
              handleToggle(current.node.id);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (current.hasChildren && current.isExpanded) {
            handleToggle(current.node.id);
          } else if (current.parentId) {
            setFocusedNodeId(current.parentId);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          setFocusedNodeId(flatNodes[0]?.node.id);
          break;
        }
        case "End": {
          e.preventDefault();
          const last = flatNodes[flatNodes.length - 1];
          if (last) setFocusedNodeId(last.node.id);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          onNodeClick(current.node.id);
          break;
        }
      }
    },
    [flatNodes, effectiveFocusedNodeId, handleToggle, onNodeClick],
  );

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collectIds = (nodes: HierarchyNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(hierarchyData);
    setExpandedIds(allIds);
  }, [hierarchyData]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const totalNodes = useMemo(() => {
    let count = 0;
    const countNodes = (nodes: HierarchyNode[]) => {
      nodes.forEach((node) => {
        count++;
        if (node.children) {
          countNodes(node.children);
        }
      });
    };
    countNodes(hierarchyData);
    return count;
  }, [hierarchyData]);

  if (hierarchyData.length === 0) {
    return (
      <EmptyState
        icon={<Network className="w-12 h-12 text-gray-400 dark:text-gray-500" />}
        title={t("common.conceptAggregation.noHierarchyTreeTitle")}
        description={t("common.conceptAggregation.noHierarchyTreeDesc")}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-500">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Info size={12} />
            {t("conceptAggregation.hierarchy.totalNodes", { count: totalNodes })}
          </span>
          {suggestions.length > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Sparkles size={12} />
              {t("conceptAggregation.hierarchy.suggestionsCount", { count: suggestions.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {t("conceptAggregation.hierarchy.expandAll")}
          </button>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {t("conceptAggregation.hierarchy.collapseAll")}
          </button>
        </div>
      </div>

      <div
        role="tree"
        aria-label={t("conceptAggregation.hierarchy.treeLabel")}
        className="flex-1 overflow-y-auto py-2"
        onKeyDown={handleTreeKeyDown}
      >
        {hierarchyData.map((node, idx) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            suggestions={suggestions}
            onToggle={handleToggle}
            onNodeClick={onNodeClick}
            onConfirmRelation={onConfirmRelation}
            onRejectRelation={onRejectRelation}
            focusedNodeId={effectiveFocusedNodeId}
            siblingsCount={hierarchyData.length}
            indexInSiblings={idx + 1}
          />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-500">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-slate-400" />
            {t("conceptAggregation.hierarchy.highConfidence")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t border-dashed border-slate-400" />
            {t("conceptAggregation.hierarchy.mediumConfidence")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t border-dotted border-slate-300" />
            {t("conceptAggregation.hierarchy.lowConfidence")}
          </span>
        </div>
      </div>
    </div>
  );
};
