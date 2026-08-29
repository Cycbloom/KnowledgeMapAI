import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import { debounce } from "@/utils/performanceUtils";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Node,
  Edge,
  RegionInfo,
  GraphColorMode,
  LayoutNode,
  LayoutLink,
  NodeStatus,
} from "@shared/types/graph";
import type { ColorScheme } from "@shared/types/styles";
import {
  useViewportUpdate,
  useSpatialGrid,
  useViewportBounds,
  useVisibleNodes,
  useVisibleNodeSet,
  useVisibleEdges,
} from "../shared/hooks/useVirtualization";
import { RegionBackground } from "./RegionBackground";
import { RegionHeader } from "./RegionHeader";
import { QuadrantNode } from "./QuadrantNode";
import { QuadrantEdge } from "./QuadrantEdge";
import { useTheme } from "../../../hooks";
import type { GraphRef } from "../../../hooks/graphEditor";
import { THEME_COLORS } from "../../../config/learningStatusColors";
import { avoidCollisions } from "../../../utils/quadrantLayout";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface QuadrantCanvasProps {
  nodes: Node[];
  edges: Edge[];
  regions: RegionInfo[];
  originPosition: { x: number; y: number };
  collapsedRegions: string[];
  onOriginMove: (position: { x: number; y: number }) => void;
  onRegionToggle: (regionId: string) => void;
  onNodeClick: (node: Node) => void;
  selectedNodeId?: string | null;
  nodeStatus?: Record<string, NodeStatus>;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
  width?: number;
  height?: number;
  focusedNodeIds?: Set<string>;
  focusedNodeId?: string | null;
  focusedLinkIds?: Set<string>;
  onCanvasClick?: () => void;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function normalizeId(id: string | number | null | undefined): string {
  if (id == null) return "";
  return String(id).trim();
}

function getNodePosition(
  node: Node,
  region: RegionInfo,
  index: number,
  total: number,
  originX: number,
  originY: number,
  regionRadius: number,
  regionNodeCount?: number,
): { x: number; y: number; angle: number } {
  const angleRange = region.angleEnd - region.angleStart;
  const angleStep = angleRange / (total + 1);
  const angle = region.angleStart + angleStep * (index + 1);

  const seed = hashCode(node.id);
  const random = seededRandom(seed);
  const baseRatio = 0.55;
  const randomOffset = (random - 0.5) * 0.5;
  const levelFactor = node.level === "sub" ? 0.05 : 0;
  const ratio = baseRatio + randomOffset + levelFactor;

  const count = regionNodeCount ?? total;
  const minBound = count <= 5 ? 0.3 : count <= 12 ? 0.24 : 0.18;
  const maxBound = count <= 5 ? 0.82 : count <= 12 ? 0.87 : 0.92;
  const distanceRatio = Math.max(minBound, Math.min(maxBound, ratio));

  const distance = regionRadius * distanceRatio;

  return {
    x: originX + distance * Math.cos(angle),
    y: originY + distance * Math.sin(angle),
    angle,
  };
}

export const QuadrantCanvas = forwardRef<GraphRef | null, QuadrantCanvasProps>(
  (
    {
      nodes: _nodes,
      edges,
      regions,
      originPosition,
      collapsedRegions: externalCollapsedRegions,
      onOriginMove,
      onRegionToggle,
      onNodeClick,
      selectedNodeId = null,
      nodeStatus,
      colorScheme: _colorScheme = "default",
      coloringMode: _coloringMode = "status",
      width = 800,
      height = 600,
      focusedNodeIds = new Set(),
      focusedNodeId = null,
      focusedLinkIds = new Set(),
      onCanvasClick,
    },
    ref,
  ) => {
    const { isDark } = useTheme();
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const contentRef = useRef<SVGGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const hasFocusMode =
      (focusedNodeId !== null && focusedNodeId !== "") ||
      focusedNodeIds.size > 0;

    const [internalCollapsedRegions, setInternalCollapsedRegions] = useState<
      Set<string>
    >(new Set());

    const collapsedRegions = useMemo(() => {
      if (externalCollapsedRegions && externalCollapsedRegions.length > 0) {
        return new Set(externalCollapsedRegions);
      }
      return internalCollapsedRegions;
    }, [externalCollapsedRegions, internalCollapsedRegions]);

    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
    const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
    const { viewportVersion, scheduleViewportUpdate, forceUpdate } = useViewportUpdate();
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isDraggingOrigin, setIsDraggingOrigin] = useState(false);

    const [containerSize, setContainerSize] = useState({
      width: typeof window !== "undefined" ? window.innerWidth : width,
      height: typeof window !== "undefined" ? window.innerHeight : height,
    });

    const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

    const visibleRegions = useMemo(() => {
      const filtered = regions.filter(
        (region) => !collapsedRegions.has(region.id),
      );
      if (filtered.length === 0) return [];

      const angleStep = (2 * Math.PI) / filtered.length;

      return filtered.map((region, index) => ({
        ...region,
        angleStart: index * angleStep,
        angleEnd: (index + 1) * angleStep,
      }));
    }, [regions, collapsedRegions]);

    const totalNodeCount = useMemo(() => {
      return visibleRegions.reduce(
        (sum, region) => sum + region.nodes.length,
        0,
      );
    }, [visibleRegions]);

    const regionRadius = useMemo(() => {
      const minDimension = Math.min(containerSize.width, containerSize.height);
      const baseRatio = 0.35 + Math.min(0.08, totalNodeCount / 500);
      const baseRadius = minDimension * baseRatio;
      const densityFactor =
        totalNodeCount <= 10
          ? 1.0 + (totalNodeCount / 10) * 0.2
          : totalNodeCount <= 25
            ? 1.2 + ((totalNodeCount - 10) / 15) * 0.3
            : totalNodeCount <= 50
              ? 1.5 + ((totalNodeCount - 25) / 25) * 0.3
              : totalNodeCount <= 100
                ? 1.8 + ((totalNodeCount - 50) / 50) * 0.5
                : Math.min(2.5, 2.3 + ((totalNodeCount - 100) / 100) * 0.2);
      return baseRadius * densityFactor;
    }, [containerSize, totalNodeCount]);

    const nodePositions = useMemo(() => {
      const positions: Record<string, { x: number; y: number; angle: number }> =
        {};

      visibleRegions.forEach((region) => {
        const regionNodes = region.nodes;
        regionNodes.forEach((node, index) => {
          const normalizedId = normalizeId(node.id);
          if (normalizedId) {
            positions[normalizedId] = getNodePosition(
              node,
              region,
              index,
              regionNodes.length,
              originPosition.x,
              originPosition.y,
              regionRadius,
              regionNodes.length,
            );
          }
        });
      });

      return positions;
    }, [visibleRegions, originPosition, regionRadius]);

    const adjustedNodePositions = useMemo(() => {
      if (totalNodeCount <= 5) return nodePositions;

      const positionMap = new Map<string, { x: number; y: number }>();
      for (const [id, pos] of Object.entries(nodePositions)) {
        positionMap.set(id, { x: pos.x, y: pos.y });
      }

      const minDistance = 58;

      const result = avoidCollisions(positionMap, minDistance);

      const adjusted: Record<string, { x: number; y: number; angle: number }> =
        {};
      for (const [id, pos] of result.entries()) {
        const original = nodePositions[id];
        adjusted[id] = {
          x: pos.x,
          y: pos.y,
          angle: original?.angle ?? 0,
        };
      }
      return adjusted;
    }, [nodePositions, totalNodeCount]);

    // Build LayoutNode array for virtualization hooks
    const layoutNodes = useMemo(() => {
      const nodeById = new Map<string, Node>();
      _nodes.forEach((n) => nodeById.set(normalizeId(n.id), n));
      return Object.entries(adjustedNodePositions).map(([id, pos]) => {
        // Find the original node to get its data
        const node = nodeById.get(id);
        if (!node) return null;
        return {
          ...node,
          id,
          x: pos.x,
          y: pos.y,
        } as LayoutNode;
      }).filter((n): n is LayoutNode => n !== null);
    }, [adjustedNodePositions, _nodes]);

    const regionEdges = useMemo(() => {
      const nodeIds = new Set(Object.keys(nodePositions));

      const filtered = edges.filter((edge) => {
        const srcId = normalizeId(edge.source_knowledge_point_id);
        const tgtId = normalizeId(edge.target_knowledge_point_id);
        return srcId && tgtId && nodeIds.has(srcId) && nodeIds.has(tgtId);
      });

      return filtered;
    }, [edges, nodePositions]);

    // Build LayoutLink array for virtualization hooks
    const layoutLinks = useMemo(() => {
      return regionEdges.map(edge => ({
        ...edge,
        source: normalizeId(edge.source_knowledge_point_id),
        target: normalizeId(edge.target_knowledge_point_id),
      })) as LayoutLink[];
    }, [regionEdges]);

    // Pre-build edge lookup map for O(1) access during rendering
    const regionEdgeMap = useMemo(() => {
      const map = new Map<string, Edge>();
      regionEdges.forEach(edge => map.set(String(edge.id), edge));
      return map;
    }, [regionEdges]);

    const visibleFocusedLinkIds = useMemo(() => {
      if (!hasFocusMode) return new Set<string>();

      const regionEdgeIds = new Set(regionEdges.map((e) => String(e.id)));
      const result = new Set<string>();

      focusedLinkIds.forEach((id) => {
        if (regionEdgeIds.has(id)) {
          result.add(id);
        }
      });

      return result;
    }, [hasFocusMode, regionEdges, focusedLinkIds]);

    const visibleFocusedNodeIds = useMemo(() => {
      if (!hasFocusMode) return new Set<string>();

      const normalizedFocusedId = normalizeId(focusedNodeId);

      if (normalizedFocusedId) {
        const result = new Set<string>([normalizedFocusedId]);

        regionEdges.forEach((edge) => {
          const src = normalizeId(edge.source_knowledge_point_id);
          const tgt = normalizeId(edge.target_knowledge_point_id);

          if (src === normalizedFocusedId && tgt) {
            result.add(tgt);
          } else if (tgt === normalizedFocusedId && src) {
            result.add(src);
          }
        });

        return result;
      }

      if (focusedNodeIds.size > 0) {
        const visibleNodeIds = new Set(Object.keys(nodePositions));
        const result = new Set<string>();

        focusedNodeIds.forEach((id) => {
          const normalizedId = normalizeId(id);
          if (normalizedId && visibleNodeIds.has(normalizedId)) {
            result.add(normalizedId);
          }
        });

        return result;
      }

      return new Set<string>();
    }, [
      hasFocusMode,
      focusedNodeId,
      focusedNodeIds,
      regionEdges,
      nodePositions,
    ]);

    // Virtualization: viewport culling
    const spatialGrid = useSpatialGrid(layoutNodes);
    const viewportBounds = useViewportBounds(
      transformRef.current,
      containerSize,
      200,
      viewportVersion,
    );
    const visibleLayoutNodes = useVisibleNodes(layoutNodes, spatialGrid, viewportBounds, true);
    const visibleNodeIds = useVisibleNodeSet(visibleLayoutNodes);
    const visibleLayoutEdges = useVisibleEdges(layoutLinks, layoutNodes, visibleNodeIds, viewportBounds);

    const updateTransformDOM = useCallback((t: Transform) => {
      if (contentRef.current) {
        contentRef.current.setAttribute(
          "transform",
          `translate(${t.x}, ${t.y}) scale(${t.k})`,
        );
      }
    }, []);

    // 使用 debounce 限制高频事件触发的 React 状态更新，视觉更新通过 updateTransformDOM 直接操作 DOM
    const updateTransformState = useMemo(
      () => debounce((newTransform: Transform) => {
        setTransform(newTransform);
      }, 100),
      [],
    );

    useEffect(() => {
      return () => {
        updateTransformState.cancel();
      };
    }, [updateTransformState]);

    const handleRegionToggle = useCallback(
      (regionId: string) => {
        if (onRegionToggle) {
          onRegionToggle(regionId);
        } else {
          setInternalCollapsedRegions((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(regionId)) {
              newSet.delete(regionId);
            } else {
              newSet.add(regionId);
            }
            return newSet;
          });
        }
      },
      [onRegionToggle],
    );

    useImperativeHandle(ref, () => ({
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
        const newTransform = { x: newX, y: newY, k: newK };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        setTransform(newTransform);
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
        const newTransform = { x: newX, y: newY, k: newK };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        setTransform(newTransform);
      },
      resetView: () => {
        const newTransform = { x: 0, y: 0, k: 1 };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        setTransform(newTransform);
      },
      toggleRegionCollapse: (regionId: string) => {
        handleRegionToggle(regionId);
      },
      expandAllRegions: () => {
        setInternalCollapsedRegions(new Set());
      },
      collapseAllRegions: () => {
        setInternalCollapsedRegions(new Set(regions.map((r) => r.id)));
      },
    }));

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

    useEffect(() => {
      updateTransformDOM(transformRef.current);
    }, [updateTransformDOM]);

    const handleWheel = useCallback(
      (e: WheelEvent) => {
        e.preventDefault();
        const scaleFactor = 1.1;
        const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;

        const prev = transformRef.current;
        const newK = Math.max(0.1, Math.min(5, prev.k * delta));

        const isMinZoom = Math.abs(prev.k - 0.1) < 0.001;
        const isMaxZoom = Math.abs(prev.k - 5) < 0.001;

        if ((isMinZoom && e.deltaY > 0) || (isMaxZoom && e.deltaY < 0)) {
          return;
        }

        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - prev.x) * delta;
        const newY = mouseY - (mouseY - prev.y) * delta;

        const newTransform = { x: newX, y: newY, k: newK };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        updateTransformState(newTransform);
        scheduleViewportUpdate();
      },
      [updateTransformDOM, updateTransformState, scheduleViewportUpdate],
    );

    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;

      svg.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        svg.removeEventListener("wheel", handleWheel);
      };
    }, [handleWheel]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (e.button !== 0) return;

        const target = e.target as SVGElement;
        const originElement = target.closest("[data-origin]");
        const regionHeaderElement = target.closest("[data-region-id]");
        const nodeElement = target.closest("[data-node-id]");

        if (regionHeaderElement || nodeElement) {
          return;
        }

        if (originElement) {
          setIsDraggingOrigin(true);
          setDragStart({
            x: e.clientX - originPosition.x * transformRef.current.k,
            y: e.clientY - originPosition.y * transformRef.current.k,
          });
        } else {
          setIsDragging(true);
          setDragStart({
            x: e.clientX - transformRef.current.x,
            y: e.clientY - transformRef.current.y,
          });
        }
      },
      [originPosition],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (isDraggingOrigin) {
          const newX = (e.clientX - dragStart.x) / transformRef.current.k;
          const newY = (e.clientY - dragStart.y) / transformRef.current.k;
          onOriginMove({ x: newX, y: newY });
          scheduleViewportUpdate();
        } else if (isDragging) {
          const newTransform = {
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
            k: transformRef.current.k,
          };
          transformRef.current = newTransform;
          updateTransformDOM(newTransform);
          updateTransformState(newTransform);
          scheduleViewportUpdate();
        }
      },
      [
        isDragging,
        isDraggingOrigin,
        dragStart,
        onOriginMove,
        updateTransformDOM,
        updateTransformState,
        scheduleViewportUpdate,
      ],
    );

    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      setIsDraggingOrigin(false);
      forceUpdate();
    }, [forceUpdate]);

    const handleNodeClick = useCallback(
      (node: Node) => {
        onNodeClick(node);
      },
      [onNodeClick],
    );

    const getNodeAngle = useCallback(
      (_node: Node, region: RegionInfo, index: number, total: number) => {
        const angleRange = region.angleEnd - region.angleStart;
        const angleStep = angleRange / (total + 1);
        return region.angleStart + angleStep * (index + 1);
      },
      [],
    );

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          role="application"
          aria-label={t('graphEditor.quadrantCanvas.ariaLabel', '象限画布，共 {{count}} 个节点，{{regionCount}} 个区域', { count: totalNodeCount, regionCount: visibleRegions.length })}
          style={{
            backgroundColor: colors.background,
            cursor: isDragging
              ? "grabbing"
              : isDraggingOrigin
                ? "move"
                : "grab",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            onCanvasClick?.();
          }}
        >
          <title>{t('graphEditor.quadrantCanvas.title', '象限画布')}</title>
          <desc>{t('graphEditor.quadrantCanvas.desc', '交互式象限画布，按区域分组展示 {{count}} 个知识节点。使用鼠标或触摸进行平移与缩放，拖动中心点可重定位，按节点可查看详情。', { count: totalNodeCount })}</desc>
          <g ref={contentRef}>
            {visibleRegions.map((region) => {
              return (
                <g key={region.id}>
                  <motion.g
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RegionBackground
                      region={region}
                      opacity={0.15}
                      radius={regionRadius}
                      originX={originPosition.x}
                      originY={originPosition.y}
                    />
                  </motion.g>
                  <RegionHeader
                    region={region}
                    isCollapsed={false}
                    originX={originPosition.x}
                    originY={originPosition.y}
                    radius={regionRadius}
                    isDark={isDark}
                  />
                </g>
              );
            })}

            {visibleLayoutEdges.map((layoutEdge) => {
              const edge = regionEdgeMap.get(String(layoutEdge.id));
              if (!edge) return null;
              const sourcePos = adjustedNodePositions[normalizeId(edge.source_knowledge_point_id)];
              const targetPos = adjustedNodePositions[normalizeId(edge.target_knowledge_point_id)];
              if (!sourcePos || !targetPos) return null;
              return (
                <QuadrantEdge
                  key={edge.id}
                  edge={edge}
                  sourceX={sourcePos.x}
                  sourceY={sourcePos.y}
                  targetX={targetPos.x}
                  targetY={targetPos.y}
                  isDark={isDark}
                  highlighted={visibleFocusedLinkIds.has(String(edge.id))}
                  hasFocusMode={hasFocusMode}
                />
              );
            })}

            {visibleRegions.map((region) => {
              // 单趟遍历同时收集展示节点与统计节点数，替代重复 filter 的 O(nodes²) 扫描
              let regionNodeCount = 0;
              const regionDisplayNodes: typeof region.nodes = [];
              for (const node of region.nodes) {
                regionNodeCount++;
                if (visibleNodeIds.has(normalizeId(node.id))) {
                  regionDisplayNodes.push(node);
                }
              }
              return (
                <g key={`nodes-${region.id}`}>
                  <AnimatePresence mode="popLayout">
                    {regionDisplayNodes.map((node, index) => (
                      <motion.g
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                      >
                        <QuadrantNode
                          node={node}
                          edges={edges}
                          nodeStatus={nodeStatus}
                          selected={node.id === selectedNodeId}
                          isDark={isDark}
                          zoomLevel={transform.k}
                          onClick={() => handleNodeClick(node)}
                          colorScheme={_colorScheme}
                          originX={originPosition.x}
                          originY={originPosition.y}
                          regionRadius={regionRadius}
                          angle={getNodeAngle(
                            node,
                            region,
                            index,
                            regionNodeCount,
                          )}
                          focused={
                            visibleFocusedNodeIds.has(normalizeId(node.id)) ||
                            normalizeId(node.id) ===
                              normalizeId(focusedNodeId)
                          }
                          hasFocusMode={hasFocusMode}
                          regionNodeCount={regionNodeCount}
                          positionX={
                            adjustedNodePositions[normalizeId(node.id)]?.x
                          }
                          positionY={
                            adjustedNodePositions[normalizeId(node.id)]?.y
                          }
                          />
                        </motion.g>
                      ))}
                  </AnimatePresence>
                </g>
              );
            })}

            <g
              data-origin
              transform={`translate(${originPosition.x}, ${originPosition.y})`}
              style={{ cursor: "move" }}
            >
              <circle
                r={12}
                className="fill-slate-200 dark:fill-slate-600 stroke-slate-400 dark:stroke-slate-500"
                strokeWidth={2}
                style={{
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                }}
              />
              <circle r={4} className="fill-slate-500 dark:fill-slate-400" />
            </g>
          </g>
        </svg>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={() => {
              const newK = Math.min(5, transformRef.current.k * 1.2);
              const centerX = containerSize.width / 2;
              const centerY = containerSize.height / 2;
              const newX =
                centerX -
                (centerX - transformRef.current.x) *
                  (newK / transformRef.current.k);
              const newY =
                centerY -
                (centerY - transformRef.current.y) *
                  (newK / transformRef.current.k);
              const newTransform = { x: newX, y: newY, k: newK };
              transformRef.current = newTransform;
              updateTransformDOM(newTransform);
              setTransform(newTransform);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label={t('graphEditor.quadrantCanvas.zoomIn', '放大')}
            title={t('graphEditor.quadrantCanvas.zoomIn', '放大')}
          >
            <svg aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={() => {
              const newK = Math.max(0.1, transformRef.current.k / 1.2);
              const centerX = containerSize.width / 2;
              const centerY = containerSize.height / 2;
              const newX =
                centerX -
                (centerX - transformRef.current.x) *
                  (newK / transformRef.current.k);
              const newY =
                centerY -
                (centerY - transformRef.current.y) *
                  (newK / transformRef.current.k);
              const newTransform = { x: newX, y: newY, k: newK };
              transformRef.current = newTransform;
              updateTransformDOM(newTransform);
              setTransform(newTransform);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label={t('graphEditor.quadrantCanvas.zoomOut', '缩小')}
            title={t('graphEditor.quadrantCanvas.zoomOut', '缩小')}
          >
            <svg aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={() => {
              const newTransform = { x: 0, y: 0, k: 1 };
              transformRef.current = newTransform;
              updateTransformDOM(newTransform);
              setTransform(newTransform);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label={t('graphEditor.quadrantCanvas.resetView', '重置视图')}
            title={t('graphEditor.quadrantCanvas.resetView', '重置视图')}
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
                d="M3 3v5h5M21 21v-5h-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="absolute left-4 bottom-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
          {t("graphEditor.quadrantCanvas.zoomLabel", { percent: Math.round(transform.k * 100) })}
        </div>
      </div>
    );
  },
);
