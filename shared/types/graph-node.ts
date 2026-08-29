// 图谱节点相关类型
// GraphNode, Node, NodeStatus, LayoutNode, LayoutLink, NodeImportance 等

import type { NodeLevel } from "./graph-core";
import type { Edge } from "./graph-edge";
import type { KnowledgePoint } from "./graph-knowledge-point";

export interface GraphNode {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: NodeLevel;
  is_accepted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export type GraphNodeWithKnowledgePoint = GraphNode &
  Omit<KnowledgePoint, "id">;

export type Node = GraphNode &
  Omit<KnowledgePoint, "id"> & {
    tags?: string[];
    /** 语言 keyed 的标题映射（如 {"zh-CN":"标题","en-US":"Title"}），title 字段已按显示语言解析 */
    titleTranslations?: string | Record<string, string> | undefined;
    /** 语言 keyed 的内容映射 */
    contentTranslations?: string | Record<string, string> | undefined;
    /** 语言 keyed 的摘要映射 */
    summaryTranslations?: string | Record<string, string> | undefined;
    /** 该知识点被多少个图谱引用（跨图谱复用次数，含当前图谱）；>1 表示已在多个图谱中复用 */
    refGraphCount?: number;
  };

export interface KnowledgePointWithGraphs extends KnowledgePoint {
  graph_nodes?: GraphNode[];
  graphs_count?: number;
}

export interface NodeStatus {
  locked: boolean;
  mastered: boolean;
  due_today?: boolean;
  due?: boolean;
  review_count?: number;
  next_review?: string;
  fsrs_stability?: number;
  fsrs_retrievability?: number;
  display_mastery?: number;
}

export interface LayoutNode extends Node {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LayoutLink extends Edge {
  source: string | LayoutNode;
  target: string | LayoutNode;
}

export interface NodeImportance {
  score: number;
  factors: {
    degree: number;
    childrenCount: number;
    level: number;
    contentLength: number;
  };
}
