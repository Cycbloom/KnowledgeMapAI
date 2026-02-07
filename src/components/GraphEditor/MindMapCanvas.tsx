import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Node, Edge, ColorScheme, LinkStyle, LinkAnimation, BranchSuggestion, TemplateLayout } from '../../types';
import type { Node as GraphNode } from '../../types';
import { MindMapNode } from './MindMapNode';
import { MindMapLink } from './MindMapLink';
import { AlternativeBranches } from './AlternativeBranches';
import { CanvasLayout } from './CanvasLayout';
import { createMindMapLayout, LayoutResult } from '../../utils/mindmapLayout';
import { THEME_COLORS } from '../../config/learningStatusColors';
import { useTheme } from '../../hooks/useTheme';

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
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
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
    
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    
    return layout.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [layout, visibleNodes]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    
    setTransform(prev => {
      const newK = Math.max(0.1, Math.min(5, prev.k * delta));
      
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, k: newK };
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newX = mouseX - (mouseX - prev.x) * delta;
      const newY = mouseY - (mouseY - prev.y) * delta;
      
      return { x: newX, y: newY, k: newK };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      if (onCanvasClick && e.button === 2) {
        onCanvasClick();
      }
    }
  }, [transform, onCanvasClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setTransform({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
        k: transform.k
      });
    }
  }, [isDragging, dragStart, transform.k]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      k: Math.min(5, prev.k * 1.2)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      k: Math.max(0.1, prev.k / 1.2)
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

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
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
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