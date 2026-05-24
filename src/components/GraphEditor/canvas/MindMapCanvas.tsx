import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useTranslation } from 'react-i18next';
import html2canvas from "html2canvas";
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
} from "../../../types";
import type { Node as GraphNode } from "../../../types";
import { MindMapNode } from "./MindMapNode";
import { MindMapLink } from "./MindMapLink";
import { AlternativeBranches } from "../shared/AlternativeBranches";
import { CanvasLayout } from "./CanvasLayout";
import { MiniMap } from "./MiniMap";
import { LayoutOrganizer } from "../shared/LayoutOrganizer";
import { NodePreviewCard } from "../shared/NodePreviewCard";
import { MobileNodePreviewCard } from "../mobile/MobileNodePreviewCard";
import { EdgeContextMenu } from "../context-menu/EdgeContextMenu";
import { EdgeEditDialog } from "../modals/EdgeEditDialog";
import {
  useSpatialGrid,
  useViewportBounds,
  useVisibleNodes,
  useVisibleEdges,
  useVisibleNodeSet,
} from "../shared/hooks/useVirtualization";
import { createMindMapLayout } from "../../../utils/mindmapLayout";
import { THEME_COLORS } from "../../../config/learningStatusColors";
import { useTheme } from "../../../hooks";
import {
  calculateNodeImportance,
  calculateEdgeStrength,
} from "../../../lib/graphUtils";
import {
  useCanvasTransform,
  useCanvasInteraction,
  useEdgeManagement,
} from "./MindMapCanvas/index";

interface MindMapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
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
}

export const MindMapCanvas = forwardRef<any, MindMapCanvasProps>(
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
      focusedNodeIds = new Set(),
      focusedLinkIds = new Set(),
      onCanvasClick,
      forceShowTextIds = new Set(),
      focusedNodeId = null,
      colorScheme = "default",
      linkStyle = "curved",
      linkAnimation = "none",
      branchSuggestions = [],
      selectedNodeForBranch = null,
      onSelectBranch,
      onSwitchBranch,
      isExplorationMode = false,
      historicalAlternativeBranches = [],
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
      selectedParentIds = [],
      leftPanelWidth = 0,
      onNavigateToGraphMap,
      onMarkNodeMastered,
      previewDelay = 500,
      onNodeLongPress,
      isMobilePreviewMode = false,
      onOpenDetail,
      learningPathNodeIds = new Set(),
      learningPathOrderMap = new Map(),
      highlightedPathNodeId = null,
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

    const layout = useMemo(() => {
      if (nodes.length === 0) return null;
      return createMindMapLayout(nodes, edges, {
        width: containerSize.width,
        height: containerSize.height,
      });
    }, [nodes, edges, containerSize]);

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

    const visibleNodeIds = useVisibleNodeSet(visibleNodes);

    const visibleLinks = useVisibleEdges(
      layoutLinks,
      layoutNodes,
      visibleNodeIds,
      viewportBounds,
    );

    const nodeImportanceMap = useMemo(() => {
      if (nodeSizeMode === "fixed") return new Map<string, number>();
      const map = new Map<string, number>();
      visibleNodes.forEach((node) => {
        const importance = calculateNodeImportance(
          node as Node,
          nodes,
          edges,
          nodeStatus,
        );
        map.set(node.id, importance.score);
      });
      return map;
    }, [visibleNodes, nodes, edges, nodeStatus, nodeSizeMode]);

    const edgeStrengthMap = useMemo(() => {
      if (edgeWidthMode === "fixed") return new Map<string, number>();
      const map = new Map<string, number>();
      visibleLinks.forEach((link) => {
        const edge = edges.find((e) => e.id === link.id);
        if (edge) {
          const strength = calculateEdgeStrength(edge, nodes, edges);
          map.set(link.id, strength.score);
        }
      });
      return map;
    }, [visibleLinks, edges, nodes, edgeWidthMode]);

    const visualCenterY = interaction.visualCenterY;

    useImperativeHandle(ref, () => ({
      captureScreenshot: async (options?: any) => {
        if (!svgRef.current) return null;
        try {
          const element = svgRef.current.parentElement as HTMLElement;
          const canvas = await html2canvas(element, {
            backgroundColor:
              options?.backgroundColor || (isDark ? "#0f172a" : "#ffffff"),
            scale: 2,
            logging: false,
            useCORS: true,
            ignoreElements: (element) => element.tagName === "BUTTON",
          });
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
        const targetK = transformRef.current.k;
        const targetX = interaction.visualCenterX - rootNode.x * targetK;
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
      interaction.visualCenterX,
      interaction.visualCenterY,
      transformRef,
      updateTransformDOM,
      updateTransformState,
    ]);

    useEffect(() => {
      if (focusedNodeId && layout) {
        const node = layout.nodes.find((n) => n.id === focusedNodeId);
        if (node) {
          const targetK = 1.2;
          const targetX = interaction.visualCenterX - node.x * targetK;
          const targetY = interaction.visualCenterY - node.y * targetK;
          animateCamera(targetX, targetY, targetK, 800);
        }
      }
    }, [focusedNodeId, layout, interaction.visualCenterX, interaction.visualCenterY, animateCamera]);

    if (!layout) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            {nodes.length === 0 ? (
              <>
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {t('graphEditor.mindMap.noNodes')}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  {t('graphEditor.mindMap.addNodeHint')}
                </p>
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('graphEditor.mindMap.loading')}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }

    const hasFocusMode = focusedNodeId !== null && focusedNodeIds.size > 0;
    const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
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
          onContextMenu={(e) => e.preventDefault()}
        >
          <g ref={contentRef}>
            <CanvasLayout
              layout={templateLayout}
              width={containerSize.width}
              height={containerSize.height}
            />
            {visibleLinks.map((link) => (
              <MindMapLink
                key={link.id}
                link={link}
                nodes={nodeMap}
                isDark={isDark}
                highlighted={false}
                focused={focusedLinkIds.has(link.id)}
                hasFocusMode={hasFocusMode}
                linkStyle={linkStyle}
                linkAnimation={linkAnimation}
                edgeWidthMode={edgeWidthMode}
                edgeStrength={edgeStrengthMap.get(link.id)}
                allNodes={nodes}
                allEdges={edges}
                onContextMenu={edgeMgmt.handleEdgeContextMenu}
              />
            ))}
            {visibleNodes.map((node) => {
              const isSelectableAsParent =
                isSelectingParent && node.id !== currentNodeId;
              const isSelectedAsParent = selectedParentIds.includes(node.id);
              const isInLearningPath = learningPathNodeIds.has(node.id);
              const learningOrder = learningPathOrderMap.get(node.id);
              const hasLearningPathHighlight =
                highlightedPathNodeId !== null && learningPathNodeIds.size > 0;
              const learningPathHighlighted =
                highlightedPathNodeId === node.id ||
                (hasLearningPathHighlight && isInLearningPath);
              return (
                <MindMapNode
                  key={node.id}
                  node={node}
                  edges={edges}
                  nodeStatus={nodeStatus}
                  selected={node.id === selectedNodeId}
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
                title={t('graphEditor.mindMap.viewGraphMap')}
              >
                <svg
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
              <svg
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
              title={t('graphEditor.mindMap.zoomIn')}
            >
              <svg
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
              title={t('graphEditor.mindMap.zoomOut')}
            >
              <svg
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
              <svg
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
              <svg
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
        </div>

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

        {isMobilePreviewMode && selectedNodeId && (
          <MobileNodePreviewCard
            node={nodes.find((n) => n.id === selectedNodeId)!}
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
        )}

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
);