// B1 双向链接相关类型
// BacklinkItem, KnowledgePointSearchHit, OutlinkItem 等

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
