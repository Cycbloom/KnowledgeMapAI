import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  Trash2,
  Wand2,
  MousePointer2,
  Sparkles,
  List,
  Layers,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  ListChecks,
  Eraser,
  Plus,
  Network,
  X,
  Link2,
  CheckCircle2,
  Circle,
  FileText,
  FolderOpen,
  Palette,
} from "lucide-react";
import { Node, Edge } from "../../../types";
import { createClient } from "@supabase/supabase-js";
import { useDebouncedSearch } from "../../../hooks/useDebouncedSearch";
import type { BatchGenerateConfig } from "../modals/BatchGenerateDialog";
import { LiteratureSourceDB } from "@shared/types/graph";
import { BatchGenerateDialog } from "../modals/BatchGenerateDialog";
import { GraphStatsSummary } from "../shared/GraphStatsSummary";
import { getLevelColors } from "../../../config/learningStatusColors";
import { useTranslation } from "react-i18next";
import { BackboneNodeIcon } from "../BackboneNodeIcon";
import { LiteratureHoverCard } from "../LiteratureHoverCard";
import { HIERARCHICAL_EDGE_TYPES } from '../../../config/relationshipTypes';
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_ICONS,
  BACKBONE_MODULE_COLORS,
  ConceptSource,
} from "@shared/types/graph";

interface GraphOutlineProps {
  nodes: Node[];
  edges?: Edge[];
  nodeStatus?: Record<string, any>;
  onNodeClick: (node: Node) => void;
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchAction?: (
    action:
      | "expand_graph"
      | "delete"
      | "batch_generate_questions"
      | "create_region",
    data?: any,
  ) => void;
  onAddNode?: () => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  className?: string;
  stats?: {
    masteredCount: number;
    dueTodayCount: number;
  };
  isReadOnly?: boolean;
  templateType?: string;
  graphId?: string;
}

