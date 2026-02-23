import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import html2canvas from 'html2canvas';
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
import { MiniMap } from './MiniMap';
import { LayoutOrganizer } from './LayoutOrganizer';
import { NodePreviewCard } from './NodePreviewCard';
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
  isRightPanelOpen?: boolean;
  rightPanelWidth?: number;
  graphId?: string;
  onLayoutUpdate?: (positions: Map<string, { x: number; y: number }>) => void;
  isSelectingParent?: boolean;
  onSelectParent?: (nodeId: string) => void;
  currentNodeId?: string;
  selectedParentIds?: string[];
  leftPanelWidth?: number;
  onNavigateToGraphMap?: () => void;
  onMarkNodeMastered?: (nodeId: string) => void;
  previewDelay?: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export const MindMapCanvas = forwardRef<any, MindMapCanvasProps>(({
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
  coloringMode = 'status',
  isRightPanelOpen = false,
  rightPanelWidth = 0,
  graphId,
  onLayoutUpdate,
  isSelectingParent = false,
  onSelectParent,
  currentNodeId,
  selectedParentIds = [],
  leftPanelWidth = 0,
  onNavigateToGraphMap,
  onMarkNodeMastered,
  previewDelay = 500
}, ref) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    captureScreenshot: async (options?: any) => {
      if (!svgRef.current) return null;
      try {
        const element = svgRef.current.parentElement as HTMLElement;
        const canvas = await html2canvas(element, {
          backgroundColor: options?.backgroundColor || (isDark ? '#0f172a' : '#ffffff'),
          scale: 2,
          logging: false,
          useCORS: true,
          ignoreElements: (element) => element.tagName === 'BUTTON'
        });
        return canvas.toDataURL('image/png');
      } catch (error) {
        console.error('Screenshot failed:', error);
        throw error;
      }
    },
    centerNode: (nodeId: string, options?: { forceRightPanelOpen?: boolean }) => {
      if (!layout) return;
      const node = layout.nodes.find(n => n.id === nodeId);
      if (node) {
        const effectiveRightWidth = options?.forceRightPanelOpen 
          ? (rightPanelWidth || 340) 
          : rightPanelWidth;
        
        const effectiveVisualCenterX = (containerSize.width - effectiveRightWidth) / 2;
        
        const targetK = 1.2;
        const targetX = effectiveVisualCenterX - node.x * targetK;
        const targetY = visualCenterY - node.y * targetK;
        animateCamera(targetX, targetY, targetK, 800);
      }
    },
    zoomIn: () => {
      const newK = Math.min(transformRef.current.k * 1.3, 5);
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      const newX = centerX - (centerX - transformRef.current.x) * (newK / transformRef.current.k);
      const newY = centerY - (centerY - transformRef.current.y) * (newK / transformRef.current.k);
      animateCamera(newX, newY, newK, 300);
    },
    zoomOut: () => {
      const newK = Math.max(transformRef.current.k / 1.3, 0.1);
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      const newX = centerX - (centerX - transformRef.current.x) * (newK / transformRef.current.k);
      const newY = centerY - (centerY - transformRef.current.y) * (newK / transformRef.current.k);
      animateCamera(newX, newY, newK, 300);
    },
    fitView: () => {
      if (!layout || layout.nodes.length === 0) return;
      
      const padding = 60;
      const effectiveRightWidth = rightPanelWidth || 0;
      const effectiveLeftWidth = leftPanelWidth || 0;
      const availableWidth = containerSize.width - effectiveRightWidth - effectiveLeftWidth - padding * 2;
      const availableHeight = containerSize.height - padding * 2;
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      layout.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      });
      
      const contentWidth = maxX - minX + 200;
      const contentHeight = maxY - minY + 200;
      
      const scaleK = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.5);
      const clampedK = Math.max(0.1, Math.min(scaleK, 2));
      
      const centerX = (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
      const centerY = containerSize.height / 2;
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;
      
      const targetX = centerX - contentCenterX * clampedK;
      const targetY = centerY - contentCenterY * clampedK;
      
      animateCamera(targetX, targetY, clampedK, 500);
    },
    resetView: () => {
      if (!layout || layout.nodes.length === 0) return;
      
      const effectiveRightWidth = rightPanelWidth || 0;
      const effectiveLeftWidth = leftPanelWidth || 0;
      const visualCenterX = (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
      const visualCenterY = containerSize.height / 2;
      
      const rootNode = layout.nodes.find(n => n.level === 'root') || layout.nodes[0];
      const targetX = visualCenterX - rootNode.x;
      const targetY = visualCenterY - rootNode.y;
      
      animateCamera(targetX, targetY, 1, 500);
    }
  }));
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
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [previewNode, setPreviewNode] = useState<{ node: Node; position: { x: number; y: number } } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Initialize with window size to minimize layout thrashing on load
  const [containerSize, setContainerSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : width, 
    height: typeof window !== 'undefined' ? window.innerHeight : height 
  });
  
  const [showMiniMap, setShowMiniMap] = useState(false);

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const hasFocusMode = focusedNodeId !== null && focusedNodeIds.size > 0;

  // Handle MiniMap transform updates
  const handleMiniMapTransformChange = useCallback((newTransform: Transform) => {
    hasUserInteracted.current = true;
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
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
    
    let nodes = layout.nodes;
    
    if (!isExplorationMode) {
      nodes = nodes.filter(node => node.is_accepted !== false);
    }

    if (nodes.length > 100) {
      const { x, y, k } = transformRef.current;
      const padding = 150;
      const viewportBounds = {
        minX: (-x - padding) / k,
        maxX: (-x + containerSize.width + padding) / k,
        minY: (-y - padding) / k,
        maxY: (-y + containerSize.height + padding) / k,
      };
      
      nodes = nodes.filter(node => 
        node.x >= viewportBounds.minX &&
        node.x <= viewportBounds.maxX &&
        node.y >= viewportBounds.minY &&
        node.y <= viewportBounds.maxY
      );
    }
    
    return nodes;
  }, [layout, isExplorationMode, transform, containerSize]);

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

  const hasUserInteracted = useRef(false);
  const prevNodeCount = useRef(0);

  // Reset interaction state when nodes are first loaded
  useEffect(() => {
    if (nodes.length > 0 && prevNodeCount.current === 0) {
      hasUserInteracted.current = false;
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    hasUserInteracted.current = true;
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
      hasUserInteracted.current = true;
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - transformRef.current.x, 
        y: e.clientY - transformRef.current.y 
      });
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

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

  const handleZoomIn = useCallback(() => {
    hasUserInteracted.current = true;
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
    hasUserInteracted.current = true;
    const prev = transformRef.current;
    const newTransform = {
      ...prev,
      k: Math.max(0.1, prev.k / 1.2)
    };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [updateTransformDOM, updateTransformState]);

  // Calculate visual center based on right panel and left panel state
  const visualCenterX = useMemo(() => {
    // If right panel is open, the visual center shifts left
    // If left panel is open, the visual center shifts right
    return (containerSize.width - rightPanelWidth + leftPanelWidth) / 2;
  }, [rightPanelWidth, leftPanelWidth, containerSize.width]);

  const visualCenterY = containerSize.height / 2;

  const handleResetView = useCallback(() => {
    hasUserInteracted.current = true;
    // Recalculate center based on visual center and root node if possible
    let targetX = 0;
    let targetY = 0;
    
    if (layout && layout.nodes.length > 0) {
      // Find root node or fallback to first node
      const rootNode = layout.nodes.find(n => n.level === 'root') || layout.nodes[0];
      targetX = visualCenterX - rootNode.x;
      targetY = visualCenterY - rootNode.y;
    }

    const newTransform = { x: targetX, y: targetY, k: 1 };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [layout, visualCenterX, visualCenterY, updateTransformDOM, updateTransformState]);

  // Auto-center root node on initial load or layout change if no user interaction
  useEffect(() => {
    if (layout && layout.nodes.length > 0 && !focusedNodeId && !hasUserInteracted.current) {
      // Find root node or fallback to first node
      const rootNode = layout.nodes.find(n => n.level === 'root') || layout.nodes[0];
      const targetK = transformRef.current.k;
      const targetX = visualCenterX - rootNode.x * targetK;
      const targetY = visualCenterY - rootNode.y * targetK;
      
      // Only update if significantly different to avoid loops
      if (Math.abs(transformRef.current.x - targetX) > 1 || 
          Math.abs(transformRef.current.y - targetY) > 1) {
        const newTransform = { x: targetX, y: targetY, k: targetK };
        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        updateTransformState(newTransform);
      }
    }
  }, [layout, visualCenterX, visualCenterY, focusedNodeId, updateTransformDOM, updateTransformState]);



  // Focus on node when focusedNodeId changes
  useEffect(() => {
    if (focusedNodeId && layout) {
      const node = layout.nodes.find(n => n.id === focusedNodeId);
      if (node) {
        const targetK = 1.2; 
        const targetX = visualCenterX - node.x * targetK;
        const targetY = visualCenterY - node.y * targetK;

        // Use smooth animation instead of instant jump
        animateCamera(targetX, targetY, targetK, 800);
      }
    }
  }, [focusedNodeId, layout, visualCenterX, visualCenterY, animateCamera]);

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
          {visibleNodes.map(node => {
            const isSelectableAsParent = isSelectingParent && node.id !== currentNodeId;
            const isSelectedAsParent = selectedParentIds.includes(node.id);
            return (
              <MindMapNode
                key={node.id}
                node={node}
                edges={edges}
                nodeStatus={nodeStatus}
                selected={node.id === selectedNodeId}
                isDark={isDark}
                zoomLevel={transform.k}
                onClick={() => {
                  if (isSelectingParent && onSelectParent) {
                    if (node.id !== currentNodeId) {
                      onSelectParent(node.id);
                    }
                  } else {
                    onNodeClick(node);
                  }
                  setShowPreview(false);
                  setPreviewNode(null);
                }}
                onMouseEnter={(e) => {
                  setHoveredNodeId(node.id);
                  previewPositionRef.current = { x: e.clientX, y: e.clientY };
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                  }
                  hoverTimeoutRef.current = setTimeout(() => {
                    setPreviewNode({ node: node as Node, position: previewPositionRef.current });
                    setShowPreview(true);
                  }, previewDelay);
                }}
                onMouseLeave={() => {
                  setHoveredNodeId(null);
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                  if (hideTimeoutRef.current) {
                    clearTimeout(hideTimeoutRef.current);
                  }
                  hideTimeoutRef.current = setTimeout(() => {
                    if (!isPreviewHovered) {
                      setShowPreview(false);
                    }
                  }, 100);
                }}
                focused={focusedNodeIds.has(node.id)}
                forceShowText={forceShowTextIds.has(node.id)}
                hasFocusMode={hasFocusMode}
                colorScheme={colorScheme}
                nodeSizeMode={nodeSizeMode}
                nodeImportance={nodeImportanceMap.get(node.id)}
                allNodes={nodes}
                onContextMenu={onNodeContextMenu}
                coloringMode={coloringMode}
                isSelectableAsParent={isSelectableAsParent}
                isExcludedAsParent={isSelectingParent && node.id === currentNodeId}
                isSelectedAsParent={isSelectedAsParent}
              />
            );
          })}
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

      {/* Controls */}
      <div 
        className="absolute bottom-4 flex flex-row gap-4 items-end pointer-events-none transition-all duration-300"
        style={{ right: rightPanelWidth > 0 ? rightPanelWidth + 16 : 16 }}
      >
        {showMiniMap && layout && (
          <div className="pointer-events-auto">
            <MiniMap 
              nodes={visibleNodes}
              transform={transform}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              onTransformChange={handleMiniMapTransformChange}
              width={240}
              height={160}
              viewCenterX={visualCenterX}
              viewCenterY={visualCenterY}
            />
          </div>
        )}
        
        <div className="flex flex-col gap-2 pointer-events-auto">
          {onNavigateToGraphMap && (
            <button
              onClick={onNavigateToGraphMap}
              className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              title="查看图谱地图"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
          )}
          {graphId && onLayoutUpdate && (
            <LayoutOrganizer
              graphId={graphId}
              nodes={nodes}
              edges={edges}
              onLayoutUpdate={onLayoutUpdate}
            />
          )}
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={showMiniMap ? "隐藏小地图" : "显示小地图"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          
          <button
            onClick={() => {
              if (!layout || layout.nodes.length === 0) return;
              const padding = 60;
              const effectiveRightWidth = rightPanelWidth || 0;
              const effectiveLeftWidth = leftPanelWidth || 0;
              const availableWidth = containerSize.width - effectiveRightWidth - effectiveLeftWidth - padding * 2;
              const availableHeight = containerSize.height - padding * 2;
              
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              layout.nodes.forEach(node => {
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
              });
              
              const contentWidth = maxX - minX + 200;
              const contentHeight = maxY - minY + 200;
              const scaleK = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.5);
              const clampedK = Math.max(0.1, Math.min(scaleK, 2));
              
              const centerX = (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
              const centerY = containerSize.height / 2;
              const contentCenterX = (minX + maxX) / 2;
              const contentCenterY = (minY + maxY) / 2;
              
              animateCamera(centerX - contentCenterX * clampedK, centerY - contentCenterY * clampedK, clampedK, 500);
            }}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="适应屏幕"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
        缩放: {Math.round(transform.k * 100)}%
      </div>

      {showPreview && previewNode && (
        <NodePreviewCard
          node={previewNode.node}
          nodes={nodes}
          edges={edges}
          nodeStatus={nodeStatus}
          position={previewNode.position}
          onNavigateToNode={(node) => {
            onNodeClick(node);
            setShowPreview(false);
            setPreviewNode(null);
          }}
          onMarkMastered={onMarkNodeMastered}
          onMouseEnter={() => {
            setIsPreviewHovered(true);
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setIsPreviewHovered(false);
            setShowPreview(false);
            setPreviewNode(null);
          }}
        />
      )}
    </div>
  );
});