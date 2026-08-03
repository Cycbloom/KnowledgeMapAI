import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { Node, Edge, ColorScheme, LinkStyle, LinkAnimation, GraphColorMode, BranchSuggestion, NodeSizeMode, EdgeWidthMode, Node as GraphNode, NodeStatus } from '../../../types';
import type { HistoricalBranchItem } from '../../../hooks/graphEditor/useExplorationState';
import { MindMapNode } from '../canvas/MindMapNode';
import { MindMapLink } from '../canvas/MindMapLink';
import { AlternativeBranches } from '../shared/AlternativeBranches';
import { createTreeLayout } from '../../../utils/layouts/treeLayout';
import { THEME_COLORS } from '../../../config/learningStatusColors';
import { useTheme } from "../../../hooks";
import { calculateNodeImportance, calculateEdgeStrength } from '../../../utils/graph/graphUtils';
import { rafThrottle } from '@/utils/performanceUtils';

interface TreeViewProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, NodeStatus>;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  onCanvasClick?: () => void;
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
  nodeSizeMode?: NodeSizeMode;
  edgeWidthMode?: EdgeWidthMode;
  coloringMode?: GraphColorMode;
  focusedNodeIds?: Set<string>;
  focusedLinkIds?: Set<string>;
  isExplorationMode?: boolean;
  branchSuggestions?: BranchSuggestion[];
  selectedNodeForBranch?: GraphNode | null;
  onSelectBranch?: (suggestion: BranchSuggestion) => void;
  onSwitchBranch?: (pathItem: HistoricalBranchItem, suggestion: BranchSuggestion) => void;
  historicalAlternativeBranches?: HistoricalBranchItem[];
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

