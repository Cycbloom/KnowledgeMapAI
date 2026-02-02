export interface AIConfig {
  provider: string;
  model: string;
}

export interface AvailableModels {
  deepseek: string[];
  volcengine: string[];
  aliyun: string[];
  [key: string]: string[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  user_metadata?: {
    name?: string;
    [key: string]: any;
  };
  profile?: {
    settings?: {
      request_retention?: number;
      maximum_interval?: number;
      ai_config?: {
        text?: AIConfig;
        embedding?: AIConfig;
        reasoning?: AIConfig;
      };
      available_models?: AvailableModels;
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
  nodes_count?: number;
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
  card_type: 'qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay';
  options?: string[];
  explanation?: string;
  next_review: string;
  review_count?: number;
  fsrs_state?: number;
}

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  payload: any;
  result: any;
  error?: string;
  created_at: string;
  updated_at: string;
}
