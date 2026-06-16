import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface StructuredAnalysisResult {
  summary: string;
  recommendations: GraphRecommendation[];
  graphIndex?: Record<string, string>;
}

export type ToolCategory = "read" | "write";

export type RiskLevel = "low" | "medium" | "high";

export type PendingActionStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category?: ToolCategory;
  requiresConfirmation?: boolean;
  riskLevel?: RiskLevel;
  execute: (
    params: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<unknown>;
}

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  graphIds?: string[];
  graphIndexMap?: Map<number, string>;
  nodeIndexMap?: Map<number, string>;
}

export interface AgentSession {
  id: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed" | "interrupted" | "awaiting_confirmation";
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
  role: "system" | "user" | "assistant" | "tool";
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
  status: "pending" | "running" | "completed" | "failed";
  timestamp: Date;
}

export interface PendingAction {
  id: string;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  category: ToolCategory;
  riskLevel: RiskLevel;
  description: string;
  status: PendingActionStatus;
  result?: unknown;
  createdAt: Date;
  executedAt?: Date;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  tools: string[];
  allowWrite?: boolean;
  maxIterations?: number;
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

export type AnalysisGoal =
  | "knowledge_completeness"
  | "relation_discovery"
  | "learning_optimization"
  | "island_detection"
  | "cross_domain"
  | "custom";

export interface ToolSelectionStrategy {
  primaryTools: string[];
  secondaryTools: string[];
  depthTools: string[];
}

export interface MergeSuggestion {
  graph_ids: string[];
  graph_titles: string[];
  similarity_score: number;
  reason: string;
  suggested_action: "merge" | "link" | "keep_separate";
  shared_concepts: string[];
}

export interface DomainDistribution {
  distribution: Record<string, number>;
  total_domains: number;
  total_graphs: number;
}

export interface KnowledgeCoverage {
  total_graphs: number;
  total_nodes: number;
  connected_graphs: number;
  isolated_graphs: number;
  connectivity_rate: string;
}

export interface GraphStructureAnalysis {
  graph_id: string;
  graph_title: string;
  node_count: number;
  edge_count: number;
  level_distribution: Record<string, number>;
  edge_type_distribution: Record<string, number>;
  avg_connectivity: number;
  depth: number;
  structure_features: string[];
}

export interface LearningPath {
  path: string[];
  path_titles: string[];
  description: string;
  estimated_time: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface SimilarGraph {
  graph_id: string;
  graph_title: string;
  similarity_score: number;
  shared_concepts: string[];
  relation_type: "similar" | "related" | "complementary";
}

export interface StudyProgress {
  completed_graphs: number;
  in_progress_graphs: number;
  not_started_graphs: number;
  total_graphs: number;
  progress_percentage: number;
}

export interface DifficultyAnalysis {
  graph_id: string;
  graph_title: string;
  difficulty_level: number;
  difficulty_factors: string[];
  estimated_study_time: string;
  prerequisite_count: number;
}

export interface PrerequisiteChain {
  target_graph_id: string;
  target_graph_title: string;
  chain: Array<{
    graph_id: string;
    graph_title: string;
    order: number;
    description: string;
  }>;
  total_steps: number;
}

export interface ExtensionSuggestion {
  graph_id: string;
  graph_title: string;
  suggestion_type: "extension" | "related" | "cross_domain";
  reason: string;
  shared_topics: string[];
}

export interface GraphTag {
  name: string;
  count: number;
}

export interface NodeRelation {
  nodeId: string;
  nodeTitle: string;
  upstreamNodes: Array<{
    id: string;
    title: string;
    relationType: string;
  }>;
  downstreamNodes: Array<{
    id: string;
    title: string;
    relationType: string;
  }>;
  totalRelations: number;
  depth: number;
}
