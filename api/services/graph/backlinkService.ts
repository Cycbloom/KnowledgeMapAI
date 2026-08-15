import { SupabaseClient } from '@supabase/supabase-js';
import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit } from '@shared/types';
import type { BlockId } from '@shared/types/note';
import { extractWikiLinks, extractWikiLinkPositions, getWikiLinkContext, replaceWikiLink } from '@shared/utils/wikiLink';
import { extractBlockId } from '../../../shared/utils/blockRef';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { edgeService } from './edgeService';
import { softDelete } from '../../utils/softDelete';
import { notDeleted } from '../common/softDeleteHelper';

interface SearchKnowledgePointsOptions {
  graphId?: string;
  limit?: number;
}

/** getBacklinks 查询行：JOIN source 知识点 + 图谱 */
interface BacklinkEdgeRow {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  created_at: string;
  source_kp: { id: string; title: string; content: string | null } | null;
  graph: { id: string; title: string; deleted_at: string | null } | null;
}

/** getOutlinks 查询行：JOIN target 知识点 + 图谱 */
interface OutlinkEdgeRow {
  id: string;
  graph_id: string;
  target_knowledge_point_id: string;
  created_at: string;
  target_kp: { id: string; title: string } | null;
  graph: { id: string; title: string; deleted_at: string | null } | null;
}

/** graph_nodes JOIN knowledge_graphs 查询行 */
interface GraphNodeRow {
  knowledge_point_id: string;
  graph_id: string;
  graph: { id: string; title: string; deleted_at: string | null } | null;
}

/** knowledge_points 搜索查询行 */
interface KnowledgePointRow {
  id: string;
  title: string;
  summary: string | null;
  updated_at: string;
}

export class BacklinkService {
  /**
   * 获取反向链接：查询哪些知识点通过 [[当前节点]] 引用了当前知识点。
   * 通过 RLS 策略自动过滤，用户只能看到自己有权限访问的知识点。
   */
  async getBacklinks(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<BacklinkItem[]> {
    // 1. 获取当前知识点标题（用于在 source 内容中定位 [[标题]]）
    const { data: currentKp, error: kpError } = await supabase
      .from('knowledge_points')
      .select('title')
      .eq('id', knowledgePointId)
      .maybeSingle();

    if (kpError) {
      logger.error('Get backlinks: fetch current knowledge point error:', { userId, knowledgePointId, error: kpError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, knowledgePointId } });
    }

    if (!currentKp) {
      return [];
    }

    const currentTitle: string = currentKp.title;

    // 2. 查询指向当前知识点的边（relates_to 关系，未软删除）
    const { data: edges, error: edgeError } = await notDeleted(supabase
      .from('edges')
      .select(`
        id,
        graph_id,
        source_knowledge_point_id,
        created_at,
        source_kp:knowledge_points!source_knowledge_point_id(id, title, content),
        graph:knowledge_graphs!graph_id(id, title, deleted_at)
      `)
      .eq('target_knowledge_point_id', knowledgePointId)
      .eq('relationship_type', 'relates_to')
      .order('created_at', { ascending: false })
      .limit(50)
    );

    if (edgeError) {
      logger.error('Get backlinks: query edges error:', { userId, knowledgePointId, error: edgeError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, knowledgePointId } });
    }

    const rows = (edges || []) as unknown as BacklinkEdgeRow[];

    // 3. 组装结果，提取上下文
    const result: BacklinkItem[] = [];
    for (const row of rows) {
      // 过滤已软删除的图谱
      if (!row.graph || row.graph.deleted_at !== null) continue;
      if (!row.source_kp) continue;

      const sourceContent = row.source_kp.content ?? '';
      const context = this.extractContextForTitle(sourceContent, currentTitle);

      result.push({
        sourceKnowledgePointId: row.source_knowledge_point_id,
        sourceKnowledgePointTitle: row.source_kp.title,
        sourceKnowledgePointContent: sourceContent,
        graphId: row.graph_id,
        graphTitle: row.graph.title,
        context,
        createdAt: row.created_at,
      });
    }

