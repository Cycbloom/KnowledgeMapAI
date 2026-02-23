import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { 
  Node, 
  Edge, 
  ColorScheme, 
  LinkStyle, 
  LinkAnimation, 
  LayoutNode,
  GraphRelation,
  GraphRelationType,
  GraphMapFilterMode,
  GRAPH_RELATION_COLORS,
} from '../../types';
import type { Graph } from '../../types';
import { MindMapNode } from '../GraphEditor/MindMapNode';
import { MindMapLink } from '../GraphEditor/MindMapLink';
import { CanvasLayout } from '../GraphEditor/CanvasLayout';
import { MiniMap } from '../GraphEditor/MiniMap';
import { createMindMapLayout, LayoutResult } from '../../utils/mindmapLayout';
import { 
  convertGraphsToNodes, 
  convertRelationsToEdges, 
  filterRelationsByType,
  getRelationColor,
} from '../../utils/graphMapAdapter';
import { THEME_COLORS } from '../../config/learningStatusColors';
import { useTheme } from '../../hooks/useTheme';

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
  onMultiSelectGraph?: (graphId: string, isMultiSelect: boolean) => void;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export const GraphMapCanvas = forwardRef<any, GraphMapCanvasProps>(({
  graphs,
  relations,
  selectedGraphId = null,
  onGraphClick,
  width = 800,
  height = 600,
  filterMode = 'all',
  colorScheme = 'default',
  linkStyle = 'curved',
  linkAnimation = 'none',
  fromGraphId,
  fromGraphTitle,
  onReturnToGraph,
  multiSelectedGraphIds,
  onMultiSelectGraph,
}, ref) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : width, 
    height: typeof window !== 'undefined' ? window.innerHeight : height 
  });
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [focusedGraphId, setFocusedGraphId] = useState<string | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  const filteredRelations = useMemo(() => 
    filterRelationsByType(relations, filterMode), 
    [relations, filterMode]
  );

  const nodes = useMemo(() => 
    convertGraphsToNodes(graphs, filteredRelations), 
    [graphs, filteredRelations]
  );

  const edges = useMemo(() => 
    convertRelationsToEdges(filteredRelations), 
    [filteredRelations]
  );

  const neighborGraphIds = useMemo(() => {
    if (!focusedGraphId) return new Set<string>();
    
    const neighbors = new Set<string>();
    neighbors.add(focusedGraphId);
    
    filteredRelations.forEach(relation => {
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
    
    filteredRelations.forEach(relation => {
      if (relation.source_graph_id === focusedGraphId || relation.target_graph_id === focusedGraphId) {
        links.add(relation.id);
      }
    });
    
    return links;
  }, [focusedGraphId, filteredRelations]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    return createMindMapLayout(nodes, edges, { 
      width: containerSize.width, 
      height: containerSize.height 
    });
  }, [nodes, edges, containerSize]);

  const updateTransformDOM = useCallback((t: Transform) => {
    if (contentRef.current) {
      contentRef.current.setAttribute('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`);
    }
  }, []);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateTransformState = useCallback((newTransform: Transform) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setTransform(newTransform);
    }, 100);
  }, []);

  const animationFrameRef = useRef<number | null>(null);

  const animateCamera = useCallback((targetX: number, targetY: number, targetK: number, duration: number = 500) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startX = transformRef.current.x;
    const startY = transformRef.current.y;
    const startK = transformRef.current.k;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const newX = startX + (targetX - startX) * ease;
      const newY = startY + (targetY - startY) * ease;
      const newK = startK + (targetK - startK) * ease;

      const newTransform = { x: newX, y: newY, k: newK };
      
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        updateTransformState(newTransform);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateTransformDOM, updateTransformState]);

  useImperativeHandle(ref, () => ({
    centerNode: (nodeId: string) => {
      if (!layout) return;
      const node = layout.nodes.find(n => n.id === nodeId);
      if (node) {
        const visualCenterX = containerSize.width / 2;
        const visualCenterY = containerSize.height / 2;
        const targetK = 1.2;
        const targetX = visualCenterX - node.x * targetK;
        const targetY = visualCenterY - node.y * targetK;
        animateCamera(targetX, targetY, targetK, 800);
      }
    }
  }));

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
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    updateTransformDOM(transformRef.current);
  }, [updateTransformDOM]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    
    const prev = transformRef.current;
    const newK = Math.max(0.1, Math.min(5, prev.k * delta));
    
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
  }, [updateTransformDOM, updateTransformState]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setHasMoved(false);
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      setDragStart({ 
        x: e.clientX - transformRef.current.x, 
        y: e.clientY - transformRef.current.y 
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) {
        setHasMoved(true);
      }
      
      const newTransform = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
        k: transformRef.current.k
      };
      
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      updateTransformState(newTransform);
    }
  }, [isDragging, dragStart, updateTransformDOM, updateTransformState]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current && !hasMoved) {
      setFocusedGraphId(null);
    }
    setHasMoved(false);
  }, [hasMoved]);

  const handleResetView = useCallback(() => {
    if (layout && layout.nodes.length > 0) {
      const rootNode = layout.nodes.find(n => n.level === 'root') || layout.nodes[0];
      const visualCenterX = containerSize.width / 2;
      const visualCenterY = containerSize.height / 2;
      const targetX = visualCenterX - rootNode.x;
      const targetY = visualCenterY - rootNode.y;
      
      const newTransform = { x: targetX, y: targetY, k: 1 };
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      updateTransformState(newTransform);
    }
  }, [layout, containerSize, updateTransformDOM, updateTransformState]);

  useEffect(() => {
    if (layout && layout.nodes.length > 0) {
      const rootNode = layout.nodes.find(n => n.level === 'root') || layout.nodes[0];
      const visualCenterX = containerSize.width / 2;
      const visualCenterY = containerSize.height / 2;
      const targetX = visualCenterX - rootNode.x;
      const targetY = visualCenterY - rootNode.y;
      
      if (Math.abs(transformRef.current.x) < 1 && Math.abs(transformRef.current.y) < 1) {
        const newTransform = { x: targetX, y: targetY, k: 1 };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        updateTransformState(newTransform);
      }
    }
  }, [layout, containerSize, updateTransformDOM, updateTransformState]);

  const handleMiniMapTransformChange = useCallback((newTransform: Transform) => {
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  const getEdgeColor = (edge: Edge): string => {
    const relationType = edge.relationship_type as GraphRelationType;
    return getRelationColor(relationType);
  };

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          {graphs.length === 0 ? (
            <>
              <div className="text-6xl mb-4">🗺️</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">暂无图谱</p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">创建你的第一个知识图谱开始探索</p>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">正在加载图谱地图...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const nodeMap = new Map(layout.nodes.map(n => [n.id, n]));

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ backgroundColor: colors.background, cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
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
          {layout.links.map(link => {
            const edge = edges.find(e => e.id === link.id);
            const edgeColor = edge ? getEdgeColor(edge) : '#6B7280';
            const isFocused = focusedGraphId ? neighborLinkIds.has(link.id) : false;
            const hasFocus = focusedGraphId !== null;
            
            return (
              <MindMapLink
                key={link.id}
                link={link}
                nodes={nodeMap}
                isDark={isDark}
                highlighted={false}
                focused={isFocused}
                hasFocusMode={hasFocus}
                linkStyle={linkStyle}
                linkAnimation={linkAnimation}
                customColor={edgeColor}
              />
            );
          })}
          {layout.nodes.map(node => {
            const graph = graphs.find(g => g.id === node.id);
            const nodeCount = graph?.node_count || 0;
            const isFocused = focusedGraphId ? neighborGraphIds.has(node.id) : false;
            const hasFocus = focusedGraphId !== null;
            
            return (
              <MindMapNode
                key={node.id}
                node={node}
                edges={edges}
                selected={node.id === selectedGraphId}
                multiSelected={multiSelectedGraphIds?.has(node.id) || false}
                isDark={isDark}
                zoomLevel={transform.k}
                onClick={(e) => {
                  if (graph) {
                    const isMultiSelect = e?.ctrlKey || e?.metaKey;
                    if (isMultiSelect && onMultiSelectGraph) {
                      onMultiSelectGraph(node.id, true);
                    } else if (!isMultiSelect && onGraphClick) {
                      onGraphClick(graph);
                      setFocusedGraphId(node.id);
                      
                      const visualCenterX = containerSize.width / 2;
                      const visualCenterY = containerSize.height / 2;
                      const targetK = transformRef.current.k;
                      const targetX = visualCenterX - node.x * targetK;
                      const targetY = visualCenterY - node.y * targetK;
                      animateCamera(targetX, targetY, targetK, 400);
                    }
                  }
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                focused={isFocused}
                forceShowText={true}
                hasFocusMode={hasFocus}
                colorScheme={colorScheme}
                nodeSizeMode="fixed"
                allNodes={nodes}
                coloringMode="level"
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {fromGraphId && onReturnToGraph && (
            <button
              onClick={onReturnToGraph}
              className="p-2 bg-blue-500 dark:bg-blue-600 rounded shadow-lg hover:bg-blue-600 dark:hover:bg-blue-700 text-white transition-colors"
              title={`返回 ${fromGraphTitle || '来源图谱'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={showMiniMap ? "隐藏小地图" : "显示小地图"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </button>

          <button
            onClick={() => {
              const newK = Math.min(5, transformRef.current.k * 1.2);
              animateCamera(transformRef.current.x, transformRef.current.y, newK);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="放大"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          
          <button
            onClick={() => {
              const newK = Math.max(0.1, transformRef.current.k / 1.2);
              animateCamera(transformRef.current.x, transformRef.current.y, newK);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="缩小"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          
          <button
            onClick={handleResetView}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="重置视角"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {showMiniMap && layout && (
        <div className="absolute bottom-4 right-14 mr-1">
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

      <div className="absolute bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
        缩放: {Math.round(transform.k * 100)}% | 图谱: {graphs.length} | 关系: {relations.length}
      </div>
    </div>
  );
});
