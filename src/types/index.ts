export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  created_at: string;
}

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

export interface StudyCard {
  id: string;
  node_id: string;
  question: string;
  answer: string;
  card_type: 'qa' | 'choice' | 'true_false';
  options?: string[];
  next_review: string;
}
