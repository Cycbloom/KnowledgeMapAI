import React, { useEffect, useMemo, useRef, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  ColorScheme,
  LinkStyle,
  LinkAnimation,
  GraphRelation,
  GraphMapFilterMode,
  Graph,
} from "../../types";
import { CanvasLayout } from "../GraphEditor/canvas/CanvasLayout";
import { MiniMap } from "../GraphEditor/canvas/MiniMap";
import { createMindMapLayout } from "../../utils/mindmapLayout";
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

interface GraphMapCanvasProps {
  graphs: Array<Graph & { node_count?: number }>;
  relations: GraphRelation[];
  selectedGraphId?: string | null;
  onGraphClick?: (graph: Graph) => void;
  width?: number;
  height?: number;
  filterMode?: GraphMapFilterMode;
  colorScheme?: ColorScheme;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
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
  domainColorMap?: Map<string, string>;
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
      fromGraphId,
      fromGraphTitle,
      onReturnToGraph,
      multiSelectedGraphIds,
      onMultiSelectGraph,
      onBoxSelection,
      selectedDomainIds = new Set(),
      domainColorMap = new Map(),
      graphDomainMap = new Map(),
    },
    ref,
  ) => {
    void domainColorMap;

    const { t } = useTranslation();
    const { isDark } = useTheme();
    const svgRef = React.useRef<SVGSVGElement>(null);
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

    const layout = useMemo(() => {
      if (nodes.length === 0) return null;
      const domainGroups = getDomainGroups(graphs);
      return createMindMapLayout(nodes, edges, {
        width: containerSize.width,
        height: containerSize.height,
        domainGroups,
      });
    }, [nodes, edges, containerSize, graphs]);

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

    const nodeHighlightState = useMemo(() => {
      const state = new Map<string, boolean>();
      if (!layout) return state;

      if (selectedDomainIds.size === 0) {
        layout.nodes.forEach((node) => state.set(node.id, true));
        return state;
      }

      layout.nodes.forEach((node) => {
        const nodeDomains = graphDomainMap.get(node.id);
        const isHighlighted = nodeDomains
          ? [...nodeDomains].some((dId) => selectedDomainIds.has(dId))
          : false;
        state.set(node.id, isHighlighted);
      });

      return state;
    }, [layout, selectedDomainIds, graphDomainMap]);

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

    const nodeMap = useMemo(
      () => (layout ? new Map(layout.nodes.map((n) => [n.id, n])) : new Map()),
      [layout],
    );

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
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t("graphMap.empty.loading")}
                </p>
              </>
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
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            backgroundColor: colors.background,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          <g ref={contentRef}>
            <CanvasLayout
              layout={undefined}
              width={containerSize.width}
              height={containerSize.height}
            />
            <DomainBackground
              layoutNodes={layout.nodes}
              graphs={graphs}
              zoomLevel={transform.k}
            />
            <GraphEdges
              links={layout.links}
              edges={edges}
              nodeMap={nodeMap}
              focusedGraphId={focusedGraphId}
              neighborLinkIds={neighborLinkIds}
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
              onGraphClick={onGraphClick}
              onMultiSelectGraph={onMultiSelectGraph}
              setFocusedGraphId={setFocusedGraphId}
              animateCamera={animateCamera}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              transformRef={transformRef}
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
            />
          </div>
        )}
      </div>
    );
  },
);