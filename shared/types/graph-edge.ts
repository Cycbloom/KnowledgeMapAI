// 边（关系）相关类型
// RelationshipTypeConfig, Edge, EdgeStrength 等

import type { EdgeLineStyle, RelationshipCategory } from "./graph-core";

export interface RelationshipTypeConfig {
  id: string;
  name: string;
  display_name: string;
  category: RelationshipCategory;
  color: string;
  line_style: EdgeLineStyle;
  show_arrow: boolean | "auto";
  is_builtin: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Edge {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean | null;
  deleted_at?: string;
  created_at?: string;
}

export interface EdgeStrength {
  score: number;
  factors: {
    relationshipType: string;
    commonConnections: number;
    pathCount: number;
  };
}

/**
 * 非层级关系类型白名单（AI 关系发现功能专用）。
 *
 * 关系发现由 AI 自动分析节点间的潜在关系，但必须排除层级（父子）关系类型
 * （contains / parent_child / part_of / derived_from），避免 AI 生成的连线
 * 破坏图谱既有的树状层级结构。白名单仅包含依赖 / 语义 / 时序 / 交互 / 因果
 * 等非层级关系类型。
 *
 * 前端（src/config/relationshipTypes.ts 的 HIERARCHICAL_EDGE_TYPES）与
 * 后端（nodeRelationDiscoveryService）统一从本常量派生允许的关系类型集合。
 */
export const NON_HIERARCHICAL_RELATIONSHIP_TYPES = [
  // dependency
  "depends_on",
  "prerequisite",
  "constrains",
  "supports",
  "mutex",
  "exclusive",
  // semantic
  "related",
  "similar_to",
  "opposite",
  "synonym",
  "equivalent",
  "generalization",
  "specialization",
  // temporal
  "follows",
  "parallel",
  "branch",
  "merge",
  "trigger",
  "loop",
  // interaction
  "points_to",
  "acts_on",
  "influences",
  "feedback",
  "calls",
  // causal
  "causes",
  "derives",
  "proportional",
  "inverse",
] as const;

export type NonHierarchicalRelationshipType =
  (typeof NON_HIERARCHICAL_RELATIONSHIP_TYPES)[number];

/** 判断某个关系类型是否为允许的非层级（父子）关系类型 */
export function isNonHierarchicalRelationshipType(name: string): boolean {
  return (NON_HIERARCHICAL_RELATIONSHIP_TYPES as readonly string[]).includes(
    name,
  );
}

/**
 * AI 关系发现产出的节点关系建议。
 * source_id / target_id 为 knowledge_point_id（与 edges 表字段一致）。
 */
export interface NodeRelationSuggestion {
  source_id: string;
  source_title: string;
  target_id: string;
  target_title: string;
  relationship_type: string;
  confidence: number;
  reason: string;
}
