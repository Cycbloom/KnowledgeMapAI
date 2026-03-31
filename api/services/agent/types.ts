import type { SupabaseClient } from '@supabase/supabase-js';

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

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  graphIds?: string[];
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: Date;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  tools: string[];
}

export interface CreateSessionOptions {
  skillId?: string;
  graphIds?: string[];
  customPrompt?: string;
}

export interface ExecuteResult {
  session: AgentSession;
  stream?: ReadableStream<string>;
}
