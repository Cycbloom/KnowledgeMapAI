import type { StudyCard } from "./common";

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
  summary?: string;
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
  summary?: string;
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
  tags?: string[];
}

export interface UpdateGraphData {
  title?: string;
  description?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  reference_books?: unknown;
  external_links?: unknown;
  learning_guide?: string;
  tags?: string[];
}

export interface GetCardsParams {
  graph_id?: string;
  knowledge_point_id?: string;
  knowledge_point_ids?: string[];
  source_graph_id?: string;
  due?: boolean;
  /** Pagination (server-side). When omitted, returns the full array. */
  page?: number;
  pageSize?: number;
  /** Keyword search against question/answer (fuzzy match). */
  search?: string;
  card_type?: string;
  fsrs_state?: string;
  review_count_min?: number;
  review_count_max?: number;
  next_review_start?: string;
  next_review_end?: string;
}

/** Paginated study cards response, mirroring the notes list contract. */
export interface PaginatedStudyCards {
  items: StudyCard[];
  total: number;
  page: number;
  pageSize: number;
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

/** FSRS 参数来源与当前值，由 GET/PUT /study/fsrs-parameters 返回。 */
export interface FsrsParameters {
  source: "default" | "custom" | "optimized";
  w: number[];
  request_retention: number;
  maximum_interval: number;
  last_optimized_at: string | null;
}

/** POST /study/fsrs-parameters/optimize 的返回结构。 */
export interface FsrsOptimizeResult {
  success: boolean;
  oldW: number[];
  newW: number[];
  improvement: number;
  reviewCount: number;
  message: string;
}

/** DELETE /study/fsrs-parameters 的返回结构。 */
export interface FsrsResetResult {
  success: boolean;
  message: string;
}

/** 单个语义分组。 */
export interface StudySemanticGroup {
  groupId: number;
  memberKpIds: string[];
  avgSimilarity: number;
}

/** 一对相互干扰的知识点。 */
export interface StudyInterferencePair {
  kpId1: string;
  kpId2: string;
  similarity: number;
}

/** GET /study/semantic-groups 的返回结构。 */
export interface StudySemanticGroupsResponse {
  groups: StudySemanticGroup[];
  interference_pairs: StudyInterferencePair[];
}

/** 仪表盘热力图单项。 */
export interface HeatmapItem {
  date: string;
  count: number;
}

/** 仪表盘盲点卡片（study_cards 关联 knowledge_points 的结果）。 */
export interface BlindSpot {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  question: string;
  answer: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_state: number;
  last_reviewed: string | null;
  knowledge_points?: { title: string } | null;
}

/** 仪表盘分布单项。 */
export interface DistributionItem {
  name: string;
  value: number;
  color: string;
}

/** GET /dashboard/stats 的返回结构。 */
export interface DashboardStats {
  heatmap: HeatmapItem[];
  blindSpots: BlindSpot[];
  distribution: DistributionItem[];
}

/** GET /statistics 的返回结构。 */
export interface StatisticsResponse {
  metrics: {
    totalCards: number;
    dueToday: number;
    learning: number;
    avgStability: number;
  };
  heatmap: unknown[];
  distribution: DistributionItem[];
  forecast: Array<{ date: string; count: number }>;
  growth: Array<{ date: string; count: number }>;
}
