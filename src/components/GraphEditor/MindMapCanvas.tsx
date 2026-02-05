import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Node, Edge } from '../../types';
import { MindMapNode } from './MindMapNode';
import { MindMapLink } from './MindMapLink';
import { createMindMapLayout, LayoutResult } from '../../utils/mindmapLayout';
import { THEME_COLORS } from '../../config/learningStatusColors';
import { useTheme } from '../../hooks/useTheme';

interface MindMapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selectedNodeId: string | null;
  onNodeClick: (node: Node) => void;
  width?: number;
  height?: number;
  sidebarMode?: 'none' | 'edit' | 'outline' | 'create' | 'detail';
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
  sidebarMode = 'none'
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

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
    if (nodes.length > 0) {
      const result = createMindMapLayout(nodes, edges, { 
        width: containerSize.width, 
        height: containerSize.height 
      });
      setLayout(result);
    }
  }, [nodes, edges, containerSize]);

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
    }
  }, [transform]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载思维导图...</p>
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
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {layout.links.map(link => (
            <MindMapLink
              key={link.id}
              link={link}
              nodes={nodeMap}
              isDark={isDark}
              highlighted={false}
            />
          ))}

          {layout.nodes.map(node => (
            <MindMapNode
              key={node.id}
              node={node}
              edges={edges}
              nodeStatus={nodeStatus}
              selected={node.id === selectedNodeId}
              isDark={isDark}
              onClick={() => onNodeClick(node)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            />
          ))}
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