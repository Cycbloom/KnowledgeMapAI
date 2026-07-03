// B1 双向链接相关类型
// BacklinkItem, KnowledgePointSearchHit, OutlinkItem, NodeBlockRefBacklink 等

import type { BlockId } from "./note";

/**
 * 反向链接项
 * 表示某 knowledge_point 被另一个 knowledge_point 引用的关系
 */
export interface BacklinkItem {
  /** 引用方（来源）知识点 ID */
  sourceKnowledgePointId: string;
  /** 引用方知识点标题 */
  sourceKnowledgePointTitle: string;
  /** 引用方知识点内容（用于提取上下文） */
  sourceKnowledgePointContent: string;
  /** 边所在的图谱 ID */
  graphId: string;
  /** 图谱标题 */
  graphTitle: string;
  /** 引用上下文（[[节点名]] 前后各 30 字符） */
  context: string;
  /** 边创建时间（ISO 字符串） */
  createdAt: string;
}

/**
 * 正向链接项
 * 表示某 knowledge_point 引用了其他 knowledge_point 的关系
 */
export interface OutlinkItem {
  /** 被引用方（目标）知识点 ID */
  targetKnowledgePointId: string;
  /** 被引用方知识点标题 */
  targetKnowledgePointTitle: string;
  /** 边所在的图谱 ID */
  graphId: string;
  /** 图谱标题 */
  graphTitle: string;
  /** 引用上下文 */
  context: string;
  /** 边创建时间（ISO 字符串） */
  createdAt: string;
}

/**
 * 知识点搜索命中项（用于 [[ 节点选择器）
 */
export interface KnowledgePointSearchHit {
  /** 知识点 ID */
  id: string;
  /** 知识点标题 */
  title: string;
  /** 知识点摘要 */
  summary?: string;
  /** 该知识点所在的图谱 ID 列表 */
  graphIds: string[];
  /** 该知识点所在图谱的标题列表（与 graphIds 一一对应） */
  graphTitles: string[];
  /** 是否在当前图谱中（用于 [[]] 选择器优先排序） */
  inCurrentGraph: boolean;
  /** 更新时间（ISO 字符串） */
  updatedAt: string;
}

/**
 * P3 节点块级反向链接项
 *
 * 表示"含 [[节点X]] 的块"被其他笔记通过 ((blockId)) 引用的关系,
 * 供节点详情侧边栏"引用此节点的块"子区块使用。
 *
 * 数据流:
 * 1. 查含 [[节点X]] 的笔记,提取这些块的 ^id(targetBlockId)
 * 2. 查 note_block_refs WHERE target_block_id IN (这些 blockId)
 * 3. JOIN source_note 拿引用方笔记标题
 *
 * 字段说明:
 * - noteId / noteTitle:引用方笔记(包含 ((blockId)) 的笔记)
 * - blockId / blockSummary:被引用的块(含 [[节点X]] 的块,在源笔记中)
 */
export interface NodeBlockRefBacklink {
  /** 引用方笔记 ID(包含 ((blockId)) 引用的笔记) */
  noteId: string;
  /** 引用方笔记标题 */
  noteTitle: string;
  /** 被引用的块 ID(含 [[节点]] 的块) */
  blockId: BlockId;
  /** 被引用块的摘要(剥离 ^id 后取前 100 字符) */
  blockSummary: string;
}
