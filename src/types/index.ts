export interface User {
  id: string;
  email: string;
  name?: string;
  profile?: {
    settings?: {
      request_retention?: number;
      maximum_interval?: number;
    };
    [key: string]: any;
  };
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  settings?: {
    gamification_enabled?: boolean;
    learning_direction?: 'top_down' | 'bottom_up';
    text_display_level?: 'all' | 'important' | 'root_only';
    [key: string]: any;
  };
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
  review_count?: number;
  fsrs_state?: number;
}

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'expand_graph' | string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  payload: any;
  result: any;
  error?: string;
  created_at: string;
  updated_at: string;
}
