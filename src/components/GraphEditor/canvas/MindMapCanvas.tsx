import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useTranslation } from 'react-i18next';
import type {
  Node,
  Edge,
  ColorScheme,
  LinkStyle,
  LinkAnimation,
  BranchSuggestion,
  TemplateLayout,
  NodeSizeMode,
  EdgeWidthMode,
  LayoutNode,
  GraphColorMode,
  NodeStatus,
  Node as GraphNode,
} from "../../../types";
import type { GraphRef } from "../../../hooks/graphEditor";
import { MindMapNode } from "./MindMapNode";
import { MindMapLink } from "./MindMapLink";
import { AlternativeBranches } from "../shared/AlternativeBranches";
import { CanvasLayout } from "./CanvasLayout";
import { MiniMap } from "./MiniMap";
import { ColorModeLegend } from "./HeatmapLegend";
import { LayoutOrganizer } from "../shared/LayoutOrganizer";
import { NodePreviewCard } from "../shared/NodePreviewCard";
import { MobileNodePreviewCard } from "../mobile/MobileNodePreviewCard";
import { EdgeContextMenu } from "../context-menu/EdgeContextMenu";
import { EdgeEditDialog } from "../modals/EdgeEditDialog";
import { EmptyState } from "../../common";
import { Network } from "lucide-react";
import {
  useSpatialGrid,
  useViewportBounds,
  useVisibleNodes,
  useVisibleEdges,
  useVisibleNodeSet,
} from "../shared/hooks/useVirtualization";
import { createMindMapLayout, createSemanticLayout, type LayoutResult } from "../../../utils/mindmapLayout";
import { useGraphWorker } from "../../../hooks/common/useWorker";
import { THEME_COLORS } from "../../../config/learningStatusColors";
import { DECAY_CONFIG } from "../../../config/graphConfig";
import { useTheme } from "../../../hooks";
import {
  calculateNodeImportance,
  calculateEdgeStrength,
  calculateGlobalMaxDegree,
  calculateGlobalMaxChildren,
  buildGraphEdgeMaps,
  buildLevelMap,
  buildNodeImportanceMaps,
} from "../../../utils/graph/graphUtils";
import {
  useCanvasTransform,
  useCanvasInteraction,
  useEdgeManagement,
} from "./MindMapCanvas/index";
import { useSemanticZoom } from "../../../hooks/graphEditor/useSemanticZoom";

const EMPTY_STRING_SET = new Set<string>();
const EMPTY_NUMBER_MAP = new Map<string, number>();
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_ALTERNATIVE_BRANCHES: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[] = [];

/** Props that affect rendering, compared by reference or value.
 *  Skipped: sidebarMode, isRightPanelOpen (prefixed with _ in component, unused in render output). */
const COMPARED_PROPS: readonly (keyof MindMapCanvasProps)[] = [
  // Core data (stable from React Query / state)
  'nodes', 'edges', 'nodeStatus',
  // Selection & focus state
  'selectedNodeId', 'focusedNodeId', 'focusedNodeIds', 'focusedLinkIds', 'forceShowTextIds', 'highlightedPathNodeId', 'multiSelectedNodeIds',
  // Visual configuration
  'colorScheme', 'linkStyle', 'linkAnimation', 'coloringMode', 'nodeSizeMode', 'edgeWidthMode', 'templateLayout', 'layoutMode',
  // Layout & sizing
  'width', 'height', 'rightPanelWidth', 'leftPanelWidth',
  // Mode flags
  'isExplorationMode', 'isSelectingParent', 'isMobilePreviewMode', 'isNarrativeMode',
  // Narrative mode
  'narrativeRevealedNodeIds', 'narrativeCurrentNodeId',
  // Branch exploration
  'branchSuggestions', 'selectedNodeForBranch', 'historicalAlternativeBranches',
  // Parent selection
  'currentNodeId', 'selectedParentIds',
  // Learning path
  'learningPathNodeIds', 'learningPathOrderMap',
  // Semantic layout
  'embeddings',
  // Search highlight
  'searchHighlightNodeId',
  // Identifiers & misc
  'graphId', 'previewDelay',
  // Callbacks (stable from useCallback in parent)
  'onNodeClick', 'onCanvasClick', 'onSelectBranch', 'onSwitchBranch',
  'onNodeContextMenu', 'onEdgeContextMenu', 'onCanvasContextMenu', 'onEdgeUpdate', 'onEdgeDelete',
  'onLayoutUpdate', 'onSelectParent', 'onNavigateToGraphMap',
  'onMarkNodeMastered', 'onNodeLongPress', 'onOpenDetail',
  // External UI reporting
  'onZoomChange',
  // Edge display mode
  'edgeDisplayMode',
  // Marquee multi-select
  'onMarqueeSelect',
];

function areEqual(prev: MindMapCanvasProps, next: MindMapCanvasProps): boolean {
  return COMPARED_PROPS.every(key => Object.is(prev[key], next[key]));
}

