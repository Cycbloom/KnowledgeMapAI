import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Node, Edge, ColorScheme, LinkStyle, LinkAnimation, GraphColorMode, NodeSizeMode, EdgeWidthMode, Node as GraphNode, NodeStatus } from '../../../types';
import { MindMapNode } from '../canvas/MindMapNode';
import { MindMapLink } from '../canvas/MindMapLink';
import { createMindMapLayout, LayoutResult } from '../../../utils/mindmapLayout';
import { THEME_COLORS } from '../../../config/learningStatusColors';
import { useTheme } from "../../../hooks";
import { useGraphWorker } from "../../../hooks/common/useWorker";
import { calculateNodeImportance, calculateEdgeStrength, calculateGlobalMaxDegree, calculateGlobalMaxChildren, buildGraphEdgeMaps, buildLevelMap, buildNodeImportanceMaps } from '../../../utils/graph/graphUtils';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { rafThrottle } from '@/utils/performanceUtils';

interface TimelineViewProps {
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
  isRightPanelOpen?: boolean;
  rightPanelWidth?: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

const TimelineViewComponent: React.FC<TimelineViewProps> = ({
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
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });
  const [progress, setProgress] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  const progressRef = useRef(progress);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const visibleCountRef = useRef(0);
  const isDraggingProgress = useRef(false);

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

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

  // 异步布局状态（worker-first + 主线程 fallback，参考 MindMapCanvas）
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [isLayoutCalculating, setIsLayoutCalculating] = useState(false);
  const { calculateMindMapLayout } = useGraphWorker();

