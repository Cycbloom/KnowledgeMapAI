import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { resolveLocalizedText, type LocalizedText } from '@shared/utils/localization';
import { notDeleted } from '../common/softDeleteHelper';

/**
 * 生成类任务的「消歧上下文」：解决同一知识点名称在不同知识图谱中含义不同的问题
 * （学习资料生成 / 题目生成通用）。
 *
 * 生成时仅凭节点标题(topic)+正文(context)无法区分同名异义（如 "Transformer"
 * 在深度学习 vs 电力工程图谱中含义完全不同）。本 helper 自动收集：
 * 1. 图谱元数据（title / description / domain）
 * 2. 祖先链（沿 edges 反向向上最多 5 层，自根向下）
 * 3. 直接子节点标题（定义该知识点在本图谱中的具体覆盖范围）
 *
 * 设计约束：
 * - 全部 best-effort，任何一步失败返回空字段，绝不阻断生成（与 siblingNodesService 一致）；
 * - edges / graph_nodes 均需按 graph_id 过滤并排除软删除，避免多图谱共享知识点时跨图谱串节点。
 */
export interface GraphDisambiguationContext {
  graphTitle?: string;
  graphDescription?: string;
  graphDomain?: string;
  /** 祖先链，自根向下（不含节点自身），如 "神经网络基础 → 注意力机制" */
  parentChain?: string;
  /** 直接子节点大纲，如 "- 自注意力机制：...\n- 多头注意力：..." */
  childrenOutline?: string;
  /** 是否存在任一可用的消歧上下文 */
  hasContext: boolean;
}

const MAX_ANCESTOR_LEVELS = 5;
const MAX_CHILDREN = 6;
const CHILD_CONTENT_PREVIEW = 120;

interface GraphMetaRow {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  domain: string | null;
}

interface EdgeParentRow {
  source_knowledge_point_id: string;
}

interface EdgeChildRow {
  target_knowledge_point_id: string;
}

interface GraphNodeWithKpRow {
  knowledge_point_id: string;
  knowledge_points?:
    | Array<{ id: string; title: LocalizedText; content?: LocalizedText }>
    | null;
}

async function fetchGraphMeta(
  supabase: SupabaseClient,
  graphId: string,
): Promise<{ title?: string; description?: string; domain?: string }> {
  const { data, error } = await notDeleted(
    supabase
      .from('knowledge_graphs')
      .select('id, title, description, domain')
      .eq('id', graphId),
  ).maybeSingle();

  if (error || !data) {
    if (error) {
      logger.warn(
        `[GraphDisambiguationContext] Failed to fetch graph meta ${graphId}:`,
        error,
      );
    }
    return {};
  }
  const row = data as GraphMetaRow;
  return {
    title: resolveLocalizedText(row.title) || undefined,
    description: resolveLocalizedText(row.description) || undefined,
    domain: row.domain || undefined,
  };
}

/**
 * 沿 edges 反向逐层向上收集祖先 id（最多 MAX_ANCESTOR_LEVELS 层，防环）。
 * 只取 source_knowledge_point_id，随后由调用方批量取标题。
 */
async function fetchAncestorIds(
  supabase: SupabaseClient,
  graphId: string,
  nodeId: string,
): Promise<string[]> {
  const chain: string[] = [];
  const visited = new Set<string>([nodeId]);
  let current = nodeId;

  for (let i = 0; i < MAX_ANCESTOR_LEVELS; i++) {
    const { data, error } = await supabase
      .from('edges')
      .select('source_knowledge_point_id')
      .eq('target_knowledge_point_id', current)
      .eq('graph_id', graphId)
      .is('deleted_at', null)
      .limit(1);

    if (error) {
      logger.warn(
        `[GraphDisambiguationContext] Failed to fetch parent edge for ${current}:`,
        error,
      );
      break;
    }
    const parentId = (data as EdgeParentRow[] | null)?.[0]?.source_knowledge_point_id;
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    chain.push(parentId);
    current = parentId;
  }

  return chain; // 从直接父级到根（叶子向上收集）
}

async function fetchKpTitlesByIds(
  supabase: SupabaseClient,
  graphId: string,
  ids: string[],
  language?: string,
): Promise<Map<string, string>> {
  const titleById = new Map<string, string>();
  if (ids.length === 0) return titleById;

  const { data, error } = await notDeleted(
    supabase
      .from('graph_nodes')
      .select('knowledge_point_id, knowledge_points(id, title)')
      .eq('graph_id', graphId)
      .in('knowledge_point_id', ids),
  );

  if (error) {
    logger.warn(
      `[GraphDisambiguationContext] Failed to fetch kp titles for ${ids.length} ids:`,
      error,
    );
    return titleById;
  }

  for (const row of data as GraphNodeWithKpRow[] | null ?? []) {
    const kp = row.knowledge_points?.[0];
    const title = kp ? resolveLocalizedText(kp.title, language) : '';
    const kpId = kp?.id ?? row.knowledge_point_id;
    if (kpId && title) titleById.set(kpId, title);
  }
  return titleById;
}

