import React from "react";
import type { Edge } from "@shared/types/graph";

interface QuadrantEdgeProps {
  edge: Edge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isDark: boolean;
  highlighted?: boolean;
}

const RELATION_COLORS: Record<string, string> = {
  depends_on: "#3B82F6",
  part_of: "#10B981",
  related_to: "#8B5CF6",
  derived_from: "#F59E0B",
  prerequisite: "#EF4444",
  default: "#64748B",
};

const LINE_STYLES: Record<string, string> = {
  depends_on: "solid",
  part_of: "solid",
  related_to: "dashed",
  derived_from: "dashed",
  prerequisite: "dotted",
  default: "solid",
};

export const QuadrantEdge: React.FC<QuadrantEdgeProps> = ({
  edge,
  sourceX,
  sourceY,
  targetX,
  targetY,
  isDark,
  highlighted = false,
}) => {
  const relationType = edge.relationship_type || "default";
  const color = RELATION_COLORS[relationType] || RELATION_COLORS.default;
  const lineStyle = LINE_STYLES[relationType] || LINE_STYLES.default;

  const strokeDasharray =
    lineStyle === "dashed" ? "8,4" : lineStyle === "dotted" ? "2,4" : "none";

  const opacity = highlighted ? 0.9 : isDark ? 0.4 : 0.5;

  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke={color}
      strokeWidth={highlighted ? 2 : 1.5}
      strokeOpacity={opacity}
      strokeDasharray={strokeDasharray}
      style={{
        transition: "stroke-opacity 0.2s ease",
      }}
      data-edge-id={edge.id}
      data-relation-type={relationType}
    />
  );
};
