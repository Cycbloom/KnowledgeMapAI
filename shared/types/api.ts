export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResponse<TUser = unknown> {
  user: TUser | null;
  session?: AuthSession | null;
  error?: string;
  message?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  name?: string;
  avatar_url?: string;
  settings?: Record<string, unknown>;
}

export interface CreateNodeData {
  graph_id: string;
  title: string;
  content?: string;
  level?: string;
  x_position?: number;
  y_position?: number;
  parent_node_ids?: string[];
  learning_material?: string;
  properties?: Record<string, unknown>;
  knowledge_point_id?: string;
  reuse_existing?: boolean;
  color?: string;
  tags?: string[];
  is_accepted?: boolean;
}

export interface UpdateNodeData {
  title?: string;
  content?: string;
  level?: string;
  x_position?: number;
  y_position?: number;
  learning_material?: string;
  properties?: Record<string, unknown>;
}

export interface CreateEdgeData {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  graph_id: string;
  relationship_type?: string;
}

export interface NodePositionUpdate {
  id: string;
  x_position: number;
  y_position: number;
}

export interface DeleteNodeResult {
  message: string;
  affected_graphs?: string[];
  deleted_graph_nodes?: number;
  deleted_edges?: number;
  deleted_cards?: number;
}

export interface CreateGraphData {
  title: string;
  description?: string;
  domain?: string;
  template_type?: string;
  preset_id?: string;
}

export interface UpdateGraphData {
  title?: string;
  description?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  reference_books?: unknown;
  external_links?: unknown;
  learning_guide?: string;
}

export interface GetCardsParams {
  graph_id?: string;
  knowledge_point_id?: string;
  knowledge_point_ids?: string[];
  source_graph_id?: string;
  due?: boolean;
}

export interface CardGroup {
  source_graph_id: string;
  graph_title: string;
  card_count: number;
}

export interface StudyStats {
  totalCards: number;
  dueCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  averageRetrievability: number;
  averageStability: number;
  averageDifficulty: number;
}
