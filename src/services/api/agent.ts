import { request } from "./client";

export type RelationType =
  | "prerequisite"
  | "extension"
  | "related"
  | "cross_domain";

export interface GraphRecommendation {
  id: string;
  source_graph_id: string;
  source_graph_title: string;
  target_graph_id: string;
  target_graph_title: string;
  relation_type: RelationType;
  reason: string;
  confidence: number;
}

export interface MergeSuggestion {
  graph_ids: string[];
  graph_titles: string[];
  similarity_score: number;
  reason: string;
  suggested_action: "merge" | "link" | "keep_separate";
  shared_concepts: string[];
}

export interface StructuredAnalysisResult {
  summary: string;
  recommendations: GraphRecommendation[];
  merge_suggestions?: MergeSuggestion[];
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

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  tools: string[];
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

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const agentApi = {
  createSession: (options?: {
    skill_id?: string;
    graph_ids?: string[];
    custom_prompt?: string;
  }): Promise<{ session: AgentSession }> =>
    request("/agent/sessions", {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  getSession: (sessionId: string): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}`),

  executeSession: (
    sessionId: string,
    customPrompt?: string,
  ): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}/execute`, {
      method: "POST",
      body: JSON.stringify({ custom_prompt: customPrompt }),
    }),

  getSkills: (): Promise<{ skills: SkillDefinition[] }> =>
    request("/agent/skills"),

  applyRecommendations: (
    recommendations: GraphRecommendation[],
  ): Promise<{ success: boolean; created: number }> =>
    request("/agent/recommendations/apply", {
      method: "POST",
      body: JSON.stringify({ recommendations }),
    }),

  mergeGraphs: (
    graphIds: string[],
    targetTitle?: string,
  ): Promise<{ success: boolean; merged_graph_id: string }> =>
    request("/graphs/merge", {
      method: "POST",
      body: JSON.stringify({ graph_ids: graphIds, target_title: targetTitle }),
    }),

  linkGraphs: (
    graphIds: string[],
    relationType?: RelationType,
  ): Promise<{ success: boolean; created: number }> =>
    request("/graphs/batch-link", {
      method: "POST",
      body: JSON.stringify({
        graph_ids: graphIds,
        relation_type: relationType || "related",
      }),
    }),

  dismissMergeSuggestion: (graphIds: string[]): Promise<{ success: boolean }> =>
    request("/agent/merge-suggestions/dismiss", {
      method: "POST",
      body: JSON.stringify({ graph_ids: graphIds }),
    }),

  getTools: (): Promise<{ tools: ToolDefinition[] }> => request("/agent/tools"),

  executeAutonomous: (
    sessionId: string,
    goal: AnalysisGoal,
  ): Promise<ExecuteResult> =>
    request(`/agent/sessions/${sessionId}/autonomous`, {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),
};
