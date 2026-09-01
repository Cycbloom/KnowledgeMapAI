import { SupabaseClient } from "@supabase/supabase-js";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { checkDuplicateGraphTopic } from "../../utils/similaritySearch";
import { aiService } from "../ai/aiService";
import { notDeleted } from "../common/softDeleteHelper";
import { cacheService, CacheKeys } from "../common/cacheService";

export type WidthRelationType = "prerequisite" | "extension" | "related";

export interface WidthExpansionConfig {
  max_depth: number;
  max_graphs_per_level: number;
  relation_types: WidthRelationType[];
}

export interface WidthCandidate {
  /** 本层内稳定 id，供前端挑选后回传 */
  key: string;
  title: string;
  description: string;
  relation_type: WidthRelationType;
  parent_graph_id: string;
  parent_title: string;
  /** true 表示库中已有相同/近似图谱，保留时会复用而非新建 */
  reuse_existing_id?: string;
}

export interface WidthJob {
  source_graph_id: string;
  depth: number; // 当前已展开到的层级（0=源头）
  max_depth: number;
  max_graphs_per_level: number;
  relation_types: WidthRelationType[];
  /** 当前前沿：本层下一步要作为"源头"的已接受图谱 */
  frontier: Array<{ graph_id: string; title: string }>;
}

export interface SelectionItem {
  key: string;
  action: "keep" | "final" | "skip";
}

const JOB_SETTINGS_KEY = "width_expansion";

function readJob(graph: { settings?: unknown }): WidthJob | null {
  const s = (graph.settings && typeof graph.settings === "object"
    ? graph.settings
    : {}) as Record<string, unknown>;
  return (s[JOB_SETTINGS_KEY] as WidthJob | undefined) ?? null;
}

async function writeJob(
  supabase: SupabaseClient,
  graphId: string,
  job: WidthJob,
): Promise<void> {
  const { data: graph } = await supabase
    .from("knowledge_graphs")
    .select("settings")
    .eq("id", graphId)
    .single();
  const settings = (graph?.settings && typeof graph.settings === "object"
    ? graph.settings
    : {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("knowledge_graphs")
    .update({ settings: { ...settings, [JOB_SETTINGS_KEY]: job } })
    .eq("id", graphId);
  if (error) {
    throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
      message: `Failed to save width expansion job: ${error.message}`,
    });
  }
}

/**
 * 对单个"源头"图谱，让其 AI 生成一层关系候选（不落库）。
 */
async function suggestRelatedGraphs(
  supabase: SupabaseClient,
  userId: string,
  params: {
    sourceGraphId: string;
    sourceGraphTitle: string;
    max_graphs_per_level: number;
    relation_types: WidthRelationType[];
  },
): Promise<
  Array<{
    title: string;
    description: string;
    relation_type: WidthRelationType;
  }>
> {
  const provider = await getAIProviderForTask("text");
  if (!provider.hasKey) {
    throw new AppError(
      "AI provider not configured",
      503,
      ErrorCodes.AI_SERVICE_UNAVAILABLE,
    );
  }

  const systemPrompt = await promptService.getRenderedPrompt(
    supabase,
    "infinite_graph_expansion",
    {
      domainTitle: params.sourceGraphTitle,
      maxGraphsPerLevel: params.max_graphs_per_level,
      parentDomainName: undefined,
    },
    userId,
  );

  const completion = await provider.client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "请分析这个知识领域，找出与之相关的其他独立知识领域。",
      },
    ],
    model: provider.model,
    response_format: { type: "json_object" },
    max_tokens: 32000,
  });

  const parsed = JSON.parse(
    completion.choices[0].message.content ||
      '{"prerequisite":[],"extension":[],"related":[]}',
  );

  const out: Array<{
    title: string;
    description: string;
    relation_type: WidthRelationType;
  }> = [];
  for (const relationType of params.relation_types) {
    for (const suggestion of (parsed[relationType] || []).slice(
      0,
      params.max_graphs_per_level,
    )) {
      if (!suggestion?.title || typeof suggestion.title !== "string") continue;
      out.push({
        title: suggestion.title,
        description: suggestion.description || "",
        relation_type: relationType,
      });
    }
  }
  return out;
}

