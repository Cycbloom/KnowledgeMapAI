import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
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
  GraphColorMode 
} from '../../types';
import type { Node as GraphNode } from '../../types';
import { MindMapNode } from './MindMapNode';
import { MindMapLink } from './MindMapLink';
import { AlternativeBranches } from './AlternativeBranches';
import { CanvasLayout } from './CanvasLayout';
import { createMindMapLayout, LayoutResult } from '../../utils/mindmapLayout';
import { THEME_COLORS } from '../../config/learningStatusColors';
import { useTheme } from '../../hooks/useTheme';
import { calculateNodeImportance, calculateEdgeStrength } from '../../lib/graphUtils';

interface MindMapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  sidebarMode?: 'none' | 'edit' | 'outline' | 'create' | 'detail';
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
  onSwitchBranch?: (pathItem: any, suggestion: BranchSuggestion) => void;
  isExplorationMode?: boolean;
  historicalAlternativeBranches?: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[];
  templateLayout?: TemplateLayout;
  nodeSizeMode?: NodeSizeMode;
  edgeWidthMode?: EdgeWidthMode;
  onNodeContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  coloringMode?: GraphColorMode;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  nodes,
  edges,
  nodeStatus,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 600,
  sidebarMode = 'none',
  focusedNodeIds = new Set(),
  focusedLinkIds = new Set(),
  onCanvasClick,
  forceShowTextIds = new Set(),
  focusedNodeId = null,
  colorScheme = 'default',
  linkStyle = 'curved',
  linkAnimation = 'none',
  branchSuggestions = [],
  selectedNodeForBranch = null,
  onSelectBranch,
  onSwitchBranch,
  isExplorationMode = false,
  historicalAlternativeBranches = [],
  templateLayout,
  nodeSizeMode = 'fixed',
  edgeWidthMode = 'fixed',
  onNodeContextMenu,
  coloringMode = 'status' // Default to status for backward compatibility unless we change it in GraphEditor
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  
  // Debounce helper for transform state updates
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateTransformState = useCallback((newTransform: Transform) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setTransform(newTransform);
    }, 100);
  }, []);

  const updateTransformDOM = useCallback((t: Transform) => {
    if (contentRef.current) {
      contentRef.current.setAttribute('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`);
    }
  }, []);

  // Animation Frame Reference
  const animationFrameRef = useRef<number | null>(null);

  // Smooth Camera Animation
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
      
      // Ease-in-out cubic function
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const newX = startX + (targetX - startX) * ease;
      const newY = startY + (targetY - startY) * ease;
      const newK = startK + (targetK - startK) * ease;

      const newTransform = { x: newX, y: newY, k: newK };
      
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      
      // Update React state at the end or intermittently if needed, 
      // but usually only at end to avoid re-renders
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        updateTransformState(newTransform);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateTransformDOM, updateTransformState]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Sync ref and DOM when state changes (e.g. initial load or external reset)
  useMemo(() => {
    // Only update ref if state is significantly different (avoid loops)
    if (Math.abs(transform.x - transformRef.current.x) > 0.1 ||
        Math.abs(transform.y - transformRef.current.y) > 0.1 ||
        Math.abs(transform.k - transformRef.current.k) > 0.001) {
       transformRef.current = transform;
    }
  }, [transform]);

  // Ensure DOM is in sync after render
  useEffect(() => {
    updateTransformDOM(transformRef.current);
  }, [updateTransformDOM]); // dependency on transformRef.current is implicit via ref access

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const hasFocusMode = focusedNodeId !== null;

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

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    return createMindMapLayout(nodes, edges, { 
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
    
    return layout.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [layout, visibleNodes]);

  // Calculate node importance map
  const nodeImportanceMap = useMemo(() => {
    if (nodeSizeMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    visibleNodes.forEach(node => {
      const importance = calculateNodeImportance(node as Node, nodes, edges, nodeStatus);
      map.set(node.id, importance.score);
    });
    return map;
  }, [visibleNodes, nodes, edges, nodeStatus, nodeSizeMode]);

  // Calculate edge strength map
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
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - (mouseX - prev.x) * delta;
    const newY = mouseY - (mouseY - prev.y) * delta;
    
    const newTransform = { x: newX, y: newY, k: newK };
    
    // Update Ref and DOM immediately
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    
    // Debounce state update
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - transformRef.current.x, 
        y: e.clientY - transformRef.current.y 
      });
      if (onCanvasClick && e.button === 2) {
        onCanvasClick();
      }
    }
  }, [onCanvasClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
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

  const handleZoomIn = useCallback(() => {
    const prev = transformRef.current;
    const newTransform = {
      ...prev,
      k: Math.min(5, prev.k * 1.2)
    };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  const handleZoomOut = useCallback(() => {
    const prev = transformRef.current;
    const newTransform = {
      ...prev,
      k: Math.max(0.1, prev.k / 1.2)
    };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  const handleResetView = useCallback(() => {
    const newTransform = { x: 0, y: 0, k: 1 };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  // Focus on node when focusedNodeId changes
  useEffect(() => {
    if (focusedNodeId && layout) {
      const node = layout.nodes.find(n => n.id === focusedNodeId);
      if (node) {
        const targetK = 1.2; 
        const targetX = (width / 2) - node.x * targetK;
        const targetY = (height / 2) - node.y * targetK;

        // Use smooth animation instead of instant jump
        animateCamera(targetX, targetY, targetK, 800);
      }
    }
  }, [focusedNodeId, layout, width, height, animateCamera]);

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          {nodes.length === 0 ? (
            <>
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">暂无节点</p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">点击工具栏的"+"按钮添加第一个节点</p>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">正在加载思维导图...</p>
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
        onContextMenu={(e) => e.preventDefault()}
      >
        <g ref={contentRef}>
          <CanvasLayout
            layout={templateLayout}
            width={containerSize.width}
            height={containerSize.height}
          />
          {visibleLinks.map(link => (
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
            />
          ))}
          {visibleNodes.map(node => (
            <MindMapNode
              key={node.id}
              node={node}
              edges={edges}
              nodeStatus={nodeStatus}
              selected={node.id === selectedNodeId}
              isDark={isDark}
              zoomLevel={transform.k}
              onClick={() => onNodeClick(node)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              focused={focusedNodeIds.has(node.id)}
              forceShowText={forceShowTextIds.has(node.id)}
              hasFocusMode={hasFocusMode}
              colorScheme={colorScheme}
              nodeSizeMode={nodeSizeMode}
              nodeImportance={nodeImportanceMap.get(node.id)}
              allNodes={nodes}
              onContextMenu={onNodeContextMenu}
              coloringMode={coloringMode}
            />
          ))}
          {isExplorationMode && selectedNodeForBranch && branchSuggestions.length > 0 && (() => {
            const layoutNode = visibleNodes.find(n => n.id === selectedNodeForBranch.id);
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
            const node = visibleNodes.find(n => n.id === item.nodeId);
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

      <div className={`absolute bottom-4 flex flex-col gap-2 transition-all duration-300 ${sidebarMode === 'none' ? 'right-4' : 'right-[324px]'}`}>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          title="放大"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          title="缩小"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          title="重置视图"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
        缩放: {Math.round(transform.k * 100)}%
      </div>
    </div>
  );
};