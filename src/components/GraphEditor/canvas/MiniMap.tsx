import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../../hooks";
import type {
  ColorScheme,
  GraphColorMode,
  NodeLevel,
  NodeStatus,
} from '../../../types';
import {
  calculateNodeHeat,
  getDecayColors,
  getHeatmapColors,
  getLearningStatus,
  getLevelColors,
  getStatusColors,
  THEME_COLORS,
} from '../../../config/learningStatusColors';

export interface MiniMapNodeDatum {
  id: string;
  x: number;
  y: number;
  level?: NodeLevel;
  isAccepted?: boolean;
}

export interface MiniMapLinkEndpoint {
  id?: string;
  x?: number;
  y?: number;
}

export interface MiniMapLinkDatum {
  source: string | MiniMapLinkEndpoint;
  target: string | MiniMapLinkEndpoint;
}

interface NodeVisual {
  primary: string;
  opacityFactor: number;
}

interface MiniMapProps {
  nodes: MiniMapNodeDatum[];
  links?: MiniMapLinkDatum[];
  transform: { x: number; y: number; k: number };
  containerWidth: number;
  containerHeight: number;
  onTransformChange: (newTransform: { x: number; y: number; k: number }) => void;
  width?: number;
  height?: number;
  className?: string;
  viewCenterX?: number;
  viewCenterY?: number;
  nodeStatus?: Record<string, NodeStatus> | null;
  coloringMode?: GraphColorMode;
  colorScheme?: ColorScheme;
  selectedNodeId?: string | null;
  multiSelectedNodeIds?: Set<string>;
}

const LEVEL_VISUAL_RADIUS: Record<NodeLevel, number> = {
  root: 7,
  core: 5.5,
  sub: 4.25,
  normal: 3.25,
  leaf: 2.5,
};

const DEFAULT_VISUAL_RADIUS = 3;

const NEUTRAL_DARK = '#94a3b8';
const NEUTRAL_LIGHT = '#64748b';