interface MindMapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, NodeStatus>;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  sidebarMode?: "none" | "edit" | "outline" | "create" | "detail";
  focusedNodeIds?: Set<string>;
  focusedLinkIds?: Set<string>;
  onCanvasClick?: () => void;
  forceShowTextIds?: Set<string>;
  focusedNodeId?: string | null;
  colorScheme?: ColorScheme;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
  branchSuggestions?: BranchSuggestion[];
  selectedNodeForBranch?: GraphNode | null;
  onSelectBranch?: (suggestion: BranchSuggestion) => void;
  onSwitchBranch?: (pathItem: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }, suggestion: BranchSuggestion) => void;
  isExplorationMode?: boolean;
  historicalAlternativeBranches?: {
    nodeId: string;
    branches: BranchSuggestion[];
    selectedBranchId: string;
  }[];
  templateLayout?: TemplateLayout;
  nodeSizeMode?: NodeSizeMode;
  edgeWidthMode?: EdgeWidthMode;
  onNodeContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeUpdate?: (edgeId: string, data: Partial<Edge>) => Promise<void>;
  onEdgeDelete?: (edgeId: string) => Promise<void>;
  coloringMode?: GraphColorMode;
  isRightPanelOpen?: boolean;
  rightPanelWidth?: number;
  graphId?: string;
  onLayoutUpdate?: (positions: Map<string, { x: number; y: number }>) => void;
  isSelectingParent?: boolean;
  onSelectParent?: (nodeId: string) => void;
  currentNodeId?: string;
  selectedParentIds?: string[];
  leftPanelWidth?: number;
  onNavigateToGraphMap?: () => void;
  onMarkNodeMastered?: (nodeId: string) => void;
  previewDelay?: number;
  onNodeLongPress?: (node: GraphNode) => void;
  isMobilePreviewMode?: boolean;
  onOpenDetail?: () => void;
  learningPathNodeIds?: Set<string>;
  learningPathOrderMap?: Map<string, number>;
  highlightedPathNodeId?: string | null;
  // Narrative mode
  isNarrativeMode?: boolean;
  narrativeRevealedNodeIds?: Set<string>;
  narrativeCurrentNodeId?: string | null;
  // Semantic layout mode
  layoutMode?: "force" | "semantic";
  embeddings?: Map<string, number[]>;
  // Canvas context menu
  onCanvasContextMenu?: (event: React.MouseEvent, canvasPosition: { x: number; y: number }) => void;
  // Search highlight
  searchHighlightNodeId?: string | null;
  // Zoom level reporting for external UI (e.g. toolbar indicator)
  onZoomChange?: (zoom: number) => void;
  // Edge display mode: full (default), simplified (no labels, thinner), hidden (no edges)
  edgeDisplayMode?: 'full' | 'simplified' | 'hidden';
  // Multi-selected node ids (for marquee/box selection visual highlight)
  multiSelectedNodeIds?: Set<string>;
  // Marquee (box) selection callback; additive=true means union with existing selection
  onMarqueeSelect?: (nodeIds: string[], additive: boolean) => void;
}

