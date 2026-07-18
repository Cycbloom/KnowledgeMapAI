import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, defaultQueryConfig } from "./config";
import type { Note, NoteListParams, NoteType, NoteTemplate, BlockContent, BlockRef, BlockRefTarget, NodeBlockRefBacklink } from "@shared/types";


/**
 * 笔记列表查询。
 *
 * 视图标签(view)统一映射为后端过滤参数:
 * - all      → 不附加过滤(显示未归档的全部类型)
 * - daily    → type=daily, isArchived=false
 * - note     → type=note, isArchived=false
 * - pinned   → isPinned=true, isArchived=false
 * - archived → isArchived=true
 */
export type NoteView = "all" | "daily" | "note" | "pinned" | "archived";

export interface UseNotesListArgs {
  view: NoteView;
  enabled?: boolean;
  pageSize?: number;
  tag?: string;
  search?: string;
}

const buildParams = (args: UseNotesListArgs, page: number): NoteListParams => {
  const { view, pageSize = 20, tag, search } = args;
  switch (view) {
    case "daily":
      return {
        filters: { type: "daily" as NoteType, isArchived: false, tag, search },
        page,
        pageSize,
        sortBy: "updated_at",
        sortOrder: "desc",
      };
    case "note":
      return {
        filters: { type: "note" as NoteType, isArchived: false, tag, search },
        page,
        pageSize,
        sortBy: "updated_at",
        sortOrder: "desc",
      };
    case "pinned":
      return {
        filters: { isPinned: true, isArchived: false, tag, search },
        page,
        pageSize,
        sortBy: "updated_at",
        sortOrder: "desc",
      };
    case "archived":
      return {
        filters: { isArchived: true, tag, search },
        page,
        pageSize,
        sortBy: "updated_at",
        sortOrder: "desc",
      };
    case "all":
    default:
      return {
        filters: { isArchived: false, tag, search },
        page,
        pageSize,
        sortBy: "updated_at",
        sortOrder: "desc",
      };
  }
};

/**
 * 笔记列表查询(Infinite Query)。
 *
 * 分页通过 pageParam 控制,queryKey 仅含过滤维度(view/tag/search 等),
 * 所有页共享同一 key,避免每页产生独立缓存项。
 *
 * NoteListResult 不含 hasMore 字段,getNextPageParam 基于
 * total / page / pageSize 推算是否还有下一页。
 */
export const useNotesList = (args: UseNotesListArgs) => {
  const { view, enabled = true, tag, search } = args;
  return useInfiniteQuery({
    queryKey: queryKeys.notes({
      type: view === "daily" || view === "note" ? view : undefined,
      isArchived: view === "archived",
      isPinned: view === "pinned",
      tag,
      search,
    }),
    queryFn: async ({ pageParam }) =>
      api.notes.list(buildParams(args, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const seen = lastPage.page * lastPage.pageSize;
      return seen < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled,
    ...defaultQueryConfig,
  });
};

/**
 * 单笔记详情查询。
 *
 * 仅在 noteId 存在时启用。queryKey 为 ["notes", "detail", noteId]，
 * 可被 ["notes"] 前缀失效（笔记更新/删除/置顶/归档等 mutation 已自动失效）。
 *
 * 注意：queryFn 内显式校验 noteId，避免非空断言。
 */
export const useNote = (noteId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.note(noteId ?? "none"),
    queryFn: async () => {
      if (!noteId) {
        throw new Error("noteId is required");
      }
      return api.notes.get(noteId);
    },
    enabled: !!noteId,
    ...defaultQueryConfig,
  });
};

/**
 * 回收站笔记查询。
 *
 * 后端 notesApi.list 在 includeDeleted=true 时返回"全部含已删除"的笔记
 * （既含已软删除，也含未删除），因此 queryFn 内需再过滤 deletedAt != null，
 * 仅保留回收站中的笔记，并按删除时间倒序排列。
 *
 * queryKey 为 ["notes", "trash"]，可被 ["notes"] 前缀失效
 * （笔记恢复/删除/更新等 mutation 已自动失效前缀）。
 */
export const useTrashNotes = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ["notes", "trash"],
    queryFn: async (): Promise<Note[]> => {
      const res = await api.notes.list({
        filters: { includeDeleted: true },
        pageSize: 100,
      });
      return res.items
        .filter((n) => n.deletedAt !== null)
        .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
    },
    enabled,
    ...defaultQueryConfig,
  });
};

/**
 * 节点详情"关联笔记"查询。
 *
 * 通过 notesApi.getByNodeId(nodeId) 拉取挂载到该节点的笔记列表
 * （基于 note_node_links 表，由笔记正文 `[[节点名]]` 自动建立挂载关系）。
 *
 * queryKey 为 ["notes", "by-node", nodeId]，可被 ["notes"] 前缀失效
 * （笔记更新/删除/置顶/归档等 mutation 已自动失效前缀）。
 *
 * 注意：queryFn 内显式校验 nodeId，避免非空断言。
 */
