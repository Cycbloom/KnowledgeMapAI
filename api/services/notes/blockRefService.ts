import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';
import {
  extractAllBlockIds,
  findBlockContent,
  extractBlockId,
  removeBlockId,
  BLOCK_EMBED_REGEX,
  BLOCK_REF_REGEX,
} from '../../../shared/utils/blockRef';
import type {
  BlockRef,
  BlockRefTarget,
  BlockContent,
  BlockId,
  BlockRefType,
} from '../../../shared/types/note';

/**
 * note_block_refs 表 DB 行（snake_case，来自数据库）
 */
interface NoteBlockRefRow {
  id: string;
  source_note_id: string;
  source_block_id: string;
  target_note_id: string;
  target_block_id: string;
  type: string;
  created_at: string;
}

/**
 * notes 表查询行（仅取所需字段）
 */
interface NoteRow {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

/**
 * getInboundRefs JOIN 查询行（source 笔记信息）
 */
interface InboundRefRow extends NoteBlockRefRow {
  source_note: { id: string; title: string; deleted_at: string | null } | null;
}

/**
 * getOutboundRefs JOIN 查询行（target 笔记信息）
 */
interface OutboundRefRow extends NoteBlockRefRow {
  target_note: { id: string; title: string; deleted_at: string | null } | null;
}

/**
 * 解析出的引用（含 source_block_id）
 * - sourceBlockId: 引用所在块的 ^id（无则用空串，表示 note 级引用）
 * - targetBlockId: 被引用的块 id
 * - type: ref | embed
 */
interface ParsedRef {
  sourceBlockId: string;
  targetBlockId: BlockId;
  type: BlockRefType;
}

/**
 * 代码块/行内代码分割正则（与 blockRef.ts 中一致）
 * 捕获组为代码段，split 后奇数索引为代码（应跳过）
 */
const CODE_SPLIT_REGEX = /(```[\s\S]*?```|`[^`\n]+`)/g;

/**
 * P3 块引用服务
 *
 * 维护 note_block_refs 表（笔记间块级引用关系）：
 * - syncBlockRefs: 笔记内容变更时同步引用关系（diff 后 DELETE/INSERT）
 * - getBlockContent: 获取指定块的内容（供前端 BlockReference/BlockEmbed 渲染）
 * - getInboundRefs: 查询笔记的被引用列表（谁引用了我的块）
 * - getOutboundRefs: 查询笔记的引用列表（我引用了谁的块）
 * - getBlocksForSearch: 块搜索补全（供前端 BlockRefPopover 使用）
 *
 * 设计要点：
 * - 失败仅 logger.warn，不阻塞调用方（参考 notesService.syncNodeLinks 容错风格）
 * - target_note_id 反查策略（方案 7）：syncBlockRefs 时遍历用户所有未软删除笔记，
 *   构建 blockId → noteId Map，从而为每个 target_block_id 找到归属笔记
 */
export class BlockRefService {
  // ============================================================
  // 同步块引用关系
  // ============================================================

  /**
   * 解析笔记内容，提取所有块引用（含 source_block_id）。
   *
   * 与 extractBlockRefs 的区别：本方法额外追踪每个引用所在块的 ^id（source_block_id）。
   * - 按空行分块（跳过代码块/行内代码）
   * - 对每块提取 ^id（无则用空串占位，表示 note 级引用）
   * - 对每块内的 ((id)) / !((id)) 提取引用
   * - 返回去重后的引用列表（按 sourceBlockId + targetBlockId + type 去重）
   */
  private parseRefsWithSourceBlocks(content: string): ParsedRef[] {
    if (!content) return [];

    const parts = content.split(CODE_SPLIT_REGEX);
    const results: ParsedRef[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < parts.length; i++) {
      // 奇数索引为代码块/行内代码，跳过
      if (i % 2 === 1) continue;
      const nonCode = parts[i];
      if (!nonCode) continue;

      // 按空行分隔块
      const blocks = nonCode.split(/\n\s*\n/);
      for (const block of blocks) {
        const sourceBlockId = extractBlockId(block) ?? '';

        // 先提取 embed，记录其匹配范围
        const embedRanges: Array<[number, number]> = [];
        BLOCK_EMBED_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = BLOCK_EMBED_REGEX.exec(block)) !== null) {
          embedRanges.push([match.index, match.index + match[0].length]);
          const key = `${sourceBlockId}|${match[1]}|embed`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              sourceBlockId,
              targetBlockId: match[1],
              type: 'embed',
            });
          }
        }

        // 再提取 ref，跳过与 embed 范围重叠的（即 !((id)) 中的 ((id)) 部分）
        BLOCK_REF_REGEX.lastIndex = 0;
        while ((match = BLOCK_REF_REGEX.exec(block)) !== null) {
          const start = match.index;
          const end = match.index + match[0].length;
          const isEmbed = embedRanges.some(
            ([es, ee]) => start >= es && end <= ee,
          );
          if (isEmbed) continue;

          const key = `${sourceBlockId}|${match[1]}|ref`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              sourceBlockId,
              targetBlockId: match[1],
              type: 'ref',
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * 同步笔记中的所有块引用（ref + embed）。
   *
   * 流程：
   * 1. 解析 content 中的 ((id)) 与 !((id))，提取含 source_block_id 的引用集合
   * 2. 查询用户所有未软删除笔记，构建 blockId → noteId Map（target_note_id 反查）
   * 3. 对每个引用，若 target_block_id 在 Map 中找到归属笔记，则保留；否则跳过（引用失效）
   * 4. 查现有 note_block_refs WHERE source_note_id = noteId
   * 5. diff 后 DELETE 不再期望的 / INSERT 新增的
   *
   * 失败仅 logger.warn，不阻塞调用方。
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param noteId 当前笔记 ID（source_note_id）
   * @param content 笔记正文
   */
  async syncBlockRefs(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
    content: string,
  ): Promise<void> {
    try {
      // 1. 解析期望引用集合
      const desiredRefs = this.parseRefsWithSourceBlocks(content);

      // 2. 查询用户所有未软删除笔记，构建 blockId → noteId Map
      const { data: userNotes, error: notesError } = await notDeleted(
        supabase
          .from('notes')
          .select('id, content')
          .eq('user_id', userId),
      );

      if (notesError) {
        logger.warn('syncBlockRefs: query user notes error', {
          userId,
          noteId,
          error: notesError,
        });
        return;
      }

      const blockIdToNoteId = new Map<string, string>();
      for (const note of (userNotes ?? []) as unknown as Pick<
        NoteRow,
        'id' | 'content'
      >[]) {
        const ids = extractAllBlockIds(note.content);
        for (const id of ids) {
          // 同一 blockId 可能跨笔记（冲突概率极低，10 位 [a-z0-9]），
          // 后写入的覆盖前者（最新创建的笔记优先）
          blockIdToNoteId.set(id, note.id);
        }
      }

      // 3. 构建期望引用列表（跳过失效引用：target_block_id 找不到归属笔记）
      const desiredMap = new Map<string, Omit<NoteBlockRefRow, 'id' | 'created_at'>>();
      for (const ref of desiredRefs) {
        const targetNoteId = blockIdToNoteId.get(ref.targetBlockId);
        if (!targetNoteId) continue; // 引用失效，跳过
        // 自引用跳过（source_note_id === target_note_id）
        if (targetNoteId === noteId) continue;

        const key = `${ref.sourceBlockId}|${ref.targetBlockId}|${ref.type}`;
        if (desiredMap.has(key)) continue;
        desiredMap.set(key, {
          source_note_id: noteId,
          source_block_id: ref.sourceBlockId,
          target_note_id: targetNoteId,
          target_block_id: ref.targetBlockId,
          type: ref.type,
        });
      }

      // 4. 查现有引用
      const { data: existing, error: existError } = await supabase
        .from('note_block_refs')
        .select('id, source_block_id, target_note_id, target_block_id, type')
        .eq('source_note_id', noteId);

      if (existError) {
        logger.warn('syncBlockRefs: query existing error', {
          userId,
          noteId,
          error: existError,
        });
        return;
      }

      const existingMap = new Map<string, string>(); // key → row id
      for (const row of (existing ?? []) as unknown as Pick<
        NoteBlockRefRow,
        'id' | 'source_block_id' | 'target_note_id' | 'target_block_id' | 'type'
      >[]) {
        const key = `${row.source_block_id}|${row.target_block_id}|${row.type}`;
        existingMap.set(key, row.id);
      }

      // 5. diff：删除不再期望的，插入新增的
      const toDelete: string[] = [];
      for (const [key, rowId] of existingMap) {
        if (!desiredMap.has(key)) {
          toDelete.push(rowId);
        }
      }

      const toInsert: Array<Omit<NoteBlockRefRow, 'id' | 'created_at'>> = [];
      for (const [key, row] of desiredMap) {
        if (!existingMap.has(key)) {
          toInsert.push(row);
        }
      }

      // 6. 执行删除
      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('note_block_refs')
          .delete()
          .in('id', toDelete);

        if (delError) {
          logger.warn('syncBlockRefs: delete error', {
            userId,
            noteId,
            count: toDelete.length,
            error: delError,
          });
        }
      }

      // 7. 执行插入
      if (toInsert.length > 0) {
        const { error: insError } = await supabase
          .from('note_block_refs')
          .insert(toInsert);

        if (insError) {
          // 唯一约束冲突（并发场景）忽略，其余记录
          if (insError.code !== '23505') {
            logger.warn('syncBlockRefs: insert error', {
              userId,
              noteId,
              count: toInsert.length,
              error: insError,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('syncBlockRefs: unexpected error', {
        userId,
        noteId,
        error: err,
      });
    }
  }

  // ============================================================
  // 块内容查询
  // ============================================================

  /**
   * 获取指定笔记中指定 blockId 的块内容。
   *
   * 流程：
   * 1. 校验属主与未软删除（notDeleted + WHERE id + user_id）
   * 2. 用 findBlockContent 解析 content 找到 blockId 对应块
   * 3. 找到返回 { isStale: false, content: 块文本 }
   * 4. 未找到返回 { isStale: true, content: '' }（块已不存在）
   * 5. 笔记不存在或跨用户返回 null
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param targetNoteId 目标笔记 ID
   * @param targetBlockId 目标块 ID
   */
  async getBlockContent(
    supabase: SupabaseClient,
    userId: string,
    targetNoteId: string,
    targetBlockId: BlockId,
  ): Promise<BlockContent | null> {
    const { data, error } = await notDeleted(
      supabase
        .from('notes')
        .select('id, title, content')
        .eq('id', targetNoteId)
        .eq('user_id', userId),
    ).maybeSingle();

    if (error) {
      logger.warn('getBlockContent: query error', {
        userId,
        targetNoteId,
        targetBlockId,
        error,
      });
      return null;
    }

    if (!data) return null;

    const note = data as unknown as Pick<NoteRow, 'id' | 'title' | 'content'>;
    const blockContent = findBlockContent(note.content, targetBlockId);

    if (blockContent === null) {
      // 块已不存在（可能被删除或 blockId 失效）
      return {
        noteId: targetNoteId,
        blockId: targetBlockId,
        content: '',
        noteTitle: note.title,
        isStale: true,
      };
    }

    return {
      noteId: targetNoteId,
      blockId: targetBlockId,
      content: blockContent,
      noteTitle: note.title,
      isStale: false,
    };
  }

  // ============================================================
  // 引用关系查询
  // ============================================================

  /**
   * 查询笔记的被引用列表（谁引用了我的块）。
   *
   * - JOIN notes 拿 source 笔记标题
   * - 过滤已软删除的 source 笔记（note_block_refs 无 deleted_at，需 JOIN 后在 JS 过滤）
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param noteId 被引用的笔记 ID（target_note_id）
   */
  async getInboundRefs(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<BlockRef[]> {
    const { data, error } = await supabase
      .from('note_block_refs')
      .select(
        `
        id,
        source_note_id,
        source_block_id,
        target_note_id,
        target_block_id,
        type,
        created_at,
        source_note:notes!source_note_id(id, title, deleted_at)
        `,
      )
      .eq('target_note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.warn('getInboundRefs: query error', { userId, noteId, error });
      return [];
    }

    const rows = (data ?? []) as unknown as InboundRefRow[];
    const result: BlockRef[] = [];
    for (const row of rows) {
      // 过滤已软删除的 source 笔记
      if (!row.source_note || row.source_note.deleted_at !== null) continue;

      result.push({
        id: row.id,
        sourceNoteId: row.source_note_id,
        sourceBlockId: row.source_block_id,
        targetNoteId: row.target_note_id,
        targetBlockId: row.target_block_id,
        type: row.type as BlockRefType,
        createdAt: row.created_at,
        sourceNoteTitle: row.source_note.title,
      });
    }

    return result;
  }

  /**
   * 查询笔记的引用列表（我引用了谁的块）。
   *
   * - JOIN notes 拿 target 笔记标题
   * - 过滤已软删除的 target 笔记
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param noteId 引用方笔记 ID（source_note_id）
   */
  async getOutboundRefs(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<BlockRef[]> {
    const { data, error } = await supabase
      .from('note_block_refs')
      .select(
        `
        id,
        source_note_id,
        source_block_id,
        target_note_id,
        target_block_id,
        type,
        created_at,
        target_note:notes!target_note_id(id, title, deleted_at)
        `,
      )
      .eq('source_note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.warn('getOutboundRefs: query error', { userId, noteId, error });
      return [];
    }

    const rows = (data ?? []) as unknown as OutboundRefRow[];
    const result: BlockRef[] = [];
    for (const row of rows) {
      // 过滤已软删除的 target 笔记
      if (!row.target_note || row.target_note.deleted_at !== null) continue;

      result.push({
        id: row.id,
        sourceNoteId: row.source_note_id,
        sourceBlockId: row.source_block_id,
        targetNoteId: row.target_note_id,
        targetBlockId: row.target_block_id,
        type: row.type as BlockRefType,
        createdAt: row.created_at,
        targetNoteTitle: row.target_note.title,
      });
    }

    return result;
  }

  // ============================================================
  // 块搜索补全
  // ============================================================

  /**
   * 块搜索补全（供前端 BlockRefPopover 使用）。
   *
   * 流程：
   * 1. 查用户最近编辑的笔记（限 20 篇，notDeleted + ORDER BY updated_at DESC）
   * 2. 对每篇解析 extractAllBlockIds，每个块生成 BlockRefTarget
   * 3. 用 query 过滤（blockSummary.includes(query) || noteTitle.includes(query)）
   * 4. 按 updated_at 倒序，limit（默认 50）
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param query 搜索关键词（匹配块摘要或笔记标题）
   * @param limit 返回上限（默认 50）
   */
  async getBlocksForSearch(
    supabase: SupabaseClient,
    userId: string,
    query: string,
    limit: number = 50,
  ): Promise<BlockRefTarget[]> {
    // 1. 查最近编辑的 20 篇笔记
    const { data: notes, error } = await notDeleted(
      supabase
        .from('notes')
        .select('id, title, content, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20),
    );

    if (error) {
      logger.warn('getBlocksForSearch: query notes error', {
        userId,
        query,
        error,
      });
      return [];
    }

    if (!notes || notes.length === 0) return [];

    // 2. 对每篇解析所有块，生成 BlockRefTarget 列表
    const allBlocks: BlockRefTarget[] = [];
    const queryLower = query.toLowerCase();

    for (const note of notes as unknown as NoteRow[]) {
      const blockIds = extractAllBlockIds(note.content);
      for (const blockId of blockIds) {
        const blockContent = findBlockContent(note.content, blockId);
        if (!blockContent) continue;

        // 剥离 ^id 后取前 100 字符作为摘要
        const cleaned = removeBlockId(blockContent);
        const summary = cleaned.slice(0, 100);

        // 无 query 时返回所有块；有 query 时按摘要或标题过滤
        if (queryLower) {
          const matches =
            summary.toLowerCase().includes(queryLower) ||
            note.title.toLowerCase().includes(queryLower);
          if (!matches) continue;
        }

        allBlocks.push({
          noteId: note.id,
          noteTitle: note.title,
          blockId,
          blockSummary: summary,
          blockType: 'text',
          updatedAt: note.updated_at,
        });
      }
    }

    // 3. 按 updated_at 倒序，取前 limit 条
    allBlocks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return allBlocks.slice(0, limit);
  }
}

export const blockRefService = new BlockRefService();
