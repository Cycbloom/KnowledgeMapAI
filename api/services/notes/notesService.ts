import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Note,
  NoteTemplate,
  CreateNoteInput,
  UpdateNoteInput,
  CreateNoteTemplateInput,
  NoteListParams,
  NoteListFilters,
  GenerateDailySummaryResponse,
  ExtractConceptsResponse,
  NoteExtractedConcept,
  CreateNodesFromConceptsRequest,
  CreateNodesFromConceptsResponse,
  CreatedNodeResult,
  WritingAssistRequest,
  WritingAssistResponse,
  RefreshDailyAggregationResponse,
  AutoArchiveRequest,
  AutoArchiveResult,
  BatchArchiveResult,
} from '@shared/types/note';
import {
  CAPTURE_INBOX_TAG,
  CAPTURE_DEFAULT_MAX_CONCEPTS,
  CAPTURE_MAX_CONCEPTS_LIMIT,
} from '@shared/constants/capture';
import { extractWikiLinks } from '@shared/utils/wikiLink';
import {
  extractAllBlockIds,
  findBlockContent,
} from '../../../shared/utils/blockRef';
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
} from '../../../shared/utils/retry';
import { logger } from '../../utils/logger';
import i18next from "i18next";
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { notDeleted } from '../common/softDeleteHelper';
import { embeddingOps } from '../ai/embeddingOps';
import { promptService } from '../ai/promptService';
import { getAIProviderForTask } from '../ai/factory';
import { performanceMonitor } from '../ai/performanceMonitor';
import { pricingService } from '../ai/pricingService';
import { parseAIResponse } from '../ai/utils';
import { getSupabaseAdmin } from '../../supabase';
import { knowledgePointService } from '../graph/knowledgePointService';
import { graphNodeService } from '../graph/graphNodeService';
import { blockRefService } from './blockRefService';
import { sseService } from '../core/sseService';
import {
  mapRowToNote,
  getLocalDateString,
  getDayStartIso,
  getNextDayStartIso,
  type NoteRow,
  type DailyAggregation,
  type NoteListResult,
  type GetOrCreateDailyResult,
} from './notesShared';
import { notesDailyService } from './notesDailyService';
import { notesTemplateService } from './notesTemplateService';

interface NoteNodeLinkRow {
  id: string;
  note_id: string;
  node_id: string;
  graph_id: string;
  created_at: string;
}

/** graph_nodes JOIN knowledge_graphs 查询行 */
interface GraphNodeRow {
  id: string;
  knowledge_point_id: string;
  graph_id: string;
  graph: { deleted_at: string | null } | null;
}

interface KnowledgePointRow {
  id: string;
  title: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * chunk_text 截断长度:笔记正文快照用于检索结果摘要展示,
 * 截断到 2000 字符(避免过大存储,同时保留足够上下文)。
 */
const CHUNK_TEXT_MAX_LENGTH = 2000;

export class NotesService {
  // ============================================================
  // 笔记 CRUD
  // ============================================================

  /**
   * 分页查询笔记列表。
   * - 默认排除已软删除(includeDeleted=false 时仅回收站可见)
   * - 排序:is_pinned DESC, updated_at DESC
   * - 支持按 type/date/tag/is_archived/is_pinned/nodeId 过滤
   */
  async list(
    supabase: SupabaseClient,
    userId: string,
    params: NoteListParams = {},
  ): Promise<NoteListResult> {
    const filters: NoteListFilters = params.filters ?? {};
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
    const includeDeleted = filters.includeDeleted ?? false;

    // 计算总数(用于分页元信息)
    let countQuery = supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!includeDeleted) {
      countQuery = notDeleted(countQuery);
    }

    if (filters.type) {
      countQuery = countQuery.eq('type', filters.type);
    }
    if (filters.date) {
      countQuery = countQuery.eq('date', filters.date);
    }
    if (filters.tag) {
      countQuery = countQuery.contains('tags', [filters.tag]);
    }
    if (typeof filters.isArchived === 'boolean') {
      countQuery = countQuery.eq('is_archived', filters.isArchived);
    }
    if (typeof filters.isPinned === 'boolean') {
      countQuery = countQuery.eq('is_pinned', filters.isPinned);
    }
    if (filters.search) {
      countQuery = countQuery.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`,
      );
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      logger.error('Notes list: count error', { userId, error: countError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    // 查询数据 - 按 nodeId 过滤时走 note_node_links JOIN
    if (filters.nodeId) {
      const items = await this.getNotesByNodeId(supabase, userId, filters.nodeId);
      // 按 is_pinned / updated_at 排序(与列表语义一致)
      items.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      const start = (page - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);
      return { items: paged, total: items.length, page, pageSize };
    }

    let dataQuery = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);

    if (!includeDeleted) {
      dataQuery = notDeleted(dataQuery);
    }

    if (filters.type) {
      dataQuery = dataQuery.eq('type', filters.type);
    }
    if (filters.date) {
      dataQuery = dataQuery.eq('date', filters.date);
    }
    if (filters.tag) {
      dataQuery = dataQuery.contains('tags', [filters.tag]);
    }
    if (typeof filters.isArchived === 'boolean') {
      dataQuery = dataQuery.eq('is_archived', filters.isArchived);
    }
    if (typeof filters.isPinned === 'boolean') {
      dataQuery = dataQuery.eq('is_pinned', filters.isPinned);
    }
    if (filters.search) {
      dataQuery = dataQuery.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`,
      );
    }

