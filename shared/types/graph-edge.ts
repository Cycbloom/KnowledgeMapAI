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
