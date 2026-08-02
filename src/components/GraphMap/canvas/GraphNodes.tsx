import React, { memo, useCallback } from "react";
import type {
  Graph,
  LayoutNode,
  Edge,
  Node,
  ColorScheme,
  GraphColorMode,
  NodeSizeMode,
} from "../../../types";
import { MindMapNode } from "../../GraphEditor/canvas/MindMapNode";

interface GraphNodesProps {
  nodes: LayoutNode[];
  graphs: Array<Graph & { node_count?: number }>;
  edges: Edge[];
  allNodes: Node[];
  selectedGraphId: string | null;
  multiSelectedGraphIds?: Set<string>;
  focusedGraphId: string | null;
  neighborGraphIds: Set<string>;
  nodeHighlightState: Map<string, boolean>;
  isDark: boolean;
  zoomLevel: number;
  colorScheme: ColorScheme;
  onGraphClick?: (graph: Graph) => void;
  onMultiSelectGraph?: (
    graphId: string,
    isMultiSelect: boolean,
    isRangeSelect?: boolean,
  ) => void;
  setFocusedGraphId: (id: string | null) => void;
  animateCamera: (
    targetX: number,
    targetY: number,
    targetK: number,
    duration?: number,
  ) => void;
  containerWidth: number;
  containerHeight: number;
  transformRef: React.MutableRefObject<{ x: number; y: number; k: number }>;
}

const GraphNodesComponent: React.FC<GraphNodesProps> = ({
  nodes,
  graphs,
  edges,
  allNodes,
  selectedGraphId,
  multiSelectedGraphIds,
  focusedGraphId,
  neighborGraphIds,
  nodeHighlightState,
  isDark,
  zoomLevel,
  colorScheme,
  onGraphClick,
  onMultiSelectGraph,
  setFocusedGraphId,
  animateCamera,
  containerWidth,
  containerHeight,
  transformRef,
}) => {
  const handleNodeClick = useCallback(
    (node: LayoutNode, e?: React.MouseEvent) => {
      const graph = graphs.find((g) => g.id === node.id);
      if (!graph) return;

      const isMultiSelect = e?.ctrlKey || e?.metaKey || false;
      const isRangeSelect = e?.shiftKey || false;

      if ((isMultiSelect || isRangeSelect) && onMultiSelectGraph) {
        onMultiSelectGraph(node.id, isMultiSelect, isRangeSelect);
      } else if (!isMultiSelect && !isRangeSelect && onGraphClick) {
        onGraphClick(graph);
        setFocusedGraphId(node.id);

        const visualCenterX = containerWidth / 2;
        const visualCenterY = containerHeight / 2;
        const targetK = transformRef.current.k;
        const targetX = visualCenterX - node.x * targetK;
        const targetY = visualCenterY - node.y * targetK;
        animateCamera(targetX, targetY, targetK, 400);
      }
    },
    [
      graphs,
      onMultiSelectGraph,
      onGraphClick,
      setFocusedGraphId,
      animateCamera,
      containerWidth,
      containerHeight,
      transformRef,
    ],
  );

  return (
    <>
      {nodes.map((node) => {
        const isFocused = focusedGraphId
          ? neighborGraphIds.has(node.id)
          : false;
        const hasFocus = focusedGraphId !== null;
        const isNodeHighlighted = nodeHighlightState.get(node.id) ?? true;

        return (
          <g
            key={node.id}
            style={{
              opacity: isNodeHighlighted ? 1 : 0.3,
              transition: "opacity 0.3s ease",
              pointerEvents: isNodeHighlighted ? "auto" : "none",
            }}
          >
            <MindMapNode
              node={node}
              edges={edges}
              selected={node.id === selectedGraphId}
              multiSelected={multiSelectedGraphIds?.has(node.id) || false}
              isDark={isDark}
              zoomLevel={zoomLevel}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseEnter={() => {}}
              onMouseLeave={() => {}}
              focused={isFocused}
              forceShowText={true}
              hasFocusMode={hasFocus}
              colorScheme={colorScheme}
              nodeSizeMode={"fixed" as NodeSizeMode}
              allNodes={allNodes}
              coloringMode={"level" as GraphColorMode}
            />
          </g>
        );
      })}
    </>
  );
};

const areEqual = (prev: GraphNodesProps, next: GraphNodesProps) => {
  return (
    prev.nodes.length === next.nodes.length &&
    prev.graphs.length === next.graphs.length &&
    prev.selectedGraphId === next.selectedGraphId &&
    prev.focusedGraphId === next.focusedGraphId &&
    prev.neighborGraphIds.size === next.neighborGraphIds.size &&
    prev.isDark === next.isDark &&
    prev.zoomLevel === next.zoomLevel &&
    prev.colorScheme === next.colorScheme &&
    prev.containerWidth === next.containerWidth &&
    prev.containerHeight === next.containerHeight &&
    prev.onGraphClick === next.onGraphClick &&
    prev.setFocusedGraphId === next.setFocusedGraphId
  );
};

export const GraphNodes = memo(GraphNodesComponent, areEqual);