async function candidateExists(
  supabase: SupabaseClient,
  userId: string,
  title: string,
): Promise<string | undefined> {
  try {
    const res = await checkDuplicateGraphTopic(supabase, userId, title, {
      threshold: 0.85,
      bypassCache: true,
    });
    if (res.isDuplicate && res.similarGraphs[0]) {
      return res.similarGraphs[0].id;
    }
  } catch (e) {
    logger.warn("candidateExists duplicate check failed:", e);
  }
  return undefined;
}

/**
 * 启动/继续：根据当前前沿生成一层候选。frontier 为空或已达 max_depth 时返回 done。
 */
async function generateCandidates(
  supabase: SupabaseClient,
  userId: string,
  sourceGraphId: string,
  job: WidthJob,
): Promise<{ candidates: WidthCandidate[]; reachesMaxDepth: boolean }> {
  const reachesMaxDepth = job.depth >= job.max_depth;
  if (reachesMaxDepth || job.frontier.length === 0) {
    return { candidates: [], reachesMaxDepth: true };
  }

  const candidates: WidthCandidate[] = [];
  const seenTitles = new Set<string>();

  for (const frontierNode of job.frontier) {
    const suggestions = await suggestRelatedGraphs(supabase, userId, {
      sourceGraphId: frontierNode.graph_id,
      sourceGraphTitle: frontierNode.title,
      max_graphs_per_level: job.max_graphs_per_level,
      relation_types: job.relation_types,
    });

    for (const s of suggestions) {
      const normalized = s.title.trim().toLowerCase();
      // 本层去重
      if (seenTitles.has(normalized)) continue;
      seenTitles.add(normalized);

      const reuseExistingId = await candidateExists(supabase, userId, s.title);
      candidates.push({
        key: `${sourceGraphId}::${normalized}`,
        title: s.title,
        description: s.description,
        relation_type: s.relation_type,
        parent_graph_id: frontierNode.graph_id,
        parent_title: frontierNode.title,
        reuse_existing_id: reuseExistingId,
      });
    }
  }

  return { candidates, reachesMaxDepth: false };
}

async function getGraph(
  supabase: SupabaseClient,
  graphId: string,
  userId: string,
): Promise<{ id: string; title: string; settings?: unknown } | null> {
  const { data, error } = await notDeleted(
    supabase
      .from("knowledge_graphs")
      .select("id, title, settings")
      .eq("id", graphId)
      .eq("user_id", userId),
  )
    .maybeSingle();
  if (error) {
    logger.warn("getGraph failed:", error);
  }
  return data ?? null;
}

