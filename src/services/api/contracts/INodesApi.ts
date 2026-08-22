import type { Node, Keyword } from '@shared/types';
import type {
  CreateNodeData,
  UpdateNodeData,
  NodePositionUpdate,
  DeleteNodeResult,
} from '@shared/types/api';

export interface INodesApi {
  create(data: CreateNodeData): Promise<Node>;

  get(id: string): Promise<Node>;

  update(
    id: string,
    data: UpdateNodeData & { keywords?: Record<string, Keyword[]> },
  ): Promise<Node>;

  delete(id: string, hardDelete?: boolean): Promise<DeleteNodeResult>;

  batchDelete(
    node_ids: string[],
    options?: { hard_delete?: boolean },
  ): Promise<{ count: number }>;

  batchUpdatePositions(positions: NodePositionUpdate[]): Promise<void>;

  getRelated(id: string): Promise<unknown>;

  searchSimilar(params: {
    title: string;
    content?: string;
    threshold?: number;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      title: string;
      content?: string;
      similarity: number;
      graphs_count: number;
    }>
  >;

  getKnowledgePointGraphs(nodeId: string): Promise<
    Array<{
      graph_id: string;
      graph_title: string;
      x_position: number;
      y_position: number;
      level: string;
    }>
  >;
}