export const useNotesByNode = (nodeId: string | undefined | null) => {
  return useQuery({
    queryKey: queryKeys.notesByNode(nodeId ?? "none"),
    queryFn: async (): Promise<Note[]> => {
      if (!nodeId) {
        throw new Error("nodeId is required");
      }
      return api.notes.getByNodeId(nodeId);
    },
    enabled: !!nodeId,
    ...defaultQueryConfig,
  });
};

/**
 * P1 Task 11: 笔记模板列表查询。
 *
 * 调用 notesApi.listTemplates 拉取当前用户可见的全部模板
 * (系统默认模板 isSystem=true + 用户自定义模板 isSystem=false)。
 *
 * queryKey 为 ["notes", "templates"],可被 ["notes"] 前缀失效
 * (虽然模板 CRUD mutation 显式失效 ["notes", "templates"],
 *  但 daily 自动创建流程依赖默认模板,故同时失效 ["notes"] 前缀以防列表与今日 daily 不一致)。
 */
export const useNoteTemplates = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.noteTemplates(),
    queryFn: async (): Promise<NoteTemplate[]> => api.notes.listTemplates(),
    enabled,
    ...defaultQueryConfig,
  });
};

// ============================================================
// P3: 块引用 / 块嵌入查询
// ============================================================

/**
 * 单块内容查询(GET /notes/:id/blocks/:blockId)。
 *
 * 供 BlockReference/BlockEmbed 渲染时拉取目标块正文。
 * 仅在 noteId/blockId 存在且 enabled 时启用。
 */
export const useBlockContent = (
  noteId: string,
  blockId: string,
  enabled?: boolean,
) =>
  useQuery({
    queryKey: queryKeys.noteBlock(noteId, blockId),
    queryFn: async (): Promise<BlockContent> =>
      api.notes.getBlock(noteId, blockId),
    enabled: (enabled ?? true) && !!noteId && !!blockId,
    ...defaultQueryConfig,
  });

/**
 * 被引用列表查询(GET /notes/:id/block-refs/inbound)。
 *
 * 返回引用了本笔记某块的全部来源,用于"被引用"面板展示。
 */
export const useInboundBlockRefs = (noteId: string) =>
  useQuery({
    queryKey: queryKeys.noteInboundBlockRefs(noteId),
    queryFn: async (): Promise<BlockRef[]> =>
      api.notes.getInboundBlockRefs(noteId),
    enabled: !!noteId,
    ...defaultQueryConfig,
  });

/**
 * 引用列表查询(GET /notes/:id/block-refs/outbound)。
 *
 * 返回本笔记正文中的全部块引用/嵌入,用于"引用列表"展示。
 */
export const useOutboundBlockRefs = (noteId: string) =>
  useQuery({
    queryKey: queryKeys.noteOutboundBlockRefs(noteId),
    queryFn: async (): Promise<BlockRef[]> =>
      api.notes.getOutboundBlockRefs(noteId),
    enabled: !!noteId,
    ...defaultQueryConfig,
  });

/**
 * 块搜索补全查询(GET /notes/block-search?q=)。
 *
 * 供 BlockRefPopover 输入 (( 时拉取候选块。
 * 仅当 query 非空且 enabled 时启用。
 */
export const useBlockSearch = (query: string, enabled?: boolean) =>
  useQuery({
    queryKey: queryKeys.noteBlockSearch(query),
    queryFn: async (): Promise<BlockRefTarget[]> =>
      api.notes.searchBlocks(query),
    enabled: (enabled ?? true) && query.trim().length > 0,
    ...defaultQueryConfig,
  });

/**
 * P3:节点详情"引用此节点的块"查询(GET /backlinks/:knowledgePointId/block-refs)。
 *
 * 返回引用了"含 [[节点]] 的块"的笔记列表,供节点详情侧边栏
 * "引用此节点的块"子区块使用。每项含引用方笔记信息 + 被引用块摘要。
 *
 * queryKey 为 ["backlinks", nodeId, "block-refs"](独立前缀,
 * 不随 ["notes"] 前缀失效,仅在节点变更时由 nodeId 维度自然失效)。
 */
export const useBlockRefBacklinks = (nodeId: string | undefined | null) =>
  useQuery({
    queryKey: queryKeys.nodeBlockRefBacklinks(nodeId ?? "none"),
    queryFn: async (): Promise<NodeBlockRefBacklink[]> => {
      if (!nodeId) {
        throw new Error("nodeId is required");
      }
      return api.backlinks.getBlockRefBacklinks(nodeId);
    },
    enabled: !!nodeId,
    ...defaultQueryConfig,
  });
