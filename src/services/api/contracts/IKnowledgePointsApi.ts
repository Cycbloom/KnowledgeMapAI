import type {
  KnowledgePoint,
  KnowledgePointWithGraphs,
  SimilarKnowledgePoint,
  DeleteKnowledgePointResult,
  GraphNode,
  GraphNodeWithKnowledgePoint,
  CombinedViewData,
  KnowledgePointVisibility,
  KnowledgePointVersion,
  KnowledgePointVersionWithDiff,
} from '@shared/types';

export interface KnowledgePointGraphInfo {
  graph_id: string;
  graph_title: string;
  x_position: number;
  y_position: number;
  level: string;
}

export interface IKnowledgePointsApi {
  list(params?: { visibility?: KnowledgePointVisibility }): Promise<KnowledgePoint[]>;

  get(id: string): Promise<KnowledgePoint>;

  getWithGraphs(id: string): Promise<KnowledgePointWithGraphs>;

  create(data: {
    title: string;
    content?: string;
    summary?: string;
    learning_material?: string;
    properties?: Record<string, unknown>;
    visibility?: KnowledgePointVisibility;
  }): Promise<KnowledgePoint>;

  update(
    id: string,
    data: {
      title?: string;
      content?: string;
      summary?: string;
      learning_material?: string;
      properties?: Record<string, unknown>;
      visibility?: KnowledgePointVisibility;
    },
  ): Promise<KnowledgePoint>;

  searchSimilar(params: {
    query: string;
    threshold?: number;
    limit?: number;
  }): Promise<SimilarKnowledgePoint[]>;

  searchSimilarByEmbedding(params: {
    embedding: number[];
    threshold?: number;
    limit?: number;
  }): Promise<SimilarKnowledgePoint[]>;

  softDeleteFromGraph(graphNodeId: string): Promise<{ success: boolean }>;

  hardDelete(knowledgePointId: string): Promise<DeleteKnowledgePointResult>;

  getGraphs(knowledgePointId: string): Promise<KnowledgePointGraphInfo[]>;

  getVersions(
    knowledgePointId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{ versions: KnowledgePointVersionWithDiff[]; total: number }>;

  getVersion(knowledgePointId: string, versionNumber: number): Promise<KnowledgePointVersion>;

  compareVersions(
    knowledgePointId: string,
    version1: number,
    version2: number,
  ): Promise<KnowledgePointVersionWithDiff[]>;

  rollbackVersion(
    knowledgePointId: string,
    versionNumber: number,
  ): Promise<{ success: boolean; knowledge_point: KnowledgePoint }>;

  createVersion(
    knowledgePointId: string,
    changeSummary: string,
  ): Promise<KnowledgePointVersion>;
}

export interface IGraphNodesApi {
  create(data: {
    graph_id: string;
    knowledge_point_id: string;
    x_position?: number;
    y_position?: number;
    level?: string;
    is_accepted?: boolean;
  }): Promise<GraphNode>;

  get(id: string): Promise<GraphNodeWithKnowledgePoint>;

  update(
    id: string,
    data: {
      x_position?: number;
      y_position?: number;
      level?: string;
      is_accepted?: boolean;
    },
  ): Promise<GraphNode>;

  delete(id: string): Promise<void>;

  batchUpdatePositions(
    positions: Array<{ id: string; x_position: number; y_position: number }>,
  ): Promise<void>;

  listByGraph(graphId: string): Promise<GraphNodeWithKnowledgePoint[]>;

  addExistingKnowledgePoint(data: {
    graph_id: string;
    knowledge_point_id: string;
    x_position?: number;
    y_position?: number;
    level?: string;
  }): Promise<GraphNode>;
}

export interface ICombinedViewApi {
  getData(graphIds: string[]): Promise<CombinedViewData>;
}
