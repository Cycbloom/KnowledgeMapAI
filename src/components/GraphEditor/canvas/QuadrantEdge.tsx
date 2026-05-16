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
  depends_on: "var(--primary-500)",
  part_of: "#10B981",
  related_to: "var(--tertiary-500)",
  derived_from: "#F59E0B",
  prerequisite: "#EF4444",
  default: "var(--slate-500)",
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

  if (highlighted) {
    return (
      <line
        x1={sourceX}
        y1={sourceY}
        x2={targetX}
        y2={targetY}
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={1}
        strokeDasharray={strokeDasharray}
        style={{
          transition: "all 0.2s ease",
          filter: isDark ? `drop-shadow(0 0 3px ${color}80)` : `drop-shadow(0 0 2px ${color}60)`,
        }}
        data-edge-id={edge.id}
        data-relation-type={relationType}
      />
    );
  }

  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke={isDark ? "var(--slate-700)" : "var(--slate-300)"}
      strokeWidth={1}
      strokeOpacity={0.25}
      strokeDasharray="none"
      style={{
        transition: "all 0.2s ease",
      }}
      data-edge-id={edge.id}
      data-relation-type={relationType}
    />
  );
};
