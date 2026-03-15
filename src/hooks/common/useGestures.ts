import { useCallback, useRef, useState, useEffect } from 'react';

export interface GestureConfig {
  minScale: number;
  maxScale: number;
  rotationSnap: number;
  flingDeceleration: number;
  flingThreshold: number;
  pinchSensitivity: number;
  rotationSensitivity: number;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface GestureState {
  isGesturing: boolean;
  gestureType: 'none' | 'pan' | 'pinch' | 'rotate' | 'fling';
  velocity: { x: number; y: number };
  currentTransform: Transform;
}

export interface GestureCallbacks {
  onTransformChange?: (transform: Transform) => void;
  onGestureStart?: (type: GestureState['gestureType']) => void;
  onGestureEnd?: (transform: Transform) => void;
  onFlingStart?: (velocity: { x: number; y: number }) => void;
  onFlingEnd?: () => void;
}

const DEFAULT_CONFIG: GestureConfig = {
  minScale: 0.1,
  maxScale: 4,
  rotationSnap: 45,
  flingDeceleration: 0.95,
  flingThreshold: 0.5,
  pinchSensitivity: 1,
  rotationSensitivity: 1,
};

function getTouchDistance(touches: React.TouchList | TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches: React.TouchList | TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY };
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function getTouchAngle(touches: React.TouchList | TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function snapToAngle(angle: number, snap: number): number {
  if (snap <= 0) return angle;
  return Math.round(angle / snap) * snap;
}

export function useGestures(
  config: Partial<GestureConfig> = {},
  callbacks: GestureCallbacks = {},
) {
  const mergedConfig: GestureConfig = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<GestureState>({
    isGesturing: false,
    gestureType: 'none',
    velocity: { x: 0, y: 0 },
    currentTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
  });

  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchStartDistanceRef = useRef<number | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartAngleRef = useRef<number | null>(null);
  const touchStartTransformRef = useRef<Transform | null>(null);
  const flingAnimationRef = useRef<number | null>(null);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRectRef = useRef<DOMRect | null>(null);

  const updateTransform = useCallback(
    (newTransform: Transform) => {
      transformRef.current = newTransform;
      setState((prev) => ({
        ...prev,
        currentTransform: newTransform,
      }));
      callbacks.onTransformChange?.(newTransform);
    },
    [callbacks],
  );

  const applyFling = useCallback(
    (velocity: { x: number; y: number }) => {
      if (flingAnimationRef.current) {
        cancelAnimationFrame(flingAnimationRef.current);
      }

      let currentVelocity = { ...velocity };
      let lastTime = performance.now();

      const animate = () => {
        const now = performance.now();
        const deltaTime = (now - lastTime) / 16;
        lastTime = now;

        currentVelocity.x *= Math.pow(mergedConfig.flingDeceleration, deltaTime);
        currentVelocity.y *= Math.pow(mergedConfig.flingDeceleration, deltaTime);

        const speed = Math.sqrt(
          currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y,
        );

        if (speed < mergedConfig.flingThreshold) {
          setState((prev) => ({
            ...prev,
            isGesturing: false,
            gestureType: 'none',
            velocity: { x: 0, y: 0 },
          }));
          callbacks.onFlingEnd?.();
          callbacks.onGestureEnd?.(transformRef.current);
          flingAnimationRef.current = null;
          return;
        }

        const newTransform = {
          ...transformRef.current,
          x: transformRef.current.x + currentVelocity.x * deltaTime,
          y: transformRef.current.y + currentVelocity.y * deltaTime,
        };

        updateTransform(newTransform);
        velocityRef.current = currentVelocity;

        flingAnimationRef.current = requestAnimationFrame(animate);
      };

      setState((prev) => ({
        ...prev,
        isGesturing: true,
        gestureType: 'fling',
        velocity: currentVelocity,
      }));
      callbacks.onFlingStart?.(currentVelocity);

      flingAnimationRef.current = requestAnimationFrame(animate);
    },
    [mergedConfig, callbacks, updateTransform],
  );

  const stopFling = useCallback(() => {
    if (flingAnimationRef.current) {
      cancelAnimationFrame(flingAnimationRef.current);
      flingAnimationRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      stopFling();

      const touches = e.touches;
      const target = e.target as Element;
      const container = target.closest('[data-gesture-container]') as Element | null;
      containerRectRef.current = container?.getBoundingClientRect() || null;

      if (touches.length === 1) {
        const touch = touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        lastTouchRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartAngleRef.current = null;
        touchStartTransformRef.current = null;
        velocityRef.current = { x: 0, y: 0 };

        setState((prev) => ({
          ...prev,
          isGesturing: true,
          gestureType: 'pan',
        }));
        callbacks.onGestureStart?.('pan');
      } else if (touches.length === 2) {
        touchStartDistanceRef.current = getTouchDistance(touches);
        touchStartCenterRef.current = getTouchCenter(touches);
        touchStartAngleRef.current = getTouchAngle(touches);
        touchStartTransformRef.current = { ...transformRef.current };

        setState((prev) => ({
          ...prev,
          isGesturing: true,
          gestureType: 'pinch',
        }));
        callbacks.onGestureStart?.('pinch');
      }
    },
    [stopFling, callbacks],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touches = e.touches;

      if (touches.length === 1 && touchStartRef.current) {
        const touch = touches[0];
        const now = Date.now();
        const deltaTime = now - (lastTouchRef.current?.time || now);
        const deltaTimeMs = Math.max(deltaTime, 1);

        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;

        if (deltaTime > 0) {
          velocityRef.current = {
            x: (touch.clientX - (lastTouchRef.current?.x || touch.clientX)) / deltaTimeMs,
            y: (touch.clientY - (lastTouchRef.current?.y || touch.clientY)) / deltaTimeMs,
          };
        }

        const newTransform = {
          ...transformRef.current,
          x: touchStartTransformRef.current
            ? touchStartTransformRef.current.x + dx
            : transformRef.current.x + dx,
          y: touchStartTransformRef.current
            ? touchStartTransformRef.current.y + dy
            : transformRef.current.y + dy,
        };

        if (!touchStartTransformRef.current) {
          touchStartTransformRef.current = { ...transformRef.current };
        }

        updateTransform(newTransform);

        lastTouchRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        };
      } else if (
        touches.length === 2 &&
        touchStartDistanceRef.current !== null &&
        touchStartCenterRef.current !== null &&
        touchStartAngleRef.current !== null &&
        touchStartTransformRef.current !== null
      ) {
        const currentDistance = getTouchDistance(touches);
        const currentCenter = getTouchCenter(touches);
        const currentAngle = getTouchAngle(touches);

        const scaleRatio = currentDistance / touchStartDistanceRef.current;
        const newScale =
          touchStartTransformRef.current.scale *
          scaleRatio *
          mergedConfig.pinchSensitivity;
        const clampedScale = Math.max(
          mergedConfig.minScale,
          Math.min(mergedConfig.maxScale, newScale),
        );

        const angleDelta = currentAngle - touchStartAngleRef.current;
        const newRotation =
          touchStartTransformRef.current.rotation +
          angleDelta * mergedConfig.rotationSensitivity;
        const snappedRotation = snapToAngle(newRotation, mergedConfig.rotationSnap);

        const rect = containerRectRef.current;
        let deltaX = 0;
        let deltaY = 0;

        if (rect) {
          const centerX = currentCenter.x - rect.left;
          const centerY = currentCenter.y - rect.top;
          const startCenterX = touchStartCenterRef.current.x - rect.left;
          const startCenterY = touchStartCenterRef.current.y - rect.top;

          deltaX = currentCenter.x - touchStartCenterRef.current.x;
          deltaY = currentCenter.y - touchStartCenterRef.current.y;

          const scaleChange = clampedScale / touchStartTransformRef.current.scale;

          const newX =
            centerX -
            (startCenterX - touchStartTransformRef.current.x) * scaleChange +
            deltaX;
          const newY =
            centerY -
            (startCenterY - touchStartTransformRef.current.y) * scaleChange +
            deltaY;

          const newTransform: Transform = {
            x: newX,
            y: newY,
            scale: clampedScale,
            rotation: snappedRotation,
          };

          updateTransform(newTransform);
        } else {
          const newTransform: Transform = {
            x: touchStartTransformRef.current.x + deltaX,
            y: touchStartTransformRef.current.y + deltaY,
            scale: clampedScale,
            rotation: snappedRotation,
          };

          updateTransform(newTransform);
        }
      }
    },
    [mergedConfig, updateTransform],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const touches = e.touches;

      if (touches.length === 0) {
        const speed = Math.sqrt(
          velocityRef.current.x * velocityRef.current.x +
            velocityRef.current.y * velocityRef.current.y,
        );

        if (speed > mergedConfig.flingThreshold) {
          applyFling({
            x: velocityRef.current.x * 16,
            y: velocityRef.current.y * 16,
          });
        } else {
          setState((prev) => ({
            ...prev,
            isGesturing: false,
            gestureType: 'none',
            velocity: { x: 0, y: 0 },
          }));
          callbacks.onGestureEnd?.(transformRef.current);
        }

        touchStartRef.current = null;
        lastTouchRef.current = null;
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartAngleRef.current = null;
        touchStartTransformRef.current = null;
      } else if (touches.length === 1) {
        touchStartRef.current = {
          x: touches[0].clientX,
          y: touches[0].clientY,
          time: Date.now(),
        };
        lastTouchRef.current = {
          x: touches[0].clientX,
          y: touches[0].clientY,
          time: Date.now(),
        };
        touchStartTransformRef.current = { ...transformRef.current };
        touchStartDistanceRef.current = null;
        touchStartCenterRef.current = null;
        touchStartAngleRef.current = null;

        setState((prev) => ({
          ...prev,
          gestureType: 'pan',
        }));
        callbacks.onGestureStart?.('pan');
      }
    },
    [mergedConfig, applyFling, callbacks],
  );

