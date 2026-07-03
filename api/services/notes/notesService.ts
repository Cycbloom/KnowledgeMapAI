import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Note,
  NoteTemplate,
  NoteType,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListParams,
  NoteListFilters,
  GenerateDailySummaryResponse,
  ExtractConceptsResponse,
  NoteExtractedConcept,
  CreateNodesFromConceptsRequest,
  CreateNodesFromConceptsResponse,
  CreatedNodeResult,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
} from '@shared/types/note';
import { extractWikiLinks } from '@shared/utils/wikiLink';
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
} from '../../../shared/utils/retry';
import { logger } from '../../utils/logger';
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

/**
 * notes 表 DB 行(snake_case,来自数据库)
 * 与 Note(camelCase)之间的转换由 mapRowToNote 完成
 */
interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: NoteType;
  date: string | null;
  template_id: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface NoteTemplateRow {
  id: string;
  user_id: string | null;
  name: string;
  content: string;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

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

/** Daily 模板渲染所需聚合数据(当日静态快照) */
interface DailyAggregation {
  reviewedCards: number;
  completedTasks: number;
  focusTimeMinutes: number;
}

/** 列表查询返回(含分页元信息) */
export interface NoteListResult {
  items: Note[];
  total: number;
  page: number;
  pageSize: number;
}

/** Daily 自动创建返回 */
export interface GetOrCreateDailyResult {
  note: Note;
  created: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * chunk_text 截断长度:笔记正文快照用于检索结果摘要展示,
 * 截断到 2000 字符(避免过大存储,同时保留足够上下文)。
 */
const CHUNK_TEXT_MAX_LENGTH = 2000;

/**
 * 将数据库行(snake_case)映射为 Note 类型(camelCase)。
 * 字段映射与 shared/types/note.ts 的 Note 接口对齐。
 */
const mapRowToNote = (row: NoteRow): Note => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  content: row.content,
  type: row.type,
  date: row.date,
  templateId: row.template_id,
  tags: row.tags,
  isPinned: row.is_pinned,
  isArchived: row.is_archived,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const mapRowToTemplate = (row: NoteTemplateRow): NoteTemplate => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  content: row.content,
  isDefault: row.is_default,
  isSystem: row.is_system,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * 获取本时区当日的 YYYY-MM-DD 字符串。
 * 使用服务器本地日期(项目部署在用户时区 Asia/Shanghai)。
 */
const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 将 Date 转为本地时区的当日 00:00:00 ISO 字符串(用于范围查询起点)。
 */
const getDayStartIso = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  return start.toISOString();
};

/**
 * 获取次日 00:00:00 ISO 字符串(范围查询上限,开区间)。
 */
const getNextDayStartIso = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return next.toISOString();
};

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

    // 异步刷新 embedding(失败仅记录日志,不阻塞笔记创建主流程)
    // 说明: refreshEmbedding 在 SubTask 1.3 实现,见类末尾
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
    await this.get(supabase, userId, id);

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

      // content 变更时刷新 embedding(失败仅记录日志,不阻塞笔记更新主流程)
      // 说明: refreshEmbedding 在 SubTask 1.3 实现,见类末尾
      await this.refreshEmbedding(supabase, note.id, note.content).catch((err) => {
        logger.warn('Notes update: refreshEmbedding failed', { userId, noteId: note.id, error: err });
      });
    }

    return note;
  }

  /**
   * 软删除笔记。
   * - UPDATE deleted_at
   * - 显式 DELETE note_node_links(软删除不触发 ON DELETE CASCADE)
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
  // Daily Notes 自动创建
  // ============================================================

  /**
   * 获取或创建今日 Daily Note。
   * - 今日已存在则直接返回(created=false)
   * - 不存在则查询用户默认模板(无则系统模板),渲染聚合变量后创建
   */
  async getOrCreateTodayDaily(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<GetOrCreateDailyResult> {
    const today = getLocalDateString();

    // 1. 查今日 daily 是否存在(未软删除)
    const { data: existing, error: existError } = await notDeleted(supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'daily')
      .eq('date', today)
    ).maybeSingle();

    if (existError) {
      logger.error('getOrCreateTodayDaily: query existing error', { userId, today, error: existError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, today } });
    }

    if (existing) {
      return {
        note: mapRowToNote(existing as unknown as NoteRow),
        created: false,
      };
    }

    // 2. 查用户默认模板,无则用系统模板
    const template = await this.getDefaultTemplate(supabase, userId);

    // 3. 渲染模板(聚合变量替换为当日静态快照)
    const aggregation = await this.getDailyAggregation(supabase, userId, today);
    const { title, content } = this.renderTemplate(template.content, today, aggregation);

    // 4. 插入 notes 表
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      title,
      content,
      type: 'daily',
      date: today,
      template_id: template.id,
      tags: [],
      is_pinned: false,
      is_archived: false,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('notes')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertError) {
      // 并发情况下另一请求可能已创建,再次查询返回已有
      if (insertError.code === '23505') {
        const { data: retry } = await notDeleted(supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'daily')
          .eq('date', today)
        ).maybeSingle();
        if (retry) {
          return {
            note: mapRowToNote(retry as unknown as NoteRow),
            created: false,
          };
        }
        throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
          context: { userId, today },
        });
      }
      logger.error('getOrCreateTodayDaily: insert error', { userId, today, error: insertError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, today } });
    }

    return {
      note: mapRowToNote(inserted as unknown as NoteRow),
      created: true,
    };
  }

  /**
   * 获取用户默认模板(自定义默认优先,无则系统默认模板)。
   * RLS 保证用户只能查到自己的 + 系统的。
   */
  private async getDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<NoteTemplate> {
    // 1. 用户自定义默认模板
    const { data: userDefault, error: userErr } = await supabase
      .from('note_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (userErr) {
      logger.error('getDefaultTemplate: user default query error', { userId, error: userErr });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    if (userDefault) {
      return mapRowToTemplate(userDefault as unknown as NoteTemplateRow);
    }

    // 2. 系统默认模板(is_system=true,由 seed 注入)
    const { data: sysTemplate, error: sysErr } = await supabase
      .from('note_templates')
      .select('*')
      .eq('is_system', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (sysErr) {
      logger.error('getDefaultTemplate: system template query error', { userId, error: sysErr });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    if (!sysTemplate) {
      // 兜底:数据库未 seed 系统模板时使用硬编码三段式(仅此一处例外,保证可用)
      return {
        id: '',
        userId: null,
        name: '系统默认 - 三段式学习日志',
        content:
          '# {{date}} 学习日志\n\n## 今日数据\n- 复习卡片: {{today_reviewed_cards}}\n- 完成任务: {{today_completed_tasks}}\n- 专注时长: {{today_focus_time}}\n\n## 今日学习\n\n## 今日复习\n\n## 今日反思\n',
        isDefault: false,
        isSystem: true,
        createdAt: '',
        updatedAt: '',
      };
    }

    return mapRowToTemplate(sysTemplate as unknown as NoteTemplateRow);
  }

  /**
   * 渲染模板:替换 {{date}}、{{today_reviewed_cards}}、{{today_completed_tasks}}、{{today_focus_time}} 为静态快照值。
   * 聚合数据写入正文后不再变化(便于历史追溯)。
   */
  renderTemplate(
    templateContent: string,
    dateStr: string,
    aggregation: DailyAggregation,
  ): { title: string; content: string } {
    let content = templateContent
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{today_reviewed_cards\}\}/g, String(aggregation.reviewedCards))
      .replace(/\{\{today_completed_tasks\}\}/g, String(aggregation.completedTasks))
      .replace(/\{\{today_focus_time\}\}/g, String(aggregation.focusTimeMinutes));

    // 从首行 H1 提取标题,无则用 "${date} 学习日志"
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `${dateStr} 学习日志`;

    return { title, content };
  }

  /**
   * 获取 Daily 模板渲染所需的当日聚合数据(只读快照)。
   * 各来源查询相互独立,单个失败不影响其他(记 0)。
   */
  private async getDailyAggregation(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<DailyAggregation> {
    const [reviewedCards, completedTasks, focusTimeMinutes] = await Promise.all([
      this.getTodayReviewedCardsCount(supabase, userId, dateStr),
      this.getTodayCompletedTasksCount(supabase, userId, dateStr),
      this.getTodayFocusTimeMinutes(supabase, userId, dateStr),
    ]);

    return { reviewedCards, completedTasks, focusTimeMinutes };
  }

  /**
   * 查今日复习卡数。
   *
   * 数据来源:study_cards 表(study_progress 表仅记录每图谱的进度汇总,
   * 不含每日复习事件)。study_cards.last_reviewed 表示最近一次复习时间,
   * 据此过滤"今日复习"的卡片。
   */
  private async getTodayReviewedCardsCount(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { count, error } = await supabase
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('last_reviewed', startIso)
      .lt('last_reviewed', endIso);

    if (error) {
      logger.warn('getTodayReviewedCardsCount: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 查今日完成任务数。
   *
   * 数据来源:task_executions 表(user_id + status='completed' + ended_at 今日)。
   * ended_at 为可空字段,status='completed' 时应当已设置,失败时回退到 started_at。
   */
  private async getTodayCompletedTasksCount(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    // 优先按 ended_at 过滤;ended_at 为空时回退到 started_at
    const { count, error } = await supabase
      .from('task_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .or(`and(ended_at.gte.${startIso},ended_at.lt.${endIso}),and(ended_at.is.null,started_at.gte.${startIso},started_at.lt.${endIso})`);

    if (error) {
      logger.warn('getTodayCompletedTasksCount: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 查今日专注时长(分钟)。
   *
   * 数据来源:focus_sessions 表(user_id + mode='focus' + started_at 今日)。
   * duration 字段单位为秒,累加后转换为分钟(向下取整)。
   */
  private async getTodayFocusTimeMinutes(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { data, error } = await supabase
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('mode', 'focus')
      .gte('started_at', startIso)
      .lt('started_at', endIso);

    if (error) {
      logger.warn('getTodayFocusTimeMinutes: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    const totalSeconds = (data ?? []).reduce(
      (sum, row: { duration: number | null }) => sum + (row.duration ?? 0),
      0,
    );
    return Math.floor(totalSeconds / 60);
  }

  // ============================================================
  // 模板查询
  // ============================================================

  /**
   * 查询用户可见模板(own OR is_system)。RLS 自动过滤。
   */
  async listTemplates(supabase: SupabaseClient, _userId: string): Promise<NoteTemplate[]> {
    const { data, error } = await supabase
      .from('note_templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('listTemplates: query error', { error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: {} });
    }

    return (data ?? []).map((row) => mapRowToTemplate(row as unknown as NoteTemplateRow));
  }

  /**
   * 创建自定义模板。user_id=当前用户,is_system=false。
   * RLS 保证 user_id 必须为当前用户。
   */
  async createTemplate(
    supabase: SupabaseClient,
    userId: string,
    data: CreateNoteTemplateInput,
  ): Promise<NoteTemplate> {
    const { data: inserted, error } = await supabase
      .from('note_templates')
      .insert({
        user_id: userId,
        name: data.name,
        content: data.content,
        is_default: false,
        is_system: false,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('createTemplate: insert error', { userId, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    return mapRowToTemplate(inserted as unknown as NoteTemplateRow);
  }

  /**
   * 更新自定义模板。
   * - 校验存在性 + ownership(跨用户返回 NOT_FOUND)
   * - is_system=true 模板返回 403(系统模板不可改)
   */
  async updateTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    data: UpdateNoteTemplateInput,
  ): Promise<NoteTemplate> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 执行更新
    const updateRow: Record<string, unknown> = {};
    if (data.name !== undefined) updateRow.name = data.name;
    if (data.content !== undefined) updateRow.content = data.content;

    if (Object.keys(updateRow).length === 0) {
      // 无字段需要更新,直接返回当前模板
      return existing;
    }

    const { data: updated, error } = await supabase
      .from('note_templates')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error('updateTemplate: update error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    return mapRowToTemplate(updated as unknown as NoteTemplateRow);
  }

  /**
   * 删除自定义模板。
   * - 校验存在性 + ownership
   * - is_system=true 模板返回 403(系统模板不可删)
   */
  async deleteTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<void> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 执行删除
    const { error } = await supabase
      .from('note_templates')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('deleteTemplate: delete error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }
  }

  /**
   * 设为默认模板。
   * - 校验存在性 + ownership + is_system=false(系统模板不可设默认)
   * - 事务:UPDATE 其他同 user 模板 is_default=false,UPDATE 该模板 is_default=true
   *
   * 实现:由于 Supabase JS 客户端不支持原生事务,通过两条 UPDATE 顺序执行;
   * 单一用户并发场景极低,且由 idx_note_templates_user_default 唯一索引兜底
   * (若并发导致同时存在两个 is_default=true,后续创建时 DB 会拒绝)。
   */
  async setDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<NoteTemplate> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 取消同用户其他模板的默认标记
    const { error: clearError } = await supabase
      .from('note_templates')
      .update({ is_default: false })
      .eq('user_id', userId)
      .neq('id', id);

    if (clearError) {
      logger.error('setDefaultTemplate: clear other defaults error', { userId, id, error: clearError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    // 3. 设置当前模板为默认
    const { data: updated, error: updateError } = await supabase
      .from('note_templates')
      .update({ is_default: true })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error('setDefaultTemplate: set default error', { userId, id, error: updateError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    return mapRowToTemplate(updated as unknown as NoteTemplateRow);
  }

  /**
   * 查询单个模板并校验属主(跨用户返回 NOT_FOUND)。
   * RLS 已保证用户只能查到自己的 + 系统的;此处显式校验 ownership 用于
   * update/delete/setDefault 场景(系统模板可见但不可改)。
   */
  private async getTemplateForOwner(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<NoteTemplate> {
    const { data, error } = await supabase
      .from('note_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('getTemplateForOwner: query error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    if (!data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    const template = mapRowToTemplate(data as unknown as NoteTemplateRow);

    // 系统模板对所有用户可见,但 ownership 校验时:系统模板视为"共享只读",
    // 调用方根据 isSystem 判断是否允许修改。其他模板必须 user_id === userId。
    if (!template.isSystem && template.userId !== userId) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    return template;
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
        return;
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
        message: '仅 daily 类型笔记支持生成今日总结',
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
              { role: 'user', content: '请生成今日学习总结：' },
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
          error instanceof Error ? error.message : 'AI 生成今日总结失败',
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
              { role: 'user', content: '请提取知识点候选，返回 JSON：' },
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
      return '（今日无复习记录）';
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
      return '（今日无完成任务）';
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
        return `${i + 1}. ${title ?? '未命名任务'}`;
      })
      .join('\n');
  }
}

export const notesService = new NotesService();
