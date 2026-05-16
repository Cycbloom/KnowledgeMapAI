import React, { useMemo, useCallback, useState } from "react";
import type { Node, Edge, GraphColorMode, NodeLevel } from "@shared/types/graph";
import type { ColorScheme } from "@shared/types/styles";
import { NodeRing } from "./NodeRing";
import {
  NODE_STYLE_CONFIG,
  getRingRadius,
  getRingOpacity,
  getCenterDotRadius,
  getShadowStyle,
} from "../../../config/nodeStyleConfig";
import {
  getLearningStatus,
  getStatusColors,
} from "../../../config/learningStatusColors";
import { truncateText } from "../../../utils/textUtils";

interface QuadrantNodeProps {
  node: Node;
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selected: boolean;
  isDark: boolean;
  zoomLevel: number;
  onClick: () => void;
  onDrag?: (nodeId: string, x: number, y: number) => void;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
  originX: number;
  originY: number;
  regionRadius: number;
  angle: number;
  focused?: boolean;
  hasFocusMode?: boolean;
  positionX?: number;
  positionY?: number;
  regionNodeCount?: number;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const QUADRANT_NODE_STYLE_OVERRIDES: Partial<
  Record<NodeLevel, { baseRadius: number; rings: number }>
> = {
  sub: { baseRadius: 24, rings: 2 },
  normal: { baseRadius: 20, rings: 1 },
  leaf: { baseRadius: 16, rings: 1 },
};

export const QuadrantNode: React.FC<QuadrantNodeProps> = ({
  node,
  edges: _edges,
  nodeStatus,
  selected,
  isDark,
  zoomLevel,
  onClick,
  onDrag,
  colorScheme = "default",
  coloringMode: _coloringMode = "status",
  originX,
  originY,
  regionRadius,
  angle,
  focused = false,
  hasFocusMode = false,
  positionX,
  positionY,
  regionNodeCount,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const level = (node.level || "leaf") as NodeLevel;
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark, colorScheme);

  const nodeOpacity = !hasFocusMode ? 1 : focused ? 1 : 0.3;

  const titleInfo = useMemo(
    () => truncateText(node.title || "未命名"),
    [node.title],
  );

  const styleConfig = useMemo(() => {
    const baseConfig = NODE_STYLE_CONFIG[level] || NODE_STYLE_CONFIG.leaf;
    const overrides = QUADRANT_NODE_STYLE_OVERRIDES[level];

    if (overrides) {
      return {
        ...baseConfig,
        baseRadius: overrides.baseRadius,
        rings: overrides.rings,
      };
    }
    return baseConfig;
  }, [level]);

  const distanceRatio = useMemo(() => {
    const seed = hashCode(node.id);
    const random = seededRandom(seed);
    const baseRatio = 0.55;
    const randomOffset = (random - 0.5) * 0.5;
    const levelFactor = node.level === "sub" ? 0.05 : 0;
    const ratio = baseRatio + randomOffset + levelFactor;

    const count = regionNodeCount ?? 10;
    const minBound = count <= 5 ? 0.30 : count <= 12 ? 0.24 : 0.18;
    const maxBound = count <= 5 ? 0.82 : count <= 12 ? 0.87 : 0.92;
    return Math.max(minBound, Math.min(maxBound, ratio));
  }, [node.id, node.level, regionNodeCount]);

  const distance = regionRadius * distanceRatio;

  let baseX: number;
  let baseY: number;
  if (positionX !== undefined && positionY !== undefined) {
    baseX = positionX;
    baseY = positionY;
  } else {
    baseX = originX + distance * Math.cos(angle);
    baseY = originY + distance * Math.sin(angle);
  }

  const x = baseX + dragOffset.x;
  const y = baseY + dragOffset.y;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDrag) {
        setIsDragging(true);
      }
    },
    [onDrag],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && onDrag) {
        const dx = e.movementX / zoomLevel;
        const dy = e.movementY / zoomLevel;
        setDragOffset((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }
    },
    [isDragging, onDrag, zoomLevel],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && onDrag) {
      onDrag(node.id, x, y);
    }
    setIsDragging(false);
  }, [isDragging, onDrag, node.id, x, y]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (isDragging) {
      handleMouseUp();
    }
  }, [isDragging, handleMouseUp]);

  const scaledFontSize = useMemo(() => {
    const baseFontSize = 12;
    const calculatedSize = baseFontSize / zoomLevel;
    return Math.max(8, Math.min(16, calculatedSize));
  }, [zoomLevel]);

  const rings = useMemo(() => {
    const result = [];
    for (let i = 0; i < styleConfig.rings; i++) {
      const radius = getRingRadius(
        styleConfig.baseRadius,
        i,
        styleConfig.rings,
        styleConfig.ringSpacing,
      );
      const opacity = getRingOpacity(i, styleConfig.rings);
      const color = i === 0 ? colors.primary : colors.secondary;

      result.push(
        <NodeRing
          key={`ring-${i}`}
          radius={radius}
          strokeWidth={styleConfig.strokeWidth}
          color={color}
          opacity={opacity}
          dashArray={styleConfig.dashArray}
          showGlow={i === 0 && (selected || isHovered)}
          glowColor={colors.glow}
          shadowBlur={styleConfig.shadow.enabled ? styleConfig.shadow.blur : 0}
          shadowColor={styleConfig.shadow.color}
        />,
      );
    }
    return result;
  }, [styleConfig, colors, selected, isHovered]);

  const centerDotRadius = styleConfig.showCenterDot
    ? getCenterDotRadius(styleConfig.baseRadius)
    : 0;

  const maxRadius = useMemo(
    () =>
      getRingRadius(
        styleConfig.baseRadius,
        0,
        styleConfig.rings,
        styleConfig.ringSpacing,
      ) +
      styleConfig.strokeWidth / 2,
    [styleConfig],
  );

  const textOffset = useMemo(() => maxRadius + 12, [maxRadius]);

  const shadowStyle = getShadowStyle(styleConfig.shadow);
  const hoverScale = isHovered ? styleConfig.animation.hoverScale : 1;

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: selected ? 1 : nodeOpacity,
      }}
    >
      <g
        style={{
          transition: "transform 200ms ease",
          transform: `scale(${hoverScale})`,
          filter: shadowStyle,
        }}
      >
        {rings}

        {styleConfig.showCenterDot && centerDotRadius > 0 && (
          <circle
            r={centerDotRadius}
            fill={colors.primary}
            style={{
              filter:
                selected || isHovered
                  ? `drop-shadow(0 0 ${6 / zoomLevel}px ${colors.glow})`
                  : "none",
            }}
          />
        )}

        {selected && (
          <circle
            r={styleConfig.baseRadius + 6}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            opacity={0.5}
            strokeDasharray="4 4"
          />
        )}
      </g>

      <circle
        r={maxRadius}
        fill="transparent"
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      />

      <text
        y={textOffset}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={scaledFontSize}
        fontWeight={500}
        className="fill-slate-900 dark:fill-slate-100"
        style={{
          pointerEvents: "none",
          textShadow: isDark
            ? `0 ${1 / zoomLevel}px ${2 / zoomLevel}px rgba(0,0,0,0.8), 0 0 ${4 / zoomLevel}px rgba(0,0,0,0.4)`
            : `0 ${1 / zoomLevel}px ${2 / zoomLevel}px rgba(0,0,0,0.15)`,
        }}
      >
        {titleInfo.truncated}
        {titleInfo.isTruncated && <title>{titleInfo.original}</title>}
      </text>

      {node.properties?.needsRefinement && (
        <circle
          r={4}
          cx={styleConfig.baseRadius - 4}
          cy={-styleConfig.baseRadius + 4}
          className="fill-amber-500"
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
          }}
        />
      )}
    </g>
  );
};
