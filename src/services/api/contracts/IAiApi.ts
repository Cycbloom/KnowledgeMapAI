import type { AIAction, TutorMode, BranchSuggestion } from "@shared/types";
import type { Keyword } from "@shared/types/graph";

export interface IAiActionsApi {
  list(graphId?: string): Promise<AIAction[]>;
  create(data: Partial<AIAction>): Promise<AIAction>;
  update(id: string, data: Partial<AIAction>): Promise<AIAction>;
  delete(id: string): Promise<void>;
  execute(data: {
    action_id: string;
    node_id: string;
    graph_id?: string;
  }): Promise<{
    data?: {
      updatedFields?: string[];
      createdCount?: number;
    };
    message?: string;
  }>;
}

export interface IAiApi {
  status(): Promise<{ available: boolean; enabled?: boolean; providers: string[] }>;

  generateContent(data: {
    topic: string;
    context?: string;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ content: string }>;

  generateContentStream(
    data: {
      topic: string;
      context?: string;
      level?: string;
      provider?: string;
      model?: string;
      language?: string;
    },
    onChunk: (content: string) => void,
  ): Promise<void>;

  annotateTerms(data: {
    node_id: string;
    node_content: string;
    graph_id: string;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ terms: Array<{ term: string; definition: string }> }>;

  generateLearningMaterial(data: {
    topic: string;
    context?: string;
    level?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
    schema_id?: string;
  }): Promise<{
    content: string;
    keywords?: Keyword[];
    sections?: Array<{ title: string; content: string }>;
  }>;

  /** AI 辅助设计/优化学习材料章节结构 */
  assistLearningSchema(data: {
    mode: "generate" | "optimize";
    topic: string;
    goal?: string;
    existing_sections?: Array<{
      title: string;
      instruction: string;
      min_words?: number;
      max_words?: number;
    }>;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{
    sections: Array<{
      title: string;
      instruction: string;
      min_words?: number;
      max_words?: number;
    }>;
  }>;

  expand(data: {
    node_title: string;
    node_content?: string;
    existing_titles?: string[];
    current_children?: string[];
    node_level?: string;
    expand_prompt?: string;
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ suggestions: Array<{ title: string; description?: string; level?: string }> }>;

  getBranchSuggestions(data: {
    node_title: string;
    node_content?: string;
    existing_nodes?: unknown[];
    child_nodes?: unknown[];
    context_level?: string;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ suggestions: BranchSuggestion[] }>;

  generateCards(data: {
    node_title: string;
    node_content?: string;
    count?: number;
    types?: string[];
    provider?: string;
    model?: string;
    language?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
    custom_prompt?: string;
  }): Promise<{ cards: Array<{ id?: string; question: string; answer: string; type: string; difficulty: string; explanation?: string; options?: string[] }> }>;

  batchGenerateCards(
    node_ids: string[],
    config: {
      types?: string[];
      count?: number;
      pack_template?: string;
      provider?: string;
      model?: string;
      language?: string;
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
      custom_prompt?: string;
      /** 每题型数量：Record<CardType, number>，合计为用户想要的总题数（所有节点均分时后端统一处理） */
      cards_per_type?: Record<string, number>;
      /** 每难度数量：单独配置 easy/medium/hard */
      count_per_difficulty?: {
        easy?: number;
        medium?: number;
        hard?: number;
      };
    },
  ): Promise<{ success: boolean; taskIds: string[]; message: string; error?: string; results?: Array<{ nodeId: string; success: boolean; count: number }> }>;

  batchExpandGraph(node_ids: string[]): Promise<{ success: boolean; message: string }>;

  getTaskStatus(id: string): Promise<{ status: string; progress?: number; result?: unknown }>;

  textToGraph(data: {
    text?: string;
    graph_id: string;
    action?: "analyze" | "save";
    nodes?: unknown[];
    edges?: unknown[];
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ nodes: Array<{ id?: string; title: string; content?: string; level?: string }>; edges: Array<{ source: string; target: string; type: string }> }>;

  documentToGraph(data: {
    graph_id: string;
    file: File;
    language?: string;
  }): Promise<{ nodes: unknown[]; edges: unknown[] }>;

  imageToGraph(formData: FormData): Promise<{ nodes: unknown[]; edges: unknown[] }>;

  urlToText(url: string): Promise<{ text: string; title?: string }>;

  recommendConnections(data: {
    graph_id: string;
    node_title: string;
    node_content?: string;
  }): Promise<{ connections: Array<{ target_title: string; relationship: string; reason: string }> }>;

  chatStream(
    data: {
      message: string;
      graph_id: string;
      history?: unknown[];
      context_node_ids?: string[];
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
    },
    onChunk: (content: string) => void,
  ): Promise<void>;

  tutorChatStream(
    data: {
      message: string;
      graph_id?: string;
      history?: unknown[];
      context_node_ids?: string[];
      mode?: TutorMode;
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
    },
    onChunk: (content: string) => void,
  ): Promise<void>;

  extractConcepts(data: {
    text: string;
    existing_nodes?: string[];
    max_concepts?: number;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ concepts: Array<{ title: string; description: string; priority: "high" | "medium" | "low" }> }>;

  suggestNextTopic(data: {
    node_title: string;
    node_content?: string;
    existing_nodes?: string[];
    user_progress?: {
      mastered_count?: number;
      due_count?: number;
      current_level?: string;
    };
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ suggestions: Array<{ title: string; description: string; priority: "high" | "medium" | "low"; estimatedDifficulty: number }> }>;

  generatePodcastScript(
    context: string,
    language?: string,
    graph_id?: string,
  ): Promise<{ script: string; segments: Array<{ speaker: string; text: string }> }>;

  analyzeCrossGraphConnections(data: {
    graph1_id: string;
    graph1_title?: string;
    graph1_nodes: Array<{ id: string; title: string; content?: string }>;
    graph2_id: string;
    graph2_title?: string;
    graph2_nodes: Array<{ id: string; title: string; content?: string }>;
    provider?: string;
    model?: string;
    language?: string;
  }): Promise<{ connections: Array<{ source: string; target: string; type: string; description: string }> }>;
}