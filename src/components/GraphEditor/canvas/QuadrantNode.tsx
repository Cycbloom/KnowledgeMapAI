import React, { useState, useCallback, useMemo } from "react";
import type { Node, Edge, GraphColorMode } from "@shared/types/graph";
import type { ColorScheme } from "@shared/types/styles";
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
}

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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark, colorScheme);

  const titleInfo = useMemo(
    () => truncateText(node.title || "未命名"),
    [node.title],
  );

  const nodeRadius = 20;
  const distanceRatio = 0.6;
  const distance = regionRadius * distanceRatio;

  const baseX = originX + distance * Math.cos(angle);
  const baseY = originY + distance * Math.sin(angle);

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

  const scaledFontSize = useMemo(() => {
    const baseFontSize = 12;
    const calculatedSize = baseFontSize / zoomLevel;
    return Math.max(8, Math.min(16, calculatedSize));
  }, [zoomLevel]);

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: selected ? 1 : 0.9,
      }}
    >
      <circle
        r={nodeRadius}
        fill={colors.primary}
        stroke={selected ? colors.glow : "white"}
        strokeWidth={selected ? 3 : 2}
        style={{
          filter: selected
            ? `drop-shadow(0 0 8px ${colors.glow})`
            : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
          transition: isDragging ? "none" : "all 0.2s ease",
        }}
      />

      <text
        y={nodeRadius + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={scaledFontSize}
        fontWeight={500}
        fill={isDark ? "#f1f5f9" : "#0f172a"}
        style={{
          pointerEvents: "none",
          textShadow: isDark
            ? "0 1px 2px rgba(0,0,0,0.8)"
            : "0 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        {titleInfo.truncated}
        {titleInfo.isTruncated && <title>{titleInfo.original}</title>}
      </text>

      {node.properties?.needsRefinement && (
        <circle
          r={4}
          cx={nodeRadius - 4}
          cy={-nodeRadius + 4}
          fill="#f59e0b"
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
          }}
        />
      )}
    </g>
  );
};
