import { useState, useCallback, useRef, useEffect } from 'react';
import type { Transform } from './useCanvasTransform';

interface UseCanvasInteractionOptions {
  transformRef: React.MutableRefObject<Transform>;
  updateTransformDOM: (t: Transform) => void;
  setTransform: (t: Transform) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  onCanvasClick?: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export const useCanvasInteraction = (options: UseCanvasInteractionOptions) => {
  const {
    transformRef,
    updateTransformDOM,
    setTransform,
    containerRef,
    onCanvasClick,
    minZoom = 0.1,
    maxZoom = 4
  } = options;
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hasUserInteracted = useRef(false);
  
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    hasUserInteracted.current = true;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.max(minZoom, Math.min(maxZoom, transformRef.current.k * delta));
    
    const scale = newK / transformRef.current.k;
    const newX = mouseX - (mouseX - transformRef.current.x) * scale;
    const newY = mouseY - (mouseY - transformRef.current.y) * scale;
    
    const newTransform = { x: newX, y: newY, k: newK };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
  }, [containerRef, transformRef, updateTransformDOM, minZoom, maxZoom]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y });
    }
  }, [transformRef]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      hasUserInteracted.current = true;
      const newTransform = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
        k: transformRef.current.k
      };
      transformRef.current = newTransform;
      updateTransformDOM(newTransform);
    }
  }, [isDragging, dragStart, transformRef, updateTransformDOM]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      onCanvasClick?.();
    }
  }, [onCanvasClick]);
  
  const handleZoomIn = useCallback(() => {
    const newK = Math.min(maxZoom, transformRef.current.k * 1.2);
    const centerX = containerRef.current ? containerRef.current.clientWidth / 2 : 0;
    const centerY = containerRef.current ? containerRef.current.clientHeight / 2 : 0;
    
    const scale = newK / transformRef.current.k;
    const newX = centerX - (centerX - transformRef.current.x) * scale;
    const newY = centerY - (centerY - transformRef.current.y) * scale;
    
    const newTransform = { x: newX, y: newY, k: newK };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    setTransform(newTransform);
  }, [containerRef, transformRef, updateTransformDOM, setTransform, maxZoom]);
  
  const handleZoomOut = useCallback(() => {
    const newK = Math.max(minZoom, transformRef.current.k / 1.2);
    const centerX = containerRef.current ? containerRef.current.clientWidth / 2 : 0;
    const centerY = containerRef.current ? containerRef.current.clientHeight / 2 : 0;
    
    const scale = newK / transformRef.current.k;
    const newX = centerX - (centerX - transformRef.current.x) * scale;
    const newY = centerY - (centerY - transformRef.current.y) * scale;
    
    const newTransform = { x: newX, y: newY, k: newK };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    setTransform(newTransform);
  }, [containerRef, transformRef, updateTransformDOM, setTransform, minZoom]);
  
  const handleResetView = useCallback(() => {
    const newTransform = { x: 0, y: 0, k: 1 };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    setTransform(newTransform);
  }, [transformRef, updateTransformDOM, setTransform]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [containerRef, handleWheel]);
  
  return {
    isDragging,
    hoveredNodeId,
    setHoveredNodeId,
    hasUserInteracted,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
    handleZoomIn,
    handleZoomOut,
    handleResetView
  };
};
