export type LearningPathStatus = "active" | "completed" | "paused" | "archived";
export type NodeStatus = "pending" | "in_progress" | "completed" | "skipped";
export type GoalType = "natural_language" | "graph_node" | "template";

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: Array<{
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
    is_milestone?: boolean;
    prerequisites?: string[];
  }>;
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  status?: LearningPathStatus;
  daily_minutes_target?: number;
  target_completion_date?: string;
}

export interface AddNodeInput {
  node_id: string;
  estimated_minutes?: number;
  difficulty_level?: number;
}

export interface UpdateProgressInput {
  completed_nodes?: number;
  total_time_spent?: number;
  last_activity_at?: string;
}

export interface CreatePlanInput {
  date: string;
  planned_nodes: string[];
  estimated_minutes?: number;
  notes?: string;
}

export interface UpdatePlanInput {
  actual_nodes?: string[];
  actual_minutes?: number;
  completed?: boolean;
  notes?: string;
}

export interface GeneratePathInput {
  goal: string;
  context?: string;
  goal_type?: GoalType;
  target_knowledge_point_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  conversation_history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ILearningPathsApi {
  list(status?: LearningPathStatus): Promise<unknown>;
  get(id: string): Promise<unknown>;
  create(data: CreateLearningPathInput): Promise<unknown>;
  update(id: string, data: UpdateLearningPathInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
  addNode(pathId: string, data: AddNodeInput): Promise<unknown>;
  updateNodeStatus(pathId: string, nodeId: string, status: NodeStatus): Promise<unknown>;
  reorderNodes(pathId: string, nodeIds: string[]): Promise<unknown>;
  removeNode(pathId: string, nodeId: string): Promise<unknown>;
  getProgress(pathId: string): Promise<unknown>;
  updateProgress(pathId: string, data: UpdateProgressInput): Promise<unknown>;
  createPlan(pathId: string, data: CreatePlanInput): Promise<unknown>;
  getPlans(pathId: string, startDate?: string, endDate?: string): Promise<unknown>;
  getPlan(pathId: string, date: string): Promise<unknown>;
  updatePlan(pathId: string, date: string, data: UpdatePlanInput): Promise<unknown>;
  generateFromGraph(data: GeneratePathInput): Promise<unknown>;
  adjust(id: string, data: { reason: string; node_ref_id?: string; adjustment_type: "insert" | "remove" | "reorder" | "difficulty" }): Promise<unknown>;
  getRecommendations(graphId: string): Promise<unknown>;
  autoSchedule(pathId: string, options?: { start_date?: string; daily_minutes?: number }): Promise<unknown>;
}

export interface ILearningPathApi {
  getQuestions(data: { graph_id: string }): Promise<unknown>;
  generate(data: {
    graph_id: string;
    target_goal?: string;
    target_knowledge_point_id?: string;
    learning_style?: "sequential" | "exploratory" | "focused" | "custom";
    daily_time_minutes?: number;
    current_knowledge?: string;
    provider?: string;
    model?: string;
  }): Promise<unknown>;
  getProgress(graphId: string): Promise<unknown>;
}
