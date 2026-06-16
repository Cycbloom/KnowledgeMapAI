export type RelationType =
  | "prerequisite"
  | "extension"
  | "related"
  | "cross_domain";

export interface GraphRecommendation {
  id: string;
  source_graph_idx: number;
  source_graph_title: string;
  target_graph_idx: number;
  target_graph_title: string;
  relation_type: RelationType;
  reason: string;
  confidence: number;
}

export interface AgentSession {
  id: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed" | "interrupted";
  skillId?: string;
  graphIds?: string[];
  messages: AgentMessage[];
  toolCalls: ToolCall[];
  result?: string;
  structuredResult?: StructuredAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: string;
}

export interface StructuredAnalysisResult {
  summary: string;
  recommendations: GraphRecommendation[];
  merge_suggestions?: MergeSuggestion[];
  graphIndex?: Record<string, string>;
}

export interface MergeSuggestion {
  graph_ids: string[];
  graph_titles: string[];
  similarity_score: number;
  reason: string;
  suggested_action: "merge" | "link" | "keep_separate";
  shared_concepts: string[];
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  tools: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AnalysisGoal {
  type: string;
  description: string;
  constraints?: Record<string, unknown>;
  maxIterations?: number;
}

export interface ExecuteResult {
  success: boolean;
  session: AgentSession;
  error?: string;
}

export interface IAgentApi {
  createSession(options?: {
    skill_id?: string;
    graph_ids?: string[];
    custom_prompt?: string;
  }): Promise<{ session: AgentSession }>;

  getSession(sessionId: string): Promise<{ session: AgentSession }>;

  executeSession(
    sessionId: string,
    customPrompt?: string,
  ): Promise<{ session: AgentSession }>;

  getSkills(): Promise<{ skills: SkillDefinition[] }>;

  applyRecommendations(
    recommendations: GraphRecommendation[],
    graphIndex?: Record<string, string>,
  ): Promise<{ success: boolean; created: number }>;

  mergeGraphs(
    graphIds: string[],
    targetTitle?: string,
  ): Promise<{ success: boolean; merged_graph_id: string }>;

  linkGraphs(
    graphIds: string[],
    relationType?: RelationType,
  ): Promise<{ success: boolean; created: number }>;

  dismissMergeSuggestion(graphIds: string[]): Promise<{ success: boolean }>;

  getTools(): Promise<{ tools: ToolDefinition[] }>;

  executeAutonomous(
    sessionId: string,
    goal: AnalysisGoal,
  ): Promise<ExecuteResult>;
}
