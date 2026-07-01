import type { BackboneModuleCustomConfig } from "@shared/types/graph";

export interface IAutoGraphApi {
  init(data: {
    topic: string;
    style?: "academic" | "practical" | "beginner" | "custom";
    customPrompt?: string;
    sources?: string[];
    graph_id?: string;
    provider?: string;
    model?: string;
    language?: string;
    session_id?: string;
    template_type?: string;
    customModules?: BackboneModuleCustomConfig[];
    storyConfig?: {
      genre?: string;
      coreConflict?: string;
      characterHints?: string;
    };
  }): Promise<{
    sessionId: string;
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{
      title: string;
      content?: string;
      summary?: string;
      level?: string;
      backboneModule?: string;
      needsRefinement?: boolean;
      color?: string;
    }>;
  }>;

  expand(data: {
    node_id: string;
    node_title: string;
    node_content?: string;
    node_level?: string;
    graph_id?: string;
    style?: string;
    customPrompt?: string;
    existing_children?: Array<{ title: string; content?: string }>;
    provider?: string;
    model?: string;
    language?: string;
    session_id?: string;
  }): Promise<{
    sessionId: string;
    parentNodeId: string;
    children: Array<{
      title: string;
      content?: string;
      summary?: string;
      level?: string;
    }>;
  }>;

  saveNodes(data: {
    graph_id: string;
    nodes: Array<{
      id?: string;
      title: string;
      content?: string;
      summary?: string;
      level?: string;
      parentId?: string;
      backboneModule?: string;
      needsRefinement?: boolean;
      color?: string;
      properties?: Record<string, unknown>;
    }>;
  }): Promise<unknown>;

  optimizePrompt(data: {
    topic: string;
    currentPrompt?: string;
  }): Promise<unknown>;

  generateEmbeddings(limit?: number): Promise<unknown>;

  getEmbeddingStatus(): Promise<unknown>;

  generateTemplates(data: unknown): Promise<unknown>;

  applyTemplate(data: unknown): Promise<unknown>;
}
