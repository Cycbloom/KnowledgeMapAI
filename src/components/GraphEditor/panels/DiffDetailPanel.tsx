import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Edit3,
  ChevronDown,
  ChevronRight,
  Loader2,
  GitCompare,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { graphVersionsApi } from "../../../services/api/graphVersions";
import type {
  DiffResult,
  NodeDiff,
  EdgeDiff,
  SnapshotNodeData,
  SnapshotEdgeData,
  DiffChangeType,
} from "@shared/types/graphVersion";

interface DiffDetailPanelProps {
  graphId: string;
  sourceSnapshotId: string;
  targetSnapshotId?: string;
  onClose: () => void;
}

const CHANGE_TYPE_CONFIG: Record<
  DiffChangeType,
  { label: string; color: string; bgColor: string; Icon: typeof Plus }
> = {
  added: {
    label: "新增",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    Icon: Plus,
  },
  removed: {
    label: "删除",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    Icon: Minus,
  },
  modified: {
    label: "修改",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    Icon: Edit3,
  },
};

function NodeDiffRow({ diff }: { diff: NodeDiff }) {
  const [expanded, setExpanded] = useState(false);
  const config = CHANGE_TYPE_CONFIG[diff.changeType];
  const { Icon } = config;
  const displayData = diff.after ?? diff.before;

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
            config.bgColor,
            config.color,
          )}
        >
          <Icon size={10} />
          {config.label}
        </span>
        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
          {displayData?.title ?? "未知节点"}
        </span>
        {diff.changeType === "modified" && diff.changedFields.length > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
            {diff.changedFields.length} 项变更
          </span>
        )}
      </button>
      {expanded && diff.changeType === "modified" && (
        <div className="px-8 pb-2 space-y-1">
          {diff.changedFields.map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400 w-16 flex-shrink-0">
                {field}
              </span>
              <span className="text-red-500 line-through truncate max-w-[120px]">
                {String(
                  (diff.before as unknown as Record<string, unknown>)?.[field] ??
                  "",
                )}
              </span>
              <span className="text-slate-400">→</span>
              <span className="text-green-600 truncate max-w-[120px]">
                {String(
                  (diff.after as unknown as Record<string, unknown>)?.[field] ??
                  "",
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {expanded && diff.changeType === "added" && diff.after && (
        <div className="px-8 pb-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            等级: {diff.after.level} · 位置: ({diff.after.xPosition},{" "}
            {diff.after.yPosition})
          </span>
        </div>
      )}
      {expanded && diff.changeType === "removed" && diff.before && (
        <div className="px-8 pb-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            等级: {diff.before.level} · 位置: ({diff.before.xPosition},{" "}
            {diff.before.yPosition})
          </span>
        </div>
      )}
    </div>
  );
}

function SimpleList<T extends SnapshotNodeData | SnapshotEdgeData>({
  items,
  changeType,
  getLabel,
}: {
  items: T[];
  changeType: "added" | "removed";
  getLabel: (item: T) => string;
}) {
  const config = CHANGE_TYPE_CONFIG[changeType];
  const { Icon } = config;

  if (items.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
              config.bgColor,
              config.color,
            )}
          >
            <Icon size={10} />
            {config.label}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate">
            {getLabel(item)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EdgeDiffRow({ diff }: { diff: EdgeDiff }) {
  const config = CHANGE_TYPE_CONFIG[diff.changeType];
  const { Icon } = config;
  const displayData = diff.after ?? diff.before;

  const getEdgeLabel = (data: SnapshotEdgeData | null) => {
    if (!data) return "未知边";
    return `${data.sourceKnowledgePointId.slice(0, 8)}... → ${data.targetKnowledgePointId.slice(0, 8)}...`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
          config.bgColor,
          config.color,
        )}
      >
        <Icon size={10} />
        {config.label}
      </span>
      <span className="text-slate-700 dark:text-slate-300 truncate">
        {diff.changeType === "modified"
          ? getEdgeLabel(diff.after ?? diff.before)
          : getEdgeLabel(displayData)}
      </span>
      {diff.changeType === "modified" && (
        <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
          {diff.changedFields.join(", ")}
        </span>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors",
        active
          ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
      )}
    >
      {dotColor && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      )}
      {label}
    </button>
  );
}

