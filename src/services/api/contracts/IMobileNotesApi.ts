import type {
  BlockContent,
  BlockRef,
  BlockRefTarget,
} from '@shared/types/note';

/**
 * Mobile 层笔记 API 契约(P3 块引用/块嵌入只读子集)。
 *
 * mobile 层仅暴露块引用相关的只读端点,不提供笔记本体的 CRUD
 * (笔记 CRUD 仍由 api 层 notesApi 承载,移动端通过 Supabase 直连或
 * 专用 mobile 客户端按需实现,不在本契约范围)。
 *
 * 方法命名与 api 层 INotesApi 对齐(api-naming-conventions §6.1):
 * - api.notes.getBlock     ↔ mobile.notes.getBlock
 * - api.notes.getInboundBlockRefs ↔ mobile.notes.getInboundBlockRefs
 * - api.notes.getOutboundBlockRefs ↔ mobile.notes.getOutboundBlockRefs
 * - api.notes.searchBlocks  ↔ mobile.notes.searchBlocks
 */
export interface IMobileNotesApi {
  /** 获取笔记中指定块的内容(GET /notes/:id/blocks/:blockId) */
  getBlock(noteId: string, blockId: string): Promise<BlockContent>;

  /** 查询引用了本笔记某块的全部来源(GET /notes/:id/block-refs/inbound) */
  getInboundBlockRefs(noteId: string): Promise<BlockRef[]>;

  /** 查询本笔记正文中的全部块引用/嵌入(GET /notes/:id/block-refs/outbound) */
  getOutboundBlockRefs(noteId: string): Promise<BlockRef[]>;

  /** 块搜索补全(GET /notes/block-search?q=&limit=) */
  searchBlocks(query: string, limit?: number): Promise<BlockRefTarget[]>;
}
