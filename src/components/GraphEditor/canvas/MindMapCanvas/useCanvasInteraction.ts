import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Node, LayoutNode } from '../../../../types';
import type { Transform } from './useCanvasTransform';

interface ContainerSize {
  width: number;
  height: number;
}

interface UseCanvasInteractionOptions {
  svgRef: React.RefObject<SVGSVGElement>;
  containerSize: ContainerSize;
  transformRef: React.MutableRefObject<Transform>;
  updateTransformDOM: (t: Transform) => void;
  updateTransformState: (t: Transform) => void;
  animateCamera: (x: number, y: number, k: number, duration?: number) => void;
  onCanvasClick?: () => void;
  onNodeLongPress?: (node: LayoutNode) => void;
  onNodeClick: (node: LayoutNode) => void;
  layout: { nodes: LayoutNode[]; links: { id: string }[] } | null;
  nodes: Node[];
  rightPanelWidth?: number;
  leftPanelWidth?: number;
  isMobilePreviewMode?: boolean;
  selectedNodeId: string | null;
  previewDelay?: number;
  isSelectingParent?: boolean;
  onSelectParent?: (nodeId: string) => void;
  currentNodeId?: string;
}

export const useCanvasInteraction = (options: UseCanvasInteractionOptions) => {
  const {
    svgRef,
    containerSize,
    transformRef,
    updateTransformDOM,
    updateTransformState,
    animateCamera,
    onCanvasClick,
    onNodeLongPress,
    onNodeClick,
    layout,
    nodes,
    rightPanelWidth = 0,
    leftPanelWidth = 0,
    isMobilePreviewMode = false,
    selectedNodeId,
    previewDelay = 500,
    isSelectingParent = false,
    onSelectParent,
    currentNodeId,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const [touchPressedNodeId, setTouchPressedNodeId] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchStartDistanceRef = useRef<number | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartTransformRef = useRef<Transform | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const touchMovedRef = useRef(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartOnNodeRef = useRef<string | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [previewNode, setPreviewNode] = useState<{
    node: Node;
    position: { x: number; y: number };
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showMiniMap, setShowMiniMap] = useState(false);

  const hasUserInteracted = useRef(false);
  const prevNodeCount = useRef(0);

  const [viewportVersion, setViewportVersion] = useState(0);
  const viewportUpdateFrameRef = useRef<number | null>(null);

  const scheduleViewportUpdate = useCallback(() => {
    if (viewportUpdateFrameRef.current !== null) {
      return;
    }
    viewportUpdateFrameRef.current = requestAnimationFrame(() => {
      setViewportVersion((v) => v + 1);
      viewportUpdateFrameRef.current = null;
    });
  }, []);

  const handleMiniMapTransformChange = useCallback(
    (newTransform: Transform) => {
      hasUserInteracted.current = true;
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      scheduleViewportUpdate();
      updateTransformState(newTransform);
    },
    [transformRef, updateTransformDOM, updateTransformState, scheduleViewportUpdate],
  );

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (nodes.length > 0 && prevNodeCount.current === 0) {
      hasUserInteracted.current = false;
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length]);

  const handleWheel = useCallback((e: WheelEvent) => {
    hasUserInteracted.current = true;
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
    scheduleViewportUpdate();
    updateTransformState(newTransform);
  }, [svgRef, transformRef, updateTransformDOM, scheduleViewportUpdate, updateTransformState]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [svgRef, layout, handleWheel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target === svgRef.current) {
        hasUserInteracted.current = true;
        setIsDragging(true);
        setDragStart({
          x: e.clientX - transformRef.current.x,
          y: e.clientY - transformRef.current.y,
        });
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [svgRef, transformRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDragging) {
        const newTransform = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
          k: transformRef.current.k,
        };

        transformRef.current = newTransform;
        updateTransformDOM(newTransform);

        scheduleViewportUpdate();

        updateTransformState(newTransform);
      }
    },
    [isDragging, dragStart, transformRef, updateTransformDOM, updateTransformState, scheduleViewportUpdate],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [isDragging, onCanvasClick],
  );

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (
    touches: React.TouchList,
  ): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      hasUserInteracted.current = true;
      const touches = e.touches;

      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }

      isLongPressTriggeredRef.current = false;
      touchMovedRef.current = false;

      if (touches.length === 1) {
        const touch = touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartTransformRef.current = { ...transformRef.current };

        const target = e.target as SVGElement;
        const nodeElement = target.closest('[data-node-id]');
        if (nodeElement) {
          const nodeId = nodeElement.getAttribute('data-node-id');
          touchStartOnNodeRef.current = nodeId;
          if (nodeId && onNodeLongPress) {
            setTouchPressedNodeId(nodeId);
            longPressTimeoutRef.current = setTimeout(() => {
              if (
                !touchMovedRef.current &&
                !isLongPressTriggeredRef.current
              ) {
                isLongPressTriggeredRef.current = true;
                const node = layout?.nodes.find((n) => n.id === nodeId);
                if (node) {
                  onNodeLongPress(node as LayoutNode);
                }
              }
              setTouchPressedNodeId(null);
            }, 500);
          }
        } else {
          touchStartOnNodeRef.current = null;
          setIsDragging(true);
          setDragStart({
            x: touch.clientX - transformRef.current.x,
            y: touch.clientY - transformRef.current.y,
          });
        }
      } else if (touches.length === 2) {
        setTouchPressedNodeId(null);
        if (longPressTimeoutRef.current) {
          clearTimeout(longPressTimeoutRef.current);
          longPressTimeoutRef.current = null;
        }

        touchStartDistanceRef.current = getTouchDistance(touches);
        touchStartCenterRef.current = getTouchCenter(touches);
        touchStartTransformRef.current = { ...transformRef.current };

        setIsDragging(true);
        setDragStart({
          x: touches[0].clientX - transformRef.current.x,
          y: touches[0].clientY - transformRef.current.y,
        });
      }
    },
    [onNodeLongPress, layout, transformRef],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      e.preventDefault();
      const touches = e.touches;

      if (touches.length === 1 && touchStartRef.current) {
        const touch = touches[0];
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);
        const moveThreshold = 10;

        if (dx > moveThreshold || dy > moveThreshold) {
          touchMovedRef.current = true;
          setTouchPressedNodeId(null);

          if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
          }
        }

        if (
          touchMovedRef.current &&
          !touchStartOnNodeRef.current &&
          touchStartTransformRef.current
        ) {
          const deltaX = touch.clientX - touchStartRef.current.x;
          const deltaY = touch.clientY - touchStartRef.current.y;

          const newTransform = {
            x: touchStartTransformRef.current.x + deltaX,
            y: touchStartTransformRef.current.y + deltaY,
            k: touchStartTransformRef.current.k,
          };

          transformRef.current = newTransform;
          updateTransformDOM(newTransform);
          scheduleViewportUpdate();
          updateTransformState(newTransform);
        }

        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (
        touches.length === 2 &&
        touchStartDistanceRef.current !== null &&
        touchStartCenterRef.current !== null &&
        touchStartTransformRef.current !== null
      ) {
        const currentDistance = getTouchDistance(touches);
        const currentCenter = getTouchCenter(touches);

        const scaleRatio = currentDistance / touchStartDistanceRef.current;
        const newK = Math.max(
          0.1,
          Math.min(3, touchStartTransformRef.current.k * scaleRatio),
        );

        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = currentCenter.x - rect.left;
        const centerY = currentCenter.y - rect.top;

        const startCenterX = touchStartCenterRef.current.x - rect.left;
        const startCenterY = touchStartCenterRef.current.y - rect.top;

        const deltaX = currentCenter.x - touchStartCenterRef.current.x;
        const deltaY = currentCenter.y - touchStartCenterRef.current.y;

        const scaleChange = newK / touchStartTransformRef.current.k;

        const newX =
          centerX -
          (startCenterX - touchStartTransformRef.current.x) * scaleChange +
          deltaX;
        const newY =
          centerY -
          (startCenterY - touchStartTransformRef.current.y) * scaleChange +
          deltaY;

        const newTransform = { x: newX, y: newY, k: newK };

        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        scheduleViewportUpdate();
        updateTransformState(newTransform);
      }
    },
    [svgRef, transformRef, updateTransformDOM, updateTransformState, scheduleViewportUpdate],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      const touches = e.touches;

      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }

      setTouchPressedNodeId(null);

      if (touches.length === 0) {
        setIsDragging(false);
        touchStartRef.current = null;
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartTransformRef.current = null;
        lastTouchRef.current = null;
        touchStartOnNodeRef.current = null;

        if (
          !touchMovedRef.current &&
          !isLongPressTriggeredRef.current &&
          onCanvasClick
        ) {
          onCanvasClick();
        }
      } else if (touches.length === 1) {
        const touch = touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartTransformRef.current = { ...transformRef.current };

        const target = e.target as SVGElement;
        const nodeElement = target.closest('[data-node-id]');
        touchStartOnNodeRef.current = nodeElement
          ? nodeElement.getAttribute('data-node-id')
          : null;

        setDragStart({
          x: touch.clientX - transformRef.current.x,
          y: touch.clientY - transformRef.current.y,
        });
      }
    },
    [onCanvasClick, transformRef],
  );

  const visualCenterX = useMemo(() => {
    return (containerSize.width - rightPanelWidth + leftPanelWidth) / 2;
  }, [rightPanelWidth, leftPanelWidth, containerSize.width]);

  const visualCenterY = useMemo(() => {
    let centerY = containerSize.height / 2;
    if (isMobilePreviewMode && selectedNodeId) {
      centerY -= 140;
    }
    return centerY;
  }, [containerSize.height, isMobilePreviewMode, selectedNodeId]);

  const handleResetView = useCallback(() => {
    hasUserInteracted.current = true;
    let targetX = 0;
    let targetY = 0;

    if (layout && layout.nodes.length > 0) {
      const rootNode =
        layout.nodes.find((n) => n.level === 'root') || layout.nodes[0];
      targetX = visualCenterX - rootNode.x;
      targetY = visualCenterY - rootNode.y;
    }

    const newTransform = { x: targetX, y: targetY, k: 1 };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    updateTransformState(newTransform);
  }, [
    layout,
    visualCenterX,
    visualCenterY,
    transformRef,
    updateTransformDOM,
    updateTransformState,
  ]);

  const handleZoomIn = useCallback(() => {
    const newK = Math.min(5, transformRef.current.k * 1.2);
    animateCamera(transformRef.current.x, transformRef.current.y, newK);
  }, [animateCamera, transformRef]);

  const handleZoomOut = useCallback(() => {
    const newK = Math.max(0.1, transformRef.current.k / 1.2);
    animateCamera(transformRef.current.x, transformRef.current.y, newK);
  }, [animateCamera, transformRef]);

  const handleFitView = useCallback(() => {
    if (!layout || layout.nodes.length === 0) return;
    const padding = 60;
    const effectiveRightWidth = rightPanelWidth || 0;
    const effectiveLeftWidth = leftPanelWidth || 0;
    const availableWidth =
      containerSize.width -
      effectiveRightWidth -
      effectiveLeftWidth -
      padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    layout.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const contentWidth = maxX - minX + 200;
    const contentHeight = maxY - minY + 200;
    const scaleK = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      1.5,
    );
    const clampedK = Math.max(0.1, Math.min(scaleK, 2));

    const centerX =
      (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;
    const centerY = containerSize.height / 2;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    animateCamera(
      centerX - contentCenterX * clampedK,
      centerY - contentCenterY * clampedK,
      clampedK,
      500,
    );
  }, [layout, containerSize, rightPanelWidth, leftPanelWidth, animateCamera]);

  const handleNodeMouseEnter = useCallback(
    (e: React.MouseEvent, node: LayoutNode) => {
      setHoveredNodeId(node.id);
      previewPositionRef.current = { x: e.clientX, y: e.clientY };
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
        setPreviewNode({
          node: node as Node,
          position: previewPositionRef.current,
        });
        setShowPreview(true);
      }, previewDelay);
    },
    [previewDelay],
  );

  const handleNodeMouseLeave = useCallback(() => {
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
  }, [isPreviewHovered]);

  const handleNodeClick = useCallback(
    (node: LayoutNode) => {
      if (isSelectingParent && onSelectParent) {
        if (node.id !== currentNodeId) {
          onSelectParent(node.id);
        }
      } else {
        onNodeClick(node);
      }
      setShowPreview(false);
      setPreviewNode(null);
    },
    [isSelectingParent, onSelectParent, currentNodeId, onNodeClick],
  );

  const handlePreviewMouseEnter = useCallback(() => {
    setIsPreviewHovered(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handlePreviewMouseLeave = useCallback(() => {
    setIsPreviewHovered(false);
    setShowPreview(false);
    setPreviewNode(null);
  }, []);

  const handlePreviewNavigate = useCallback(
    (node: Node) => {
      onNodeClick(node as LayoutNode);
      setShowPreview(false);
      setPreviewNode(null);
    },
    [onNodeClick],
  );

  return {
    isDragging,
    touchPressedNodeId,
    hoveredNodeId,
    previewNode,
    showPreview,
    isPreviewHovered,
    showMiniMap,
    setShowMiniMap,
    hasUserInteracted,
    visualCenterX,
    visualCenterY,
    viewportVersion,
    scheduleViewportUpdate,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMiniMapTransformChange,
    handleResetView,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    handleNodeClick,
    handlePreviewMouseEnter,
    handlePreviewMouseLeave,
    handlePreviewNavigate,
  };
};