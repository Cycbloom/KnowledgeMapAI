import React, { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  ColorScheme,
  LinkStyle,
  LinkAnimation,
  GraphRelation,
  GraphMapFilterMode,
  Graph,
  NodeShape,
  CenterDotShape,
  GridStyle,
} from "../../types";
import { CanvasLayout } from "../GraphEditor/canvas/CanvasLayout";
import { MiniMap } from "../GraphEditor/canvas/MiniMap";
import { createMindMapLayout, type LayoutResult } from "../../utils/mindmapLayout";
import { useGraphWorker } from "../../hooks/common/useWorker";
import {
  convertGraphsToNodes,
  convertRelationsToEdges,
  filterRelationsByType,
  getDomainGroups,
} from "../../utils/graphMapAdapter";
import { THEME_COLORS } from "../../config/learningStatusColors";
import { useTheme } from "../../hooks";
import { DomainBackground } from "./DomainBackground";
import { RelationshipLegend } from "./RelationshipLegend";
import { GraphNodes } from "./canvas/GraphNodes";
import { GraphEdges } from "./canvas/GraphEdges";
import { SelectionBox } from "./canvas/SelectionBox";
import { TransformControls } from "./canvas/TransformControls";
import { useGraphMapInteraction } from "./hooks/useGraphMapInteraction";

// 聚焦节点时，被高亮节点中至少 N 个属于某领域，才显示该领域的遮罩
const MIN_NEIGHBOR_DOMAIN_COUNT = 2;

interface GraphMapCanvasProps {
  graphs: Array<Graph & { node_count?: number }>;
  relations: GraphRelation[];
  selectedGraphId?: string | null;
  onGraphClick?: (graph: Graph | null) => void;
  width?: number;
  height?: number;
  filterMode?: GraphMapFilterMode;
  colorScheme?: ColorScheme;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
  nodeShape?: NodeShape;
  centerDotShape?: CenterDotShape;
  nodeGlow?: boolean;
  gridStyle?: GridStyle;
  fromGraphId?: string | null;
  fromGraphTitle?: string;
  onReturnToGraph?: () => void;
  multiSelectedGraphIds?: Set<string>;
  onMultiSelectGraph?: (
    graphId: string,
    isMultiSelect: boolean,
    isRangeSelect?: boolean,
  ) => void;
  onBoxSelection?: (graphIds: string[]) => void;
  selectedDomainIds?: Set<string>;
  hoveredDomainId?: string | null;
  /** 高亮焦点领域（点击选中或悬停），存在时该领域节点/区域高亮、其余淡化 */
  focusDomainId?: string | null;
  /** 点击领域胶囊标签 */
  onDomainPillClick?: (domainId: string) => void;
  /** 点击画布空白时清除领域点击高亮 */
  onDomainFocusClear?: () => void;
  domainColorMap?: Map<string, string>;
  domainIdToInfo?: Map<string, { name: string; color: string }>;
  graphDomainMap?: Map<string, Set<string>>;
}

export const GraphMapCanvas = forwardRef<
  { centerNode: (nodeId: string) => void },
  GraphMapCanvasProps