const TreeViewComponent: React.FC<TreeViewProps> = ({
  nodes,
  edges,
  nodeStatus,
  selectedNodeId,
  onNodeClick,
  onCanvasClick,
  width = 800,
  height = 600,
  colorScheme = 'default',
  linkStyle = 'curved',
  linkAnimation = 'none',
  nodeSizeMode = 'fixed',
  edgeWidthMode = 'fixed',
  coloringMode = 'level',
  focusedNodeIds = new Set(),
  focusedLinkIds = new Set(),
  isExplorationMode = false,
  branchSuggestions = [],
  selectedNodeForBranch = null,
  onSelectBranch,
  onSwitchBranch,
  historicalAlternativeBranches = []
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [_hoveredNodeId, _setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const hasFocusMode = focusedNodeIds.size > 0;

  // 保持 ref 与 state 同步，避免回调中 stale closure 问题
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // 使用 rafThrottle 限制高频事件触发的 React 状态更新
  const throttledSetTransform = useMemo(() => rafThrottle((t: Transform) => {
    setTransform(t);
  }), []);

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateContainerSize();
    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    return createTreeLayout(nodes, edges, {
      width: containerSize.width,
      height: containerSize.height
    });
  }, [nodes, edges, containerSize]);

  const visibleNodes = useMemo(() => {
    if (!layout) return [];
    
    if (!isExplorationMode) {
      return layout.nodes.filter(node => node.is_accepted !== false);
    }
    
    return layout.nodes;
  }, [layout, isExplorationMode]);

  const visibleLinks = useMemo(() => {
    if (!layout) return [];
    const visibleNodeIds = new Set(visibleNodes.map(n => String(n.id).trim()));
    const nodesMap = new Map(layout.nodes.map(n => [String(n.id).trim(), n]));
    
    return layout.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      
      if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) {
        return false;
      }
      
      const sourceNode = nodesMap.get(sourceId);
      const targetNode = nodesMap.get(targetId);
      if (sourceNode && targetNode) {
        const SAME_LEVEL_THRESHOLD = 10;
        const isSameLevel = Math.abs(sourceNode.y - targetNode.y) < SAME_LEVEL_THRESHOLD;
        if (isSameLevel) {
          return false;
        }
      }
      
      return true;
    });
  }, [layout, visibleNodes]);

  const nodeImportanceMap = useMemo(() => {
    if (nodeSizeMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    visibleNodes.forEach(node => {
      const importance = calculateNodeImportance(node as Node, nodes, edges, nodeStatus);
      map.set(node.id, importance.score);
    });
    return map;
  }, [visibleNodes, nodes, edges, nodeStatus, nodeSizeMode]);

  const edgeStrengthMap = useMemo(() => {
    if (edgeWidthMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    visibleLinks.forEach(link => {
      const edge = edges.find(e => e.id === link.id);
      if (edge) {
        const strength = calculateEdgeStrength(edge, nodes, edges);
        map.set(link.id, strength.score);
      }
    });
    return map;
  }, [visibleLinks, edges, nodes, edgeWidthMode]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    const prev = transformRef.current;
    const newK = Math.max(0.1, Math.min(5, prev.k * delta));
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      const newTransform = { ...prev, k: newK };
      transformRef.current = newTransform;
      throttledSetTransform(newTransform);
      return;
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newX = mouseX - (mouseX - prev.x) * delta;
    const newY = mouseY - (mouseY - prev.y) * delta;

    const newTransform = { x: newX, y: newY, k: newK };
    transformRef.current = newTransform;
    throttledSetTransform(newTransform);
  }, [throttledSetTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y });
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const newTransform = {
        ...transformRef.current,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      transformRef.current = newTransform;
      throttledSetTransform(newTransform);
    }
  }, [isDragging, dragStart, throttledSetTransform]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging && mouseDownPosRef.current && onCanvasClick) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      const moveThreshold = 5;
      
      if (dx < moveThreshold && dy < moveThreshold) {
        onCanvasClick();
      }
    }
    setIsDragging(false);
    mouseDownPosRef.current = null;
  }, [isDragging, onCanvasClick]);

  if (!layout) return null;

  const nodesMap = new Map(layout.nodes.map(n => [String(n.id).trim(), n]));
  const visibleNodeIds = new Set(visibleNodes.map(n => String(n.id).trim()));

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height}
        className="absolute inset-0"
        style={{ backgroundColor: colors.background }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          <g className="links">
            {visibleLinks.map(link => {
              const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
              const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
              
              if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) {
                return null;
              }
              
              const sourceNode = nodesMap.get(sourceId);
              const targetNode = nodesMap.get(targetId);
              
              if (!sourceNode || !targetNode) {
                return null;
              }
              
              const linkWithNodes = {
                ...link,
                source: sourceNode,
                target: targetNode
              };
              
              const isFocused = focusedLinkIds.has(link.id);
              
              return (
                <MindMapLink
                  key={link.id}
                  link={linkWithNodes}
                  nodes={nodesMap}
                  isDark={isDark}
                  linkStyle={linkStyle}
                  linkAnimation={linkAnimation}
                  edgeWidthMode={edgeWidthMode}
                  edgeStrength={edgeStrengthMap.get(link.id)}
                  allNodes={nodes}
                  allEdges={edges}
                  focused={isFocused}
                  hasFocusMode={hasFocusMode}
                />
              );
            })}
          </g>

          <g className="nodes">
            {visibleNodes.map(node => {
              const isFocused = focusedNodeIds.has(node.id);
              
              return (
                <MindMapNode
                  key={node.id}
                  node={node}
                  edges={edges}
                  nodeStatus={nodeStatus}
                  selected={selectedNodeId === node.id}
                  isDark={isDark}
                  zoomLevel={transform.k}
                  onClick={() => onNodeClick(node as GraphNode)}
                  onMouseEnter={() => _setHoveredNodeId(node.id)}
                  onMouseLeave={() => _setHoveredNodeId(null)}
                  focused={isFocused}
                  hasFocusMode={hasFocusMode}
                  colorScheme={colorScheme}
                  nodeSizeMode={nodeSizeMode}
                  nodeImportance={nodeImportanceMap.get(node.id)}
                  allNodes={nodes}
                  coloringMode={coloringMode}
                />
              );
            })}
          </g>

          {isExplorationMode && selectedNodeForBranch && branchSuggestions.length > 0 && (() => {
            const layoutNode = visibleNodes.find(n => String(n.id).trim() === String(selectedNodeForBranch.id).trim());
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
          {isExplorationMode && historicalAlternativeBranches.map((item, index) => {
            const node = visibleNodes.find(n => String(n.id).trim() === String(item.nodeId).trim());
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
    </div>
  );
};

const areEqual = (prev: TreeViewProps, next: TreeViewProps) => {
  return (
    prev.nodes.length === next.nodes.length &&
    prev.edges.length === next.edges.length &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.colorScheme === next.colorScheme &&
    prev.linkStyle === next.linkStyle &&
    prev.linkAnimation === next.linkAnimation &&
    prev.nodeSizeMode === next.nodeSizeMode &&
    prev.edgeWidthMode === next.edgeWidthMode &&
    prev.coloringMode === next.coloringMode &&
    prev.isExplorationMode === next.isExplorationMode &&
    prev.onNodeClick === next.onNodeClick &&
    prev.onCanvasClick === next.onCanvasClick
  );
};

export const TreeView = React.memo(TreeViewComponent, areEqual);
