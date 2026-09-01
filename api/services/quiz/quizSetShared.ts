export interface EmbeddedKnowledgePoint {
  id: string;
  title: string;
  content: string | null;
}

export interface GraphNodeWithKnowledgePoint {
  knowledge_point_id: string;
  knowledge_points: EmbeddedKnowledgePoint | EmbeddedKnowledgePoint[] | null;
}

export interface CreateQuizSetData {
  title: string;
  description?: string;
  config?: Record<string, unknown>;
  graph_id?: string;
}

export interface UpdateQuizSetData {
  title?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface GenerateCardsOptions {
  quiz_set_id: string;
  node_ids?: string[];
  config?: Record<string, unknown>;
}
