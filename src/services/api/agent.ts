import { request } from './client';

export type RelationType = 'prerequisite' | 'extension' | 'related' | 'cross_domain';

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

export interface StructuredAnalysisResult {
  summary: string;
  recommendations: GraphRecommendation[];
}

export interface AgentSession {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';
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
  role: 'system' | 'user' | 'assistant' | 'tool';
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
  status: 'pending' | 'running' | 'completed' | 'failed';
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

export const agentApi = {
  createSession: (options?: {
    skill_id?: string;
    graph_ids?: string[];
    custom_prompt?: string;
  }): Promise<{ session: AgentSession }> =>
    request('/agent/sessions', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),

  getSession: (sessionId: string): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}`),

  executeSession: (
    sessionId: string,
    customPrompt?: string,
  ): Promise<{ session: AgentSession }> =>
    request(`/agent/sessions/${sessionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ custom_prompt: customPrompt }),
    }),

  getSkills: (): Promise<{ skills: SkillDefinition[] }> =>
    request('/agent/skills'),

  applyRecommendations: (
    recommendations: GraphRecommendation[],
  ): Promise<{ success: boolean; created: number }> =>
    request('/agent/recommendations/apply', {
      method: 'POST',
      body: JSON.stringify({ recommendations }),
    }),
};
