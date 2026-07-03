import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit, NodeBlockRefBacklink } from '@shared/types';

export interface IBacklinksApi {
  /** 获取某知识点的反向链接列表（谁引用了它） */
  list(knowledgePointId: string): Promise<BacklinkItem[]>;

  /** 获取某知识点的正向链接列表（它引用了谁） */
  getOutlinks(knowledgePointId: string): Promise<OutlinkItem[]>;

  /** 搜索知识点（用于 [[ 节点选择器） */
  search(
    query: string,
    options?: { graphId?: string; limit?: number },
  ): Promise<KnowledgePointSearchHit[]>;

  /**
   * P3:获取"引用了含 [[节点]] 的块"的笔记列表(节点详情侧边栏"引用此节点的块"用)。
   * 返回 NodeBlockRefBacklink[],每项含引用方笔记信息 + 被引用块摘要。
   */
  getBlockRefBacklinks(knowledgePointId: string): Promise<NodeBlockRefBacklink[]>;
}
