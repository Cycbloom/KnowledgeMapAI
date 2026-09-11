// 图谱节点相关类型
// GraphNode, Node, NodeStatus, LayoutNode, LayoutLink, NodeImportance 等

import type { NodeLevel } from "./graph-core";
import type { Edge } from "./graph-edge";
import type { KnowledgePoint } from "./graph-knowledge-point";

/**
 * 节点特异性标注（AI 生成节点时写入 properties.specificity）：
 * - specific：标题精确、无歧义（专名/术语），可参与本图与跨图谱的知识点复用判定；
 * - generic：标题泛化（如「项目现状」「未来展望」），在不同上下文含义可能不同，复用判定应跳过此类节点。
 */
export type NodeSpecificity = "specific" | "generic";

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