>(
  (
    {
      graphs,
      relations,
      selectedGraphId = null,
      onGraphClick,
      width = 800,
      height = 600,
      filterMode = "all",
      colorScheme = "default",
      linkStyle = "curved",
      linkAnimation = "none",
      nodeShape = 'circle',
      centerDotShape,
      nodeGlow = false,
      gridStyle = 'hidden',
      fromGraphId,
      fromGraphTitle,
      onReturnToGraph,
      multiSelectedGraphIds,
      onMultiSelectGraph,
      onBoxSelection,
      selectedDomainIds = new Set(),
      hoveredDomainId = null,
      focusDomainId = null,
      onDomainPillClick,
      onDomainFocusClear,
      domainColorMap = new Map(),
      domainIdToInfo,
      graphDomainMap = new Map(),
    },
    ref,
  ) => {
    void domainColorMap;

    const { t } = useTranslation();
    const { isDark } = useTheme();
    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<SVGGElement>(null);
    const layoutRef = useRef(null) as React.MutableRefObject<ReturnType<typeof createMindMapLayout> | null>;

    const {
      transform,
      transformRef,
      isDragging,
      containerSize,
      showMiniMap,
      showLegend,
      setShowLegend,
      focusedGraphId,
      setFocusedGraphId,
      isSelecting,
      selectionBox,
      applyTransform,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleCanvasClick,
      handleResetView,
      handleMiniMapTransformChange,
      handleZoomIn,
      handleZoomOut,
      handleToggleMiniMap,
      handleToggleLegend,
      animateCamera,
      svgCallbackRef,
      hasMoved,
      panMovedRef,
    } = useGraphMapInteraction({
      ref,
      svgRef,
      containerRef,
      contentRef,
      width,
      height,
      layoutRef,
      graphs,
      onGraphClick,
      onBoxSelection,
    });

    const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

    const filteredRelations = useMemo(
      () => filterRelationsByType(relations, filterMode),
      [relations, filterMode],
    );

    const nodes = useMemo(
      () => convertGraphsToNodes(graphs, filteredRelations),
      [graphs, filteredRelations],
    );

    const edges = useMemo(
      () => convertRelationsToEdges(filteredRelations),
      [filteredRelations],
    );

    // 异步布局状态（worker-first + 主线程 fallback，参考 MindMapCanvas）
    const [layout, setLayout] = useState<LayoutResult | null>(null);
    const { calculateMindMapLayout } = useGraphWorker();

    useEffect(() => {
      if (nodes.length === 0) {
        setLayout(null);
        return;
      }

      const domainGroups = getDomainGroups(graphs);

      const timer = setTimeout(async () => {
        try {
          const result = await calculateMindMapLayout(
            nodes,
            edges as unknown as Array<Record<string, unknown>>,
            {
              width: containerSize.width,
              height: containerSize.height,
              domainGroups,
            }
          );
          if (result) {
            setLayout(result as unknown as LayoutResult);
          } else {
            // Fallback: Worker 不可用时降级为主线程同步计算
            console.warn('[GraphMapCanvas] Worker layout failed, falling back to main thread');
            const fallbackResult = createMindMapLayout(nodes, edges, {
              width: containerSize.width,
              height: containerSize.height,
              domainGroups,
            });
            setLayout(fallbackResult);
          }
        } catch (error) {
          // 错误时也降级到主线程
          console.warn('[GraphMapCanvas] Worker layout error, falling back to main thread', error);
          const fallbackResult = createMindMapLayout(nodes, edges, {
            width: containerSize.width,
            height: containerSize.height,
            domainGroups,
          });
          setLayout(fallbackResult);
        }
      }, 300); // 300ms 防抖

      return () => clearTimeout(timer);
    }, [nodes, edges, containerSize, graphs, calculateMindMapLayout]);

    layoutRef.current = layout;

    const neighborGraphIds = useMemo(() => {
      if (!focusedGraphId) return new Set<string>();

      const neighbors = new Set<string>();
      neighbors.add(focusedGraphId);

      filteredRelations.forEach((relation) => {
        if (relation.source_graph_id === focusedGraphId) {
          neighbors.add(relation.target_graph_id);
        }
        if (relation.target_graph_id === focusedGraphId) {
          neighbors.add(relation.source_graph_id);
        }
      });

      return neighbors;
    }, [focusedGraphId, filteredRelations]);

    const neighborLinkIds = useMemo(() => {
      if (!focusedGraphId) return new Set<string>();

      const links = new Set<string>();

      filteredRelations.forEach((relation) => {
        if (
          relation.source_graph_id === focusedGraphId ||
          relation.target_graph_id === focusedGraphId
        ) {
          links.add(relation.id);
        }
      });

      return links;
    }, [focusedGraphId, filteredRelations]);

    // 聚焦节点时，仅显示「被高亮节点（焦点+一阶邻居）中 ≥2 个属于该领域」的领域遮罩，
    // 避免聚焦单个节点时所有领域都出阴影，让人分辨不清该节点属于哪个领域
    const focusVisibleDomainIds = useMemo(() => {
      if (!focusedGraphId || neighborGraphIds.size === 0) return null;
      const countByDomain = new Map<string, number>();
      neighborGraphIds.forEach((nodeId) => {
        const nodeDomains = graphDomainMap.get(nodeId);
        if (nodeDomains) {
          for (const dId of nodeDomains) {
            countByDomain.set(dId, (countByDomain.get(dId) || 0) + 1);
          }
        }
      });
      const visible = new Set<string>();
      for (const [dId, count] of countByDomain) {
        if (count >= MIN_NEIGHBOR_DOMAIN_COUNT) visible.add(dId);
      }
      return visible;
    }, [focusedGraphId, neighborGraphIds, graphDomainMap]);

    const nodeHighlightState = useMemo(() => {
      const state = new Map<string, boolean>();
      if (!layout) return state;

      // 聚焦领域（点击选中或悬停）优先：该领域节点高亮，其余淡化
      if (focusDomainId) {
        layout.nodes.forEach((node) => {
          const nodeDomains = graphDomainMap.get(node.id);
          let hit = false;
          if (nodeDomains) {
            for (const dId of nodeDomains) {
              if (dId === focusDomainId) {
                hit = true;
                break;
              }
            }
          }
          state.set(node.id, hit);
        });
        return state;
      }

      if (selectedDomainIds.size === 0) {
        layout.nodes.forEach((node) => state.set(node.id, true));
        return state;
      }

      layout.nodes.forEach((node) => {
        const nodeDomains = graphDomainMap.get(node.id);
        // 直接遍历 Set，避免展开数组后 some 的额外分配；命中即短路
        let isHighlighted = false;
        if (nodeDomains) {
          for (const dId of nodeDomains) {
            if (selectedDomainIds.has(dId)) {
              isHighlighted = true;
              break;
            }
          }
        }
        state.set(node.id, isHighlighted);
      });

      return state;
    }, [layout, focusDomainId, selectedDomainIds, graphDomainMap]);

    const linkHighlightState = useMemo(() => {
      const state = new Map<string, boolean>();
      if (!layout) return state;

      if (selectedDomainIds.size === 0) {
        layout.links.forEach((link) => state.set(link.id, true));
        return state;
      }

      layout.links.forEach((link) => {
        const sourceId =
          typeof link.source === "string" ? link.source : link.source.id;
        const targetId =
          typeof link.target === "string" ? link.target : link.target.id;
        const sourceHighlighted = nodeHighlightState.get(sourceId) ?? false;
        const targetHighlighted = nodeHighlightState.get(targetId) ?? false;
        state.set(link.id, sourceHighlighted && targetHighlighted);
      });

      return state;
    }, [layout, nodeHighlightState]);

    // 焦点邻域内边集合：两端都在选中节点一阶邻居集合内，聚焦时保持高亮，其余边变暗
    const focusHighlightLinkIds = useMemo(() => {
      const ids = new Set<string>();
      if (!focusedGraphId || !layout) return ids;

      layout.links.forEach((link) => {
        const sourceId = String(
          typeof link.source === "string" ? link.source : link.source.id,
        );
        const targetId = String(
          typeof link.target === "string" ? link.target : link.target.id,
        );
        if (neighborGraphIds.has(sourceId) && neighborGraphIds.has(targetId)) {
          ids.add(link.id);
        }
      });

      return ids;
    }, [focusedGraphId, layout, neighborGraphIds]);

    const nodeMap = useMemo(
      () => (layout ? new Map(layout.nodes.map((n) => [n.id, n])) : new Map()),
      [layout],
    );

    // 预构建 graphs 索引，避免每次聚焦取标题时对数组线性 find（O(n)→O(1) get）
    const graphMap = useMemo(
      () => new Map(graphs.map((g) => [g.id, g])),
      [graphs],
    );

    const focusedNodeTitle = useMemo(() => {
      if (!focusedGraphId) return null;
      const focusedGraph = graphMap.get(focusedGraphId);
      return focusedGraph?.title ?? null;
    }, [focusedGraphId, graphMap]);

    const canvasAriaLabel = t("graphMap.canvas.ariaLabel", {
      count: nodes.length,
      focus: focusedNodeTitle ?? t("graphMap.canvas.emptyFocus"),
    });

    useEffect(() => {
      if (layout && layout.nodes.length > 0) {
        const rootNode =
          layout.nodes.find((n) => n.level === "root") || layout.nodes[0];
        const visualCenterX = containerSize.width / 2;
        const visualCenterY = containerSize.height / 2;
        const targetX = visualCenterX - rootNode.x;
        const targetY = visualCenterY - rootNode.y;

        if (
          Math.abs(transformRef.current.x) < 1 &&
          Math.abs(transformRef.current.y) < 1
        ) {
          applyTransform({ x: targetX, y: targetY, k: 1 });
        }
      }
    }, [layout, containerSize, transformRef, applyTransform]);

    if (!layout) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            {graphs.length === 0 ? (
              <>
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {t("graphMap.empty.noGraphs")}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  {t("graphMap.empty.createFirst")}
                </p>
              </>
            ) : (
              <div aria-live="polite">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" aria-hidden="true"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t("graphMap.empty.loading")}
                </p>
                <span className="sr-only">{t("common.aria.loading")}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      >
        <svg
          ref={svgCallbackRef}
          width="100%"
          height="100%"
          role="application"
          aria-label={canvasAriaLabel}
          style={{
            backgroundColor: colors.background,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
          // 点击画布空白（SVG 根，非节点/标签）且未发生拖动：清除领域点击高亮
          if (!hasMoved && e.target === svgRef.current) {
            onDomainFocusClear?.();
          }
          handleCanvasClick(e);
        }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <title>{canvasAriaLabel}</title>
          <desc>{t("graphMap.canvas.desc")}</desc>
          <g ref={contentRef} aria-label={t("graphMap.canvas.nodesContainer", { count: nodes.length })}>
            <CanvasLayout
              layout={undefined}
              width={containerSize.width}
              height={containerSize.height}
              gridStyle={gridStyle}
            />
            <DomainBackground
              layoutNodes={layout.nodes}
              graphs={graphs}
              zoomLevel={transform.k}
              selectedDomainIds={selectedDomainIds}
              visibleDomainIds={focusVisibleDomainIds}
              focusDomainId={focusDomainId ?? hoveredDomainId}
              domainIdToInfo={domainIdToInfo}
            />
            <GraphEdges
              links={layout.links}
              edges={edges}
              nodeMap={nodeMap}
              focusedGraphId={focusedGraphId}
              neighborLinkIds={neighborLinkIds}
              focusHighlightLinkIds={focusHighlightLinkIds}
              linkHighlightState={linkHighlightState}
              selectedDomainIds={selectedDomainIds}
              isDark={isDark}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
            />
            <GraphNodes
              nodes={layout.nodes}
              graphs={graphs}
              edges={edges}
              allNodes={nodes}
              selectedGraphId={selectedGraphId}
              multiSelectedGraphIds={multiSelectedGraphIds}
              focusedGraphId={focusedGraphId}
              neighborGraphIds={neighborGraphIds}
              nodeHighlightState={nodeHighlightState}
              isDark={isDark}
              zoomLevel={transform.k}
              colorScheme={colorScheme}
              nodeShape={nodeShape}
              centerDotShape={centerDotShape}
              nodeGlow={nodeGlow}
              onGraphClick={onGraphClick}
              onMultiSelectGraph={onMultiSelectGraph}
              setFocusedGraphId={setFocusedGraphId}
              animateCamera={animateCamera}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              transformRef={transformRef}
              panMovedRef={panMovedRef}
            />
            {/* 领域胶囊标签层：置于节点之上，避免被节点遮挡，支持点击聚焦领域 */}
            <DomainBackground
              variant="labels"
              layoutNodes={layout.nodes}
              graphs={graphs}
              zoomLevel={transform.k}
              selectedDomainIds={selectedDomainIds}
              visibleDomainIds={focusVisibleDomainIds}
              focusDomainId={focusDomainId ?? hoveredDomainId}
              domainIdToInfo={domainIdToInfo}
              onPillClick={onDomainPillClick}
            />
          </g>

          <SelectionBox isSelecting={isSelecting} selectionBox={selectionBox} />
        </svg>

        <TransformControls
          fromGraphId={fromGraphId}
          fromGraphTitle={fromGraphTitle}
          onReturnToGraph={onReturnToGraph}
          showMiniMap={showMiniMap}
          onToggleMiniMap={handleToggleMiniMap}
          showLegend={showLegend}
          onToggleLegend={handleToggleLegend}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          transformK={transform.k}
          graphsCount={graphs.length}
          relationsCount={relations.length}
        />

        {showLegend && (
          <div className="absolute top-4 right-4">
            <RelationshipLegend
              edges={edges}
              isDark={isDark}
              onClose={() => setShowLegend(false)}
            />
          </div>
        )}

        {showMiniMap && layout && (
          <div className="absolute bottom-[calc(3.5rem+var(--safe-area-inset-bottom))] md:bottom-4 right-14 mr-1">
            <MiniMap
              nodes={layout.nodes}
              transform={transform}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              onTransformChange={handleMiniMapTransformChange}
              width={200}
              height={140}
              viewCenterX={containerSize.width / 2}
              viewCenterY={containerSize.height / 2}
              selectedNodeId={selectedGraphId}
              multiSelectedNodeIds={multiSelectedGraphIds}
            />
          </div>
        )}
      </div>
    );
  },
);