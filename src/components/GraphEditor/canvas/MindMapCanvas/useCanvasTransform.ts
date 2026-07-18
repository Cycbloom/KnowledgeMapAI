import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { debounce } from '@/utils/performanceUtils';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

interface UseCanvasTransformOptions {
  contentRef: React.RefObject<SVGGElement>;
  initialTransform?: Transform;
}

export const useCanvasTransform = (options: UseCanvasTransformOptions) => {
  const { contentRef, initialTransform } = options;
  
  const [transform, setTransform] = useState<Transform>(initialTransform || { x: 0, y: 0, k: 1 });
  const transformRef = useRef<Transform>(initialTransform || { x: 0, y: 0, k: 1 });
  const animationFrameRef = useRef<number | null>(null);
  const updateTransformState = useMemo(
    () =>
      debounce((newTransform: Transform) => {
        setTransform(newTransform);
      }, 100),
    [],
  );
  
  const updateTransformDOM = useCallback((t: Transform) => {
    if (contentRef.current) {
      contentRef.current.setAttribute('transform', `translate(${t.x}, ${t.y}) scale(${t.k})`);
    }
  }, [contentRef]);
  
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
  
  const setTransformImmediate = useCallback((newTransform: Transform) => {
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    setTransform(newTransform);
  }, [updateTransformDOM]);
  
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      updateTransformState.cancel();
    };
  }, [updateTransformState]);
  
  useEffect(() => {
    if (Math.abs(transform.x - transformRef.current.x) > 0.1 ||
        Math.abs(transform.y - transformRef.current.y) > 0.1 ||
        Math.abs(transform.k - transformRef.current.k) > 0.001) {
      transformRef.current = transform;
    }
  }, [transform]);
  
  useEffect(() => {
    updateTransformDOM(transformRef.current);
  }, [updateTransformDOM]);
  
  return {
    transform,
    transformRef,
    setTransform: setTransformImmediate,
    animateCamera,
    updateTransformDOM,
    updateTransformState,
  };
};