    dataQuery = dataQuery
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error } = await dataQuery;

    if (error) {
      logger.error('Notes list: query error', { userId, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    const items = (data ?? []).map((row) => mapRowToNote(row as unknown as NoteRow));
    return { items, total: count ?? 0, page, pageSize };
  }

  /**
   * 查询单个笔记。不存在或跨用户(由 RLS 拦截)时抛 NOT_FOUND。
   */
  async get(supabase: SupabaseClient, userId: string, id: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Notes get: query error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    if (!data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    return mapRowToNote(data as unknown as NoteRow);
  }

  /**
   * 创建笔记。
   * - daily 类型需校验 date 字段存在(由 DB CHECK 约束保证)
   * - 创建后同步 note_node_links(若 content 含 [[节点名]])
   */
  async create(
    supabase: SupabaseClient,
    userId: string,
    data: CreateNoteInput,
  ): Promise<Note> {
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      title: data.title,
      content: data.content ?? '',
      type: data.type,
      tags: data.tags ?? [],
      is_pinned: data.isPinned ?? false,
      is_archived: data.isArchived ?? false,
    };

    if (data.date) {
      insertRow.date = data.date;
    }
    if (data.templateId) {
      insertRow.template_id = data.templateId;
    }

    const { data: inserted, error } = await supabase
      .from('notes')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // 唯一约束冲突(daily 重复创建)→ 409
      if (error.code === '23505') {
        throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
          context: { userId, type: data.type, date: data.date },
        });
      }
      logger.error('Notes create: insert error', { userId, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    const note = mapRowToNote(inserted as unknown as NoteRow);

    // 同步挂载关系(失败仅记录日志,不阻塞笔记创建)
    await this.syncNodeLinks(supabase, userId, note.id, note.content).catch((err) => {
      logger.warn('Notes create: syncNodeLinks failed', { userId, noteId: note.id, error: err });
    });

    // P3: 同步块引用关系(失败仅记录日志,不阻塞笔记创建)
    await blockRefService
      .syncBlockRefs(supabase, userId, note.id, note.content)
      .catch((err) => {
        logger.warn('Notes create: syncBlockRefs failed', { userId, noteId: note.id, error: err });
      });

    // 异步刷新 embedding(失败仅记录日志,不阻塞笔记创建主流程)
    await this.refreshEmbedding(supabase, note.id, note.content).catch((err) => {
      logger.warn('Notes create: refreshEmbedding failed', { userId, noteId: note.id, error: err });
    });

    return note;
  }

  /**
   * 更新笔记。
   * - 保存时同步 note_node_links(解析 content 中 [[节点名]],diff 新增/删除)
   * - 支持更新 deletedAt 用于恢复(restore 复用此能力)
   */
  async update(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    data: UpdateNoteInput,
  ): Promise<Note> {
    // 先校验存在性(同时验证属主,跨用户返回 NOT_FOUND)
    const oldNote = await this.get(supabase, userId, id);

    const updateRow: Record<string, unknown> = {};
    if (data.title !== undefined) updateRow.title = data.title;
    if (data.content !== undefined) updateRow.content = data.content;
    if (data.date !== undefined) updateRow.date = data.date;
    if (data.templateId !== undefined) updateRow.template_id = data.templateId;
    if (data.tags !== undefined) updateRow.tags = data.tags;
    if (data.isPinned !== undefined) updateRow.is_pinned = data.isPinned;
    if (data.isArchived !== undefined) updateRow.is_archived = data.isArchived;
    if (data.deletedAt !== undefined) updateRow.deleted_at = data.deletedAt;

    const { data: updated, error } = await supabase
      .from('notes')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
          context: { userId, id, date: data.date },
        });
      }
      logger.error('Notes update: error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    const note = mapRowToNote(updated as unknown as NoteRow);

    // 仅当 content 变更时同步挂载关系(避免无谓开销)
    if (data.content !== undefined) {
      await this.syncNodeLinks(supabase, userId, note.id, note.content).catch((err) => {
        logger.warn('Notes update: syncNodeLinks failed', { userId, noteId: note.id, error: err });
      });

      // P3: 同步块引用关系(失败仅记录日志,不阻塞笔记更新)
      await blockRefService
        .syncBlockRefs(supabase, userId, note.id, note.content)
        .catch((err) => {
          logger.warn('Notes update: syncBlockRefs failed', { userId, noteId: note.id, error: err });
        });

      // content 变更时刷新 embedding(失败仅记录日志,不阻塞笔记更新主流程)
      await this.refreshEmbedding(supabase, note.id, note.content).catch((err) => {
        logger.warn('Notes update: refreshEmbedding failed', { userId, noteId: note.id, error: err });
      });

      // P3: SSE 推送 block_updated(块内容变化时通知前端实时刷新嵌入/引用)
      try {
        const oldContent = oldNote.content;
        const newContent = note.content;
        const oldBlockIds = extractAllBlockIds(oldContent);
        const newBlockIds = extractAllBlockIds(newContent);

        // 检查新旧块内容是否变化
        const allBlockIds = new Set<string>([...oldBlockIds, ...newBlockIds]);
        for (const blockId of allBlockIds) {
          const oldBlock = findBlockContent(oldContent, blockId);
          const newBlock = findBlockContent(newContent, blockId);

          if (oldBlock !== newBlock) {
            // 内容变化(新增/修改/删除),推送 block_updated
            await sseService.sendToUser(userId, {
              type: 'block_updated',
              blockId,
              noteId: note.id,
              newContent: newBlock ?? '',
            });
          }
        }
      } catch (err) {
        logger.warn('Notes update: SSE block_updated push failed', {
          userId,
          noteId: note.id,
          error: err,
        });
      }
    }

    return note;
  }

  /**
   * 软删除笔记。
   * - UPDATE deleted_at
   * - 显式 DELETE note_node_links(软删除不触发 ON DELETE CASCADE)
   * - P3: 显式 DELETE note_block_refs(清理块引用关系,挂载关系不自动恢复)
   * - P3: 推送 block_removed 给引用方(SSE)
   */
  async delete(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    // 校验存在性 + 属主
    await this.get(supabase, userId, id);

    const { error: updateError } = await supabase
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      logger.error('Notes delete: update error', { userId, id, error: updateError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    // 显式清理挂载关系(挂载关系不自动恢复,恢复时由前端提示用户)
    const { error: linkError } = await supabase
      .from('note_node_links')
      .delete()
      .eq('note_id', id);

    if (linkError) {
      logger.warn('Notes delete: cleanup links failed', { userId, id, error: linkError });
    }

    // P3: 清理块引用关系(软删除不触发 ON DELETE CASCADE)
    const { error: refError } = await supabase
      .from('note_block_refs')
      .delete()
      .or(`source_note_id.eq.${id},target_note_id.eq.${id}`);

    if (refError) {
      logger.warn('Notes delete: cleanup block refs failed', { userId, id, error: refError });
    }

    // P3: 推送 block_removed 给当前用户(RLS 限制跨用户,简化为推送给当前用户)
    try {
      await sseService.sendToUser(userId, {
        type: 'block_removed',
        noteId: id,
      });
    } catch (err) {
      logger.warn('Notes delete: SSE block_removed push failed', {
        userId,
        noteId: id,
        error: err,
      });
    }
  }

  /**
   * 恢复软删除的笔记。
   * - 注意:挂载关系不自动恢复,需在返回中提示调用方。
   */
  async restore(supabase: SupabaseClient, userId: string, id: string): Promise<Note> {
    // 校验存在性 + 属主(可查到已软删除的)
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Notes restore: query error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    if (!data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    const existing = mapRowToNote(data as unknown as NoteRow);
    if (existing.deletedAt === null) {
      // 已是正常状态,直接返回(幂等)
      return existing;
    }

    const { data: restored, error: updateError } = await supabase
      .from('notes')
      .update({ deleted_at: null })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Notes restore: update error', { userId, id, error: updateError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    return mapRowToNote(restored as unknown as NoteRow);
  }

  // ============================================================
  // 模板域委托(实现见 notesTemplateService)
  // 保留同级方法名以保证路由/测试调用不变
  // ============================================================

  listTemplates(supabase: SupabaseClient, userId: string): Promise<NoteTemplate[]> {
    return notesTemplateService.listTemplates(supabase, userId);
  }

  createTemplate(
    supabase: SupabaseClient,
    userId: string,
    data: CreateNoteTemplateInput,
  ): Promise<NoteTemplate> {
    return notesTemplateService.createTemplate(supabase, userId, data);
  }

  updateTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<NoteTemplate> {
    return notesTemplateService.updateTemplate(supabase, userId, id, data);
  }

  deleteTemplate(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return notesTemplateService.deleteTemplate(supabase, userId, id);
  }

  setDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<NoteTemplate> {
    return notesTemplateService.setDefaultTemplate(supabase, userId, id);
  }

  // ============================================================
  // Daily Notes 域委托(实现见 notesDailyService)
  // ============================================================

  getOrCreateTodayDaily(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<GetOrCreateDailyResult> {
    return notesDailyService.getOrCreateTodayDaily(supabase, userId);
  }

  renderTemplate(
    templateContent: string,
    dateStr: string,
    aggregation: DailyAggregation,
  ): { title: string; content: string } {
    return notesDailyService.renderTemplate(templateContent, dateStr, aggregation);
  }

  private getDailyAggregation(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<DailyAggregation> {
    return notesDailyService.getDailyAggregation(supabase, userId, dateStr);
  }

  // ============================================================
  // 节点详情"关联笔记"
  // ============================================================

  /**
   * 按节点查关联笔记(JOIN note_node_links)。
   * 用于节点详情侧边栏"关联笔记"区块。
   */
  async getNotesByNodeId(
    supabase: SupabaseClient,
    userId: string,
    nodeId: string,
  ): Promise<Note[]> {
    // 查询挂载到该节点的笔记 ID
    const { data: links, error: linkError } = await supabase
      .from('note_node_links')
      .select('note_id')
      .eq('node_id', nodeId);

    if (linkError) {
      logger.error('getNotesByNodeId: links query error', { userId, nodeId, error: linkError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, nodeId } });
    }

    if (!links || links.length === 0) {
      return [];
    }

    const noteIds = (links as unknown as { note_id: string }[]).map((l) => l.note_id);

    // 查笔记详情(RLS 保证 user_id 隔离 + 排除已软删除)
    const { data: notes, error: notesError } = await notDeleted(supabase
      .from('notes')
      .select('*')
      .in('id', noteIds)
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    );

    if (notesError) {
      logger.error('getNotesByNodeId: notes query error', { userId, nodeId, error: notesError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, nodeId } });
    }

    return (notes ?? []).map((row) => mapRowToNote(row as unknown as NoteRow));
  }

  // ============================================================
  // 挂载关系同步(wiki 链接即挂载)
  // ============================================================

  /**
   * 同步 note_node_links:解析 content 中 [[节点名]],diff 出新增/删除的链接。
   *
   * 解析逻辑:
   * 1. 用 extractWikiLinks 提取期望的节点标题集合(去重)
   * 2. 查 knowledge_points(title IN titles, owner=用户 OR public)
   * 3. 查 graph_nodes(knowledge_point_id IN kp_ids,图谱未软删除)
   *    → 期望的 (note_id, node_id, graph_id) 集合
   * 4. 查现有 note_node_links WHERE note_id = X
   * 5. 删除不再期望的;插入新增的(去重 by node_id)
   *
   * 说明:
   * - 同一节点标题可能存在于多个图谱 → 为每个 graph_node 创建一条 link
   * - (note_id, node_id) 唯一约束由 DB 保证
   * - 失败仅记录日志,不阻塞笔记保存主流程
   */
  async syncNodeLinks(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
    content: string,
  ): Promise<void> {
    try {
      // 1. 解析期望的节点标题
      const desiredTitles = extractWikiLinks(content);

      // 期望的挂载关系:node_id → graph_id
      const desiredLinks = new Map<string, string>();

      if (desiredTitles.length > 0) {
        // 2. 查匹配的 knowledge_points(owner=用户 OR public)
        const { data: kps, error: kpError } = await supabase
          .from('knowledge_points')
          .select('id, title')
          .in('title', desiredTitles)
          .or(`owner_id.eq.${userId},visibility.eq.public`);

        if (kpError) {
          logger.warn('syncNodeLinks: query knowledge_points error', { userId, noteId, error: kpError });
          return;
        }

        const kpRows = (kps ?? []) as unknown as KnowledgePointRow[];
        const kpIds = kpRows.map((k) => k.id);

        if (kpIds.length > 0) {
          // 3. 查 graph_nodes(JOIN knowledge_graphs 排除已软删除图谱)
          const { data: graphNodes, error: gnError } = await notDeleted(supabase
            .from('graph_nodes')
            .select(`
              id,
              knowledge_point_id,
              graph_id,
              graph:knowledge_graphs!graph_id(deleted_at)
            `)
            .in('knowledge_point_id', kpIds)
          );

          if (gnError) {
            logger.warn('syncNodeLinks: query graph_nodes error', { userId, noteId, error: gnError });
            return;
          }

          for (const gn of (graphNodes ?? []) as unknown as GraphNodeRow[]) {
            if (!gn.graph || gn.graph.deleted_at !== null) continue;
            desiredLinks.set(gn.id, gn.graph_id);
          }
        }
      }

      // 4. 查现有挂载关系
      const { data: existing, error: existError } = await supabase
        .from('note_node_links')
        .select('id, node_id')
        .eq('note_id', noteId);

      if (existError) {
        logger.warn('syncNodeLinks: query existing links error', { userId, noteId, error: existError });
        return;
      }

      const existingMap = new Map<string, string>(); // node_id → link_id
      for (const link of (existing ?? []) as unknown as NoteNodeLinkRow[]) {
        existingMap.set(link.node_id, link.id);
      }

      // 5. 计算差异
      const toDelete: string[] = [];
      for (const [nodeId, linkId] of existingMap) {
        if (!desiredLinks.has(nodeId)) {
          toDelete.push(linkId);
        }
      }

      const toInsert: { note_id: string; node_id: string; graph_id: string }[] = [];
      for (const [nodeId, graphId] of desiredLinks) {
        if (!existingMap.has(nodeId)) {
          toInsert.push({ note_id: noteId, node_id: nodeId, graph_id: graphId });
        }
      }

      // 6. 执行删除
      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('note_node_links')
          .delete()
          .in('id', toDelete);

        if (delError) {
          logger.warn('syncNodeLinks: delete links error', { userId, noteId, count: toDelete.length, error: delError });
        }
      }

      // 7. 执行插入
      if (toInsert.length > 0) {
        const { error: insError } = await supabase
          .from('note_node_links')
          .insert(toInsert);

        if (insError) {
          // 唯一约束冲突(并发场景)忽略,其余记录
          if (insError.code !== '23505') {
            logger.warn('syncNodeLinks: insert links error', { userId, noteId, count: toInsert.length, error: insError });
          }
        }
      }
    } catch (err) {
      logger.warn('syncNodeLinks: unexpected error', { userId, noteId, error: err });
    }
  }

  // ============================================================
  // Embedding 刷新 (P1: 笔记内容参与语义检索)
  // ============================================================

  /**
   * 刷新笔记 embedding: 调用 embeddingOps 生成向量并 UPSERT 到 note_embeddings 表。
   *
   * 设计:
   * - 单笔记单 embedding (note_embeddings.note_id UNIQUE), UPSERT 简单
   * - chunk_text 截断到 CHUNK_TEXT_MAX_LENGTH 字符, 作为检索结果摘要
   * - embedding provider 未配置或生成失败时仅记日志, 不抛错 (容错, 参考 syncNodeLinks 风格)
   * - 由 create() / update() 在 content 变更后异步调用
   *
   * 失败场景:
   * - embedding provider 未配置 → logger.warn, 返回
   * - generateEmbedding 返回 null → logger.warn, 返回
   * - UPSERT 失败 → logger.warn, 返回 (不阻塞主流程)
   */
  private async refreshEmbedding(
    supabase: SupabaseClient,
    noteId: string,
    content: string,
  ): Promise<void> {
    try {
      // 空内容不生成 embedding (避免无意义开销)
      if (!content || content.trim().length === 0) {
        return;
      }

      const embedding = await embeddingOps.generateEmbedding(content);

      if (!embedding || embedding.length === 0) {
        logger.warn('refreshEmbedding: generateEmbedding returned null', {
          noteId,
          contentLength: content.length,
        });
        return;
      }

      // chunk_text 截断到最大长度, 用于检索结果摘要展示
      const chunkText = content.slice(0, CHUNK_TEXT_MAX_LENGTH);

      const { error: upsertError } = await supabase
        .from('note_embeddings')
        .upsert(
          {
            note_id: noteId,
            embedding,
            chunk_text: chunkText,
          },
          { onConflict: 'note_id' },
        );

      if (upsertError) {
        logger.warn('refreshEmbedding: upsert error', { noteId, error: upsertError });
      }
    } catch (err) {
      logger.warn('refreshEmbedding: unexpected error', { noteId, error: err });
    }
  }

  // ============================================================
  // P1 Task 3: AI 辅助 - 当日学习总结 / 反向建图
  // ============================================================

  /**
   * 生成当日学习总结。
   *
   * 流程:
   * 1. 校验笔记存在 + 属于该用户 + type='daily'
   * 2. 聚合当日数据(复习卡数 / 完成任务数 / 专注时长,复用 getDailyAggregation)
   * 3. 额外查询今日复习的卡片内容(question/answer,截断前若干条)
   * 4. 额外查询今日完成的任务列表(标题)
   * 5. 渲染 prompt(notes_daily_summary)并调用 AI
   * 6. 记录 performanceMonitor
   *
   * 失败处理: AI 调用失败抛 AppError(AI_TIMEOUT / AI_PROVIDER_ERROR),并记 performanceMonitor success=false
   */
  async generateDailySummary(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<GenerateDailySummaryResponse> {
    const startTime = Date.now();

    // 1. 校验笔记存在 + 属主 + type='daily'
    const note = await this.get(supabase, userId, noteId);
    if (note.type !== 'daily') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: i18next.t("notes.api.errors.dailyOnly"),
        context: { userId, noteId, type: note.type },
      });
    }

    // 使用笔记的 date 作为聚合日期(daily 笔记必有 date);无则回退到今日
    const dateStr = note.date ?? getLocalDateString();

    // 2. 聚合当日基础数据(复习卡数 / 完成任务数 / 专注时长)
    const aggregation = await this.getDailyAggregation(supabase, userId, dateStr);

    // 3. 查今日复习的卡片内容(用于 prompt 上下文)
    const cardContents = await this.getTodayReviewedCardContents(supabase, userId, dateStr);

    // 4. 查今日完成的任务列表
    const completedTasksList = await this.getTodayCompletedTasksList(
      supabase,
      userId,
      dateStr,
    );

    // 5. 获取 AI provider(未配置抛 AI_PROVIDER_NOT_CONFIGURED)
    const provider = await getAIProviderForTask('text');
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, {
        context: { userId, noteId },
      });
    }

    try {
      // 6. 渲染 prompt(从 prompt_templates 表读取,支持三层覆盖)
      const prompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        'notes_daily_summary',
        {
          date: dateStr,
          today_reviewed_cards: aggregation.reviewedCards,
          today_completed_tasks: aggregation.completedTasks,
          today_focus_time: aggregation.focusTimeMinutes,
          today_reviewed_card_contents: cardContents,
          today_completed_tasks_list: completedTasksList,
        },
        userId,
      );

      // 7. 调用 AI(带超时 + 重试)
      const completion = await withTimeoutAndRetry(
        () =>
          provider.client.chat.completions.create({
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: i18next.t("notes.api.prompts.generateDailySummary") },
            ],
            model: provider.model,
          }),
        {
          timeout: DEFAULT_TIMEOUT,
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(
              `generateDailySummary retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

      const summary = completion.choices[0]?.message?.content ?? '';
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        inputTokens,
        outputTokens,
      );

      // 8. 记录性能监控
      await performanceMonitor.recordLog({
        operation: 'notes_daily_summary',
        provider: provider.providerType,
        model: provider.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        duration: Date.now() - startTime,
        success: true,
        metadata: { userId },
      });

      return { summary, tokensUsed: totalTokens };
    } catch (error) {
      // 记录失败
      await performanceMonitor.recordLog({
        operation: 'notes_daily_summary',
        provider: provider.providerType,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { userId },
      });

      if (error instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT, { context: { userId, noteId } });
      }
      if (error instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${error.attempts} 次: ${error.lastError.message}`,
          context: { userId, noteId },
        });
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message:
          error instanceof Error ? error.message : i18next.t("notes.api.errors.aiSummaryFailed"),
        context: { userId, noteId },
      });
    }
  }

  /**
   * 从笔记正文提取候选知识点(用于反向建图)。
   *
   * 流程:
   * 1. 校验笔记存在 + 属主
   * 2. 渲染 prompt(notes_extract_concepts)要求 AI 返回 JSON
   * 3. 调用 AI(response_format: json_object)
   * 4. JSON 解析容错:AI 可能返回 markdown code fence,strip 后再 parse;
   *    解析失败返回空 concepts 数组 + logger.warn(不抛错)
   * 5. 记录 performanceMonitor
   */
  async extractConcepts(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<ExtractConceptsResponse> {
    const startTime = Date.now();

    // 1. 校验笔记存在 + 属主
    const note = await this.get(supabase, userId, noteId);

    // 空内容直接返回空数组(避免无意义 AI 调用)
    if (!note.content || note.content.trim().length === 0) {
      return { concepts: [] };
    }

    // 2. 获取 AI provider
    const provider = await getAIProviderForTask('text');
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, {
        context: { userId, noteId },
      });
    }

    try {
      // 3. 渲染 prompt
      const prompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        'notes_extract_concepts',
        { content: note.content },
        userId,
      );

      // 4. 调用 AI(要求 JSON 输出)
      const completion = await withTimeoutAndRetry(
        () =>
          provider.client.chat.completions.create({
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: i18next.t("notes.api.prompts.extractKnowledgePoints") },
            ],
            model: provider.model,
            response_format: { type: 'json_object' },
          }),
        {
          timeout: DEFAULT_TIMEOUT,
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(
              `extractConcepts retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

      const content = completion.choices[0]?.message?.content ?? '';
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        inputTokens,
        outputTokens,
      );

      // 5. JSON 解析容错(parseAIResponse 会 strip code fence + regex 兜底,
      //    失败会 throw,这里捕获后返回空数组,不阻塞调用方)
      let concepts: NoteExtractedConcept[] = [];
      try {
        const parsed = parseAIResponse<{ concepts?: unknown[] }>(
          content,
          'notes_extract_concepts',
        );
        if (Array.isArray(parsed.concepts)) {
          concepts = parsed.concepts
            .filter(
              (c): c is Record<string, unknown> =>
                typeof c === 'object' && c !== null,
            )
            .map((c) => ({
              name: typeof c.name === 'string' ? c.name : '',
              description: typeof c.description === 'string' ? c.description : '',
              related: Array.isArray(c.related)
                ? c.related.filter(
                    (r): r is string => typeof r === 'string',
                  )
                : [],
            }))
            .filter((c) => c.name.length > 0);
        }
      } catch (parseError) {
        logger.warn(
          'extractConcepts: JSON parse failed, returning empty concepts',
          {
            userId,
            noteId,
            error:
              parseError instanceof Error ? parseError.message : String(parseError),
            rawContentPreview: content.slice(0, 200),
          },
        );
        // 不抛错,返回空数组(已在上方初始化)
      }

      // 6. 记录性能监控
      await performanceMonitor.recordLog({
        operation: 'notes_extract_concepts',
        provider: provider.providerType,
        model: provider.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        duration: Date.now() - startTime,
        success: true,
        metadata: { userId },
      });

      return { concepts };
    } catch (error) {
      // 记录失败
      await performanceMonitor.recordLog({
        operation: 'notes_extract_concepts',
        provider: provider.providerType,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { userId },
      });

      if (error instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT, { context: { userId, noteId } });
      }
      if (error instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${error.attempts} 次: ${error.lastError.message}`,
          context: { userId, noteId },
        });
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: error instanceof Error ? error.message : 'AI 提取知识点失败',
        context: { userId, noteId },
      });
    }
  }

  /**
   * 反向建图:根据用户确认的知识点列表,在目标图谱创建节点并挂载到本笔记。
   *
   * 流程:
   * 1. 校验笔记存在 + 属主
   * 2. 校验 graphId 属于该用户
   * 3. 对 selectedConcepts 中每个 concept:
   *    - 创建 knowledge_point(title=name, content=description)
   *    - 创建 graph_node(graph_id=request.graphId, knowledge_point_id=新 kp id)
   *    - 创建 note_node_links(note_id=noteId, node_id=新 graph_node.id, graph_id=request.graphId)
   *    - 记录 CreatedNodeResult{conceptName, nodeId, success}
   *    - 单个失败不阻塞其他(success=false + error message)
   * 4. 返回 { results: CreatedNodeResult[] }
   *
   * 注意:不在笔记正文中插入 [[新节点名]](spec 标注"可选"),保持简单。
   */
  async createNodesFromConcepts(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
    request: CreateNodesFromConceptsRequest,
  ): Promise<CreateNodesFromConceptsResponse> {
    // 1. 校验笔记存在 + 属主
    await this.get(supabase, userId, noteId);

    // 2. 校验 graphId 属于该用户
    const { data: graph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id')
      .eq('id', request.graphId)
      .maybeSingle();

    if (graphError) {
      logger.error('createNodesFromConcepts: graph query error', {
        userId,
        graphId: request.graphId,
        error: graphError,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, graphId: request.graphId },
      });
    }

    if (!graph) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND, {
        context: { userId, graphId: request.graphId },
      });
    }

    // RLS 已保证只能查到自己的图谱,再显式校验一次(防御性)
    const graphRow = graph as unknown as { id: string; user_id: string };
    if (graphRow.user_id !== userId) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND, {
        context: { userId, graphId: request.graphId },
      });
    }

    // 3. 逐个创建知识点 + 节点 + 挂载关系(单个失败不阻塞其他)
    const results: CreatedNodeResult[] = [];

    for (const concept of request.selectedConcepts) {
      try {
        // 创建 knowledge_point(复用 knowledgePointService)
        const kp = await knowledgePointService.create(supabase, {
          title: concept.name,
          content: concept.description,
          owner_id: userId,
        });

        // 创建 graph_node(复用 graphNodeService.addToGraph)
        const graphNode = await graphNodeService.addToGraph(supabase, {
          graph_id: request.graphId,
          knowledge_point_id: kp.id,
        });

        // 创建 note_node_links(新节点 ↔ 本笔记)
        const { error: linkError } = await supabase
          .from('note_node_links')
          .insert({
            note_id: noteId,
            node_id: graphNode.id,
            graph_id: request.graphId,
          });

        if (linkError) {
          // 唯一约束冲突(note_id, node_id 已存在)忽略,其余记录日志
          if (linkError.code !== '23505') {
            logger.warn('createNodesFromConcepts: link insert error', {
              userId,
              noteId,
              nodeId: graphNode.id,
              conceptName: concept.name,
              error: linkError,
            });
          }
        }

        results.push({
          conceptName: concept.name,
          nodeId: graphNode.id,
          success: true,
        });
      } catch (error) {
        // 单个失败不阻塞其他概念创建
        logger.warn('createNodesFromConcepts: concept creation failed', {
          userId,
          noteId,
          conceptName: concept.name,
          error:
            error instanceof Error ? error.message : String(error),
        });
        results.push({
          conceptName: concept.name,
          nodeId: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { results };
  }

  // ============================================================
  // 捕获 AI 自动归档（捕获箱 → 图谱）
  // ============================================================

  /**
   * 单条捕获 AI 自动归档。
   *
   * 复用 P1 已有链路：
   * 1. 提取知识点（extractConcepts）
   * 2. 自动挑选前 N 个（去空名，不超过 maxConcepts）
   * 3. 在目标图谱创建节点并挂载到本笔记（createNodesFromConcepts）
   * 4. 移除捕获箱 tag；无知识点时仅清除捕获箱标记（不再视为未处理捕获）
   *
   * 失败处理：AI 提取失败抛出底层 AppError（由路由层决定是否终止）；创建节点失败不阻塞本方法。
   */
  async autoArchive(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
    request: AutoArchiveRequest,
  ): Promise<AutoArchiveResult> {
    const note = await this.get(supabase, userId, noteId);
    const maxConcepts = Math.max(
      1,
      Math.min(
        request.maxConcepts ?? CAPTURE_DEFAULT_MAX_CONCEPTS,
        CAPTURE_MAX_CONCEPTS_LIMIT,
      ),
    );

    // 1. 提取知识点（空内容返回空数组，这里统一处理）
    const { concepts } = await this.extractConcepts(supabase, userId, noteId);
    const selected = concepts
      .filter((c) => c.name.trim().length > 0)
      .slice(0, maxConcepts);

    // 2. 有知识点则落库建图
    let createdNodes: CreatedNodeResult[] = [];
    let created = false;
    if (selected.length > 0) {
      const { results } = await this.createNodesFromConcepts(supabase, userId, noteId, {
        graphId: request.graphId,
        selectedConcepts: selected,
      });
      createdNodes = results;
      created = true;
    }

    // 3. 移除捕获箱 tag，并把已建概念名并入 tag（去重）
    const baseTags = (note.tags ?? []).filter(
      (tag) => tag.toLowerCase() !== CAPTURE_INBOX_TAG.toLowerCase(),
    );
    const conceptTags = createdNodes
      .filter((r) => r.success && r.conceptName.trim().length > 0)
      .map((r) => r.conceptName.trim());
    const mergedTags = Array.from(
      new Set([...baseTags, ...conceptTags].map((tag) => tag.trim()).filter(Boolean)),
    );
    await this.update(supabase, userId, noteId, { tags: mergedTags });

    const nodeCount = createdNodes.filter((r) => r.success).length;
    return { noteId, title: note.title, createdNodes, nodeCount, created };
  }

  /**
   * 批量 AI 自动归档。逐条复用 autoArchive，单条失败不阻塞其他条。
   */
  async batchAutoArchive(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    noteIds: string[],
  ): Promise<BatchArchiveResult> {
    const results: AutoArchiveResult[] = [];
    let archivedCount = 0;
    let failedCount = 0;

    for (const noteId of noteIds) {
      try {
        const result = await this.autoArchive(supabase, userId, noteId, { graphId });
        results.push(result);
        archivedCount += 1;
      } catch (error) {
        failedCount += 1;
        logger.warn('batchAutoArchive: item failed', {
          userId,
          noteId,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          noteId,
          title: '',
          createdNodes: [],
          nodeCount: 0,
          created: false,
        });
      }
    }

    return { results, archivedCount, failedCount };
  }

  // ============================================================
  // P2 Task 3: 写作辅助 / Daily 聚合刷新
  // ============================================================

  /**
   * 写作辅助(continue / rewrite / expand)。
   *
   * 流程:
   * 1. 校验笔记存在 + 属主(复用 this.get)
   * 2. 渲染 prompt(notes_writing_${action},含 selectedText / contextBefore / contextAfter)
   * 3. 调用 AI(单一 system + user 消息)
   * 4. 记录 performanceMonitor(token 用量与时长)
   * 5. 返回 { suggestion, tokensUsed }
   *
   * 失败处理: AI 调用失败抛 AppError(AI_TIMEOUT / AI_PROVIDER_ERROR),并记 performanceMonitor success=false
   */
  async writingAssist(
    supabase: SupabaseClient,
    userId: string,
    req: WritingAssistRequest,
  ): Promise<WritingAssistResponse> {
    const startTime = Date.now();

    // 1. 校验笔记存在 + 属主(跨用户由 RLS 拦截,返回 NOT_FOUND)
    await this.get(supabase, userId, req.noteId);

    // 2. 获取 AI provider(未配置抛 AI_PROVIDER_NOT_CONFIGURED)
    const provider = await getAIProviderForTask('text');
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, {
        context: { userId, noteId: req.noteId },
      });
    }

    try {
      // 3. 渲染 prompt(根据 action 选择 notes_writing_continue / rewrite / expand)
      const prompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        `notes_writing_${req.action}`,
        {
          selectedText: req.selectedText,
          contextBefore: req.contextBefore ?? '',
          contextAfter: req.contextAfter ?? '',
        },
        userId,
      );

      // 4. 调用 AI(单一 system + user 消息,带超时 + 重试)
      const completion = await withTimeoutAndRetry(
        () =>
          provider.client.chat.completions.create({
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: req.selectedText },
            ],
            model: provider.model,
          }),
        {
          timeout: DEFAULT_TIMEOUT,
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(
              `writingAssist retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

      const suggestion = completion.choices[0]?.message?.content ?? '';
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        inputTokens,
        outputTokens,
      );

      // 5. 记录性能监控
      await performanceMonitor.recordLog({
        operation: `notes_writing_${req.action}`,
        provider: provider.providerType,
        model: provider.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        duration: Date.now() - startTime,
        success: true,
        metadata: { userId, noteId: req.noteId, action: req.action },
      });

      return { suggestion, tokensUsed: totalTokens };
    } catch (error) {
      // 记录失败
      await performanceMonitor.recordLog({
        operation: `notes_writing_${req.action}`,
        provider: provider.providerType,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { userId, noteId: req.noteId, action: req.action },
      });

      if (error instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT, { context: { userId, noteId: req.noteId } });
      }
      if (error instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${error.attempts} 次: ${error.lastError.message}`,
          context: { userId, noteId: req.noteId },
        });
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: error instanceof Error ? error.message : 'AI 写作辅助失败',
        context: { userId, noteId: req.noteId },
      });
    }
  }

  /**
   * 刷新 Daily 笔记的"今日数据"段。
   *
   * 流程:
   * 1. 校验笔记存在 + 属主 + type='daily'(否则抛 VALIDATION_ERROR "笔记不是 Daily 类型")
   * 2. 调用 getDailyAggregation 获取最新统计(复习卡数 / 完成任务数 / 专注时长)
   * 3. 渲染 ## 今日数据 段 Markdown(与系统默认模板格式一致)
   * 4. 用正则定位正文中的"今日数据"段并整段替换;未匹配时在顶部追加
   * 5. 调用 this.update 落盘
   * 6. 返回 { note: updatedNote, refreshed: true }
   */
  async refreshDailyAggregation(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<RefreshDailyAggregationResponse> {
    // 1. 校验笔记存在 + 属主 + type='daily'
    const note = await this.get(supabase, userId, noteId);
    if (note.type !== 'daily') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: i18next.t("notes.api.errors.noteNotDaily"),
        context: { userId, noteId, type: note.type },
      });
    }

    // 2. 获取最新聚合数据(daily 笔记必有 date;无则回退到今日)
    const dateStr = note.date ?? getLocalDateString();
    const aggregation = await this.getDailyAggregation(supabase, userId, dateStr);

    // 3. 渲染 ## 今日数据 段(与系统默认模板格式一致)
    const newSection =
      `## 今日数据\n` +
      `- 复习卡片: ${aggregation.reviewedCards}\n` +
      `- 完成任务: ${aggregation.completedTasks}\n` +
      `- 专注时长: ${aggregation.focusTimeMinutes}\n`;

    // 4. 按行分段替换正文中的"今日数据"段;未匹配时在顶部追加
    //    旧实现用正则 /^## 今日数据$\n(?:.*\n)*?(?=^## |\n$|$)/m,在以下场景会失败导致数据残留/重复:
    //    - \r\n 换行: $\n 不匹配 \r\n
    //    - 标题尾部空格(## 今日数据 ): ^## 今日数据$ 不匹配
    //    - 段在文档末尾无末尾 \n: (?:.*\n) 要求每行以 \n 结尾,最后一行无法匹配
    //    - 多次连续刷新: 部分场景下非贪婪只匹配标题行,数据行残留后下次刷新再追加,数据重复
    //    改为按行分段: 找到 ## 今日数据 行(用 trim 容忍尾部空格),向后遍历到下一个 ## 标题或文档末尾,
    //    整段替换为 newSection。同时容忍 \r\n(统一转为 \n 处理)。
    const normalizedContent = note.content.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    const sectionHeader = '## 今日数据';
    const headerIdx = lines.findIndex((line) => line.trim() === sectionHeader);

    let content: string;
    if (headerIdx === -1) {
      // 未找到段,在文档顶部追加(newSection 末尾已有 \n,再加一个 \n 形成空行分隔)
      content = `${newSection}\n${note.content}`;
    } else {
      // 找到段,向后遍历直到下一个 ## 标题(trimStart 容忍前导空格)或文档末尾
      let endIdx = headerIdx + 1;
      while (
        endIdx < lines.length &&
        !lines[endIdx].trimStart().startsWith('## ')
      ) {
        endIdx++;
      }
      const before = lines.slice(0, headerIdx);
      const after = lines.slice(endIdx);
      // newSection 末尾的 \n 在 split 后产生末尾空字符串元素,过滤最后一个空元素避免双空行
      const newSectionLines = newSection
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line, i, arr) => !(line === '' && i === arr.length - 1));
      const newLines = [...before, ...newSectionLines, ...after];
      content = newLines.join('\n');
    }

    // 5. 落盘(复用 update,会自动 syncNodeLinks + refreshEmbedding)
    const updatedNote = await this.update(supabase, userId, noteId, { content });

    return { note: updatedNote, refreshed: true };
  }

  // ============================================================
  // generateDailySummary 辅助查询
  // ============================================================

  /**
   * 查今日复习的卡片内容(question/answer,截断前若干条)。
   * 用于 generateDailySummary 的 prompt 上下文。
   * 查询失败回退为空字符串(不阻塞总结生成)。
   */
  private async getTodayReviewedCardContents(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<string> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { data, error } = await supabase
      .from('study_cards')
      .select('question, answer, card_type')
      .eq('user_id', userId)
      .gte('last_reviewed', startIso)
      .lt('last_reviewed', endIso)
      .order('last_reviewed', { ascending: false })
      .limit(10);

    if (error) {
      logger.warn('getTodayReviewedCardContents: query error, fallback to empty', {
        userId,
        dateStr,
        error,
      });
      return '';
    }

    if (!data || data.length === 0) {
      return i18next.t("notes.api.defaults.noReviewRecords");
    }

    const rows = data as unknown as Array<{
      question: string;
      answer: string;
      card_type: string;
    }>;
    return rows
      .map(
        (card, i) =>
          `${i + 1}. [${card.card_type}] Q: ${card.question}\n   A: ${card.answer}`,
      )
      .join('\n');
  }

  /**
   * 查今日完成的任务列表(标题)。
   * 数据来源:task_executions JOIN user_tasks(status='completed' 且 ended_at/started_at 今日)。
   * 查询失败回退为空字符串(不阻塞总结生成)。
   */
  private async getTodayCompletedTasksList(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<string> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { data, error } = await supabase
      .from('task_executions')
      .select('task_id, status, ended_at, started_at, user_tasks!inner(title)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .or(
        `and(ended_at.gte.${startIso},ended_at.lt.${endIso}),and(ended_at.is.null,started_at.gte.${startIso},started_at.lt.${endIso})`,
      )
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.warn('getTodayCompletedTasksList: query error, fallback to empty', {
        userId,
        dateStr,
        error,
      });
      return '';
    }

    if (!data || data.length === 0) {
      return i18next.t("notes.api.defaults.noCompletedTasks");
    }

    // user_tasks 是 many-to-one join,结果为对象(非数组)
    const rows = data as unknown as Array<{
      task_id: string;
      user_tasks: { title: string } | { title: string }[];
    }>;
    return rows
      .map((row, i) => {
        const title = Array.isArray(row.user_tasks)
          ? row.user_tasks[0]?.title
          : row.user_tasks?.title;
        return `${i + 1}. ${title ?? i18next.t("notes.api.defaults.unnamedTask")}`;
      })
      .join('\n');
  }
}

export const notesService = new NotesService();