  useEffect(() => {
    if (allNodes.length === 0) {
      setLayout(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLayoutCalculating(true);
      try {
        const result = await calculateMindMapLayout(
          allNodes,
          edges as unknown as Array<Record<string, unknown>>,
          {
            width: containerSize.width,
            height: containerSize.height - 80
          }
        );
        if (result) {
          setLayout(result as unknown as LayoutResult);
        } else {
          // Fallback: Worker 不可用时降级为主线程同步计算
          console.warn('[TimelineView] Worker layout failed, falling back to main thread');
          const fallbackResult = createMindMapLayout(allNodes, edges, {
            width: containerSize.width,
            height: containerSize.height - 80
          });
          setLayout(fallbackResult);
        }
      } catch (error) {
        // 错误时也降级到主线程
        console.warn('[TimelineView] Worker layout error, falling back to main thread', error);
        const fallbackResult = createMindMapLayout(allNodes, edges, {
          width: containerSize.width,
          height: containerSize.height - 80
        });
        setLayout(fallbackResult);
      } finally {
        setIsLayoutCalculating(false);
      }
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
  }, [allNodes, edges, containerSize, calculateMindMapLayout]);

  // 预计算全局 maxDegree 和 maxChildren，避免每个节点重复计算
  const globalMaxDegree = useMemo(() => {
    if (nodeSizeMode === 'fixed') return 1;
    return calculateGlobalMaxDegree(nodes, edges);
  }, [nodes, edges, nodeSizeMode]);

  const globalMaxChildren = useMemo(() => {
    if (nodeSizeMode === 'fixed') return 1;
    return calculateGlobalMaxChildren(nodes, edges);
  }, [nodes, edges, nodeSizeMode]);

  const importanceMaps = useMemo(() => buildNodeImportanceMaps(nodes, edges), [nodes, edges]);

  const nodeImportanceMap = useMemo(() => {
    if (nodeSizeMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    allNodes.forEach(node => {
      const importance = calculateNodeImportance(node as Node, nodes, edges, nodeStatus, globalMaxDegree, globalMaxChildren, importanceMaps);
      map.set(node.id, importance.score);
    });
    return map;
  }, [allNodes, nodes, edges, nodeStatus, nodeSizeMode, globalMaxDegree, globalMaxChildren, importanceMaps]);

  const graphEdgeMaps = useMemo(() => buildGraphEdgeMaps(nodes, edges), [nodes, edges]);

  const levelMap = useMemo(() => buildLevelMap(nodes, edges), [nodes, edges]);

  const edgeStrengthMap = useMemo(() => {
    if (edgeWidthMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    edges.forEach(edge => {
      const strength = calculateEdgeStrength(edge, nodes, edges, graphEdgeMaps);
      map.set(edge.id, strength.score);
    });
    return map;
  }, [edges, nodes, edgeWidthMode, graphEdgeMaps]);

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

    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // 基于实际经过时间计算进度增量，确保速度一致
      // playSpeed=1 时，10秒从0到100，即每秒10单位
      const increment = (deltaTime / 1000) * 10 * playSpeed;
      const newProgress = Math.min(100, progressRef.current + increment);

      progressRef.current = newProgress;

      // 直接操作 DOM 更新进度条视觉（绕过 React 渲染周期）
      if (fillRef.current) {
        fillRef.current.style.width = `${newProgress}%`;
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${newProgress}%`;
      }

      // 仅在节点可见性实际变化时更新 React 状态
      const newVisibleCount = sortedNodes.filter(
        n => (nodeTimeMap.get(n.id) || 0) <= newProgress
      ).length;

      if (newVisibleCount !== visibleCountRef.current || newProgress >= 100) {
        visibleCountRef.current = newVisibleCount;
        setProgress(newProgress);
      }

      if (newProgress >= 100) {
        setIsPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, playSpeed, sortedNodes, nodeTimeMap]);

  const updateProgressFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newProgress = ratio * 100;
    progressRef.current = newProgress;
    if (fillRef.current) fillRef.current.style.width = `${newProgress}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${newProgress}%`;
    setProgress(newProgress);
  }, []);

  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingProgress.current = true;
    setIsPlaying(false);
    updateProgressFromPosition(e.clientX);
  }, [updateProgressFromPosition]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingProgress.current) return;
      updateProgressFromPosition(e.clientX);
    };

    const handleMouseUp = () => {
      isDraggingProgress.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateProgressFromPosition]);

  const handlePlayPause = useCallback(() => {
    if (progress >= 100) {
      progressRef.current = 0;
      setProgress(0);
    }
    progressRef.current = progress;
    setIsPlaying(prev => !prev);
  }, [progress]);

  const handleReset = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    const nextIndex = Math.ceil(progress / 100 * sortedNodes.length);
    if (nextIndex < sortedNodes.length) {
      const newProgress = ((nextIndex + 1) / sortedNodes.length) * 100;
      progressRef.current = newProgress;
      setProgress(newProgress);
    }
  }, [progress, sortedNodes.length]);

  const handleStepBack = useCallback(() => {
    const currentIndex = Math.floor(progress / 100 * sortedNodes.length);
    if (currentIndex > 0) {
      const newProgress = ((currentIndex - 1) / sortedNodes.length) * 100;
      progressRef.current = newProgress;
      setProgress(newProgress);
    }
  }, [progress, sortedNodes.length]);

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

  const nodesMap = layout ? new Map(layout.nodes.map(n => [String(n.id).trim(), n])) : new Map();

  const timelineAriaLabel = t('graphEditor.timelineView.ariaLabel', { count: nodes.length });

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height - 80}
        className="absolute inset-0"
        role="application"
        aria-label={timelineAriaLabel}
        style={{ backgroundColor: colors.background, cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <title>{timelineAriaLabel}</title>
        <desc>{t('graphEditor.timelineView.desc')}</desc>
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
                  levelMap={levelMap}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {isLayoutCalculating && !layout && (
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ top: 0, left: 0, right: 0, bottom: 80 }}
          aria-live="polite"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" aria-hidden="true"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {t('graphEditor.mindMap.loading')}
            </p>
            <span className="sr-only">{t('common.aria.loading')}</span>
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 p-4 ${isDark ? 'bg-slate-800/95' : 'bg-white/95'} backdrop-blur-sm border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
        style={{ right: rightPanelWidth > 0 ? rightPanelWidth : 0 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title={t('common.aria.reset')}
              aria-label={t('common.aria.reset')}
            >
              <RotateCcw aria-hidden="true" className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>

            <button
              onClick={handleStepBack}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title={t('common.aria.prevStep')}
              aria-label={t('common.aria.prevStep')}
            >
              <SkipBack aria-hidden="true" className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>

            <button
              onClick={handlePlayPause}
              className={`p-3 rounded-full ${isDark ? 'bg-primary-600 hover:bg-primary-500' : 'bg-primary-500 hover:bg-primary-400'} text-white transition-colors`}
              title={isPlaying ? t('common.aria.pause') : t('common.aria.play')}
              aria-label={isPlaying ? t('common.aria.pause') : t('common.aria.play')}
              aria-pressed={isPlaying}
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="w-5 h-5" />
              ) : (
                <Play aria-hidden="true" className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleStepForward}
              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-target flex items-center justify-center ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              title={t('common.aria.nextStep')}
              aria-label={t('common.aria.nextStep')}
            >
              <SkipForward aria-hidden="true" className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'} w-16`}>
              {t('graphEditor.timelineView.nodeCount', { current: currentNodeCount, total: totalCount })}
            </span>
            
            <div
              ref={trackRef}
              className="flex-1 h-2 rounded-lg cursor-pointer relative"
              style={{ backgroundColor: isDark ? '#334155' : '#e5e7eb' }}
              onMouseDown={handleTrackMouseDown}
            >
              <div
                ref={fillRef}
                className="absolute top-0 left-0 h-full rounded-lg"
                style={{ width: `${progress}%`, backgroundColor: '#6366f1' }}
              />
              <div
                ref={thumbRef}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full shadow-md cursor-grab active:cursor-grabbing"
                style={{ left: `${progress}%`, backgroundColor: '#6366f1' }}
              />
            </div>
            
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'} w-12 text-right`}>
              {Math.round(progress)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t('graphEditor.timelineView.speed')}</span>
            {[0.5, 1, 2, 4].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playSpeed === speed
                    ? isDark 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-primary-500 text-white'
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

const areEqual = (prev: TimelineViewProps, next: TimelineViewProps) => {
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
    prev.onNodeClick === next.onNodeClick &&
    prev.onCanvasClick === next.onCanvasClick
  );
};

export const TimelineView = React.memo(TimelineViewComponent, areEqual);
