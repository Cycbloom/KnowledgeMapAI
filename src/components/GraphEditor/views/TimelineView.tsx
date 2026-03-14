import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { Node, Edge, ColorScheme, LinkStyle, LinkAnimation, GraphColorMode, NodeSizeMode, EdgeWidthMode, Node as GraphNode } from '../../../types';
import { MindMapNode } from '../canvas/MindMapNode';
import { MindMapLink } from '../canvas/MindMapLink';
import { createMindMapLayout, LayoutResult } from '../../../utils/mindmapLayout';
import { THEME_COLORS } from '../../../config/learningStatusColors';
import { useTheme } from "../../../hooks";
import { calculateNodeImportance, calculateEdgeStrength } from '../../../lib/graphUtils';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

interface TimelineViewProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
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
  isRightPanelOpen?: boolean;
  rightPanelWidth?: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
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
  isRightPanelOpen: _isRightPanelOpen = false,
  rightPanelWidth = 0
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });
  const [progress, setProgress] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

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
  }, [containerRef]);

  const allNodes = useMemo(() => {
    return nodes.filter(n => n.is_accepted !== false);
  }, [nodes]);

  const sortedNodes = useMemo(() => {
    return [...allNodes].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });
  }, [allNodes]);

  const nodeTimeMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedNodes.forEach((node, index) => {
      map.set(node.id, ((index + 1) / sortedNodes.length) * 100);
    });
    return map;
  }, [sortedNodes]);

  const layout = useMemo((): LayoutResult | null => {
    if (allNodes.length === 0) return null;
    return createMindMapLayout(allNodes, edges, {
      width: containerSize.width,
      height: containerSize.height - 80
    });
  }, [allNodes, edges, containerSize]);

  const nodeImportanceMap = useMemo(() => {
    if (nodeSizeMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    allNodes.forEach(node => {
      const importance = calculateNodeImportance(node as Node, nodes, edges, nodeStatus);
      map.set(node.id, importance.score);
    });
    return map;
  }, [allNodes, nodes, edges, nodeStatus, nodeSizeMode]);

  const edgeStrengthMap = useMemo(() => {
    if (edgeWidthMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    edges.forEach(edge => {
      const strength = calculateEdgeStrength(edge, nodes, edges);
      map.set(edge.id, strength.score);
    });
    return map;
  }, [edges, nodes, edgeWidthMode]);

  const isNodeVisible = useCallback((nodeId: string) => {
    const nodeProgress = nodeTimeMap.get(nodeId) || 0;
    return nodeProgress <= progress;
  }, [nodeTimeMap, progress]);

  const isEdgeVisible = useCallback((sourceId: string, targetId: string) => {
    return isNodeVisible(sourceId) && isNodeVisible(targetId);
  }, [isNodeVisible]);

  const currentNodeCount = useMemo(() => {
    return allNodes.filter(n => isNodeVisible(n.id)).length;
  }, [allNodes, isNodeVisible]);

  const totalCount = sortedNodes.length;

  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return prev + 0.5 * playSpeed;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(Number(e.target.value));
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (progress >= 100) {
      setProgress(0);
    }
    setIsPlaying(prev => !prev);
  }, [progress]);

  const handleReset = useCallback(() => {
    setProgress(0);
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    const nextIndex = Math.ceil(progress / 100 * sortedNodes.length);
    if (nextIndex < sortedNodes.length) {
      setProgress(((nextIndex + 1) / sortedNodes.length) * 100);
    }
  }, [progress, sortedNodes.length]);

  const handleStepBack = useCallback(() => {
    const currentIndex = Math.floor(progress / 100 * sortedNodes.length);
    if (currentIndex > 0) {
      setProgress(((currentIndex - 1) / sortedNodes.length) * 100);
    }
  }, [progress, sortedNodes.length]);

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
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, transform]);

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

  const nodesMap = layout ? new Map(layout.nodes.map(n => [String(n.id).trim(), n])) : new Map();

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height - 80}
        className="absolute inset-0"
        style={{ backgroundColor: colors.background, cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {layout && layout.links.map(link => {
            const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
            const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
            
            const sourceNode = nodesMap.get(sourceId);
            const targetNode = nodesMap.get(targetId);
            
            if (!sourceNode || !targetNode) return null;
            
            const visible = isEdgeVisible(sourceId, targetId);
            
            const linkWithNodes = {
              ...link,
              source: sourceNode,
              target: targetNode
            };
            
            return (
              <g
                key={link.id}
                style={{
                  opacity: visible ? 1 : 0,
                  transition: 'opacity 0.3s ease'
                }}
              >
                <MindMapLink
                  link={linkWithNodes}
                  nodes={nodesMap}
                  isDark={isDark}
                  linkStyle={linkStyle}
                  linkAnimation={linkAnimation}
                  edgeWidthMode={edgeWidthMode}
                  edgeStrength={edgeStrengthMap.get(link.id)}
                  allNodes={nodes}
                  allEdges={edges}
                />
              </g>
            );
          })}
          
          {layout && layout.nodes.map(node => {
            const visible = isNodeVisible(node.id);
            
            return (
              <g
                key={node.id}
                style={{
                  opacity: visible ? 1 : 0,
                  transition: 'opacity 0.15s ease'
                }}
              >
                <MindMapNode
                  node={node}
                  edges={edges}
                  nodeStatus={nodeStatus}
                  selected={selectedNodeId === node.id}
                  isDark={isDark}
                  zoomLevel={transform.k}
                  onClick={() => onNodeClick(node as GraphNode)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  focused={hoveredNodeId === node.id}
                  colorScheme={colorScheme}
                  nodeSizeMode={nodeSizeMode}
                  nodeImportance={nodeImportanceMap.get(node.id)}
                  allNodes={nodes}
                  coloringMode={coloringMode}
                />
              </g>
            );
          })}
        </g>
      </svg>

      <div 
        className={`absolute bottom-0 left-0 p-4 ${isDark ? 'bg-slate-800/95' : 'bg-white/95'} backdrop-blur-sm border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
        style={{ right: rightPanelWidth > 0 ? rightPanelWidth : 0 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title="重置"
            >
              <RotateCcw className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>
            
            <button
              onClick={handleStepBack}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title="上一步"
            >
              <SkipBack className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>
            
            <button
              onClick={handlePlayPause}
              className={`p-3 rounded-full ${isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-500 hover:bg-indigo-400'} text-white transition-colors`}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={handleStepForward}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title="下一步"
            >
              <SkipForward className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'} w-16`}>
              {currentNodeCount} / {totalCount} 节点
            </span>
            
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: isDark 
                  ? `linear-gradient(to right, #6366f1 ${progress}%, #334155 ${progress}%)`
                  : `linear-gradient(to right, #6366f1 ${progress}%, #e5e7eb ${progress}%)`
              }}
            />
            
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'} w-12 text-right`}>
              {Math.round(progress)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>速度</span>
            {[0.5, 1, 2, 4].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playSpeed === speed
                    ? isDark 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-indigo-500 text-white'
                    : isDark 
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
