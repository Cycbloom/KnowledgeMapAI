import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit } from '@shared/types';

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
}