    return result;
  }

  /**
   * 获取正向链接：查询当前知识点通过 [[...]] 引用了哪些知识点。
   * 通过 RLS 策略自动过滤。
   */
  async getOutlinks(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<OutlinkItem[]> {
    // 1. 获取当前知识点内容（用于定位 [[target title]]）
    const { data: currentKp, error: kpError } = await supabase
      .from('knowledge_points')
      .select('content')
      .eq('id', knowledgePointId)
      .maybeSingle();

    if (kpError) {
      logger.error('Get outlinks: fetch current knowledge point error:', { userId, knowledgePointId, error: kpError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, knowledgePointId } });
    }

    if (!currentKp) {
      return [];
    }

    const currentContent: string = currentKp.content ?? '';

    // 2. 查询当前知识点发出的边
    const { data: edges, error: edgeError } = await notDeleted(supabase
      .from('edges')
      .select(`
        id,
        graph_id,
        target_knowledge_point_id,
        created_at,
        target_kp:knowledge_points!target_knowledge_point_id(id, title),
        graph:knowledge_graphs!graph_id(id, title, deleted_at)
      `)
      .eq('source_knowledge_point_id', knowledgePointId)
      .eq('relationship_type', 'relates_to')
      .order('created_at', { ascending: false })
      .limit(50)
    );

    if (edgeError) {
      logger.error('Get outlinks: query edges error:', { userId, knowledgePointId, error: edgeError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, knowledgePointId } });
    }

    const rows = (edges || []) as unknown as OutlinkEdgeRow[];

    // 3. 组装结果
    const result: OutlinkItem[] = [];
    for (const row of rows) {
      if (!row.graph || row.graph.deleted_at !== null) continue;
      if (!row.target_kp) continue;

      const context = this.extractContextForTitle(currentContent, row.target_kp.title);

      result.push({
        targetKnowledgePointId: row.target_knowledge_point_id,
        targetKnowledgePointTitle: row.target_kp.title,
        graphId: row.graph_id,
        graphTitle: row.graph.title,
        context,
        createdAt: row.created_at,
      });
    }

    return result;
  }

  /**
   * 搜索知识点（用于 [[ 节点选择器）。
   * 前缀匹配、大小写不敏感；用户只能搜索自己的和公开的知识点。
   */
  async searchKnowledgePoints(
    supabase: SupabaseClient,
    userId: string,
    query: string,
    options?: SearchKnowledgePointsOptions,
  ): Promise<KnowledgePointSearchHit[]> {
    const limit = Math.min(options?.limit ?? 10, 20);
    const graphId = options?.graphId;

    if (!query.trim()) {
      return [];
    }

    // 1. 查询知识点（前缀匹配，所有者或公开）
    const { data: kps, error: kpError } = await supabase
      .from('knowledge_points')
      .select('id, title, summary, updated_at')
      .or(`owner_id.eq.${userId},visibility.eq.public`)
      .ilike('title', `${query}%`)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (kpError) {
      logger.error('Search knowledge points error:', { userId, query, error: kpError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, query } });
    }

    if (!kps || kps.length === 0) {
      return [];
    }

    const kpRows = kps as unknown as KnowledgePointRow[];
    const kpIds = kpRows.map(k => k.id);

    // 2. 查询这些知识点所在的图谱（通过 graph_nodes JOIN knowledge_graphs）
    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        graph_id,
        graph:knowledge_graphs!graph_id(id, title, deleted_at)
      `)
      .in('knowledge_point_id', kpIds)
    );

    if (gnError) {
      logger.error('Search knowledge points: fetch graph nodes error:', { userId, query, error: gnError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, query } });
    }

    // 3. 构建 kpId → graphs 映射
    const kpGraphsMap = new Map<string, { id: string; title: string }[]>();
    // 预构建含目标 graphId 的 kp 集合，替代 hits 组装时 graphs.some 的 O(graphs) 内层扫描
    const kpIdsInGraph = new Set<string>();
    for (const gn of (graphNodes || []) as unknown as GraphNodeRow[]) {
      if (!gn.graph || gn.graph.deleted_at !== null) continue;
      if (graphId && gn.graph_id === graphId) kpIdsInGraph.add(gn.knowledge_point_id);
      const list = kpGraphsMap.get(gn.knowledge_point_id) ?? [];
      list.push({ id: gn.graph_id, title: gn.graph.title });
      kpGraphsMap.set(gn.knowledge_point_id, list);
    }

    // 4. 组装结果
    const hits: KnowledgePointSearchHit[] = kpRows.map(kp => {
      const graphs = kpGraphsMap.get(kp.id) ?? [];
      return {
        id: kp.id,
        title: kp.title,
        summary: kp.summary ?? undefined,
        graphIds: graphs.map(g => g.id),
        graphTitles: graphs.map(g => g.title),
        inCurrentGraph: graphId ? kpIdsInGraph.has(kp.id) : false,
        updatedAt: kp.updated_at,
      };
    });

    // 5. 排序：同图谱优先，然后按 updated_at DESC
    hits.sort((a, b) => {
      if (a.inCurrentGraph !== b.inCurrentGraph) {
        return a.inCurrentGraph ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return hits.slice(0, limit);
  }

  /**
   * 同步反向链接：根据 content 中的 [[...]] 创建/删除边。
   * 此方法可能被异步调用，不阻塞主流程，失败时仅记录警告不抛错。
   */
  async syncBacklinks(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    knowledgePointId: string,
    content: string,
  ): Promise<void> {
    try {
      // 1. 解析 content 中的所有 [[]] 双链
      const titles = extractWikiLinks(content);

      // 2. 查询当前图谱中的知识点 ID 集合（用于优先匹配同图谱）
      const { data: graphNodes, error: gnError } = await notDeleted(supabase
        .from('graph_nodes')
        .select('knowledge_point_id')
        .eq('graph_id', graphId)
      );

      if (gnError) {
        logger.warn('Sync backlinks: fetch graph nodes error:', { userId, graphId, error: gnError });
        return;
      }

      const sameGraphKpIds = new Set<string>(
        (graphNodes || []).map((gn: { knowledge_point_id: string }) => gn.knowledge_point_id)
      );

      // 3. 为每个标题解析目标知识点（优先同图谱，其次全局，按 updated_at DESC 取第一个）
      const titleToTargetId = new Map<string, string>();

      if (titles.length > 0) {
        const { data: kps, error: kpError } = await supabase
          .from('knowledge_points')
          .select('id, title, updated_at')
          .in('title', titles)
          .order('updated_at', { ascending: false });

        if (kpError) {
          logger.warn('Sync backlinks: query target knowledge points error:', { userId, graphId, error: kpError });
          return;
        }

        // 预构建 title → 知识点列表 映射，替代 titles 循环内对 kps 的 O(titles×kps) filter 扫描
        const kpsByTitle = new Map<string, Array<{ title: string; id: string; updated_at: string }>>();
        for (const k of (kps || []) as unknown as Array<{ title: string; id: string; updated_at: string }>) {
          const list = kpsByTitle.get(k.title) ?? [];
          list.push(k);
          kpsByTitle.set(k.title, list);
        }

        for (const title of titles) {
          const matches = kpsByTitle.get(title) ?? [];
          if (matches.length === 0) continue;

          const sameGraphMatches = matches.filter(
            (k: { id: string }) => sameGraphKpIds.has(k.id)
          );
          const target = sameGraphMatches.length > 0 ? sameGraphMatches[0] : matches[0];
          titleToTargetId.set(title, (target as { id: string }).id);
        }
      }

      // 4. 查询当前已有的 relates_to 边（排除 custom_label='manual' 的手动边）
      const { data: existingEdges, error: edgeError } = await notDeleted(supabase
        .from('edges')
        .select('id, target_knowledge_point_id')
        .eq('graph_id', graphId)
        .eq('source_knowledge_point_id', knowledgePointId)
        .eq('relationship_type', 'relates_to')
        .or('custom_label.neq.manual,custom_label.is.null')
      );

      if (edgeError) {
        logger.warn('Sync backlinks: query existing edges error:', { userId, graphId, error: edgeError });
        return;
      }

      const existingMap = new Map<string, string>();
      for (const e of (existingEdges || []) as unknown as { id: string; target_knowledge_point_id: string }[]) {
        existingMap.set(e.target_knowledge_point_id, e.id);
      }

      const desiredTargetIds = new Set(titleToTargetId.values());

      // 5. 消失的双链 → 软删除
      for (const [targetId, edgeId] of existingMap) {
        if (!desiredTargetIds.has(targetId)) {
          const result = await softDelete(supabase, 'edges', edgeId);
          if (!result.success) {
            logger.warn('Sync backlinks: soft delete edge failed:', { userId, graphId, edgeId, error: result.error });
          }
        }
      }

      // 6. 新增的双链 → 创建边（custom_label='wikilink' 标记来源）
      for (const [title, targetId] of titleToTargetId) {
        // 跳过自引用
        if (targetId === knowledgePointId) continue;
        if (existingMap.has(targetId)) continue;

        try {
          await edgeService.create(supabase, {
            graph_id: graphId,
            source_knowledge_point_id: knowledgePointId,
            target_knowledge_point_id: targetId,
            relationship_type: 'relates_to',
            custom_label: 'wikilink',
          });
        } catch (createErr) {
          logger.warn('Sync backlinks: create edge failed:', { userId, graphId, title, targetId, error: createErr });
        }
      }
    } catch (err) {
      logger.warn('Sync backlinks: unexpected error:', { userId, graphId, knowledgePointId, error: err });
    }
  }

  /**
   * 同步笔记正文中的 wiki 链接（节点重命名场景）。
   *
   * 当图节点 X 被重命名为 Y 时，将所有引用 [[X]] 的未软删除笔记正文更新为 [[Y]]。
   * 扩展现有 backlinks 机制，覆盖 notes 表（既有 syncBacklinks 仅处理 knowledge_points 间的边）。
   *
   * 说明：
   * - 节点重命名不改变 node_id，只改 knowledge_points.title；
   *   note_node_links 通过 node_id 关联，故挂载关系无需重新同步。
   * - 用 LIKE（大小写敏感）预筛出 content 含 [[oldName]] 的候选笔记，
   *   再由 replaceWikiLink 精确替换（区分大小写，避免误伤 [[oldName-后缀]] 等）。
   * - 此方法设计为异步调用，不阻塞重命名主流程，失败仅记录警告（参考 notesService.syncNodeLinks 容错风格）。
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param oldName 旧节点标题
   * @param newName 新节点标题
   */
  async syncNotesWikiLinks(
    supabase: SupabaseClient,
    userId: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    try {
      if (!oldName || !newName || oldName === newName) return;

      // 1. 查询所有 content 含 [[oldName]] 且未软删除的笔记（大小写敏感预筛）
      const pattern = `%[[${oldName}]]%`;
      const { data: notes, error: queryError } = await notDeleted(supabase
        .from('notes')
        .select('id, content')
        .eq('user_id', userId)
        .like('content', pattern)
      );

      if (queryError) {
        logger.warn('syncNotesWikiLinks: query notes error', { userId, oldName, newName, error: queryError });
        return;
      }

      if (!notes || notes.length === 0) return;

      // 2. 对每篇笔记用 replaceWikiLink 精确替换，仅收集实际发生变更的
      const toUpdate: { id: string; content: string }[] = [];
      for (const note of notes as unknown as { id: string; content: string }[]) {
        const newContent = replaceWikiLink(note.content ?? '', oldName, newName);
        if (newContent !== note.content) {
          toUpdate.push({ id: note.id, content: newContent });
        }
      }

      if (toUpdate.length === 0) return;

      // 3. 批量更新（逐条 UPDATE，supabase-js 不支持异构 content 批量更新）
      for (const { id, content } of toUpdate) {
        const { error: updateError } = await supabase
          .from('notes')
          .update({ content })
          .eq('id', id);
        if (updateError) {
          logger.warn('syncNotesWikiLinks: update note content error', { userId, noteId: id, error: updateError });
        }
      }
    } catch (err) {
      logger.warn('syncNotesWikiLinks: unexpected error', { userId, oldName, newName, error: err });
    }
  }

  /**
   * 从内容中提取指定标题的 [[...]] 上下文（前后各 30 字符）。
   * 匹配按 trim + 大小写不敏感比较。
   */
  private extractContextForTitle(content: string, title: string): string {
    if (!content || !title) return '';
    const positions = extractWikiLinkPositions(content);
    const targetLower = title.trim().toLowerCase();
    const match = positions.find(p => p.title.trim().toLowerCase() === targetLower);
    if (!match) return '';
    return getWikiLinkContext(content, match.start, match.end);
  }

  // ============================================================
  // P3 块引用反链：查询哪些笔记通过块引用引用了含 [[节点X]] 的块
  // ============================================================

  /**
   * 查询通过块引用引用了"含 [[节点X]] 的块"的笔记列表。
   *
   * 用于节点详情侧边栏"块引用反链"区块，与 getBacklinks（基于 edges 关系）
   * 互补：getBacklinks 返回图谱层面的边关系，本方法返回笔记块引用层面的关系。
   *
   * 流程：
   * 1. 查 knowledge_points 拿到节点标题
   * 2. 查所有未软删除的、content 含 [[节点标题]] 的笔记
   * 3. 对每篇笔记，提取含 [[节点标题]] 的块的 ^id（blockId）
   * 4. 查 note_block_refs WHERE target_block_id IN (这些 blockId)
   * 5. JOIN source 笔记拿标题，返回引用方列表
   *
   * @param supabase Supabase 客户端
   * @param userId 用户 ID（RLS 隔离）
   * @param knowledgePointId 知识点 ID
   */
  async getBlockRefBacklinksForNode(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<Array<{ noteId: string; noteTitle: string; blockId: BlockId; blockSummary: string }>> {
    try {
      // 1. 查知识点标题
      const { data: kp, error: kpError } = await supabase
        .from('knowledge_points')
        .select('title')
        .eq('id', knowledgePointId)
        .maybeSingle();

      if (kpError) {
        logger.warn('getBlockRefBacklinksForNode: fetch knowledge point error', {
          userId,
          knowledgePointId,
          error: kpError,
        });
        return [];
      }

      if (!kp) return [];

      const nodeTitle: string = kp.title;

      // 2. 查含 [[nodeTitle]] 的笔记（LIKE 预筛，大小写敏感）
      const pattern = `%[[${nodeTitle}]]%`;
      const { data: notes, error: notesError } = await notDeleted(supabase
        .from('notes')
        .select('id, title, content')
        .eq('user_id', userId)
        .like('content', pattern)
      );

      if (notesError) {
        logger.warn('getBlockRefBacklinksForNode: query notes error', {
          userId,
          knowledgePointId,
          nodeTitle,
          error: notesError,
        });
        return [];
      }

      if (!notes || notes.length === 0) return [];

      // 3. 对每篇笔记，提取含 [[nodeTitle]] 的块的 ^id
      const blockIdToNoteInfo = new Map<string, { noteId: string; noteTitle: string; blockSummary: string }>();
      const wikiLinkPattern = `[[${nodeTitle}]]`;
      for (const note of notes as unknown as Array<{ id: string; title: string; content: string }>) {
        const blocks = (note.content ?? '').split(/\n\s*\n/);
        for (const block of blocks) {
          // 仅处理含 [[nodeTitle]] 的块
          if (!block.includes(wikiLinkPattern)) continue;

          // 提取块的 ^id
          const blockId = extractBlockId(block);
          if (!blockId) continue;

          // 块摘要：剥离 ^id 后取前 100 字符
          const summary = block.replace(/\s*\^[a-z0-9]{10}\s*$/, '').trim().slice(0, 100);
          blockIdToNoteInfo.set(blockId, {
            noteId: note.id,
            noteTitle: note.title,
            blockSummary: summary,
          });
        }
      }

      if (blockIdToNoteInfo.size === 0) return [];

      // 4. 查 note_block_refs WHERE target_block_id IN (这些 blockId)
      const targetBlockIds = Array.from(blockIdToNoteInfo.keys());
      const { data: refs, error: refsError } = await supabase
        .from('note_block_refs')
        .select(`
          source_note_id,
          target_block_id,
          source_note:notes!source_note_id(id, title, deleted_at)
        `)
        .in('target_block_id', targetBlockIds);

      if (refsError) {
        logger.warn('getBlockRefBacklinksForNode: query refs error', {
          userId,
          knowledgePointId,
          error: refsError,
        });
        return [];
      }

      // 5. 组装结果：引用方笔记列表
      const result: Array<{ noteId: string; noteTitle: string; blockId: BlockId; blockSummary: string }> = [];
      const seenReferrers = new Set<string>(); // 去重：(sourceNoteId, blockId)

      for (const ref of (refs ?? []) as unknown as Array<{
        source_note_id: string;
        target_block_id: string;
        source_note: { id: string; title: string; deleted_at: string | null } | null;
      }>) {
        // 过滤已软删除的 source 笔记
        if (!ref.source_note || ref.source_note.deleted_at !== null) continue;

        const blockInfo = blockIdToNoteInfo.get(ref.target_block_id);
        if (!blockInfo) continue;

        const key = `${ref.source_note_id}|${ref.target_block_id}`;
        if (seenReferrers.has(key)) continue;
        seenReferrers.add(key);

        // 返回引用方笔记信息 + 被引用块的信息
        result.push({
          noteId: ref.source_note_id,
          noteTitle: ref.source_note.title,
          blockId: ref.target_block_id,
          blockSummary: blockInfo.blockSummary,
        });
      }

      return result;
    } catch (err) {
      logger.warn('getBlockRefBacklinksForNode: unexpected error', {
        userId,
        knowledgePointId,
        error: err,
      });
      return [];
    }
  }
}

export const backlinkService = new BacklinkService();
