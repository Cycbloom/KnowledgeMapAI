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
  hasFocusMode?: boolean;
}

const RELATION_COLORS: Record<string, string> = {
  contains: "var(--primary-500)",
  part_of: "#3B82F6",
  parent_child: "var(--primary-500)",
  depends_on: "#F59E0B",
  prerequisite: "#EF4444",
  constrains: "#F59E0B",
  supports: "#10B981",
  mutex: "#EF4444",
  exclusive: "#EF4444",
  related: "#6B7280",
  similar_to: "#8B5CF6",
  opposite: "#EC4899",
  synonym: "#8B5CF6",
  equivalent: "#8B5CF6",
  generalization: "#10B981",
  specialization: "#10B981",
  follows: "#06B6D4",
  parallel: "#06B6D4",
  branch: "#06B6D4",
  merge: "#06B6D4",
  trigger: "#06B6D4",
  loop: "#06B6D4",
  points_to: "#F97316",
  acts_on: "#F97316",
  influences: "#F97316",
  feedback: "#F97316",
  calls: "#F97316",
  causes: "#DC2626",
  derives: "#DC2626",
  proportional: "#DC2626",
  inverse: "#DC2626",
  derived_from: "#F59E0B",
  default: "var(--slate-500)",
};

const LINE_STYLES: Record<string, string> = {
  contains: "solid",
  part_of: "solid",
  parent_child: "solid",
  depends_on: "dashed",
  prerequisite: "dotted",
  constrains: "dashed",
  supports: "dashed",
  mutex: "dotted",
  exclusive: "dotted",
  related: "solid",
  similar_to: "solid",
  opposite: "solid",
  synonym: "solid",
  equivalent: "solid",
  generalization: "solid",
  specialization: "solid",
  follows: "dashed",
  parallel: "solid",
  branch: "solid",
  merge: "solid",
  trigger: "dashed",
  loop: "dashed",
  points_to: "solid",
  acts_on: "solid",
  influences: "dashed",
  feedback: "dashed",
  calls: "solid",
  causes: "solid",
  derives: "solid",
  proportional: "solid",
  inverse: "solid",
  derived_from: "dashed",
  default: "solid",
};

export const QuadrantEdge = React.memo(({
  edge,
  sourceX,
  sourceY,
  targetX,
  targetY,
  isDark,
  highlighted = false,
  hasFocusMode = false,
}: QuadrantEdgeProps) => {
  const relationType = edge.relationship_type || "default";
  let color = RELATION_COLORS[relationType] || RELATION_COLORS.default;
  let lineStyle = LINE_STYLES[relationType] || LINE_STYLES.default;

  if (edge.custom_color) {
    color = edge.custom_color;
  }
  if (edge.custom_line_style) {
    lineStyle = edge.custom_line_style;
  }

  const strokeDasharray =
    lineStyle === "dashed" ? "8,4" : lineStyle === "dotted" ? "2,4" : "none";

  const strokeWidth = highlighted ? 2.5 : hasFocusMode ? 1.2 : 1.5;
  const strokeOpacity = highlighted ? 1 : hasFocusMode ? 0.25 : 0.55;
  const filter = highlighted
    ? isDark
      ? `drop-shadow(0 0 3px ${color}80)`
      : `drop-shadow(0 0 2px ${color}60)`
    : undefined;

  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeDasharray={strokeDasharray}
      style={{
        transition: "all 0.2s ease",
        ...(filter ? { filter } : {}),
      }}
      data-edge-id={edge.id}
      data-relation-type={relationType}
    />
  );
});