  const setTransform = useCallback(
    (transform: Partial<Transform>) => {
      const newTransform = { ...transformRef.current, ...transform };
      updateTransform(newTransform);
    },
    [updateTransform],
  );

  const resetTransform = useCallback(() => {
    stopFling();
    const newTransform: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };
    updateTransform(newTransform);
  }, [stopFling, updateTransform]);

  const bindGestures = useCallback(
    <T extends HTMLElement | SVGElement>(element: T | null) => {
      if (!element) return;

      element.addEventListener('touchstart', handleTouchStart as EventListener, { passive: false });
      element.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
      element.addEventListener('touchend', handleTouchEnd as EventListener);
      element.addEventListener('touchcancel', handleTouchEnd as EventListener);

      return () => {
        element.removeEventListener('touchstart', handleTouchStart as EventListener);
        element.removeEventListener('touchmove', handleTouchMove as EventListener);
        element.removeEventListener('touchend', handleTouchEnd as EventListener);
        element.removeEventListener('touchcancel', handleTouchEnd as EventListener);
      };
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd],
  );

  useEffect(() => {
    return () => {
      stopFling();
    };
  }, [stopFling]);

  const reactHandlers = {
    onTouchStart: (e: React.TouchEvent) => handleTouchStart(e.nativeEvent),
    onTouchMove: (e: React.TouchEvent) => handleTouchMove(e.nativeEvent),
    onTouchEnd: (e: React.TouchEvent) => handleTouchEnd(e.nativeEvent),
    onTouchCancel: (e: React.TouchEvent) => handleTouchEnd(e.nativeEvent),
  };

  return {
    state,
    transform: state.currentTransform,
    setTransform,
    resetTransform,
    bindGestures,
    handlers: reactHandlers,
  };
}

export type UseGesturesReturn = ReturnType<typeof useGestures>;