async function fetchChildrenOutline(
  supabase: SupabaseClient,
  graphId: string,
  nodeId: string,
  language?: string,
): Promise<string | undefined> {
  const { data: edgeData, error: edgeError } = await supabase
    .from('edges')
    .select('target_knowledge_point_id')
    .eq('source_knowledge_point_id', nodeId)
    .eq('graph_id', graphId)
    .is('deleted_at', null)
    .limit(MAX_CHILDREN);

  if (edgeError) {
    logger.warn(
      `[GraphDisambiguationContext] Failed to fetch child edges for ${nodeId}:`,
      edgeError,
    );
    return undefined;
  }
  const childIds = (edgeData as EdgeChildRow[] | null ?? []).map(
    (e) => e.target_knowledge_point_id,
  );
  if (childIds.length === 0) return undefined;

  const { data, error } = await notDeleted(
    supabase
      .from('graph_nodes')
      .select('knowledge_point_id, knowledge_points(id, title, content)')
      .eq('graph_id', graphId)
      .in('knowledge_point_id', childIds),
  );

  if (error) {
    logger.warn(
      `[GraphDisambiguationContext] Failed to fetch child details for ${nodeId}:`,
      error,
    );
    return undefined;
  }

  const lines: string[] = [];
  for (const row of data as GraphNodeWithKpRow[] | null ?? []) {
    const kp = row.knowledge_points?.[0];
    const title = kp ? resolveLocalizedText(kp.title, language) : '';
    if (!title) continue;
    const rawContent = kp?.content;
    const content = resolveLocalizedText(rawContent, language);
    const preview =
      content && content.trim().length > 0
        ? content.trim().slice(0, CHILD_CONTENT_PREVIEW)
        : '';
    lines.push(preview ? `- ${title}：${preview}` : `- ${title}`);
  }
  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * 仅收集图谱级消歧上下文（title / description / domain），不含层级信息。
 * 用于没有 node_id 的同步路径（如 console 手动生成）。
 * 永不抛错：任何异常均记录日志后返回空字段。
 */
export async function buildGraphMetaContext(
  supabase: SupabaseClient,
  graphId: string | undefined,
): Promise<Pick<GraphDisambiguationContext, 'graphTitle' | 'graphDescription' | 'graphDomain' | 'hasContext'>> {
  if (!graphId) return { hasContext: false };

  const meta = await fetchGraphMeta(supabase, graphId);
  return {
    graphTitle: meta.title,
    graphDescription: meta.description,
    graphDomain: meta.domain,
    hasContext: Boolean(meta.title || meta.description || meta.domain),
  };
}

/**
 * 将消歧上下文格式化为 prompt 追加块（代码级无条件追加，兼容任意模板）。
 * 任一字段存在时返回非空块；全部缺失返回空串（零输出、无回归）。
 * 与学习资料/卡片链路（contentGenerationService.buildGraphContextBlock）同格式。
 */
export function formatGraphContextBlock(
  ctx: Pick<GraphDisambiguationContext, 'graphTitle' | 'graphDescription' | 'graphDomain' | 'parentChain' | 'childrenOutline'>,
): string {
  const { graphTitle, graphDescription, graphDomain, parentChain, childrenOutline } = ctx;
  if (
    !graphTitle && !graphDescription && !graphDomain &&
    !parentChain && !childrenOutline
  ) {
    return "";
  }

  const lines: string[] = ['## Knowledge Graph Context'];
  const graphRef = [
    graphTitle ? `"${graphTitle}"` : undefined,
    graphDomain ? `domain: ${graphDomain}` : undefined,
  ]
    .filter((s): s is string => Boolean(s))
    .join(' ');
  if (graphRef) {
    lines.push(`This knowledge point belongs to the knowledge graph ${graphRef}.`);
  }
  if (graphDescription) {
    lines.push(`Graph description: ${graphDescription}`);
  }
  if (parentChain) {
    lines.push(`Position in this graph's hierarchy: ${parentChain}`);
  }
  if (childrenOutline) {
    lines.push('This node covers the following sub-concepts in this graph:');
    lines.push(childrenOutline);
  }
  lines.push(
    'IMPORTANT: Interpret the topic strictly within this knowledge graph\'s context. ' +
      'If the term has multiple meanings across different fields, use the graph context above ' +
      'to determine the intended meaning.',
  );
  return lines.join('\n');
}

/**
 * 收集生成任务的消歧上下文（图谱元数据 + 祖先链 + 直接子节点）。
 * 无 graphId 时无法限定图谱范围，直接返回空上下文。
 * 永不抛错：任何异常均记录日志后返回部分/空结果。
 */
export async function buildGraphDisambiguationContext(
  supabase: SupabaseClient,
  graphId: string | undefined,
  nodeId: string,
  language?: string,
): Promise<GraphDisambiguationContext> {
  if (!graphId) return { hasContext: false };

  const meta = await fetchGraphMeta(supabase, graphId);

  let parentChain: string | undefined;
  try {
    const ancestorIds = await fetchAncestorIds(supabase, graphId, nodeId);
    if (ancestorIds.length > 0) {
      const titleById = await fetchKpTitlesByIds(
        supabase,
        graphId,
        ancestorIds,
        language,
      );
      // ancestorIds 自直接父级到根，反转为自根向下
      const chain = [...ancestorIds].reverse()
        .map((id) => titleById.get(id))
        .filter((t): t is string => Boolean(t));
      if (chain.length > 0) parentChain = chain.join(' → ');
    }
  } catch (err) {
    logger.warn(
      `[GraphDisambiguationContext] Failed to build ancestor chain for ${nodeId}:`,
      err,
    );
  }

  let childrenOutline: string | undefined;
  try {
    childrenOutline = await fetchChildrenOutline(
      supabase,
      graphId,
      nodeId,
      language,
    );
  } catch (err) {
    logger.warn(
      `[GraphDisambiguationContext] Failed to build children outline for ${nodeId}:`,
      err,
    );
  }

  return {
    graphTitle: meta.title,
    graphDescription: meta.description,
    graphDomain: meta.domain,
    parentChain,
    childrenOutline,
    hasContext: Boolean(
      meta.title || meta.description || meta.domain || parentChain || childrenOutline,
    ),
  };
}