export const MindMapCanvas = React.memo(
  forwardRef<GraphRef | null, MindMapCanvasProps>(
  (
    {
      nodes,
      edges,
      nodeStatus,
      selectedNodeId,
      onNodeClick,
      width = 800,
      height = 600,
      sidebarMode: _sidebarMode = "none",
      focusedNodeIds = EMPTY_STRING_SET,
      focusedLinkIds = EMPTY_STRING_SET,
      onCanvasClick,
      forceShowTextIds = EMPTY_STRING_SET,
      focusedNodeId = null,
      colorScheme = "default",
      linkStyle = "curved",
      linkAnimation = "none",
      branchSuggestions = [],
      selectedNodeForBranch = null,
      onSelectBranch,
      onSwitchBranch,
      isExplorationMode = false,
      historicalAlternativeBranches = EMPTY_ALTERNATIVE_BRANCHES,
      templateLayout,
      nodeSizeMode = "fixed",
      edgeWidthMode = "fixed",
      onNodeContextMenu,
      onEdgeContextMenu,
      onEdgeUpdate,
      onEdgeDelete,
      coloringMode = "status",
      isRightPanelOpen: _isRightPanelOpen = false,
      rightPanelWidth = 0,
      graphId,
      onLayoutUpdate,
      isSelectingParent = false,
      onSelectParent,
      currentNodeId,
      selectedParentIds = EMPTY_STRING_ARRAY,
      leftPanelWidth = 0,
      onNavigateToGraphMap,
      onMarkNodeMastered,
      previewDelay = 500,
      onNodeLongPress,
      isMobilePreviewMode = false,
      onOpenDetail,
      learningPathNodeIds = EMPTY_STRING_SET,
      learningPathOrderMap = EMPTY_NUMBER_MAP,
      highlightedPathNodeId = null,
      isNarrativeMode = false,
      narrativeRevealedNodeIds = EMPTY_STRING_SET,
      narrativeCurrentNodeId = null,
      layoutMode: _layoutMode = "force",
      embeddings,
      onCanvasContextMenu,
      searchHighlightNodeId = null,
      onZoomChange,
      edgeDisplayMode = 'full',
      multiSelectedNodeIds,
      onMarqueeSelect,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { isDark } = useTheme();
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<SVGGElement>(null);

    const [containerSize, setContainerSize] = useState({
      width: typeof window !== "undefined" ? window.innerWidth : width,
      height: typeof window !== "undefined" ? window.innerHeight : height,
    });

    useEffect(() => {
      const updateContainerSize = () => {
        if (containerRef.current) {
          setContainerSize({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };

      updateContainerSize();

      const resizeObserver = new ResizeObserver(updateContainerSize);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => resizeObserver.disconnect();
    }, []);

    const {
      transform,
      transformRef,
      animateCamera,
      updateTransformDOM,
      updateTransformState,
    } = useCanvasTransform({ contentRef });

    const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

    const {
      semanticLevel,
      semanticLevelLabel,
      nodeStrategies,
      semanticVisibleEdgeIds,
    } = useSemanticZoom({
      zoomK: transform.k,
      nodes,
      edges,
    });

    // 异步布局状态
    const [layout, setLayout] = useState<LayoutResult | null>(null);
    const [isLayoutCalculating, setIsLayoutCalculating] = useState(false);
    const [semanticLayoutUnavailable, setSemanticLayoutUnavailable] = useState(false);

    // Worker hook
    const { calculateMindMapLayout, calculateSemanticLayout } = useGraphWorker();

    // 防抖 + 异步布局计算
    useEffect(() => {
      if (nodes.length === 0) {
        setLayout(null);
        return;
      }

      const isSemanticMode = _layoutMode === "semantic" && embeddings && embeddings.size > 0;

      if (_layoutMode === "semantic" && (!embeddings || embeddings.size === 0)) {
        setSemanticLayoutUnavailable(true);
      } else {
        setSemanticLayoutUnavailable(false);
      }

      const timer = setTimeout(async () => {
        setIsLayoutCalculating(true);
        try {
          if (isSemanticMode) {
            if (!embeddings) {
              return;
            }
            // Semantic layout: convert Map to Record for Worker serialization
            const embeddingsRecord: Record<string, number[]> = {};
            embeddings.forEach((value, key) => {
              embeddingsRecord[key] = value;
            });

            const result = await calculateSemanticLayout(
              nodes,
              edges as unknown as Array<Record<string, unknown>>,
              embeddingsRecord,
              {
                width: containerSize.width,
                height: containerSize.height,
              }
            );
            if (result) {
              setLayout(result as unknown as LayoutResult);
            } else {
              // Fallback: Worker 不可用时降级为主线程同步计算
              console.warn('[MindMapCanvas] Worker semantic layout failed, falling back to main thread');
              const fallbackResult = createSemanticLayout(nodes, edges, embeddings, {
                width: containerSize.width,
                height: containerSize.height,
              });
              setLayout(fallbackResult);
            }
          } else {
            // Force-directed layout (default)
            const result = await calculateMindMapLayout(
              nodes,
              edges as unknown as Array<Record<string, unknown>>,
              {
                width: containerSize.width,
                height: containerSize.height,
              }
            );
            if (result) {
              setLayout(result as unknown as LayoutResult);
            } else {
              // Fallback: Worker 不可用时降级为主线程同步计算
              console.warn('[MindMapCanvas] Worker layout failed, falling back to main thread');
              const fallbackResult = createMindMapLayout(nodes, edges, {
                width: containerSize.width,
                height: containerSize.height,
              });
              setLayout(fallbackResult);
            }
          }
        } catch (error) {
          // 错误时也降级到主线程
          console.warn('[MindMapCanvas] Worker layout error, falling back to main thread', error);
          if (isSemanticMode) {
            if (!embeddings) {
              return;
            }
            const fallbackResult = createSemanticLayout(nodes, edges, embeddings, {
              width: containerSize.width,
              height: containerSize.height,
            });
            setLayout(fallbackResult);
          } else {
            const fallbackResult = createMindMapLayout(nodes, edges, {
              width: containerSize.width,
              height: containerSize.height,
            });
            setLayout(fallbackResult);
          }
        } finally {
          setIsLayoutCalculating(false);
        }
      }, 300); // 300ms 防抖

      return () => clearTimeout(timer);
    }, [nodes, edges, containerSize, calculateMindMapLayout, calculateSemanticLayout, _layoutMode, embeddings]);

    const layoutNodes = useMemo(() => layout?.nodes ?? [], [layout]);
    const layoutLinks = useMemo(() => layout?.links ?? [], [layout]);

    const interaction = useCanvasInteraction({
      svgRef,
      containerSize,
      transformRef,
      updateTransformDOM,
      updateTransformState,
      animateCamera,
      onCanvasClick,
      onNodeLongPress: onNodeLongPress as ((node: LayoutNode) => void) | undefined,
      onNodeClick: onNodeClick as (node: LayoutNode) => void,
      layout: layout as { nodes: LayoutNode[]; links: { id: string }[] } | null,
      nodes,
      rightPanelWidth,
      leftPanelWidth,
      isMobilePreviewMode,
      selectedNodeId,
      previewDelay,
      isSelectingParent,
      onSelectParent,
      currentNodeId,
      onMarqueeSelect,
    });

    const edgeMgmt = useEdgeManagement({
      edges,
      onEdgeContextMenu,
      onEdgeUpdate,
      onEdgeDelete,
    });

    const spatialGrid = useSpatialGrid(layoutNodes);
    const viewportBounds = useViewportBounds(
      transformRef.current,
      containerSize,
      200,
      interaction.viewportVersion,
    );

    const visibleNodes = useVisibleNodes(
      layoutNodes,
      spatialGrid,
      viewportBounds,
      isExplorationMode,
    );

    // Apply semantic zoom filtering on top of virtualization
    const semanticallyFilteredNodes = useMemo(() => {
      return visibleNodes.filter((node) => {
        const strategy = nodeStrategies.get(node.id);
        return strategy?.visible ?? true;
      });
    }, [visibleNodes, nodeStrategies]);

    const visibleNodeIds = useVisibleNodeSet(semanticallyFilteredNodes);

    const visibleLinks = useVisibleEdges(
      layoutLinks,
      layoutNodes,
      visibleNodeIds,
      viewportBounds,
    );

    // Filter edges by semantic zoom level - only show edges where both endpoints are visible
    const semanticVisibleLinks = useMemo(() => {
      if (semanticVisibleEdgeIds.size === 0) return [];
      return visibleLinks.filter(link => semanticVisibleEdgeIds.has(link.id));
    }, [visibleLinks, semanticVisibleEdgeIds]);

    // Narrative mode filtering - narrative takes priority over semantic zoom
    // but still respects semantic zoom visibility (nodes hidden by zoom stay hidden)
    const narrativeFilteredNodes = useMemo(() => {
      if (!isNarrativeMode) return semanticallyFilteredNodes;
      return semanticallyFilteredNodes.filter(node => narrativeRevealedNodeIds.has(node.id));
    }, [isNarrativeMode, semanticallyFilteredNodes, narrativeRevealedNodeIds]);

    const narrativeFilteredLinks = useMemo(() => {
      if (!isNarrativeMode) return semanticVisibleLinks;
      return layoutLinks.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return narrativeRevealedNodeIds.has(sourceId) && narrativeRevealedNodeIds.has(targetId);
      });
    }, [isNarrativeMode, semanticVisibleLinks, narrativeRevealedNodeIds, isNarrativeMode ? layoutLinks : null]);

    // 第一步：决定处理哪些节点（轻量，3 项依赖）
    const nodesForImportance = useMemo(() => {
      if (nodeSizeMode === "fixed") return null;
      return isNarrativeMode ? narrativeFilteredNodes : semanticallyFilteredNodes;
    }, [nodeSizeMode, isNarrativeMode, narrativeFilteredNodes, semanticallyFilteredNodes]);

    // 预计算全局 maxDegree 和 maxChildren，避免每个节点重复计算
    const globalMaxDegree = useMemo(() => {
      if (nodeSizeMode === "fixed") return 1;
      return calculateGlobalMaxDegree(nodes, edges);
    }, [nodes, edges, nodeSizeMode]);

    const globalMaxChildren = useMemo(() => {
      if (nodeSizeMode === "fixed") return 1;
      return calculateGlobalMaxChildren(nodes, edges);
    }, [nodes, edges, nodeSizeMode]);

    // 第二步：计算重要性分数（4 项依赖）
    const importanceMaps = useMemo(() => buildNodeImportanceMaps(nodes, edges), [nodes, edges]);

    const nodeImportanceMap = useMemo(() => {
      if (!nodesForImportance) return new Map<string, number>();
      const map = new Map<string, number>();
      nodesForImportance.forEach((node) => {
        const importance = calculateNodeImportance(
          node as Node,
          nodes,
          edges,
          nodeStatus,
          globalMaxDegree,
          globalMaxChildren,
          importanceMaps,
        );
        map.set(node.id, importance.score);
      });
      return map;
    }, [nodesForImportance, nodes, edges, nodeStatus, globalMaxDegree, globalMaxChildren, importanceMaps]);

    // 第一步：决定处理哪些边（3 项依赖）
    const linksForStrength = useMemo(() => {
      if (edgeWidthMode === "fixed") return null;
      return isNarrativeMode ? narrativeFilteredLinks : semanticVisibleLinks;
    }, [edgeWidthMode, isNarrativeMode, narrativeFilteredLinks, semanticVisibleLinks]);

    // 第二步：预构建 edge 查找 Map（1 项依赖）
    const edgeLookupMap = useMemo(() => {
      return new Map(edges.map(e => [e.id, e]));
    }, [edges]);

    // 第三步：计算边强度（3 项依赖）
    const graphEdgeMaps = useMemo(() => buildGraphEdgeMaps(nodes, edges), [nodes, edges]);

    const levelMap = useMemo(() => buildLevelMap(nodes, edges), [nodes, edges]);

    const edgeStrengthMap = useMemo(() => {
      if (!linksForStrength) return new Map<string, number>();
      const map = new Map<string, number>();
      linksForStrength.forEach((link) => {
        const edge = edgeLookupMap.get(link.id);
        if (edge) {
          const strength = calculateEdgeStrength(edge, nodes, edges, graphEdgeMaps);
          map.set(link.id, strength.score);
        }
      });
      return map;
    }, [linksForStrength, edgeLookupMap, nodes, graphEdgeMaps]);

    const decayStats = useMemo(() => {
      if (coloringMode !== "decay" || !nodeStatus) return null;
      const entries = Object.entries(nodeStatus);
      const decayedNodes = entries.filter(([, status]) =>
        status.fsrs_retrievability != null && status.fsrs_retrievability < DECAY_CONFIG.severeDecayThreshold
      );
      if (decayedNodes.length === 0) return null;

      const mostDecayed = decayedNodes.reduce((worst, current) =>
        (current[1].fsrs_retrievability ?? 1) < (worst[1].fsrs_retrievability ?? 1) ? current : worst
      );

      return {
        count: decayedNodes.length,
        mostDecayedNodeId: mostDecayed[0],
      };
    }, [coloringMode, nodeStatus]);

    const visualCenterY = interaction.visualCenterY;

    useImperativeHandle(ref, () => ({
      captureScreenshot: async (options?: {
        backgroundColor?: string | null;
        transparent?: boolean;
        fitView?: boolean;
        hideGrid?: boolean;
      }) => {
        if (!svgRef.current) return null;
        try {
          // If fitView, temporarily adjust transform to fit all nodes
          let savedTransform: { x: number; y: number; k: number } | null = null;
          if (options?.fitView && layout && layout.nodes.length > 0) {
            savedTransform = { ...transformRef.current };
            const padding = 60;
            const effectiveRightWidth = rightPanelWidth || 0;
            const effectiveLeftWidth = leftPanelWidth || 0;
            const availableWidth =
              containerSize.width - effectiveRightWidth - effectiveLeftWidth - padding * 2;
            const availableHeight = containerSize.height - padding * 2;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            layout.nodes.forEach((node) => {
              minX = Math.min(minX, node.x);
              maxX = Math.max(maxX, node.x);
              minY = Math.min(minY, node.y);
              maxY = Math.max(maxY, node.y);
            });

            const contentWidth = maxX - minX + 200;
            const contentHeight = maxY - minY + 200;
            const scaleK = Math.min(
              availableWidth / contentWidth,
              availableHeight / contentHeight,
              1.5,
            );
            const clampedK = Math.max(0.1, Math.min(scaleK, 2));

            const centerX =
              (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
            const centerY = containerSize.height / 2;
            const contentCenterX = (minX + maxX) / 2;
            const contentCenterY = (minY + maxY) / 2;

            const fitTransform = {
              x: centerX - contentCenterX * clampedK,
              y: centerY - contentCenterY * clampedK,
              k: clampedK,
            };
            transformRef.current = fitTransform;
            updateTransformDOM(fitTransform);
          }

          // If hideGrid, temporarily hide the canvas-layout elements
          const gridElements = svgRef.current.querySelectorAll('.canvas-layout');
          if (options?.hideGrid) {
            gridElements.forEach((el) => {
              (el as SVGElement).setAttribute('data-was-visible', 'true');
              (el as SVGElement).style.display = 'none';
            });
          }

          // Wait a frame for DOM updates to take effect
          await new Promise((resolve) => requestAnimationFrame(resolve));

          const element = svgRef.current.parentElement as HTMLElement;
          // 按需动态导入 html2canvas (~200KB)，避免打入主 bundle
          const { default: html2canvas } = await import("html2canvas");
          const canvas = await html2canvas(element, {
            backgroundColor: options?.transparent
              ? null
              : (options?.backgroundColor || (isDark ? "#0f172a" : "#ffffff")),
            scale: 2,
            logging: false,
            useCORS: true,
            ignoreElements: (el) => el.tagName === "BUTTON",
          });

          // Restore grid elements
          if (options?.hideGrid) {
            gridElements.forEach((el) => {
              const svgEl = el as SVGElement;
              if (svgEl.getAttribute('data-was-visible') === 'true') {
                svgEl.style.display = '';
                svgEl.removeAttribute('data-was-visible');
              }
            });
          }

          // Restore transform
          if (savedTransform) {
            transformRef.current = savedTransform;
            updateTransformDOM(savedTransform);
            updateTransformState(savedTransform);
          }

          return canvas.toDataURL("image/png");
        } catch (error) {
          console.error("Screenshot failed:", error);
          throw error;
        }
      },
      centerNode: (
        nodeId: string,
        options?: { forceRightPanelOpen?: boolean },
      ) => {
        if (!layout) return;
        const node = layout.nodes.find((n) => n.id === nodeId);
        if (node) {
          const effectiveRightWidth = options?.forceRightPanelOpen
            ? rightPanelWidth || 340
            : rightPanelWidth;

          const effectiveVisualCenterX =
            (containerSize.width - effectiveRightWidth) / 2;

          const targetK = 1.2;
          const targetX = effectiveVisualCenterX - node.x * targetK;
          const targetY = interaction.visualCenterY - node.y * targetK;
          animateCamera(targetX, targetY, targetK, 800);
        }
      },
      zoomIn: () => {
        const newK = Math.min(transformRef.current.k * 1.3, 5);
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const newX =
          centerX -
          (centerX - transformRef.current.x) * (newK / transformRef.current.k);
        const newY =
          centerY -
          (centerY - transformRef.current.y) * (newK / transformRef.current.k);
        animateCamera(newX, newY, newK, 300);
      },
      zoomOut: () => {
        const newK = Math.max(transformRef.current.k / 1.3, 0.1);
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const newX =
          centerX -
          (centerX - transformRef.current.x) * (newK / transformRef.current.k);
        const newY =
          centerY -
          (centerY - transformRef.current.y) * (newK / transformRef.current.k);
        animateCamera(newX, newY, newK, 300);
      },
      resetZoom: () => {
        const newK = 1;
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const newX =
          centerX -
          (centerX - transformRef.current.x) * (newK / transformRef.current.k);
        const newY =
          centerY -
          (centerY - transformRef.current.y) * (newK / transformRef.current.k);
        animateCamera(newX, newY, newK, 300);
      },
      getZoom: () => {
        return transformRef.current.k;
      },
      fitView: () => {
        if (!layout || layout.nodes.length === 0) return;

        const padding = 60;
        const effectiveRightWidth = rightPanelWidth || 0;
        const effectiveLeftWidth = leftPanelWidth || 0;
        const availableWidth =
          containerSize.width -
          effectiveRightWidth -
          effectiveLeftWidth -
          padding * 2;
        const availableHeight = containerSize.height - padding * 2;

        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        layout.nodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        });

        const contentWidth = maxX - minX + 200;
        const contentHeight = maxY - minY + 200;

        const scaleK = Math.min(
          availableWidth / contentWidth,
          availableHeight / contentHeight,
          1.5,
        );
        const clampedK = Math.max(0.1, Math.min(scaleK, 2));

        const centerX =
          (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
        const centerY = containerSize.height / 2;
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        const targetX = centerX - contentCenterX * clampedK;
        const targetY = centerY - contentCenterY * clampedK;

        animateCamera(targetX, targetY, clampedK, 500);
      },
      fitSelection: (nodeIds?: string[]) => {
        if (!layout || layout.nodes.length === 0) return;

        // Fall back to fitView when no selection
        if (!nodeIds || nodeIds.length === 0) {
          // Reuse the fitView logic above
          const padding = 60;
          const effectiveRightWidth = rightPanelWidth || 0;
          const effectiveLeftWidth = leftPanelWidth || 0;
          const availableWidth =
            containerSize.width -
            effectiveRightWidth -
            effectiveLeftWidth -
            padding * 2;
          const availableHeight = containerSize.height - padding * 2;

          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          layout.nodes.forEach((node) => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
          });

          const contentWidth = maxX - minX + 200;
          const contentHeight = maxY - minY + 200;
          const scaleK = Math.min(
            availableWidth / contentWidth,
            availableHeight / contentHeight,
            1.5,
          );
          const clampedK = Math.max(0.1, Math.min(scaleK, 2));
          const centerX =
            (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
          const centerY = containerSize.height / 2;
          const contentCenterX = (minX + maxX) / 2;
          const contentCenterY = (minY + maxY) / 2;
          animateCamera(
            centerX - contentCenterX * clampedK,
            centerY - contentCenterY * clampedK,
            clampedK,
            500,
          );
          return;
        }

        const idSet = new Set(nodeIds);
        const selectedNodes = layout.nodes.filter((n) => idSet.has(n.id));
        if (selectedNodes.length === 0) return;

        const padding = 80;
        const effectiveRightWidth = rightPanelWidth || 0;
        const effectiveLeftWidth = leftPanelWidth || 0;
        const availableWidth =
          containerSize.width -
          effectiveRightWidth -
          effectiveLeftWidth -
          padding * 2;
        const availableHeight = containerSize.height - padding * 2;

        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        // Account for node visual radius so the whole node fits in view
        const nodeRadius = 80;
        selectedNodes.forEach((node) => {
          minX = Math.min(minX, node.x - nodeRadius);
          maxX = Math.max(maxX, node.x + nodeRadius);
          minY = Math.min(minY, node.y - nodeRadius);
          maxY = Math.max(maxY, node.y + nodeRadius);
        });

        const contentWidth = Math.max(maxX - minX, 1);
        const contentHeight = Math.max(maxY - minY, 1);
        const scaleK = Math.min(
          availableWidth / contentWidth,
          availableHeight / contentHeight,
          2,
        );
        const clampedK = Math.max(0.1, Math.min(scaleK, 2));

        const centerX =
          (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
        const centerY = containerSize.height / 2;
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        animateCamera(
          centerX - contentCenterX * clampedK,
          centerY - contentCenterY * clampedK,
          clampedK,
          500,
        );
      },
      resetView: () => {
        if (!layout || layout.nodes.length === 0) return;

        const effectiveRightWidth = rightPanelWidth || 0;
        const effectiveLeftWidth = leftPanelWidth || 0;
        const visualCenterX =
          (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
        let vcY = containerSize.height / 2;
        if (isMobilePreviewMode && selectedNodeId) {
          vcY -= 140;
        }

        const rootNode =
          layout.nodes.find((n) => n.level === "root") || layout.nodes[0];
        const targetX = visualCenterX - rootNode.x;
        const targetY = vcY - rootNode.y;

        animateCamera(targetX, targetY, 1, 500);
      },
      getTransform: () => {
        const t = transformRef.current;
        return { x: t.x, y: t.y, k: t.k };
      },
      animateToTransform: (targetTransform: { x: number; y: number; k: number }, duration: number = 800) => {
        animateCamera(targetTransform.x, targetTransform.y, targetTransform.k, duration);
      },
    }));

    useEffect(() => {
      if (
        layout &&
        layout.nodes.length > 0 &&
        !focusedNodeId &&
        !interaction.hasUserInteracted.current
      ) {
        const rootNode =
          layout.nodes.find((n) => n.level === "root") || layout.nodes[0];
        // 与 resetView/fitView 方法保持一致：直接基于 props 计算有效视口中心
        const effectiveRightWidth = rightPanelWidth || 0;
        const effectiveLeftWidth = leftPanelWidth || 0;
        const initVisualCenterX =
          (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;

        const targetK = transformRef.current.k;
        const targetX = initVisualCenterX - rootNode.x * targetK;
        const targetY = interaction.visualCenterY - rootNode.y * targetK;

        if (
          Math.abs(transformRef.current.x - targetX) > 1 ||
          Math.abs(transformRef.current.y - targetY) > 1
        ) {
          const newTransform = { x: targetX, y: targetY, k: targetK };
          transformRef.current = newTransform;
          updateTransformDOM(newTransform);
          updateTransformState(newTransform);
        }
      }
    }, [
      layout,
      focusedNodeId,
      interaction.hasUserInteracted,
      containerSize.width,
      rightPanelWidth,
      leftPanelWidth,
      interaction.visualCenterY,
      transformRef,
      updateTransformDOM,
      updateTransformState,
    ]);

    useEffect(() => {
      if (focusedNodeId && layout) {
        const node = layout.nodes.find((n) => n.id === focusedNodeId);
        if (node) {
          // 与 centerNode 方法保持一致：直接基于 props 计算有效视口中心
          const effectiveRightWidth = rightPanelWidth || 0;
          const effectiveVisualCenterX =
            (containerSize.width - effectiveRightWidth) / 2;

          const targetK = 1.2;
          const targetX = effectiveVisualCenterX - node.x * targetK;
          const targetY = interaction.visualCenterY - node.y * targetK;
          animateCamera(targetX, targetY, targetK, 800);
        }
      }
    }, [focusedNodeId, layout, containerSize.width, rightPanelWidth, interaction.visualCenterY, animateCamera]);

    // Report zoom level changes to parent (for toolbar zoom indicator)
    useEffect(() => {
      onZoomChange?.(transform.k);
    }, [transform.k, onZoomChange]);

    const nodeMap = useMemo(() => new Map((layout?.nodes ?? []).map((n) => [n.id, n])), [layout?.nodes]);

    // 预构建 selectedParentIds 集合，将渲染路径的节点选中判断由 O(nodes*selectedParentIds) 降为 O(1)
    const selectedParentIdSet = useMemo(() => new Set(selectedParentIds), [selectedParentIds]);

    const focusedNodeTitle = useMemo(() => {
      if (!focusedNodeId) return null;
      const focusedNode = nodes.find((n) => n.id === focusedNodeId);
      return focusedNode?.title ?? null;
    }, [focusedNodeId, nodes]);

    if (!layout) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            {nodes.length === 0 ? (
              <EmptyState
                variant="panel"
                size="lg"
                icon={<Network className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
                iconWrapper
                illustration="empty"
                title={t('graphEditor.mindMap.noNodes')}
                description={t('graphEditor.mindMap.addNodeHint')}
              />
            ) : isLayoutCalculating ? (
              <div aria-live="polite">
                <div className="flex flex-col items-center gap-3 mx-auto mb-4" aria-hidden="true">
                  <div className="w-64 h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-48 h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-56 h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
                  <div className="w-40 h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
                </div>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  {_layoutMode === "semantic"
                    ? t('graphEditor.mindMapCanvas.semanticLoading')
                    : t('graphEditor.mindMap.loading')}
                </p>
                <span className="sr-only">{t('common.aria.loading')}</span>
              </div>
            ) : (
              <EmptyState
                variant="panel"
                illustration="error"
                title={t('graphEditor.mindMapCanvas.layoutFailed')}
                description={t('graphEditor.mindMapCanvas.layoutFailedHint')}
              />
            )}
          </div>
        </div>
      );
    }

    const hasFocusMode = focusedNodeId !== null && focusedNodeIds.size > 0;

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      >
        {semanticLayoutUnavailable && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-modal-overlay bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-lg text-sm text-amber-800 dark:text-amber-200">
            {t('graphEditor.mindMap.semanticUnavailable')}
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          role="application"
          aria-label={t('graphEditor.mindMapCanvas.ariaLabel', { count: nodes.length, focus: focusedNodeTitle ?? t('graphEditor.mindMapCanvas.emptyFocus') })}
          style={{
            backgroundColor: colors.background,
            cursor: interaction.isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onMouseDown={interaction.handleMouseDown}
          onMouseMove={interaction.handleMouseMove}
          onMouseUp={interaction.handleMouseUp}
          onMouseLeave={interaction.handleMouseUp}
          onTouchStart={interaction.handleTouchStart}
          onTouchMove={interaction.handleTouchMove}
          onTouchEnd={interaction.handleTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            if (onCanvasContextMenu && e.target === svgRef.current) {
              const transform = transformRef.current;
              const canvasX = (e.clientX - transform.x) / transform.k;
              const canvasY = (e.clientY - transform.y) / transform.k;
              onCanvasContextMenu(e, { x: canvasX, y: canvasY });
            }
          }}
        >
          <title>{t('graphEditor.mindMapCanvas.title')}</title>
          <desc>{t('graphEditor.mindMapCanvas.desc', { count: nodes.length })}</desc>
          <g ref={contentRef}>
            <CanvasLayout
              layout={templateLayout}
              width={containerSize.width}
              height={containerSize.height}
            />
            {edgeDisplayMode !== 'hidden' && narrativeFilteredLinks.map((link) => {
              const linkSourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const linkTargetId = typeof link.target === 'string' ? link.target : link.target.id;
              const isNarrativeEdge = isNarrativeMode && (linkSourceId === narrativeCurrentNodeId || linkTargetId === narrativeCurrentNodeId);
              return (
              <MindMapLink
                key={link.id}
                link={link}
                nodes={nodeMap}
                isDark={isDark}
                highlighted={false}
                focused={focusedLinkIds.has(link.id)}
                hasFocusMode={hasFocusMode}
                linkStyle={linkStyle}
                linkAnimation={isNarrativeEdge ? "flow" : linkAnimation}
                edgeWidthMode={edgeWidthMode}
                edgeStrength={edgeStrengthMap.get(link.id)}
                allNodes={nodes}
                allEdges={edges}
                graphEdgeMaps={graphEdgeMaps}
                onContextMenu={edgeMgmt.handleEdgeContextMenu}
                edgeDisplayMode={edgeDisplayMode}
              />
              );
            })}
            {narrativeFilteredNodes.map((node) => {
              const isSelectableAsParent =
                isSelectingParent && node.id !== currentNodeId;
              const isSelectedAsParent = selectedParentIdSet.has(node.id);
              const isInLearningPath = learningPathNodeIds.has(node.id);
              const learningOrder = learningPathOrderMap.get(node.id);
              const hasLearningPathHighlight =
                highlightedPathNodeId !== null && learningPathNodeIds.size > 0;
              const learningPathHighlighted =
                highlightedPathNodeId === node.id ||
                (hasLearningPathHighlight && isInLearningPath);
              const semanticStrategy = nodeStrategies.get(node.id);
              return (
                <MindMapNode
                  key={node.id}
                  node={node}
                  edges={edges}
                  nodeStatus={nodeStatus}
                  selected={node.id === selectedNodeId}
                  multiSelected={multiSelectedNodeIds?.has(node.id) ?? false}
                  isDark={isDark}
                  zoomLevel={transform.k}
                  onClick={() => interaction.handleNodeClick(node)}
                  onMouseEnter={(e) => interaction.handleNodeMouseEnter(e, node)}
                  onMouseLeave={interaction.handleNodeMouseLeave}
                  focused={focusedNodeIds.has(node.id)}
                  forceShowText={forceShowTextIds.has(node.id)}
                  hasFocusMode={hasFocusMode}
                  colorScheme={colorScheme}
                  nodeSizeMode={nodeSizeMode}
                  nodeImportance={nodeImportanceMap.get(node.id)}
                  allNodes={nodes}
                  onContextMenu={onNodeContextMenu}
                  coloringMode={coloringMode}
                  isSelectableAsParent={isSelectableAsParent}
                  isExcludedAsParent={
                    isSelectingParent && node.id === currentNodeId
                  }
                  isSelectedAsParent={isSelectedAsParent}
                  isTouchPressed={interaction.touchPressedNodeId === node.id}
                  isInLearningPath={isInLearningPath}
                  learningOrder={learningOrder}
                  learningPathHighlighted={learningPathHighlighted}
                  isNarrativeCurrent={isNarrativeMode && node.id === narrativeCurrentNodeId}
                  isSearchHighlight={node.id === searchHighlightNodeId}
                  semanticZoomLevel={semanticLevel}
                  showContentPreview={semanticStrategy?.showContentPreview ?? false}
                  showLearningStatus={semanticStrategy?.showLearningStatus ?? false}
                  showReviewCount={semanticStrategy?.showReviewCount ?? false}
                  maxTitleLength={semanticStrategy?.maxTitleLength}
                  childCount={semanticStrategy?.childCount ?? 0}
                  levelMap={levelMap}
                  importanceMaps={importanceMaps}
                />
              );
            })}
            {isExplorationMode &&
              selectedNodeForBranch &&
              branchSuggestions.length > 0 &&
              (() => {
                const layoutNode = visibleNodes.find(
                  (n) =>
                    String(n.id).trim() ===
                    String(selectedNodeForBranch.id).trim(),
                );
                if (!layoutNode) return null;
                return (
                  <AlternativeBranches
                    parentNode={layoutNode}
                    branches={branchSuggestions}
                    isDark={isDark}
                    onSelectBranch={onSelectBranch}
                  />
                );
              })()}
            {isExplorationMode &&
              historicalAlternativeBranches.map((item, index) => {
                const node = visibleNodes.find(
                  (n) => String(n.id).trim() === String(item.nodeId).trim(),
                );
                if (!node) return null;
                return (
                  <AlternativeBranches
                    key={`historical-${item.nodeId}-${index}`}
                    parentNode={node}
                    branches={item.branches}
                    selectedBranchId={item.selectedBranchId}
                    isDark={isDark}
                    pathItem={item}
                    onSwitchBranch={onSwitchBranch}
                  />
                );
              })}
            {interaction.marqueeRect && (
              <rect
                x={interaction.marqueeRect.x}
                y={interaction.marqueeRect.y}
                width={interaction.marqueeRect.width}
                height={interaction.marqueeRect.height}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="rgba(59, 130, 246, 0.9)"
                strokeWidth={1 / transform.k}
                strokeDasharray={`${4 / transform.k} ${2 / transform.k}`}
                pointerEvents="none"
              />
            )}
          </g>
        </svg>

        <div
          className={`absolute flex flex-row gap-4 items-end pointer-events-none transition-all duration-300 ${isMobilePreviewMode && selectedNodeId ? "bottom-72" : "bottom-4"}`}
          style={{ right: rightPanelWidth > 0 ? rightPanelWidth + 16 : 16 }}
        >
          {interaction.showMiniMap && layout && (
            <div className="pointer-events-auto">
              <MiniMap
                nodes={visibleNodes}
                transform={transform}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                onTransformChange={interaction.handleMiniMapTransformChange}
                width={240}
                height={160}
                viewCenterX={interaction.visualCenterX}
                viewCenterY={visualCenterY}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pointer-events-auto">
            {onNavigateToGraphMap && (
              <button
                onClick={onNavigateToGraphMap}
                className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
                aria-label={t('graphEditor.mindMap.viewGraphMap')}
                title={t('graphEditor.mindMap.viewGraphMap')}
              >
                <svg aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>
            )}
            {graphId && onLayoutUpdate && (
              <LayoutOrganizer
                graphId={graphId}
                nodes={nodes}
                edges={edges}
                onLayoutUpdate={onLayoutUpdate}
              />
            )}
            <button
              onClick={() => interaction.setShowMiniMap(!interaction.showMiniMap)}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              title={interaction.showMiniMap ? t('graphEditor.mindMap.hideMiniMap') : t('graphEditor.mindMap.showMiniMap')}
            >
              <svg aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </button>

            <button
              onClick={interaction.handleZoomIn}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label={t('graphEditor.mindMap.zoomIn')}
              title={t('graphEditor.mindMap.zoomIn')}
            >
              <svg aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M12 5v14M5 12h14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              onClick={interaction.handleZoomOut}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label={t('graphEditor.mindMap.zoomOut')}
              title={t('graphEditor.mindMap.zoomOut')}
            >
              <svg aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M5 12h14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              onClick={interaction.handleResetView}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              title={t('graphEditor.mindMap.resetView')}
            >
              <svg aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M3 3v5h5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              onClick={interaction.handleFitView}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              title={t('graphEditor.mindMap.fitScreen')}
            >
              <svg aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`absolute left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm pointer-events-none transition-all duration-300 ${isMobilePreviewMode && selectedNodeId ? "bottom-72" : "bottom-4"}`}
        >
          {t('graphEditor.mindMap.zoom', { percent: Math.round(transform.k * 100) })}
          <span style={{ fontSize: 10, color: isDark ? '#64748B' : '#94A3B8', marginLeft: 4 }}>
            {t(semanticLevelLabel, { defaultValue: '' })}
          </span>
        </div>

        <ColorModeLegend coloringMode={coloringMode} isDark={isDark} />

        {decayStats && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 20,
              background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)'}`,
              backdropFilter: 'blur(4px)',
              zIndex: 10,
              cursor: 'pointer',
              fontSize: 13,
              color: isDark ? '#FCD34D' : '#B45309',
            }}
            onClick={() => {
              const targetNode = layout?.nodes.find(n => n.id === decayStats.mostDecayedNodeId);
              if (targetNode) {
                const targetK = 1.2;
                const targetX = interaction.visualCenterX - targetNode.x * targetK;
                const targetY = interaction.visualCenterY - targetNode.y * targetK;
                animateCamera(targetX, targetY, targetK, 800);
              }
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{t('graphEditor.decay.decayWarning', { count: decayStats.count })}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{t('graphEditor.decay.clickToFocus')}</span>
          </div>
        )}

        {interaction.showPreview &&
          interaction.previewNode &&
          !(isMobilePreviewMode && selectedNodeId) && (
            <NodePreviewCard
              node={interaction.previewNode.node}
              nodes={nodes}
              edges={edges}
              nodeStatus={nodeStatus}
              position={interaction.previewNode.position}
              onNavigateToNode={interaction.handlePreviewNavigate}
              onMarkMastered={onMarkNodeMastered}
              onMouseEnter={interaction.handlePreviewMouseEnter}
              onMouseLeave={interaction.handlePreviewMouseLeave}
            />
          )}

        {isMobilePreviewMode && selectedNodeId && (() => {
          const selectedNode = nodes.find((n) => n.id === selectedNodeId);
          if (!selectedNode) return null;
          return (
            <MobileNodePreviewCard
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              nodeStatus={nodeStatus}
              onNavigateToNode={(node) => {
                onNodeClick(node);
              }}
              onMarkMastered={onMarkNodeMastered}
              onOpenDetail={onOpenDetail}
              onClose={() => {
                if (onCanvasClick) onCanvasClick();
              }}
            />
          );
        })()}

        {edgeMgmt.contextMenuPosition && edgeMgmt.selectedEdge && (
          <EdgeContextMenu
            edge={edgeMgmt.selectedEdge}
            position={edgeMgmt.contextMenuPosition}
            onClose={edgeMgmt.handleCloseContextMenu}
            onEditLabel={edgeMgmt.handleEditLabel}
            onChangeRelationshipType={edgeMgmt.handleChangeRelationshipType}
            onDelete={edgeMgmt.handleDeleteEdge}
          />
        )}

        <EdgeEditDialog
          isOpen={edgeMgmt.isEditDialogOpen}
          edge={edgeMgmt.selectedEdge}
          onClose={edgeMgmt.handleCloseEditDialog}
          onSave={edgeMgmt.handleSaveEdge}
          relationshipTypes={edgeMgmt.relationshipTypes}
        />
      </div>
    );
  },
  ),
  areEqual,
);