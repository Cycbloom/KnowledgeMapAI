import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import type { Graph } from "../../../types";
import type { LayoutResult } from "../../../utils/mindmapLayout";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface UseGraphMapInteractionOptions {
  ref: React.ForwardedRef<{ centerNode: (nodeId: string) => void }>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<SVGGElement | null>;
  width: number;
  height: number;
  layoutRef: React.MutableRefObject<LayoutResult | null>;
  graphs: Array<Graph & { node_count?: number }>;
  onGraphClick?: (graph: Graph) => void;
  onBoxSelection?: (graphIds: string[]) => void;
}

export function useGraphMapInteraction({
  ref,
  svgRef,
  containerRef,
  contentRef,
  width,
  height,
  layoutRef,
  graphs,
  onGraphClick,
  onBoxSelection,
}: UseGraphMapInteractionOptions) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : width,
    height: typeof window !== "undefined" ? window.innerHeight : height,
  });
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [focusedGraphId, setFocusedGraphId] = useState<string | null>(null);
  const [hasMoved, setHasMoved] = useState(false);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

  const mouseDownPos = useRef({ x: 0, y: 0 });
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchStartDistance = useRef<number | null>(null);
  const touchStartMidpoint = useRef<{ x: number; y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const touchStartOnNodeRef = useRef<string | null>(null);
  const touchStartTransformRef = useRef<Transform | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateTransformDOM = useCallback((t: Transform) => {
    if (contentRef.current) {
      contentRef.current.setAttribute(
        "transform",
        `translate(${t.x}, ${t.y}) scale(${t.k})`,
      );
    }
  }, [contentRef]);

  const updateTransformState = useCallback((newTransform: Transform) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setTransform(newTransform);
    }, 100);
  }, []);

  const animateCamera = useCallback(
    (
      targetX: number,
      targetY: number,
      targetK: number,
      duration: number = 500,
    ) => {
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

        const ease =
          progress < 0.5
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
    },
    [updateTransformDOM, updateTransformState],
  );

  useImperativeHandle(ref, () => ({
    centerNode: (nodeId: string) => {
      const currentLayout = layoutRef.current;
      if (!currentLayout) return;
      const node = currentLayout.nodes.find((n) => n.id === nodeId);
      if (node) {
        const visualCenterX = containerSize.width / 2;
        const visualCenterY = containerSize.height / 2;
        const targetK = 1.2;
        const targetX = visualCenterX - node.x * targetK;
        const targetY = visualCenterY - node.y * targetK;
        animateCamera(targetX, targetY, targetK, 800);
      }
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
  }, [containerRef]);

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
    },
    [svgRef, updateTransformDOM, updateTransformState],
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();

    touchMovedRef.current = false;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      touchStartDistance.current = null;
      touchStartMidpoint.current = null;
      touchStartTransformRef.current = { ...transformRef.current };

      const target = e.target as SVGElement;
      const nodeElement = target.closest("[data-node-id]");
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute("data-node-id");
        touchStartOnNodeRef.current = nodeId;
      } else {
        touchStartOnNodeRef.current = null;
        setIsDragging(true);
        setHasMoved(false);
        dragStartRef.current = {
          x: touch.clientX - transformRef.current.x,
          y: touch.clientY - transformRef.current.y,
        };
      }
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      );
      touchStartDistance.current = distance;

      const midpoint = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        touchStartMidpoint.current = {
          x: midpoint.x - rect.left,
          y: midpoint.y - rect.top,
        };
      }
      touchStartTransformRef.current = { ...transformRef.current };
    }
  }, [svgRef]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && touchStartPos.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        const moveThreshold = 10;

        if (dx > moveThreshold || dy > moveThreshold) {
          touchMovedRef.current = true;
          if (touchStartOnNodeRef.current) {
            touchStartOnNodeRef.current = null;
          }
        }

        if (touchMovedRef.current && touchStartTransformRef.current) {
          const deltaX = touch.clientX - touchStartPos.current.x;
          const deltaY = touch.clientY - touchStartPos.current.y;

          const newTransform = {
            x: touchStartTransformRef.current.x + deltaX,
            y: touchStartTransformRef.current.y + deltaY,
            k: touchStartTransformRef.current.k,
          };

          transformRef.current = newTransform;
          updateTransformDOM(newTransform);
          updateTransformState(newTransform);
        }

        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (
        e.touches.length === 2 &&
        touchStartDistance.current &&
        touchStartMidpoint.current &&
        touchStartTransformRef.current
      ) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2),
        );

        const scaleFactor = currentDistance / touchStartDistance.current;
        const newK = Math.max(
          0.1,
          Math.min(5, touchStartTransformRef.current.k * scaleFactor),
        );

        const midpoint = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const currentMidpoint = {
            x: midpoint.x - rect.left,
            y: midpoint.y - rect.top,
          };

          const deltaX = currentMidpoint.x - touchStartMidpoint.current.x;
          const deltaY = currentMidpoint.y - touchStartMidpoint.current.y;

          const newX = touchStartTransformRef.current.x + deltaX;
          const newY = touchStartTransformRef.current.y + deltaY;

          const newTransform = { x: newX, y: newY, k: newK };

          transformRef.current = newTransform;
          updateTransformDOM(newTransform);
          updateTransformState(newTransform);
        }
      }
    },
    [svgRef, updateTransformDOM, updateTransformState],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (
          !touchMovedRef.current &&
          touchStartOnNodeRef.current &&
          onGraphClick
        ) {
          const graph = graphs.find(
            (g) => g.id === touchStartOnNodeRef.current,
          );
          if (graph) {
            onGraphClick(graph);
            setFocusedGraphId(touchStartOnNodeRef.current);
          }
        }

        setIsDragging(false);
        touchStartPos.current = null;
        touchStartDistance.current = null;
        touchStartMidpoint.current = null;
        lastTouchRef.current = null;
        touchMovedRef.current = false;
        touchStartOnNodeRef.current = null;
        touchStartTransformRef.current = null;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartPos.current = {
          x: touch.clientX,
          y: touch.clientY,
        };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartDistance.current = null;
        touchStartMidpoint.current = null;
        touchStartTransformRef.current = { ...transformRef.current };

        const target = e.target as SVGElement;
        const nodeElement = target.closest("[data-node-id]");
        touchStartOnNodeRef.current = nodeElement
          ? nodeElement.getAttribute("data-node-id")
          : null;
      }
    },
    [onGraphClick, graphs],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const options = { passive: false };

    svg.addEventListener("wheel", handleWheel, options);
    svg.addEventListener("touchstart", handleTouchStart, options);
    svg.addEventListener("touchmove", handleTouchMove, options);
    svg.addEventListener("touchend", handleTouchEnd, options);
    svg.addEventListener("touchcancel", handleTouchEnd, options);

    return () => {
      svg.removeEventListener("wheel", handleWheel);
      svg.removeEventListener("touchstart", handleTouchStart);
      svg.removeEventListener("touchmove", handleTouchMove);
      svg.removeEventListener("touchend", handleTouchEnd);
      svg.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [svgRef, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target === svgRef.current) {
        setIsDragging(true);
        setHasMoved(false);
        mouseDownPos.current = { x: e.clientX, y: e.clientY };
        dragStartRef.current = {
          x: e.clientX - transformRef.current.x,
          y: e.clientY - transformRef.current.y,
        };

        if (e.shiftKey) {
          setIsSelecting(true);
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setSelectionBox({
              start: { x: e.clientX - rect.left, y: e.clientY - rect.top },
              end: { x: e.clientX - rect.left, y: e.clientY - rect.top },
            });
          }
        }
      }
    },
    [svgRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isSelecting && selectionBox) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          setSelectionBox((prev) =>
            prev
              ? {
                  ...prev,
                  end: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                }
              : null,
          );
        }
        return;
      }

      if (isDragging) {
        const dx = e.clientX - mouseDownPos.current.x;
        const dy = e.clientY - mouseDownPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
          setHasMoved(true);
        }

        const newTransform = {
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
          k: transformRef.current.k,
        };

        transformRef.current = newTransform;
        updateTransformDOM(newTransform);
        updateTransformState(newTransform);
      }
    },
    [
      isDragging,
      isSelecting,
      selectionBox,
      svgRef,
      updateTransformDOM,
      updateTransformState,
    ],
  );

  const handleMouseUp = useCallback(() => {
    const currentLayout = layoutRef.current;
    if (isSelecting && selectionBox && currentLayout && onBoxSelection) {
      const box = {
        x: Math.min(selectionBox.start.x, selectionBox.end.x),
        y: Math.min(selectionBox.start.y, selectionBox.end.y),
        width: Math.abs(selectionBox.end.x - selectionBox.start.x),
        height: Math.abs(selectionBox.end.y - selectionBox.start.y),
      };

      if (box.width > 10 && box.height > 10) {
        const transformCurrent = transformRef.current;
        const selectedIds = currentLayout.nodes
          .filter((node) => {
            const screenX = node.x * transformCurrent.k + transformCurrent.x;
            const screenY = node.y * transformCurrent.k + transformCurrent.y;
            return (
              screenX >= box.x &&
              screenX <= box.x + box.width &&
              screenY >= box.y &&
              screenY <= box.y + box.height
            );
          })
          .map((node) => node.id);

        if (selectedIds.length > 0) {
          onBoxSelection(selectedIds);
        }
      }
    }

    setIsSelecting(false);
    setSelectionBox(null);
    setIsDragging(false);
  }, [isSelecting, selectionBox, layoutRef, onBoxSelection]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target === svgRef.current && !hasMoved) {
        setFocusedGraphId(null);
      }
      setHasMoved(false);
    },
    [svgRef, hasMoved],
  );

  const handleResetView = useCallback(() => {
    const currentLayout = layoutRef.current;
    if (currentLayout && currentLayout.nodes.length > 0) {
      const rootNode =
        currentLayout.nodes.find((n) => n.level === "root") || currentLayout.nodes[0];
      const visualCenterX = containerSize.width / 2;
      const visualCenterY = containerSize.height / 2;
      const targetX = visualCenterX - rootNode.x;
      const targetY = visualCenterY - rootNode.y;

      const newTransform = { x: targetX, y: targetY, k: 1 };
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      updateTransformState(newTransform);
    }
  }, [layoutRef, containerSize, updateTransformDOM, updateTransformState]);

  const handleMiniMapTransformChange = useCallback(
    (newTransform: Transform) => {
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
      updateTransformState(newTransform);
    },
    [updateTransformDOM, updateTransformState],
  );

  const handleZoomIn = useCallback(() => {
    const newK = Math.min(5, transformRef.current.k * 1.2);
    animateCamera(
      transformRef.current.x,
      transformRef.current.y,
      newK,
    );
  }, [animateCamera]);

  const handleZoomOut = useCallback(() => {
    const newK = Math.max(0.1, transformRef.current.k / 1.2);
    animateCamera(
      transformRef.current.x,
      transformRef.current.y,
      newK,
    );
  }, [animateCamera]);

  const handleToggleMiniMap = useCallback(() => {
    setShowMiniMap((prev) => !prev);
  }, []);

  const handleToggleLegend = useCallback(() => {
    setShowLegend((prev) => !prev);
  }, []);

  const applyTransform = useCallback(
    (t: Transform) => {
      transformRef.current = t;
      updateTransformDOM(t);
      updateTransformState(t);
    },
    [updateTransformDOM, updateTransformState],
  );

  return {
    transform,
    transformRef,
    isDragging,
    containerSize,
    showMiniMap,
    showLegend,
    setShowLegend,
    focusedGraphId,
    setFocusedGraphId,
    hasMoved,
    isSelecting,
    selectionBox,
    applyTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCanvasClick,
    handleResetView,
    handleMiniMapTransformChange,
    handleZoomIn,
    handleZoomOut,
    handleToggleMiniMap,
    handleToggleLegend,
    animateCamera,
  };
}