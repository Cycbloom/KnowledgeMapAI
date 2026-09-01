import React, { memo, useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type {
  Graph,
  LayoutNode,
  Edge,
  Node,
  ColorScheme,
  GraphColorMode,
  NodeSizeMode,
  NodeShape,
  CenterDotShape,
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
  nodeShape?: NodeShape;
  centerDotShape?: CenterDotShape;
  nodeGlow?: boolean;
  /** 跨图谱学习路径：graphId → 1-based 学习顺序（叠加序号徽章） */
  learningOrderMap?: Map<string, number>;
  /** 跨图谱学习路径中「当前/下一个待学图谱」（脉冲高亮） */
  learningPathCurrentGraphId?: string | null;
  onGraphClick?: (graph: Graph | null) => void;
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
  panMovedRef: React.MutableRefObject<boolean>;
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
  nodeShape,
  centerDotShape,
  nodeGlow,
  learningOrderMap,
  learningPathCurrentGraphId,
  onGraphClick,
  onMultiSelectGraph,
  setFocusedGraphId,
  animateCamera,
  containerWidth,
  containerHeight,
  transformRef,
  panMovedRef,
}) => {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{
    graph: Graph & { node_count?: number };
    x: number;
    y: number;
  } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  // 离开画布节点时延迟清除 hover：给光标移入 tooltip 前的短暂停留留缓冲，避免抖动闪烁
  const clearHover = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHover(null);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // 悬停 200ms 无变化才展示 tooltip，减少快速扫过时的视觉噪音
  const handleNodeHover = useCallback(
    (node: LayoutNode, e: React.MouseEvent) => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
      const graph = graphs.find((g) => g.id === node.id);
      if (!graph) return;
      const x = e.clientX;
      const y = e.clientY;
      hoverTimerRef.current = window.setTimeout(
        () => setHover({ graph, x, y }),
        200,
      );
    },
    [graphs],
  );

  const handleNodeMove = useCallback(
    (node: LayoutNode, e: React.MouseEvent) => {
      if (hoverTimerRef.current !== null) return;
      setHover((prev) => {
        if (prev && prev.graph.id === node.id) {
          return { ...prev, x: e.clientX, y: e.clientY };
        }
        return prev;
      });
    },
    [],
  );

  const handleNodeClick = useCallback(
    (node: LayoutNode, e?: React.MouseEvent) => {
      // 若本次按下发生了平移拖动，则视为拖画布而非点击节点，避免聚焦/回跳
      if (panMovedRef.current) return;

      const graph = graphs.find((g) => g.id === node.id);
      if (!graph) return;

      const isMultiSelect = e?.ctrlKey || e?.metaKey || false;
      const isRangeSelect = e?.shiftKey || false;

      if ((isMultiSelect || isRangeSelect) && onMultiSelectGraph) {
        onMultiSelectGraph(node.id, isMultiSelect, isRangeSelect);
      } else if (!isMultiSelect && !isRangeSelect) {
        // 再次点击已聚焦节点 → 取消选中/聚焦（邻居不再高亮、凸包遮罩消失）
        if (focusedGraphId === node.id) {
          onGraphClick?.(null);
          setFocusedGraphId(null);
          return;
        }
        onGraphClick?.(graph);
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
      focusedGraphId,
      onMultiSelectGraph,
      onGraphClick,
      setFocusedGraphId,
      animateCamera,
      containerWidth,
      containerHeight,
      transformRef,
      panMovedRef,
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
            onMouseEnter={(e) => handleNodeHover(node, e)}
            onMouseMove={(e) => handleNodeMove(node, e)}
            onMouseLeave={clearHover}
          >
            <MindMapNode
              node={node}
              edges={edges}
              selected={node.id === selectedGraphId}
              multiSelected={multiSelectedGraphIds?.has(node.id) || false}
              isDark={isDark}
              zoomLevel={zoomLevel}
              onClick={(e) => handleNodeClick(node, e)}
              focused={isFocused}
              forceShowText={true}
              hasFocusMode={hasFocus}
              colorScheme={colorScheme}
              nodeSizeMode={"fixed" as NodeSizeMode}
              allNodes={allNodes}
              coloringMode={"level" as GraphColorMode}
              nodeShape={nodeShape}
              centerDotShape={centerDotShape}
              nodeGlow={nodeGlow}
              learningOrder={learningOrderMap?.get(node.id)}
              isInLearningPath={learningOrderMap?.has(node.id) ?? false}
              learningPathHighlighted={learningPathCurrentGraphId === node.id}
            />
          </g>
        );
      })}

      {hover &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50"
            role="tooltip"
            style={{
              left: Math.min(hover.x + 14, window.innerWidth - 250),
              top: Math.min(hover.y + 14, window.innerHeight - 96),
            }}
          >
            <div
              className={`w-[224px] rounded-lg shadow-lg border p-2.5 ${
                isDark
                  ? "bg-slate-800/95 border-slate-600 text-gray-200"
                  : "bg-white/95 border-gray-200 text-gray-800"
              } backdrop-blur-sm`}
            >
              <p className="text-xs font-semibold truncate">
                {hover.graph.title}
              </p>
              {hover.graph.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {hover.graph.description}
                </p>
              )}
              <p className="text-[11px] mt-1 text-gray-500 dark:text-gray-400">
                {t("graphMap.graph.nodeCount", {
                  count: hover.graph.node_count ?? hover.graph.nodes_count ?? 0,
                })}
              </p>
            </div>
          </div>,
          document.body,
        )}
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
    prev.nodeHighlightState === next.nodeHighlightState &&
    prev.isDark === next.isDark &&
    prev.zoomLevel === next.zoomLevel &&
    prev.colorScheme === next.colorScheme &&
    prev.nodeShape === next.nodeShape &&
    prev.centerDotShape === next.centerDotShape &&
    prev.nodeGlow === next.nodeGlow &&
    prev.learningOrderMap === next.learningOrderMap &&
    prev.learningPathCurrentGraphId === next.learningPathCurrentGraphId &&
    prev.containerWidth === next.containerWidth &&
    prev.containerHeight === next.containerHeight &&
    prev.onGraphClick === next.onGraphClick &&
    prev.setFocusedGraphId === next.setFocusedGraphId
  );
};

export const GraphNodes = memo(GraphNodesComponent, areEqual);
