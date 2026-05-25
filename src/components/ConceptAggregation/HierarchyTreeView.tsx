import React, { useState, useCallback, useMemo } from "react";
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

const LEVEL_LABELS: Record<NodeLevel, string> = {
  root: "根节点",
  core: "核心",
  sub: "次级",
  normal: "普通",
  leaf: "叶子",
};

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
}) => {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children !== undefined && node.children.length > 0;
  const confidenceLevel = getConfidenceLevel(node.confidence);
  const [showTooltip, setShowTooltip] = useState(false);

  const nodeSuggestions = useMemo(
    () => suggestions.filter((s) => s.parentId === node.id),
    [suggestions, node.id],
  );

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 ${
          isSelected
            ? "bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500/30"
            : ""
        } ${getConfidenceOpacity(confidenceLevel)}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
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
          {LEVEL_LABELS[node.level]}
        </span>

        {showTooltip && (
          <div className="absolute z-50 left-full ml-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 w-56">
            <div className="space-y-1.5">
              <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
                {node.title}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className={LEVEL_COLORS[node.level]}>
                  {LEVEL_ICONS[node.level]}
                </span>
                <span>{LEVEL_LABELS[node.level]}</span>
              </div>
              {node.confidence !== undefined && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  置信度:{" "}
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
                  子节点: {node.children?.length} 个
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
                  ? "border-dotted border-slate-200 dark:border-slate-700 opacity-60"
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
                title="确认关系"
              >
                <Check size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRejectRelation(suggestion.id);
                }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                title="拒绝关系"
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={`overflow-hidden ${getConfidenceBorderStyle(confidenceLevel)}`}
          >
            <div className="py-0.5">
              {node.children?.map((child) => (
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
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        <Network className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">暂无层次结构</p>
        <p className="text-xs mt-1">运行概念分析以生成层次树</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Info size={12} />
            共 {totalNodes} 个节点
          </span>
          {suggestions.length > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Sparkles size={12} />
              {suggestions.length} 条建议
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            全部展开
          </button>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            全部折叠
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {hierarchyData.map((node) => (
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
          />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-slate-400" />
            高置信度 ≥85%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t border-dashed border-slate-400" />
            中置信度 ≥70%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t border-dotted border-slate-300" />
            低置信度 &lt;70%
          </span>
        </div>
      </div>
    </div>
  );
};
