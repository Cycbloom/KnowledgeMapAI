/**
 * 跨图谱学习路径算法（图谱级，path_type = cross_graph）。
 *
 * 与单图学习路径（learningPathAlgorithms.ts 以知识点为粒度）不同，
 * 这里以「图谱」为粒度：输入是图谱地图（图谱 + graph_relations），
 * 只把「前置 / 扩展」关系视为学习顺序约束，related / cross_domain 仅作软提示。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import type { GraphRelationType } from "../graph/graphRelationService";

/** 图谱完成度阈值：超过则视为「已学完」，跨图路径中排到末尾并标记完成 */
export const CROSS_GRAPH_COMPLETION_THRESHOLD = 0.85;

export interface CrossGraphNodeInput {
  graphId: string;
  title: string;
  description?: string;
  nodeCount: number;
  /** 0..1，图谱学习完成度（graph_learning 子任务完成率） */
  completion: number;
  domainIds: string[];
}

export interface CrossGraphRelationInput {
  sourceGraphId: string;
  targetGraphId: string;
  relationType: GraphRelationType;
}

export interface CrossGraphStage {
  graphId: string;
  graphTitle: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  isCompleted: boolean;
  completion: number;
  /** 前置图谱 id（仅 prerequisite/extension 关系） */
  prerequisites: string[];
}

/**
 * 构建图谱级依赖图：把 prerequisite / extension 关系视为有向边 source → target
 * （即「先学 source 图，再学 target 图」）。related / cross_domain 不参与排序。
 */
export function buildCrossGraphDependencyMaps(
  graphs: CrossGraphNodeInput[],
  relations: CrossGraphRelationInput[],
): { parentMap: Map<string, string[]>; childMap: Map<string, string[]> } {
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  graphs.forEach((g) => {
    parentMap.set(g.graphId, []);
    childMap.set(g.graphId, []);
  });

  relations.forEach((r) => {
    if (r.relationType !== "prerequisite" && r.relationType !== "extension") {
      return;
    }
    if (!parentMap.has(r.targetGraphId) || !childMap.has(r.sourceGraphId)) {
      return;
    }
    const parents = parentMap.get(r.targetGraphId) ?? [];
    if (!parents.includes(r.sourceGraphId)) {
      parents.push(r.sourceGraphId);
      parentMap.set(r.targetGraphId, parents);
    }
    const children = childMap.get(r.sourceGraphId) ?? [];
    if (!children.includes(r.targetGraphId)) {
      children.push(r.targetGraphId);
      childMap.set(r.sourceGraphId, children);
    }
  });

  return { parentMap, childMap };
}

/**
 * 图谱级规则路径生成（Kahn 拓扑排序）：
 * 1. 按「前置/扩展」关系约束顺序（有前置未排完则后置）；
 * 2. 同一可并行层内：未完成图谱优先 → 完成度升序 → 节点数降序 → 同领域相邻；
 * 3. 已完成的图谱排到末尾并标记 completed。
 */
export function generateCrossGraphRulePath(
  graphs: CrossGraphNodeInput[],
  relations: CrossGraphRelationInput[],
): { stages: CrossGraphStage[]; suggestions: string[] } {
  const { parentMap, childMap } = buildCrossGraphDependencyMaps(graphs, relations);
  const nodeById = new Map(graphs.map((g) => [g.graphId, g]));

  const inDegree = new Map<string, number>();
  graphs.forEach((g) => {
    inDegree.set(g.graphId, (parentMap.get(g.graphId) ?? []).length);
  });

  const isCompletedNode = (g: CrossGraphNodeInput) =>
    g.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD;

  // 就绪层排序：未完成优先 → 完成度升序 → 节点数降序 → 标题
  const sortReady = (list: string[]) => {
    return list.sort((aId, bId) => {
      const a = nodeById.get(aId);
      const b = nodeById.get(bId);
      if (!a || !b) return 0;
      if (isCompletedNode(a) !== isCompletedNode(b)) {
        return isCompletedNode(a) ? 1 : -1;
      }
      if (a.completion !== b.completion) return a.completion - b.completion;
      if (a.nodeCount !== b.nodeCount) return b.nodeCount - a.nodeCount;
      return a.title.localeCompare(b.title);
    });
  };

  // 首层就绪：无前置依赖的图谱
  let ready = graphs
    .filter((g) => (inDegree.get(g.graphId) ?? 0) === 0)
    .map((g) => g.graphId);
  ready = sortReady(ready);

  const ordered: string[] = [];
  const visited = new Set<string>();

  while (ready.length > 0) {
    const next = ready.shift();
    if (!next) break;
    if (visited.has(next)) continue;
    visited.add(next);
    ordered.push(next);

    for (const childId of childMap.get(next) ?? []) {
      const newDegree = (inDegree.get(childId) ?? 1) - 1;
      inDegree.set(childId, newDegree);
      if (newDegree === 0 && !visited.has(childId)) {
        ready.push(childId);
      }
    }
    ready = sortReady(ready);
  }

  // 处理环 / 未覆盖节点：追加到末尾
  if (visited.size < graphs.length) {
    const remaining = graphs
      .filter((g) => !visited.has(g.graphId))
      .map((g) => g.graphId);
    ordered.push(...sortReady(remaining));
    logger.info("[CrossGraphPath] graph dependency cycle detected, appended at end", {
      remaining: remaining.length,
    });
  }

  const suggestions: string[] = [];
  const stages: CrossGraphStage[] = ordered.map((graphId, index) => {
    const node = nodeById.get(graphId);
    if (!node) {
      return {
        graphId,
        graphTitle: graphId,
        order: index,
        priority: "low" as const,
        reason: "",
        isCompleted: false,
        completion: 0,
        prerequisites: [],
      };
    }
    const isCompleted = isCompletedNode(node);
    const priority: "high" | "medium" | "low" = isCompleted
      ? "low"
      : node.completion < 0.6
        ? "high"
        : "medium";
    const reason = isCompleted
      ? "已完成学习"
      : node.completion < 0.6
        ? "尚未开始或掌握度较低，优先学习"
        : "已进行中，继续巩固";
    return {
      graphId: node.graphId,
      graphTitle: node.title,
      order: index,
      priority,
      reason,
      isCompleted,
      completion: node.completion,
      prerequisites: parentMap.get(node.graphId) ?? [],
    };
  });

  const pendingCount = stages.filter((s) => !s.isCompleted).length;
  if (pendingCount === 0) {
    suggestions.push("所有图谱均已学完，可开始复习或新建学习目标");
  } else if (pendingCount > 8) {
    suggestions.push(`共 ${pendingCount} 张图谱待学，建议按路径顺序逐图推进`);
  }

  return { stages, suggestions };
}

