import { SupabaseClient } from '@supabase/supabase-js';
import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit } from '@shared/types';
import { extractWikiLinks, extractWikiLinkPositions, getWikiLinkContext } from '@shared/utils/wikiLink';
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
    for (const gn of (graphNodes || []) as unknown as GraphNodeRow[]) {
      if (!gn.graph || gn.graph.deleted_at !== null) continue;
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
        inCurrentGraph: graphId ? graphs.some(g => g.id === graphId) : false,
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

        for (const title of titles) {
          const matches = (kps || []).filter(
            (k: { title: string; id: string; updated_at: string }) => k.title === title
          );
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
}

export const backlinkService = new BacklinkService();
