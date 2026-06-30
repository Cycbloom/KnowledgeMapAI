// 组合视图与跨图谱连接相关类型
// CombinedViewGraph, CombinedViewData, CrossGraphNodeConnection, CrossGraphRelationData 等

import type { Edge } from "./graph-edge";
import type { Graph } from "./graph-entity";
import type { KnowledgePoint } from "./graph-knowledge-point";
import type { GraphNode, GraphNodeWithKnowledgePoint } from "./graph-node";
import type { GraphRelation } from "./graph-discovery";

export interface CombinedViewGraph {
  graph_id: string;
  graph_title: string;
  color: string;
  nodes: GraphNodeWithKnowledgePoint[];
  edges: Edge[];
}

export interface CombinedViewData {
  graphs: CombinedViewGraph[];
  shared_knowledge_points: Array<{
    knowledge_point_id: string;
    knowledge_point: KnowledgePoint;
    graph_nodes: GraphNode[];
  }>;
}

export interface CrossGraphNodeConnection {
  id: string;
  knowledge_point_id: string;
  node1: {
    id: string;
    title: string;
    graph_id: string;
    x_position: number;
    y_position: number;
  };
  node2: {
    id: string;
    title: string;
    graph_id: string;
    x_position: number;
    y_position: number;
  };
  connection_type: "same_knowledge_point" | "similar_content";
  similarity?: number;
}

export interface CrossGraphRelationData {
  graph1: {
    id: string;
    title: string;
    node_count: number;
  };
  graph2: {
    id: string;
    title: string;
    node_count: number;
  };
  graph_relations: GraphRelation[];
  cross_graph_connections: CrossGraphNodeConnection[];
  exported_at: string;
}

export interface CombinedGraphViewData {
  graph1: Graph;
  graph2: Graph;
  relations: GraphRelation[];
}