export class WidthExpansionService {
  async start(
    supabase: SupabaseClient,
    userId: string,
    sourceGraphId: string,
    config: WidthExpansionConfig,
  ): Promise<{
    candidates: WidthCandidate[];
    reachesMaxDepth: boolean;
    job: WidthJob;
  }> {
    const graph = await getGraph(supabase, sourceGraphId, userId);
    if (!graph) {
      throw new AppError(
        "图谱不存在或无权访问",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const job: WidthJob = {
      source_graph_id: sourceGraphId,
      depth: 0,
      max_depth: config.max_depth,
      max_graphs_per_level: config.max_graphs_per_level,
      relation_types: config.relation_types,
      frontier: [{ graph_id: sourceGraphId, title: graph.title }],
    };
    await writeJob(supabase, sourceGraphId, job);

    const { candidates, reachesMaxDepth } = await generateCandidates(
      supabase,
      userId,
      sourceGraphId,
      job,
    );
    return { candidates, reachesMaxDepth, job };
  }

  /**
   * 用已有 job 的当前前沿生成下一层候选（不重置、不落库）。
   */
  async next(
    supabase: SupabaseClient,
    userId: string,
    sourceGraphId: string,
  ): Promise<{ candidates: WidthCandidate[]; reachesMaxDepth: boolean }> {
    const graph = await getGraph(supabase, sourceGraphId, userId);
    if (!graph) {
      throw new AppError(
        "图谱不存在或无权访问",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }
    const job = readJob(graph);
    if (!job) {
      throw new AppError(
        "未找到宽度拓展任务，请重新开始",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return generateCandidates(supabase, userId, sourceGraphId, job);
  }

  /**
   * 应用本层选择：只创建"keep"，跳过 "skip"，"final" 创建后标记为终结点（不再作为源头）。
   * 返回新的前沿与是否已达最大深度。
   */
  async apply(
    supabase: SupabaseClient,
    userId: string,
    sourceGraphId: string,
    selections: SelectionItem[],
  ): Promise<{
    frontier: Array<{ graph_id: string; title: string }>;
    depth: number;
    reachesMaxDepth: boolean;
    created: number;
    applied: Record<string, string>;
  }> {
    const graph = await getGraph(supabase, sourceGraphId, userId);
    if (!graph) {
      throw new AppError(
        "图谱不存在或无权访问",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }
    const job = readJob(graph);
    if (!job) {
      throw new AppError(
        "未找到宽度拓展任务，请重新开始",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (job.depth >= job.max_depth) {
      return {
        frontier: [],
        depth: job.depth,
        reachesMaxDepth: true,
        created: 0,
        applied: {},
      };
    }

    // 重新生成候选以拿到完整信息（key → 候选），保持与前端一致
    const { candidates } = await generateCandidates(
      supabase,
      userId,
      sourceGraphId,
      job,
    );
    const byKey = new Map(candidates.map((c) => [c.key, c]));
    const keep = selections.filter((s) => s.action === "keep" || s.action === "final");

    const nextFrontier: Array<{ graph_id: string; title: string }> = [];
    let created = 0;
    const applied: Record<string, string> = {};

    for (const sel of keep) {
      const cand = byKey.get(sel.key);
      if (!cand) continue;

      let targetGraphId = cand.reuse_existing_id;

      if (!targetGraphId) {
        let embedding: number[] | null = null;
        try {
          embedding = await aiService.generateEmbedding(cand.title);
        } catch (e) {
          logger.warn("Failed to generate embedding for new graph:", e);
        }
        const { data: newGraph } = await supabase
          .from("knowledge_graphs")
          .insert({
            user_id: userId,
            title: cand.title,
            description: cand.description,
            embedding: embedding ?? undefined,
          })
          .select("id")
          .single();
        if (!newGraph) continue;
        targetGraphId = newGraph.id;
        created++;
      }

      if (!targetGraphId) continue;

      // 终点：持久化到该图谱 settings，后续不再作为源头拓展
      if (sel.action === "final") {
        const { data: tg } = await supabase
          .from("knowledge_graphs")
          .select("settings")
          .eq("id", targetGraphId)
          .single();
        const gs = (tg?.settings && typeof tg.settings === "object"
          ? tg.settings
          : {}) as Record<string, unknown>;
        await supabase
          .from("knowledge_graphs")
          .update({ settings: { ...gs, is_expansion_terminal: true } })
          .eq("id", targetGraphId);
      }

      // 建边（父图谱 → 候选：图谱级关系）
      const { data: targetGraph } = await supabase
        .from("knowledge_graphs")
        .select("title")
        .eq("id", targetGraphId)
        .single();
      const { error: relError } = await supabase
        .from("graph_relations")
        .insert({
          source_graph_id: cand.parent_graph_id,
          target_graph_id: targetGraphId,
          relation_type: cand.relation_type,
        });
      if (relError) {
        logger.warn("Failed to create graph relation:", relError);
      }

      applied[cand.key] = targetGraphId;

      // 只有非终点的候选进入下一层前沿
      if (sel.action === "keep") {
        nextFrontier.push({
          graph_id: targetGraphId,
          title: targetGraph?.title ?? cand.title,
        });
      }
    }

    job.frontier = nextFrontier;
    job.depth += 1;
    await writeJob(supabase, sourceGraphId, job);

    // 图谱地图/用户图谱缓存失效
    await cacheService.del([CacheKeys.GRAPH_MAP(userId), CacheKeys.USER_GRAPHS(userId)]);

    return {
      frontier: nextFrontier,
      depth: job.depth,
      reachesMaxDepth: job.depth >= job.max_depth,
      created,
      applied,
    };
  }
}

export const widthExpansionService = new WidthExpansionService();