/**
 * AI 目标驱动跨图谱路径：给定自然语言「学习目标」，让 AI 结合图谱地图（图谱 + 前置/扩展/相关）
 * 生成图谱级学习顺序。复用 DB 权威的 learning_path_generate 模板；无 AI key / 解析失败时回退规则算法。
 */
export async function generateCrossGraphAIPath(
  supabase: SupabaseClient,
  userId: string,
  graphs: CrossGraphNodeInput[],
  relations: CrossGraphRelationInput[],
  targetGoal: string,
  dailyTimeMinutes: number,
): Promise<{ stages: CrossGraphStage[]; suggestions: string[] }> {
  const provider = await getAIProviderForTask("text");
  if (!provider.hasKey) {
    return generateCrossGraphRulePath(graphs, relations);
  }

  const nodesInfo = graphs.map((g) => ({
    title: g.title,
    nodeCount: g.nodeCount,
    completion: Math.round(g.completion * 100) / 100,
    isCompleted: g.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD,
  }));
  const titleToGraphId = new Map(
    graphs.map((g) => [g.title.toLowerCase(), g.graphId]),
  );
  const graphByLowerTitle = new Map(
    graphs.map((g) => [g.title.toLowerCase(), g]),
  );
  const graphById = new Map(graphs.map((g) => [g.graphId, g]));
  const edgesInfo = relations.map((r) => ({
    source: graphById.get(r.sourceGraphId)?.title ?? r.sourceGraphId,
    target: graphById.get(r.targetGraphId)?.title ?? r.targetGraphId,
    relationship: r.relationType,
  }));

  const systemPrompt = await promptService.getRenderedPrompt(
    supabase,
    "learning_path_generate",
    {
      graphTitle: "图谱地图",
      targetGoal,
      dailyTimeMinutes,
      currentKnowledge: "未提供",
      nodesCount: graphs.length,
      isSequential: true,
      isExploratory: false,
      isFocused: false,
      targetGoalProvided: true,
    },
    userId,
  );

  const userMessage = `请根据以下图谱地图与学习目标，生成一份「图谱级」学习路径（顺序学习）。
学习目标：${targetGoal}
图谱列表：${JSON.stringify(nodesInfo, null, 2)}
图谱关系（source → target，含前置/扩展/相关）：${JSON.stringify(edgesInfo, null, 2)}

要求：
1. 先学前置/基础图谱，再学依赖它的扩展图谱；同层图谱按重要性与完成度排序（未完成的优先）；
2. 每个图谱给出 priority（high/medium/low）、reason（简短中文理由）、estimatedTime（分钟）、prerequisites（前置图谱标题，用输入中的精确标题）；
3. 返回 JSON：{"path":[{"nodeTitle":"...","priority":"high","reason":"...","estimatedTime":30,"prerequisites":[]}],"suggestions":["..."]}`;

  try {
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"path": [], "suggestions": []}');
    const stages: CrossGraphStage[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < (parsed.path || []).length; index++) {
      const item = parsed.path[index];
      let graph = item?.nodeTitle
        ? graphByLowerTitle.get(String(item.nodeTitle).toLowerCase())
        : undefined;
      if (!graph && item?.nodeTitle) {
        const lower = String(item.nodeTitle).toLowerCase();
        graph = graphs.find(
          (g) =>
            g.title.toLowerCase().includes(lower) ||
            lower.includes(g.title.toLowerCase()),
        );
      }
      if (!graph || seen.has(graph.graphId)) continue;
      seen.add(graph.graphId);
      stages.push({
        graphId: graph.graphId,
        graphTitle: graph.title,
        order: stages.length,
        priority: item.priority === "low" ? "low" : item.priority === "medium" ? "medium" : "high",
        reason: item.reason || "",
        isCompleted: graph.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD,
        completion: graph.completion,
        prerequisites: (item.prerequisites || [])
          .map((p: string) => titleToGraphId.get(String(p).toLowerCase()) || p)
          .filter(Boolean),
      });
    }

    // 未命中图谱（标题改动/新增）追加到末尾，保证路径覆盖全部图谱
    for (const g of graphs) {
      if (!seen.has(g.graphId)) {
        stages.push({
          graphId: g.graphId,
          graphTitle: g.title,
          order: stages.length,
          priority: g.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD ? "low" : "medium",
          reason: "补充图谱",
          isCompleted: g.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD,
          completion: g.completion,
          prerequisites: [],
        });
      }
    }

    return {
      stages,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch (error) {
    logger.error("[CrossGraphPath] AI path generation failed, fallback to rule", {
      error: error instanceof Error ? error.message : String(error),
    });
    return generateCrossGraphRulePath(graphs, relations);
  }
}