export const GraphOutline = React.memo(function GraphOutline({
  nodes,
  edges = [],
  onNodeClick,
  selectedNodeId,
  selectedNodeIds = new Set(),
  onSelectionChange,
  onBatchAction,
  onAddNode,
  onConnectNodes,
  className = "",
  stats,
  isReadOnly = false,
  templateType,
  graphId,
}: GraphOutlineProps) {
  const { t } = useTranslation();
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBatchGenerateOpen, setIsBatchGenerateOpen] = useState(false);
  const [showConnectionDiscovery, setShowConnectionDiscovery] = useState(false);
  const [literatureSourcesMap, setLiteratureSourcesMap] = useState<
    Map<string, LiteratureSourceDB>
  >(new Map());

  useEffect(() => {
    if (!graphId || templateType !== "topic_research") return;

    const fetchLiteratureSources = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) return;

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase
          .from("literature_sources")
          .select("*")
          .eq("graph_id", graphId);

        if (error) {
          console.error("Failed to fetch literature sources:", error);
          return;
        }

        if (data && data.length > 0) {
          const map = new Map<string, LiteratureSourceDB>();
          data.forEach((source) => {
            map.set(source.title, source as LiteratureSourceDB);
          });
          setLiteratureSourcesMap(map);
        }
      } catch (err) {
        console.error("Error fetching literature sources:", err);
      }
    };

    fetchLiteratureSources();
  }, [graphId, templateType]);

  const [viewMode, setViewMode] = useState<
    "tree" | "list" | "module" | "literature"
  >(templateType === "topic_research" ? "module" : "tree");
  const [sortMode, setSortMode] = useState<"default" | "title" | "level">(
    "default",
  );
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const processedNodes = useMemo(() => {
    let result = nodes.filter((node) => node && node.id);

    // 1. Search
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (node) =>
          (node.title && node.title.toLowerCase().includes(query)) ||
          (node.content && node.content.toLowerCase().includes(query)),
      );
    }

    // 2. Filter Level
    if (filterLevel !== "all") {
      result = result.filter((node) => (node.level || "leaf") === filterLevel);
    }

    // 3. Sort (Applies to List Mode mainly, but we prepare it anyway)
    if (viewMode === "list" || debouncedSearchQuery.trim() || filterLevel !== "all") {
      result = [...result].sort((a, b) => {
        const safeTitleA = a.title || "";
        const safeTitleB = b.title || "";

        if (sortMode === "title") return safeTitleA.localeCompare(safeTitleB);
        if (sortMode === "level") {
          const levelOrder: Record<string, number> = {
            root: 0,
            core: 1,
            sub: 2,
            normal: 3,
            leaf: 4,
          };
          return (
            (levelOrder[a.level || "leaf"] || 4) -
            (levelOrder[b.level || "leaf"] || 4)
          );
        }
        // Default: Level then Creation Time (to preserve learning order)
        const levelOrder: Record<string, number> = {
          root: 0,
          core: 1,
          sub: 2,
          normal: 3,
          leaf: 4,
        };
        const la = levelOrder[a.level || "leaf"] ?? 4;
        const lb = levelOrder[b.level || "leaf"] ?? 4;
        if (la !== lb) return la - lb;
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });
    }

    return result;
  }, [nodes, debouncedSearchQuery, filterLevel, sortMode, viewMode]);

  // Calculate isolated nodes count
  const isolatedCount = useMemo(() => {
    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source_knowledge_point_id);
      connectedNodeIds.add(edge.target_knowledge_point_id);
    });
    return nodes.filter((node) => !connectedNodeIds.has(node.id)).length;
  }, [nodes, edges]);

  // Build Tree Structure
  const { rootNodes, childrenMap, parentMap } = useMemo(() => {
    const cMap = new Map<string, Node[]>();
    const pMap = new Map<string, string>(); // childId -> parentId
    const hasParent = new Set<string>();

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Helper to get level value
    const levelOrder: Record<string, number> = {
      root: 0,
      core: 1,
      sub: 2,
      normal: 3,
      leaf: 4,
    };
    const getLevelVal = (n?: Node) => levelOrder[n?.level || "leaf"] ?? 4;

    // Filter to only hierarchical edge types for tree building
    const hierarchicalEdges = edges.filter((edge) => {
      if (!edge.relationship_type) return true; // No type: keep existing behavior
      return HIERARCHICAL_EDGE_TYPES.has(edge.relationship_type);
    });

    // Sort edges to prioritize better parent-child relationships for the tree view
    // We want to avoid "upward" links becoming the primary parent-child relationship in the outline
    const sortedEdges = [...hierarchicalEdges].sort((a, b) => {
      const sA = nodeMap.get(a.source_knowledge_point_id);
      const tA = nodeMap.get(a.target_knowledge_point_id);
      const sB = nodeMap.get(b.source_knowledge_point_id);
      const tB = nodeMap.get(b.target_knowledge_point_id);

      if (!sA || !tA) return 0;
      if (!sB || !tB) return 0;

      const lA_source = getLevelVal(sA);
      const lA_target = getLevelVal(tA);
      const lB_source = getLevelVal(sB);
      const lB_target = getLevelVal(tB);

      // 1. Prefer "Top-Down" relationships (Source Level < Target Level)
      // Difference: (Target - Source). Positive means correct direction (e.g. Root(0) -> Core(1) = 1)
      // Negative means incorrect direction (e.g. Leaf(4) -> Root(0) = -4)
      const diffA = lA_target - lA_source;
      const diffB = lB_target - lB_source;

      const isPosA = diffA > 0;
      const isPosB = diffB > 0;

      // Positive differences (Top-Down) come first
      if (isPosA && !isPosB) return -1;
      if (!isPosA && isPosB) return 1;

      if (isPosA && isPosB) {
        // Both positive: prefer SMALLER difference (tighter parent-child relationship)
        // e.g. Core->Sub (diff=1) is better than Root->Sub (diff=2)
        if (diffA !== diffB) return diffA - diffB;
      } else {
        // Both negative or zero: prefer LARGER difference (closer to 0)
        // e.g. Peer (0) is better than Backlink (-1)
        if (diffA !== diffB) return diffB - diffA;
      }

      // 2. Prefer higher level sources (Root < Core < Sub)
      if (lA_source !== lB_source) return lA_source - lB_source;

      return 0;
    });

    sortedEdges.forEach((edge) => {
      const source = nodeMap.get(edge.source_knowledge_point_id);
      const target = nodeMap.get(edge.target_knowledge_point_id);

      if (source && target) {
        if (!hasParent.has(edge.target_knowledge_point_id)) {
          if (!cMap.has(edge.source_knowledge_point_id))
            cMap.set(edge.source_knowledge_point_id, []);
          cMap.get(edge.source_knowledge_point_id)!.push(target);

          hasParent.add(edge.target_knowledge_point_id);
          pMap.set(
            edge.target_knowledge_point_id,
            edge.source_knowledge_point_id,
          );
        }
      }
    });

    // Sort children by creation time to preserve learning order
    cMap.forEach((list) => {
      list.sort((a, b) => {
        const levelOrder: Record<string, number> = {
          root: 0,
          core: 1,
          sub: 2,
          normal: 3,
          leaf: 4,
        };
        const la = levelOrder[a.level || "leaf"] ?? 4;
        const lb = levelOrder[b.level || "leaf"] ?? 4;
        if (la !== lb) return la - lb;
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });
    });

    // Find roots
    let roots = nodes.filter((n) => n && n.id && !hasParent.has(n.id));

    // Fallback for cycles/loops where everyone has a parent
    if (roots.length === 0 && nodes.length > 0) {
      roots = nodes.filter((n) => n && n.level === "root");
      if (roots.length === 0 && nodes[0]) roots = [nodes[0]];
    }

    // Sort roots by creation time to preserve learning order
    roots.sort((a, b) => {
      const levelOrder: Record<string, number> = {
        root: 0,
        core: 1,
        sub: 2,
        normal: 3,
        leaf: 4,
      };
      const la = levelOrder[a.level || "leaf"] ?? 4;
      const lb = levelOrder[b.level || "leaf"] ?? 4;
      if (la !== lb) return la - lb;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

    return { rootNodes: roots, childrenMap: cMap, parentMap: pMap };
  }, [nodes, edges]);

  // Auto-expand all nodes on initial load
  useEffect(() => {
    if (childrenMap.size > 0) {
      const allParentIds = new Set(childrenMap.keys());
      setExpandedNodeIds(allParentIds);
    }
  }, [childrenMap]);

  // Auto-expand path to selected node
  useEffect(() => {
    if (selectedNodeId && !searchQuery) {
      const toExpand = new Set<string>();
      let currentId = parentMap.get(selectedNodeId);
      while (currentId) {
        toExpand.add(currentId);
        currentId = parentMap.get(currentId);
      }

      if (toExpand.size > 0) {
        setExpandedNodeIds((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [selectedNodeId, parentMap, searchQuery]);

  const toggleExpand = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleToggleSelection = useCallback(
    (nodeId: string) => {
      if (!onSelectionChange) return;
      const newSet = new Set(selectedNodeIds);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      onSelectionChange(newSet);
    },
    [selectedNodeIds, onSelectionChange],
  );

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (selectedNodeIds.size === nodes.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(nodes.map((n) => n.id)));
    }
  }, [selectedNodeIds.size, nodes, onSelectionChange]);

  const handleBatchGenerateSuccess = useCallback(
    (config?: BatchGenerateConfig) => {
      onSelectionChange?.(new Set());
      setIsMultiSelectMode(false);
      onBatchAction?.("batch_generate_questions", config);
    },
    [onSelectionChange, onBatchAction],
  );

  const existingConnections = useMemo(() => {
    const connections = new Set<string>();
    edges.forEach((edge) => {
      connections.add(
        `${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`,
      );
      connections.add(
        `${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`,
      );
    });
    return connections;
  }, [edges]);

  const connectionSuggestions = useMemo(() => {
    const suggestions: {
      sourceId: string;
      sourceTitle: string;
      targetId: string;
      targetTitle: string;
      reason: string;
      score: number;
    }[] = [];

    nodes.forEach((node) => {
      const nodeTags = new Set(node.tags || node.properties?.tags || []);
      const nodeContent = (node.summary || node.content || "").toLowerCase();
      const connectedIds = new Set(
        edges
          .filter(
            (e) =>
              e.source_knowledge_point_id === node.id ||
              e.target_knowledge_point_id === node.id,
          )
          .map((e) =>
            e.source_knowledge_point_id === node.id
              ? e.target_knowledge_point_id
              : e.source_knowledge_point_id,
          ),
      );

      nodes.forEach((otherNode) => {
        if (node.id === otherNode.id) return;
        if (connectedIds.has(otherNode.id)) return;
        if (existingConnections.has(`${node.id}-${otherNode.id}`)) return;

        let score = 0;
        const reasons: string[] = [];

        const otherTags = new Set(
          otherNode.tags || otherNode.properties?.tags || [],
        );
        const commonTags = [...nodeTags].filter((t) => otherTags.has(t));
        if (commonTags.length > 0) {
          score += commonTags.length * 10;
          reasons.push(`共同标签: ${commonTags.slice(0, 2).join(", ")}`);
        }

        const otherContent = (otherNode.content || "").toLowerCase();
        if (
          nodeContent.includes(otherNode.title.toLowerCase()) ||
          otherContent.includes(node.title.toLowerCase())
        ) {
          score += 15;
          reasons.push("内容中提及对方");
        }

        if (score >= 10) {
          suggestions.push({
            sourceId: node.id,
            sourceTitle: node.title,
            targetId: otherNode.id,
            targetTitle: otherNode.title,
            reason: reasons[0] || "可能相关",
            score,
          });
        }
      });
    });

    const uniqueSuggestions = suggestions
      .filter(
        (s, i, arr) =>
          arr.findIndex(
            (other) =>
              (other.sourceId === s.sourceId &&
                other.targetId === s.targetId) ||
              (other.sourceId === s.targetId && other.targetId === s.sourceId),
          ) === i,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return uniqueSuggestions;
  }, [nodes, edges, existingConnections]);

  const [dismissedConnections, setDismissedConnections] = useState<Set<string>>(
    new Set(),
  );

  const filteredSuggestions = useMemo(() => {
    return connectionSuggestions.filter((s) => {
      const key = [s.sourceId, s.targetId].sort().join("-");
      return !dismissedConnections.has(key);
    });
  }, [connectionSuggestions, dismissedConnections]);

  const handleConnect = useCallback(
    (suggestion: { sourceId: string; targetId: string }) => {
      onConnectNodes?.(suggestion.sourceId, suggestion.targetId);
    },
    [onConnectNodes],
  );

  const handleDismissConnection = useCallback(
    (sourceId: string, targetId: string) => {
      const key = [sourceId, targetId].sort().join("-");
      setDismissedConnections((prev) => new Set([...prev, key]));
    },
    [],
  );

  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );
  const [expandedLiteratures, setExpandedLiteratures] = useState<Set<string>>(
    new Set(),
  );

  const [hoveredLiterature, setHoveredLiterature] = useState<{
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
  } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const literatureHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moduleGroups = useMemo(() => {
    if (templateType !== "topic_research") return [];

    const rootNodes = nodes.filter(
      (n) => n.level === "root" && !n.properties?.backboneModule,
    );
    const groups: {
      key: string;
      label: string;
      icon: string;
      color: string;
      nodes: Node[];
    }[] = [];

    if (rootNodes.length > 0) {
      groups.push({
        key: "__root__",
        label: "研究主题",
        icon: "📌",
        color: "var(--secondary-500)",
        nodes: rootNodes,
      });
    }

    const allModules = Object.values(BackboneModule);
    for (const mod of allModules) {
      const moduleNodes = nodes.filter(
        (n) => n.properties?.backboneModule === mod,
      );
      groups.push({
        key: mod,
        label: BACKBONE_MODULE_LABELS[mod],
        icon: BACKBONE_MODULE_ICONS[mod],
        color: BACKBONE_MODULE_COLORS[mod],
        nodes: moduleNodes,
      });
    }

    return groups;
  }, [nodes, templateType, literatureSourcesMap]);

  const literatureGroups = useMemo(() => {
    if (templateType !== "topic_research") return [];

    const literatureMap = new Map<
      string,
      {
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
    >();

    for (const node of nodes) {
      const sources =
        (node.properties?.sources as ConceptSource[] | undefined) || [];
      if (sources.length === 0) continue;

      for (const source of sources) {
        const key = source.title;
        if (!literatureMap.has(key)) {
          // Get full metadata from literature_sources table if available
          const fullSource = literatureSourcesMap.get(key);

          literatureMap.set(key, {
            key,
            title: source.title,
            authors: fullSource?.authors || source.authors,
            year: fullSource?.year || source.year,
            url: fullSource?.url || source.url,
            fileName: fullSource?.fileName || source.fileName,
            type: fullSource?.type,
            journal: fullSource?.journal,
            doi: fullSource?.doi,
            keywords: fullSource?.keywords,
            abstract: fullSource?.abstract,
            nodes: [],
          });
        }
        literatureMap.get(key)!.nodes.push(node);
      }
    }

    const groups = Array.from(literatureMap.values());

    const uncategorizedNodes = nodes.filter((n) => {
      const sources =
        (n.properties?.sources as ConceptSource[] | undefined) || [];
      return (
        sources.length === 0 &&
        n.level !== "root" &&
        n.level !== "core" &&
        !n.properties?.backboneModule
      );
    });

    if (uncategorizedNodes.length > 0) {
      groups.push({
        key: "__uncategorized__",
        title: "未分类",
        nodes: uncategorizedNodes,
      });
    }

    return groups;
  }, [nodes, templateType, literatureSourcesMap]);

  const toggleModuleExpand = useCallback((moduleKey: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
  }, []);

  const toggleLiteratureExpand = useCallback((key: string) => {
    setExpandedLiteratures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderModuleView = () => {
    if (moduleGroups.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t("graphEditor.outline.noNodes")}
        </div>
      );
    }

    return moduleGroups.map((group) => {
      const isExpanded = expandedModules.has(group.key);
      const hasNodes = group.nodes.length > 0;
      const allRefined =
        hasNodes && group.nodes.every((n) => !n.properties?.needsRefinement);

      return (
        <div key={group.key} className="mb-1">
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
            style={{ borderLeft: `3px solid ${group.color}` }}
            onClick={() => toggleModuleExpand(group.key)}
          >
            <span className="text-sm">{group.icon}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">
              {group.label}
            </span>
            {hasNodes && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                {group.nodes.length}
              </span>
            )}
            {hasNodes &&
              (allRefined ? (
                <CheckCircle2
                  size={14}
                  className="text-green-500 dark:text-green-400"
                />
              ) : (
                <Circle
                  size={14}
                  className="text-gray-400 dark:text-gray-500"
                />
              ))}
            {isExpanded ? (
              <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <ChevronRight size={14} className="text-slate-400" />
            )}
          </div>
          {isExpanded && hasNodes && (
            <div className="ml-2">
              {group.nodes.map((node) => {
                const level = node.level || "leaf";
                const isSelected = selectedNodeIds.has(node.id);
                const backboneModule = node.properties?.backboneModule as
                  | BackboneModule
                  | undefined;

                return (
                  <div
                    key={node.id}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group
                      ${
                        selectedNodeId === node.id && !isMultiSelectMode
                          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    onClick={() => {
                      if (isMultiSelectMode) {
                        handleToggleSelection(node.id);
                      } else {
                        onNodeClick(node);
                      }
                    }}
                  >
                    {isMultiSelectMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelection(node.id);
                        }}
                        className="cursor-pointer text-slate-400 hover:text-primary-500"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-primary-500" />
                        ) : (
                          <Square size={16} />
                        )}
                      </div>
                    )}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: getLevelColors(node.level || "leaf")
                          .primary,
                      }}
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
                    <span
                      className="text-[10px] px-1 py-0.5 rounded uppercase"
                      style={{
                        backgroundColor: getLevelColors(level).background,
                        color: getLevelColors(level).text,
                      }}
                    >
                      {level}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const renderLiteratureView = () => {
    if (literatureGroups.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t("graphEditor.outline.noNodes")}
        </div>
      );
    }

    return (
      <div className="relative">
        {literatureGroups.map((group) => {
          const isExpanded = expandedLiteratures.has(group.key);
          const isUncategorized = group.key === "__uncategorized__";

          return (
            <div key={group.key} className="mb-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors relative group/literature ${
                  isUncategorized
                    ? "hover:bg-slate-50 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                style={{
                  borderLeft: isUncategorized
                    ? "3px solid var(--slate-400)"
                    : "3px solid var(--tertiary-500)",
                }}
                onClick={() => toggleLiteratureExpand(group.key)}
                onMouseEnter={(e) => {
                  if (!isUncategorized) {
                    if (literatureHideTimerRef.current) {
                      clearTimeout(literatureHideTimerRef.current);
                      literatureHideTimerRef.current = null;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredLiterature({
                      key: group.key,
                      title: group.title,
                      authors: group.authors,
                      year: group.year,
                      url: group.url,
                      fileName: group.fileName,
                      type: group.type,
                      journal: group.journal,
                      doi: group.doi,
                      keywords: group.keywords,
                      abstract: group.abstract,
                      nodes: group.nodes,
                    });
                    setHoverPosition({ x: rect.right, y: rect.top });
                  }
                }}
                onMouseLeave={() => {
                  literatureHideTimerRef.current = setTimeout(() => {
                    setHoveredLiterature(null);
                    setHoverPosition(null);
                  }, 200);
                }}
              >
                {isUncategorized ? (
                  <FolderOpen size={14} className="text-slate-400" />
                ) : (
                  <FileText size={14} className="text-purple-500" />
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm truncate block ${
                      isUncategorized
                        ? "font-normal text-slate-500 dark:text-slate-400"
                        : "font-medium text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {group.title}
                  </span>
                  {isUncategorized ? (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block">
                      无来源信息的概念节点
                    </span>
                  ) : (
                    group.authors &&
                    group.authors.length > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                        {group.authors.join(", ")}
                        {group.year ? ` (${group.year})` : ""}
                      </span>
                    )
                  )}
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    isUncategorized
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {group.nodes.length}
                </span>
                {isExpanded ? (
                  <ChevronDown
                    size={14}
                    className="text-slate-400 flex-shrink-0"
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    className="text-slate-400 flex-shrink-0"
                  />
                )}
              </div>
              {isExpanded && (
                <div className="ml-2 mt-0.5 space-y-0.5">
                  {group.nodes.map((node) => {
                    const backboneModule = node.properties?.backboneModule as
                      | BackboneModule
                      | undefined;

                    return (
                      <div
                        key={node.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                          selectedNodeId === node.id
                            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNodeClick(node);
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getLevelColors(
                              node.level || "leaf",
                            ).primary,
                          }}
                        />
                        {backboneModule && (
                          <BackboneNodeIcon
                            module={backboneModule}
                            size="small"
                          />
                        )}
                        <span className="text-sm truncate flex-1">
                          {node.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {hoveredLiterature && hoverPosition && (
          <LiteratureHoverCard
            literature={hoveredLiterature}
            position={hoverPosition}
            onNodeClick={onNodeClick}
            onMouseEnter={() => {
              if (literatureHideTimerRef.current) {
                clearTimeout(literatureHideTimerRef.current);
                literatureHideTimerRef.current = null;
              }
            }}
            onMouseLeave={() => {
              literatureHideTimerRef.current = setTimeout(() => {
                setHoveredLiterature(null);
                setHoverPosition(null);
              }, 200);
            }}
          />
        )}
      </div>
    );
  };

  const renderList = () => {
    // processedNodes is already sorted and filtered
    if (processedNodes.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t("graphEditor.outline.noMatchingNodes")}
        </div>
      );
    }

    return processedNodes.map((node) => {
      const level = node.level || "leaf";
      const isSelected = selectedNodeIds.has(node.id);
      const backboneModule = node.properties?.backboneModule as
        | BackboneModule
        | undefined;

      return (
        <div
          key={node.id}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group
            ${
              selectedNodeId === node.id && !isMultiSelectMode
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          onClick={() => {
            if (isMultiSelectMode) {
              handleToggleSelection(node.id);
            } else {
              onNodeClick(node);
            }
          }}
        >
          {isMultiSelectMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSelection(node.id);
              }}
              className="cursor-pointer text-slate-400 hover:text-primary-500"
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-primary-500" />
              ) : (
                <Square size={16} />
              )}
            </div>
          )}

          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: getLevelColors(node.level || "leaf").primary,
            }}
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
          <span
            className="text-[10px] px-1 py-0.5 rounded uppercase"
            style={{
              backgroundColor: getLevelColors(level).background,
              color: getLevelColors(level).text,
            }}
          >
            {level}
          </span>
        </div>
      );
    });
  };

  // Helper to select all direct children of a node
  const handleSelectChildren = useCallback(
    (parentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onSelectionChange) return;

      const children = childrenMap.get(parentId) || [];
      if (children.length === 0) return;

      const newSet = new Set(selectedNodeIds);
      children.forEach((child) => newSet.add(child.id));

      onSelectionChange(newSet);
      if (!isMultiSelectMode) setIsMultiSelectMode(true);
    },
    [selectedNodeIds, onSelectionChange, isMultiSelectMode, childrenMap],
  );

  // Helper to select isolated nodes (nodes with no edges)
  const handleSelectIsolated = useCallback(() => {
    if (!onSelectionChange) return;

    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source_knowledge_point_id);
      connectedNodeIds.add(edge.target_knowledge_point_id);
    });

    const isolatedNodes = nodes.filter(
      (node) => !connectedNodeIds.has(node.id),
    );

    if (isolatedNodes.length === 0) {
      return;
    }

    const newSet = new Set(selectedNodeIds);
    isolatedNodes.forEach((node) => newSet.add(node.id));

    onSelectionChange(newSet);
    if (!isMultiSelectMode) setIsMultiSelectMode(true);
  }, [selectedNodeIds, onSelectionChange, isMultiSelectMode, nodes, edges]);

  // Tree Mode: Recursive Render
  const TreeNode = React.memo(
    ({
      node,
      depth,
      visited,
      isReadOnly: isNodeReadOnly,
    }: {
      node: Node;
      depth: number;
      visited: Set<string>;
      isReadOnly?: boolean;
    }) => {
      if (visited.has(node.id)) return null;
      const newVisited = new Set(visited).add(node.id);

      const children = childrenMap.get(node.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedNodeIds.has(node.id);
      const isSelected = selectedNodeIds.has(node.id);
      const backboneModule = node.properties?.backboneModule as
        | BackboneModule
        | undefined;

      const paddingLeft = 12 + depth * 16;

      return (
        <div className="select-none">
          <div
            className={`w-full flex items-center pr-2 py-1.5 cursor-pointer text-sm transition-colors group
            ${
              selectedNodeId === node.id && !isMultiSelectMode
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => {
              if (isMultiSelectMode) {
                handleToggleSelection(node.id);
              } else {
                onNodeClick(node);
              }
            }}
          >
            <div
              className={`w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors ${hasChildren ? "visible" : "invisible"}`}
              onClick={(e) => hasChildren && toggleExpand(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </div>

            {isMultiSelectMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSelection(node.id);
                }}
                className="mr-2 cursor-pointer text-slate-400 hover:text-primary-500"
              >
                {isSelected ? (
                  <CheckSquare size={16} className="text-primary-500" />
                ) : (
                  <Square size={16} />
                )}
              </div>
            )}

            <div
              className="w-2 h-2 rounded-full shrink-0 mr-2"
              style={{
                backgroundColor: getLevelColors(node.level || "leaf").primary,
              }}
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

            {node.level && (
              <span
                className="text-[10px] uppercase ml-2 px-1 rounded hidden group-hover:inline-block"
                style={{
                  backgroundColor:
                    selectedNodeId === node.id
                      ? getLevelColors(node.level).primary
                      : getLevelColors(node.level).background,
                  color:
                    selectedNodeId === node.id
                      ? "var(--white)"
                      : getLevelColors(node.level).text,
                }}
              >
                {node.level}
              </span>
            )}

            {hasChildren && !isNodeReadOnly && (
              <button
                onClick={(e) => handleSelectChildren(node.id, e)}
                className="ml-2 p-1 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded hidden group-hover:flex items-center justify-center transition-colors"
                title={t("graphEditor.outline.selectAllChildren")}
              >
                <ListChecks size={14} />
              </button>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div>
              {children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  visited={newVisited}
                  isReadOnly={isNodeReadOnly}
                />
              ))}
            </div>
          )}
        </div>
      );
    },
  );

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${className}`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        {stats && (
          <GraphStatsSummary
            nodes={nodes}
            masteredCount={stats.masteredCount}
            dueTodayCount={stats.dueTodayCount}
            isolatedCount={isolatedCount}
          />
        )}
        <div className="flex justify-between items-center mb-3 pr-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("graphEditor.outline.title", { count: nodes.length })}
          </h2>
          <div className="flex items-center gap-1">
            {onAddNode && !isReadOnly && (
              <button
                onClick={onAddNode}
                className="p-1.5 rounded transition-colors text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-500"
                title={t("graphEditor.outline.addNode")}
              >
                <Plus size={16} />
              </button>
            )}
            {!isReadOnly && (
              <button
                onClick={handleSelectIsolated}
                className="p-1.5 rounded transition-colors text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-500"
                title={t("graphEditor.outline.selectIsolatedNodes")}
              >
                <Eraser size={16} />
              </button>
            )}
            {filteredSuggestions.length > 0 && !isReadOnly && (
              <button
                onClick={() =>
                  setShowConnectionDiscovery(!showConnectionDiscovery)
                }
                className={`p-1.5 rounded transition-colors ${showConnectionDiscovery ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-500"}`}
                title={t("graphEditor.outline.connectionDiscovery", {
                  count: filteredSuggestions.length,
                })}
              >
                <Network size={16} />
              </button>
            )}
            {!isReadOnly && (
              <button
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  if (isMultiSelectMode && onSelectionChange) {
                    onSelectionChange(new Set());
                  }
                }}
                className={`p-1.5 rounded transition-colors ${isMultiSelectMode ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                title={
                  isMultiSelectMode
                    ? t("graphEditor.outline.exitMultiSelect")
                    : t("graphEditor.outline.multiSelectMode")
                }
              >
                <MousePointer2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("graphEditor.outline.searchNodes")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
          />
        </div>

        {/* View & Filter Controls */}
        <div className="flex items-center gap-2 mb-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-0.5">
            {templateType === "topic_research" && (
              <button
                onClick={() => setViewMode("module")}
                className={`p-1.5 rounded ${viewMode === "module" ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 hover:text-slate-600"}`}
                title="模块视图"
              >
                <Network size={14} />
              </button>
            )}
            {templateType === "topic_research" && (
              <button
                onClick={() => setViewMode("literature")}
                className={`p-1.5 rounded ${viewMode === "literature" ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 hover:text-slate-600"}`}
                title="文献视图"
              >
                <FileText size={14} />
              </button>
            )}
            <button
              onClick={() => setViewMode("tree")}
              className={`p-1.5 rounded ${viewMode === "tree" ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 hover:text-slate-600"}`}
              title={t("graphEditor.outline.treeView")}
            >
              <Layers size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-400 hover:text-slate-600"}`}
              title={t("graphEditor.outline.listView")}
            >
              <List size={14} />
            </button>
          </div>

          {/* Filter Dropdown */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <Filter size={12} className="text-slate-400" />
            </div>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full pl-7 pr-2 py-1 bg-slate-100 dark:bg-slate-800 border-none rounded text-xs text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary-500 appearance-none cursor-pointer"
            >
              <option value="all">{t("graphEditor.outline.allLevels")}</option>
              <option value="root">Root</option>
              <option value="core">Core</option>
              <option value="sub">Sub</option>
              <option value="normal">Normal</option>
              <option value="leaf">Leaf</option>
            </select>
          </div>

          {/* Sort Toggle (List Mode Only) */}
          {(viewMode === "list" || searchQuery || filterLevel !== "all") && (
            <button
              onClick={() =>
                setSortMode((prev) => (prev === "title" ? "level" : "title"))
              }
              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 hover:text-primary-600"
              title={
                sortMode === "title"
                  ? t("graphEditor.outline.sortByTitle")
                  : t("graphEditor.outline.sortByLevel")
              }
            >
              {sortMode === "title" ? (
                <ArrowDownAZ size={14} />
              ) : (
                <ArrowUpAZ size={14} />
              )}
            </button>
          )}
        </div>

        {/* Batch Actions Toolbar */}
        {isMultiSelectMode && !isReadOnly && (
          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                title={t("graphEditor.outline.selectAll")}
              >
                {selectedNodeIds.size === nodes.length && nodes.length > 0 ? (
                  <CheckSquare size={16} />
                ) : (
                  <Square size={16} />
                )}
              </button>
              <span className="text-xs text-slate-500 font-medium">
                {t("graphEditor.outline.selected", {
                  count: selectedNodeIds.size,
                })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onBatchAction?.("create_region")}
                disabled={selectedNodeIds.size < 2}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("graphEditor.region.createRegion")}
              >
                <Palette size={16} />
              </button>
              <button
                onClick={() => setIsBatchGenerateOpen(true)}
                disabled={selectedNodeIds.size === 0}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("graphEditor.outline.batchGenerateQuestions")}
              >
                <Sparkles size={16} />
              </button>
              <button
                onClick={() => onBatchAction?.("expand_graph")}
                disabled={selectedNodeIds.size === 0}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("graphEditor.outline.backgroundExpand")}
              >
                <Wand2 size={16} />
              </button>
              <button
                onClick={() => onBatchAction?.("delete")}
                disabled={selectedNodeIds.size === 0}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("graphEditor.outline.batchDelete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connection Discovery Panel */}
      {showConnectionDiscovery &&
        filteredSuggestions.length > 0 &&
        !isReadOnly && (
          <div className="border-b border-slate-200 dark:border-slate-800 p-3 bg-primary-50/50 dark:bg-primary-900/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-primary-500" />
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                  {t("graphEditor.outline.connectionDiscovery", {
                    count: filteredSuggestions.length,
                  })}
                </span>
              </div>
              <button
                onClick={() => setShowConnectionDiscovery(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredSuggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.sourceId}-${suggestion.targetId}-${idx}`}
                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                        {suggestion.sourceTitle}
                      </span>
                      <Link2 size={10} className="text-primary-400" />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                        {suggestion.targetTitle}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {suggestion.reason}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleConnect(suggestion)}
                      className="p-1 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded"
                      title={t("graphEditor.outline.establishConnection")}
                    >
                      <Link2 size={12} />
                    </button>
                    <button
                      onClick={() =>
                        handleDismissConnection(
                          suggestion.sourceId,
                          suggestion.targetId,
                        )
                      }
                      className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      title={t("graphEditor.outline.ignore")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="flex-1 overflow-y-auto py-2">
        {viewMode === "module" &&
        !searchQuery.trim() &&
        filterLevel === "all" ? (
          <div className="space-y-0.5 px-2">{renderModuleView()}</div>
        ) : viewMode === "literature" &&
          !searchQuery.trim() &&
          filterLevel === "all" ? (
          <div className="space-y-0.5 px-2">{renderLiteratureView()}</div>
        ) : viewMode === "list" ||
          searchQuery.trim() ||
          filterLevel !== "all" ? (
          <div className="space-y-0.5 px-2">{renderList()}</div>
        ) : (
          <div className="space-y-0.5">
            {rootNodes.length === 0 && nodes.length > 0
              ? nodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    visited={new Set()}
                    isReadOnly={isReadOnly}
                  />
                ))
              : rootNodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    visited={new Set()}
                    isReadOnly={isReadOnly}
                  />
                ))}
            {nodes.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                {t("graphEditor.outline.noNodes")}
              </div>
            )}
          </div>
        )}
      </div>

      <BatchGenerateDialog
        isOpen={isBatchGenerateOpen}
        onClose={() => setIsBatchGenerateOpen(false)}
        selectedNodeIds={Array.from(selectedNodeIds)}
        onSuccess={handleBatchGenerateSuccess}
      />
    </div>
  );
});