const MiniMapComponent: React.FC<MiniMapProps> = ({
  nodes,
  links,
  transform,
  containerWidth,
  containerHeight,
  onTransformChange,
  width = 240,
  height = 160,
  className = '',
  viewCenterX,
  viewCenterY,
  nodeStatus,
  coloringMode,
  colorScheme,
  selectedNodeId,
  multiSelectedNodeIds
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  type DragMode = 'jump' | 'grab';
  const dragModeRef = useRef<DragMode | null>(null);
  const grabOriginRef = useRef<{ clientX: number; clientY: number; tx: number; ty: number } | null>(null);

  const latestTransformRef = useRef(transform);
  useEffect(() => {
    latestTransformRef.current = transform;
  }, [transform]);

  const emitTransform = useCallback(
    (next: { x: number; y: number; k: number }) => {
      latestTransformRef.current = next;
      onTransformChange(next);
    },
    [onTransformChange],
  );

  const targetCenterX = viewCenterX ?? containerWidth / 2;
  const targetCenterY = viewCenterY ?? containerHeight / 2;

  const hasColorContext = coloringMode != null;
  const accentColor = isDark ? '#38bdf8' : '#0284c7';

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [nodes]);

  const scale = useMemo(() => {
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    return Math.min(scaleX, scaleY);
  }, [width, height, bounds]);

  const invScale = 1 / scale;

  const viewportRect = useMemo(() => {
    const graphLeft = -transform.x / transform.k;
    const graphTop = -transform.y / transform.k;
    const graphRight = (containerWidth - transform.x) / transform.k;
    const graphBottom = (containerHeight - transform.y) / transform.k;

    const x = (graphLeft - bounds.minX) * scale;
    const y = (graphTop - bounds.minY) * scale;
    const w = (graphRight - graphLeft) * scale;
    const h = (graphBottom - graphTop) * scale;

    return { x, y, w, h };
  }, [transform, containerWidth, containerHeight, bounds, scale]);

  const offsetX = (width - bounds.width * scale) / 2;
  const offsetY = (height - bounds.height * scale) / 2;

  const clampedViewport = useMemo(() => {
    const x = Math.max(0, Math.min(width - viewportRect.w, viewportRect.x + offsetX));
    const y = Math.max(0, Math.min(height - viewportRect.h, viewportRect.y + offsetY));
    return {
      x,
      y,
      w: Math.min(width, viewportRect.w),
      h: Math.min(height, viewportRect.h)
    };
  }, [viewportRect, offsetX, offsetY, width, height]);

  const handleJumpTo = useCallback((e: MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;

    const graphCenterX = (clickX - offsetX) / scale + bounds.minX;
    const graphCenterY = (clickY - offsetY) / scale + bounds.minY;

    const current = latestTransformRef.current;
    emitTransform({
      ...current,
      x: targetCenterX - graphCenterX * current.k,
      y: targetCenterY - graphCenterY * current.k,
    });
  }, [svgRef, offsetX, offsetY, scale, bounds, emitTransform, targetCenterX, targetCenterY]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      dragModeRef.current = 'grab';
      const current = latestTransformRef.current;
      grabOriginRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        tx: current.x,
        ty: current.y,
      };
    } else {
      dragModeRef.current = 'jump';
      handleJumpTo(e.nativeEvent);
    }
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const mode = dragModeRef.current;
    if (!mode) return;

    if (mode === 'grab') {
      const origin = grabOriginRef.current;
      if (!origin) return;
      emitTransform({
        ...latestTransformRef.current,
        x: origin.tx + (e.clientX - origin.clientX),
        y: origin.ty + (e.clientY - origin.clientY),
      });
      return;
    }

    handleJumpTo(e);
  }, [emitTransform, handleJumpTo]);

  const handleMouseUp = useCallback(() => {
    dragModeRef.current = null;
    grabOriginRef.current = null;
    setIsDragging(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, handleMouseUp, handleMouseMove]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = Math.max(containerWidth, containerHeight) * 0.15 * transform.k;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = step;
    else if (e.key === 'ArrowRight') dx = -step;
    else if (e.key === 'ArrowUp') dy = step;
    else if (e.key === 'ArrowDown') dy = -step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    emitTransform({ ...transform, x: transform.x + dx, y: transform.y + dy });
  }, [containerWidth, containerHeight, transform, emitTransform]);

  const nodePosById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => map.set(String(node.id), node));
    return map;
  }, [nodes]);

  const resolveEndpoint = useCallback((endpoint: string | MiniMapLinkEndpoint): { x: number; y: number } | undefined => {
    if (typeof endpoint === 'string') return nodePosById.get(endpoint);
    if (typeof endpoint.x === 'number' && typeof endpoint.y === 'number') {
      return { x: endpoint.x, y: endpoint.y };
    }
    if (endpoint.id != null) return nodePosById.get(String(endpoint.id));
    return undefined;
  }, [nodePosById]);

  const getNodeVisual = useCallback((node: MiniMapNodeDatum): NodeVisual => {
    if (!hasColorContext) {
      return { primary: isDark ? NEUTRAL_DARK : NEUTRAL_LIGHT, opacityFactor: 0.85 };
    }
    const statusEntry = nodeStatus?.[node.id];
    if (coloringMode === 'level') {
      return { primary: getLevelColors(node.level ?? 'normal', isDark).primary, opacityFactor: 1 };
    }
    if (coloringMode === 'heatmap') {
      return { primary: getHeatmapColors(calculateNodeHeat(statusEntry), isDark).primary, opacityFactor: 1 };
    }
    if (coloringMode === 'decay') {
      const displayMastery = statusEntry?.display_mastery;
      const retrievability = statusEntry?.fsrs_retrievability;
      const decayValue = displayMastery != null
        ? displayMastery
        : (retrievability != null ? retrievability : -1);
      const colors = getDecayColors(decayValue, 'displayMastery', isDark);
      return { primary: colors.primary, opacityFactor: colors.opacity ?? 1 };
    }
    return {
      primary: getStatusColors(getLearningStatus(statusEntry), isDark, colorScheme ?? 'default').primary,
      opacityFactor: 1
    };
  }, [hasColorContext, coloringMode, colorScheme, nodeStatus, isDark]);

  const decoratedNodes = useMemo(() => {
    return nodes.map((node) => {
      const visual = getNodeVisual(node);
      const radiusPx = hasColorContext && node.level
        ? LEVEL_VISUAL_RADIUS[node.level]
        : DEFAULT_VISUAL_RADIUS;
      const accepted = node.isAccepted !== false;
      return {
        id: String(node.id),
        x: node.x,
        y: node.y,
        radiusPx,
        fill: visual.primary,
        opacity: accepted ? visual.opacityFactor : visual.opacityFactor * 0.4,
        isSelected: selectedNodeId === node.id,
        isMultiSelected: multiSelectedNodeIds?.has(node.id) ?? false
      };
    });
  }, [nodes, getNodeVisual, hasColorContext, selectedNodeId, multiSelectedNodeIds]);

  const linkElements = useMemo(() => {
    if (!links || links.length === 0) return null;
    const linkColor = isDark ? THEME_COLORS.dark.link : THEME_COLORS.light.link;
    const elements: React.ReactNode[] = [];
    links.forEach((link, index) => {
      const source = resolveEndpoint(link.source);
      const target = resolveEndpoint(link.target);
      if (!source || !target) return;
      elements.push(
        <line
          key={`mm-link-${index}`}
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          stroke={linkColor}
          strokeWidth={invScale}
          strokeOpacity={0.3}
        />
      );
    });
    return elements.length > 0 ? elements : null;
  }, [links, resolveEndpoint, invScale, isDark]);

  const nodeElements = useMemo(() => {
    return decoratedNodes.map((node) => (
      <circle
        key={`mm-node-${node.id}`}
        data-minimap-node-id={node.id}
        cx={node.x}
        cy={node.y}
        r={node.radiusPx * invScale}
        fill={node.fill}
        fillOpacity={node.opacity}
      />
    ));
  }, [decoratedNodes, invScale]);

  const highlightElements = useMemo(() => {
    const highlights = decoratedNodes.filter(
      (node) => node.isSelected || node.isMultiSelected
    );
    if (highlights.length === 0) return null;
    return highlights.map((node) => (
      <circle
        key={`mm-highlight-${node.id}`}
        cx={node.x}
        cy={node.y}
        r={(node.radiusPx + 2.5) * invScale}
        fill="none"
        stroke={accentColor}
        strokeWidth={(node.isSelected ? 1.6 : 1) * invScale}
        strokeOpacity={node.isSelected ? 0.95 : 0.65}
      />
    ));
  }, [decoratedNodes, invScale, accentColor]);

  if (nodes.length === 0) return null;

  const miniMapAriaLabel = t('graphEditor.miniMap.ariaLabel', { count: nodes.length });

  return (
    <div
      className={`bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-500 rounded-lg shadow-lg overflow-hidden backdrop-blur-sm ${className}`}
      style={{ width, height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="application"
        aria-label={miniMapAriaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className={`block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      >
        <title>{miniMapAriaLabel}</title>
        <desc>{t('graphEditor.miniMap.desc')}</desc>
        <g transform={`translate(${offsetX - bounds.minX * scale}, ${offsetY - bounds.minY * scale}) scale(${scale})`}>
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.width}
            height={bounds.height}
            rx={12 * invScale}
            fill={isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(100, 116, 139, 0.04)'}
          />
          {linkElements}
          {nodeElements}
          {highlightElements}
        </g>

        <rect
          x={clampedViewport.x}
          y={clampedViewport.y}
          width={clampedViewport.w}
          height={clampedViewport.h}
          rx={2}
          fill={accentColor}
          fillOpacity={isDragging ? 0.14 : 0.08}
          stroke={accentColor}
          strokeWidth="1.5"
          className="pointer-events-none transition-all duration-75"
        />
      </svg>
    </div>
  );
};

const areEqual = (prev: MiniMapProps, next: MiniMapProps) => {
  return (
    prev.nodes === next.nodes &&
    prev.links === next.links &&
    prev.transform.x === next.transform.x &&
    prev.transform.y === next.transform.y &&
    prev.transform.k === next.transform.k &&
    prev.containerWidth === next.containerWidth &&
    prev.containerHeight === next.containerHeight &&
    prev.nodeStatus === next.nodeStatus &&
    prev.coloringMode === next.coloringMode &&
    prev.colorScheme === next.colorScheme &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.multiSelectedNodeIds === next.multiSelectedNodeIds &&
    prev.onTransformChange === next.onTransformChange &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.className === next.className &&
    prev.viewCenterX === next.viewCenterX &&
    prev.viewCenterY === next.viewCenterY
  );
};

export const MiniMap = React.memo(MiniMapComponent, areEqual);
