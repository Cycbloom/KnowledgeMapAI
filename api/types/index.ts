// Copied from src/types/index.ts to avoid tsconfig path issues in node backend
export interface Node {
  id: string;
  graph_id: string;
  title: string;
  content?: string;
  x_position: number;
  y_position: number;
  color?: string;
  level?: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
  properties?: Record<string, any>;
  updated_at?: string;
  created_at?: string;
}

export interface Edge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type?: string;
}
