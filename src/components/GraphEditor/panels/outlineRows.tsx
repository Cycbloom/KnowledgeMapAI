import React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { Node } from "../../../types";
import { getLevelColors } from "../../../config/learningStatusColors";
import { BackboneNodeIcon } from "../BackboneNodeIcon";
import type { BackboneModule } from "@shared/types/graph";

// ─── 模块分组树：扁平化行类型 ──────────────────────────────────────────────
export interface ModuleGroup {
  key: string;
  label: string;
  icon: string;
  color: string;
  nodes: Node[];
}

export interface LiteratureGroup {
  key: string;
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  type?: string;
  journal?: string;
  doi?: string;
  keywords?: string[];
  abstract?: string;
  nodes: Node[];
}

/** 节点的骨干模块标注类型 */
type BackboneModuleVal = BackboneModule | undefined;

export type ModuleRow =
  | { type: "group"; group: ModuleGroup }
  | { type: "node"; group: ModuleGroup; node: Node };

export type LiteratureRow =
  | { type: "group"; group: LiteratureGroup }
  | { type: "node"; group: LiteratureGroup; node: Node };

interface ModuleNodeRowProps {
  group: ModuleGroup;
  node: Node;
  nodeIndex: number;
  selectedNodeId: string | null;
  isMultiSelectMode: boolean;
  selectedNodeIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onNodeClick: (node: Node) => void;
}

export const ModuleGroupRow = React.memo(function ModuleGroupRow({
  group,
  groupIndex,
  groupCount,
  isExpanded,
  onToggle,
}: {
  group: ModuleGroup;
  groupIndex: number;
  groupCount: number;
  isExpanded: boolean;
  onToggle: (key: string) => void;
}) {
  const hasNodes = group.nodes.length > 0;
  const allRefined =
    hasNodes && group.nodes.every((n) => !n.properties?.needsRefinement);

  return (
    <div
      role="treeitem"
      aria-level={1}
      aria-expanded={hasNodes ? isExpanded : undefined}
      aria-selected={false}
      aria-setsize={groupCount}
      aria-posinset={groupIndex + 1}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          if (hasNodes && !isExpanded) {
            e.preventDefault();
            onToggle(group.key);
          }
        } else if (e.key === "ArrowLeft") {
          if (hasNodes && isExpanded) {
            e.preventDefault();
            onToggle(group.key);
          }
        }
      }}
      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
      style={{ borderLeft: `3px solid ${group.color}` }}
      onClick={() => onToggle(group.key)}
    >
      <span className="text-sm" aria-hidden="true">{group.icon}</span>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">
        {group.label}
      </span>
      {hasNodes && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium"
          aria-hidden="true"
        >
          {group.nodes.length}
        </span>
      )}
      {hasNodes &&
        (allRefined ? (
          <CheckCircle2
            size={14}
            className="text-green-500 dark:text-green-400"
            aria-hidden="true"
          />
        ) : (
          <Circle
            size={14}
            className="text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        ))}
      {isExpanded ? (
        <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
      ) : (
        <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />
      )}
    </div>
  );
});

/**
 * 模块树中的单个节点行。内联于 GraphOutline 时依赖其大量闭包状态，
 * 提取为独立组件后通过 props 显式接收，便于复用与测试。
 */
export const ModuleNodeRow = React.memo(function ModuleNodeRow({
  group,
  node,
  nodeIndex,
  selectedNodeId,
  isMultiSelectMode,
  selectedNodeIds,
  onToggleSelection,
  onNodeClick,
}: ModuleNodeRowProps) {
  const { t } = useTranslation();
  const isSelected = selectedNodeIds.has(node.id);
  const backboneModule = node.properties?.backboneModule as
    | BackboneModuleVal
    | undefined;
  const isRowSelected =
    selectedNodeId === node.id && !isMultiSelectMode;

  return (
    <div
      role="treeitem"
      aria-level={2}
      aria-setsize={group.nodes.length}
      aria-posinset={nodeIndex + 1}
      aria-selected={isRowSelected}
      tabIndex={isRowSelected ? 0 : -1}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group focus:outline-none focus:ring-2 focus:ring-primary-400
          ${
            isRowSelected
              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
      onClick={() => {
        if (isMultiSelectMode) {
          onToggleSelection(node.id);
        } else {
          onNodeClick(node);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isMultiSelectMode) {
            onToggleSelection(node.id);
          } else {
            onNodeClick(node);
          }
        }
      }}
    >
      {isMultiSelectMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(node.id);
          }}
          className="cursor-pointer text-slate-400 hover:text-primary-500"
          aria-hidden="true"
        >
          {isSelected ? (
            <CheckSquare
              size={16}
              className="text-primary-500"
              aria-hidden="true"
            />
          ) : (
            <Square size={16} aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: getLevelColors(node.level || "leaf").primary }}
        aria-hidden="true"
      />
      <span className="truncate flex-1 font-medium flex items-center gap-1.5">
        {backboneModule && (
          <BackboneNodeIcon
            module={backboneModule}
            size="small"
            showTooltip={true}
          />
        )}
        {node.title || t("graphEditor.outline.unnamedNode")}
      </span>
      {(() => {
        const levelVal = node.level || "leaf";
        const palette = getLevelColors(levelVal);
        const isSel = isRowSelected;
        const bg = isSel ? palette.primary : palette.background;
        const fg = isSel ? "#FFFFFF" : palette.text;
        const border = isSel
          ? `1px solid ${palette.primary}`
          : `1px solid ${palette.primary}22`;
        return (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium tracking-wide flex-shrink-0"
            style={{
              backgroundColor: bg,
              color: fg,
              border,
              boxShadow: isSel ? `0 1px 2px ${palette.primary}33` : undefined,
            }}
            aria-hidden="true"
          >
            {levelVal}
          </span>
        );
      })()}
    </div>
  );
});

interface LiteratureNodeRowProps {
  group: LiteratureGroup;
  node: Node;
  nodeIndex: number;
  selectedNodeId: string | null;
  onNodeClick: (node: Node) => void;
}

export const LiteratureNodeRow = React.memo(function LiteratureNodeRow({
  group,
  node,
  nodeIndex,
  selectedNodeId,
  onNodeClick,
}: LiteratureNodeRowProps) {
  const backboneModule = node.properties?.backboneModule as
    | BackboneModuleVal
    | undefined;
  const isRowSelected = selectedNodeId === node.id;

  return (
    <div
      role="treeitem"
      aria-level={2}
      aria-setsize={group.nodes.length}
      aria-posinset={nodeIndex + 1}
      aria-selected={isRowSelected}
      tabIndex={isRowSelected ? 0 : -1}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${
        isRowSelected
          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick(node);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNodeClick(node);
        }
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: getLevelColors(node.level || "leaf").primary }}
        aria-hidden="true"
      />
      {backboneModule && (
        <BackboneNodeIcon module={backboneModule} size="small" />
      )}
      <span className="text-sm truncate flex-1">{node.title}</span>
    </div>
  );
});