export const DiffDetailPanel: React.FC<DiffDetailPanelProps> = ({
  graphId,
  sourceSnapshotId,
  targetSnapshotId,
  onClose,
}) => {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    nodesAdded: true,
    nodesRemoved: true,
    nodesModified: true,
    edgesAdded: true,
    edgesRemoved: true,
    edgesModified: true,
  });
  const [changeTypeFilter, setChangeTypeFilter] = useState<"all" | "added" | "removed" | "modified">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "node" | "edge">("all");

  useEffect(() => {
    const fetchDiff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await graphVersionsApi.diff(
          graphId,
          sourceSnapshotId,
          targetSnapshotId,
        );
        setDiff(result);
      } catch (_e) {
        setError("获取 Diff 数据失败");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDiff();
  }, [graphId, sourceSnapshotId, targetSnapshotId]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionVisible = (sectionKey: string) => {
    const changeTypeMap: Record<string, "added" | "removed" | "modified"> = {
      nodesAdded: "added",
      nodesRemoved: "removed",
      nodesModified: "modified",
      edgesAdded: "added",
      edgesRemoved: "removed",
      edgesModified: "modified",
    };
    const entityTypeMap: Record<string, "node" | "edge"> = {
      nodesAdded: "node",
      nodesRemoved: "node",
      nodesModified: "node",
      edgesAdded: "edge",
      edgesRemoved: "edge",
      edgesModified: "edge",
    };
    if (changeTypeFilter !== "all" && changeTypeMap[sectionKey] !== changeTypeFilter) return false;
    if (entityTypeFilter !== "all" && entityTypeMap[sectionKey] !== entityTypeFilter) return false;
    return true;
  };

  const SectionHeader = ({
    sectionKey,
    title,
    count,
    colorClass,
  }: {
    sectionKey: string;
    title: string;
    count: number;
    colorClass: string;
  }) => {
    if (count === 0 || !isSectionVisible(sectionKey)) return null;
    const isExpanded = expandedSections[sectionKey];
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-slate-400" />
        ) : (
          <ChevronRight size={14} className="text-slate-400" />
        )}
        <span className={`text-xs font-semibold ${colorClass}`}>{title}</span>
        <span className="text-xs text-slate-400 ml-1">({count})</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <GitCompare className="text-primary-500" size={18} />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            版本对比
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
        >
          <X size={18} className="text-slate-500" />
        </button>
      </div>

      {diff && diff.summary.totalChanges > 0 && (
        <div className="px-4 py-2 space-y-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">变更</span>
            <div className="flex items-center gap-1">
              <FilterChip
                active={changeTypeFilter === "all"}
                onClick={() => setChangeTypeFilter("all")}
                label="全部"
              />
              <FilterChip
                active={changeTypeFilter === "added"}
                onClick={() => setChangeTypeFilter("added")}
                label="新增"
                dotColor="bg-green-500"
              />
              <FilterChip
                active={changeTypeFilter === "removed"}
                onClick={() => setChangeTypeFilter("removed")}
                label="删除"
                dotColor="bg-red-500"
              />
              <FilterChip
                active={changeTypeFilter === "modified"}
                onClick={() => setChangeTypeFilter("modified")}
                label="修改"
                dotColor="bg-amber-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">实体</span>
            <div className="flex items-center gap-1">
              <FilterChip
                active={entityTypeFilter === "all"}
                onClick={() => setEntityTypeFilter("all")}
                label="全部"
              />
              <FilterChip
                active={entityTypeFilter === "node"}
                onClick={() => setEntityTypeFilter("node")}
                label="节点"
              />
              <FilterChip
                active={entityTypeFilter === "edge"}
                onClick={() => setEntityTypeFilter("edge")}
                label="边"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
            <p className="text-sm">{error}</p>
          </div>
        ) : diff ? (
          <div className="py-2">
            {diff.summary.totalChanges === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
                <GitCompare size={40} className="mb-3 opacity-50" />
                <p className="text-sm">两个版本之间没有差异</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    {diff.summary.nodesAdded > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        <Plus size={10} />
                        +{diff.summary.nodesAdded} 节点
                      </span>
                    )}
                    {diff.summary.nodesRemoved > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        <Minus size={10} />
                        -{diff.summary.nodesRemoved} 节点
                      </span>
                    )}
                    {diff.summary.nodesModified > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Edit3 size={10} />
                        ~{diff.summary.nodesModified} 节点
                      </span>
                    )}
                    {diff.summary.edgesAdded > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        <Plus size={10} />
                        +{diff.summary.edgesAdded} 边
                      </span>
                    )}
                    {diff.summary.edgesRemoved > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        <Minus size={10} />
                        -{diff.summary.edgesRemoved} 边
                      </span>
                    )}
                    {diff.summary.edgesModified > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Edit3 size={10} />
                        ~{diff.summary.edgesModified} 边
                      </span>
                    )}
                  </div>
                </div>

                <SectionHeader
                  sectionKey="nodesAdded"
                  title="新增节点"
                  count={diff.nodes.added.length}
                  colorClass="text-green-600 dark:text-green-400"
                />
                {isSectionVisible("nodesAdded") && expandedSections.nodesAdded && (
                  <SimpleList
                    items={diff.nodes.added}
                    changeType="added"
                    getLabel={(n: SnapshotNodeData) => n.title}
                  />
                )}

                <SectionHeader
                  sectionKey="nodesRemoved"
                  title="删除节点"
                  count={diff.nodes.removed.length}
                  colorClass="text-red-600 dark:text-red-400"
                />
                {isSectionVisible("nodesRemoved") && expandedSections.nodesRemoved && (
                  <SimpleList
                    items={diff.nodes.removed}
                    changeType="removed"
                    getLabel={(n: SnapshotNodeData) => n.title}
                  />
                )}

                <SectionHeader
                  sectionKey="nodesModified"
                  title="修改节点"
                  count={diff.nodes.modified.length}
                  colorClass="text-amber-600 dark:text-amber-400"
                />
                {isSectionVisible("nodesModified") && expandedSections.nodesModified && (
                  <div>
                    {diff.nodes.modified.map((d) => (
                      <NodeDiffRow key={d.id} diff={d} />
                    ))}
                  </div>
                )}

                <SectionHeader
                  sectionKey="edgesAdded"
                  title="新增边"
                  count={diff.edges.added.length}
                  colorClass="text-green-600 dark:text-green-400"
                />
                {isSectionVisible("edgesAdded") && expandedSections.edgesAdded && (
                  <SimpleList
                    items={diff.edges.added}
                    changeType="added"
                    getLabel={(e: SnapshotEdgeData) =>
                      `${e.sourceKnowledgePointId.slice(0, 8)}... → ${e.targetKnowledgePointId.slice(0, 8)}...`
                    }
                  />
                )}

                <SectionHeader
                  sectionKey="edgesRemoved"
                  title="删除边"
                  count={diff.edges.removed.length}
                  colorClass="text-red-600 dark:text-red-400"
                />
                {isSectionVisible("edgesRemoved") && expandedSections.edgesRemoved && (
                  <SimpleList
                    items={diff.edges.removed}
                    changeType="removed"
                    getLabel={(e: SnapshotEdgeData) =>
                      `${e.sourceKnowledgePointId.slice(0, 8)}... → ${e.targetKnowledgePointId.slice(0, 8)}...`
                    }
                  />
                )}

                <SectionHeader
                  sectionKey="edgesModified"
                  title="修改边"
                  count={diff.edges.modified.length}
                  colorClass="text-amber-600 dark:text-amber-400"
                />
                {isSectionVisible("edgesModified") && expandedSections.edgesModified && (
                  <div>
                    {diff.edges.modified.map((d) => (
                      <EdgeDiffRow key={d.id} diff={d} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
