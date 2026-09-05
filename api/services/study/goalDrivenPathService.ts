/**
 * 目标驱动跨图谱学习路径服务。
 *
 * 职责：
 * 1. 构建「图谱地图摘要」（图谱标题/节点数/完成度/描述）供 AI 对话与候选生成使用；
 * 2. dialogStream：AI 对话澄清用户学习目标（SSE 流式，复用 chatService 流式循环）；
 * 3. generateVariants：结合图谱地图 + 澄清后的目标，一次生成多条候选跨图谱学习路径；
 * 4. saveVariant：保存用户选中的候选路径（归档旧 active 跨图路径，落库 cross_graph）。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import type { Response } from "express";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { graphCrudService } from "../graph/graphCrudService";
import { crossGraphLearningPathService } from "./crossGraphLearningPathService";
import { learningPathService } from "./learningPathService";
import {
  generateCrossGraphRulePath,
  CROSS_GRAPH_COMPLETION_THRESHOLD,
  type CrossGraphNodeInput,
  type CrossGraphRelationInput,
  type CrossGraphStage,
} from "./crossGraphPathAlgorithms";
import { searchSimilarGraphs } from "../../utils/similaritySearch";
import { stageWindowPlannerService } from "../scheduler/planning/stageWindowPlannerService";
import { getAIProvider, getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { chatService } from "../ai/chatService";
import { getSupabaseAdmin } from "../../supabase";
import { getMockResponse } from "../ai/mock";
import { parseAIResponse } from "../ai/utils";
import {
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "../../routes/ai/utils";
import type { AuthRequest } from "../../middleware/auth";

/** 一次喂给 AI 的图谱列表上限：超大图谱地图时不无限膨胀输入（正常规模不触发，关系仍全量用于排序） */
export const CROSS_GRAPH_INPUT_CAP = 80;

export type VariantEmphasis = "goal_oriented" | "systematic" | "quick_overview";

export interface VariantStage {
  graphId: string;
  graphTitle: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  estimatedTime: number;
}

export interface CrossGraphPathVariant {
  id: string;
  name: string;
  description: string;
  emphasis: VariantEmphasis;
  estimatedWeeks?: number;
  totalEstimatedMinutes?: number;
  stages: VariantStage[];
  suggestions: string[];
}

/** 图谱地图选中内容的解析模型（含一跳/二跳邻居展开） */
interface SelectionModel {
  hasSelection: boolean;
  /** 用户直接选中的图谱（最优先） */
  selectedGraphs: Array<{ id: string; title: string }>;
  /** 一跳邻居（次优先，含关系类型详情） */
  oneHopGraphs: Array<{ id: string; title: string; relationTypes: string[] }>;
  /** 二跳邻居（简要参照，最多 30 个，含标题） */
  twoHopGraphs: Array<{ id: string; title: string }>;
  /** 选中 + 一跳邻居的组合 id（用于规则回退排优先） */
  priorityGraphIds: string[];
  /** 选中的领域及其成员图谱标题 */
  selectedDomains: Array<{ name: string; graphTitles: string[] }>;
}

class GoalDrivenPathService {
  /**
   * 构建图谱地图摘要（供 AI 对话 / 候选生成）。每图一行，描述截断，可设上限防止上下文过大。
   * @param graphsOverride 可选：外部已取到的图谱数组（如已按目标语义排序），传入则复用其顺序与数据，避免重复查库；
   *                       省略时内部走 getGraphMap 自取。
   */
  async buildGraphContextSummary(
    supabase: SupabaseClient,
    userId: string,
    opts?: { cap?: number; graphsOverride?: Array<Record<string, unknown>> },
  ): Promise<string> {
    const cap = opts?.cap ?? 40;
    const graphsRaw =
      opts?.graphsOverride ??
      (await graphCrudService.getGraphMap(supabase, userId)).graphs ??
      [];
    if (graphsRaw.length === 0) return "图谱地图为空";

    const graphIds = graphsRaw.map((g) => (g as { id: string }).id);
    const completionMap =
      await crossGraphLearningPathService.computeGraphCompletions(
        supabase,
        userId,
        graphIds,
      );
    // 领域 id → 名称映射：让 AI 对话 / 建议目标 / 候选路径感知领域
    const domainNameMap = await this.loadDomainNameMap(supabase, graphsRaw);

    const lines: string[] = [];
    for (const raw of graphsRaw.slice(0, cap)) {
      const g = raw as {
        id: string;
        title?: string;
        description?: string;
        node_count?: number;
        nodes_count?: number;
        domainIds?: string[];
        domain_ids?: string[];
      };
      const title = g.title ?? g.id;
      const nodeCount = g.node_count ?? g.nodes_count ?? 0;
      const completion = completionMap.get(g.id) ?? 0;
      const domainNames = (g.domainIds ?? g.domain_ids ?? [])
        .map((id) => domainNameMap.get(id))
        .filter((n): n is string => !!n);
      const domainPart =
        domainNames.length > 0 ? `、领域: ${domainNames.join("/")}` : "";
      const desc = (g.description ?? "").trim();
      const descPart = desc ? ` · ${desc.slice(0, 60)}` : "";
      lines.push(
        `- 【${title}】(知识点: ${nodeCount}${domainPart}、完成度: ${Math.round(completion * 100)}%)${descPart}`,
      );
    }
    if (graphsRaw.length > cap) {
      lines.push(
        `另有 ${graphsRaw.length - cap} 张图谱未列出（未命中标题的图谱会自动补到路径末尾）`,
      );
    }
    return lines.join("\n");
  }

  /**
   * AI 对话澄清学习目标（SSE 流式）。
   * 无 AI key 时回退到本地 mock 文本，保证流程可走通。
   */
  async dialogStream(
    req: AuthRequest,
    res: Response,
    options: {
      message: string;
      history?: Array<{ role: string; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      sessionId: string;
      selectedGraphIds?: string[];
      selectedDomainIds?: string[];
    },
  ): Promise<void> {
    try {
      const provider = options.provider
        ? await getAIProvider(options.provider as AIProviderType)
        : await getAIProviderForTask("text");

      if (!provider.hasKey) {
        await this.streamMock(res, String(getMockResponse("chat", options.message)));
        return;
      }

      const supabase = req.supabase;
      if (!supabase) {
        sendStreamError(res, "未授权", ErrorCodes.AUTH_UNAUTHORIZED);
        return;
      }

      const graphContextSummary = await this.buildGraphContextSummary(
        supabase,
        req.user.id,
      );
      const selectionModel = await this.buildSelectionModel(supabase, req.user.id, {
        selectedGraphIds: options.selectedGraphIds,
        selectedDomainIds: options.selectedDomainIds,
      });
      const selectionContext = this.selectionModelToContext(selectionModel);

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "cross_graph_goal_dialog",
        { graphContextSummary, selectionContext },
        req.user.id,
        undefined,
        options.language,
      );

      const messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [
        { role: "system", content: systemPrompt },
        ...(options.history ?? []).map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
        { role: "user", content: options.message },
      ];

      const model = options.model || provider.model;

      await chatService.streamMessages(res, provider, messages, model, {
        operation: "cross_graph_goal_dialog",
        metadata: {
          userId: req.user.id,
          graphId: undefined,
          topic: options.message.slice(0, 50),
        },
        sessionId: options.sessionId,
      });
      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[GoalDrivenPath] dialog stream error:", error);
      sendStreamError(
        res,
        err.message || "AI 对话失败",
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  /**
   * 基于图谱地图生成学习目标建议（复用 learning_path_questions 的"建议目标"职责）。
   * 上下文包含：图谱地图逐图概览 + 领域分布聚合，确保建议目标覆盖多个图谱/领域。
   * 无 AI key / 解析失败时回退到按领域聚合的规则建议。
   */
  async suggestGoals(
    supabase: SupabaseClient,
    userId: string,
    opts?: {
      provider?: string;
      model?: string;
      selectedGraphIds?: string[];
      selectedDomainIds?: string[];
    },
  ): Promise<{ suggestedGoals: string[] }> {
    const provider = opts?.provider
      ? await getAIProvider(opts.provider as AIProviderType)
      : await getAIProviderForTask("text");

    const mapData = await graphCrudService.getGraphMap(supabase, userId);
    const graphsRaw = mapData.graphs ?? [];
    if (graphsRaw.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "图谱地图为空，无法生成目标建议",
      });
    }

    const domainNameMap = await this.loadDomainNameMap(supabase, graphsRaw);
    const domainSummary = this.buildDomainSummary(graphsRaw, domainNameMap);
    const selectionModel = await this.buildSelectionModel(
      supabase,
      userId,
      {
        selectedGraphIds: opts?.selectedGraphIds,
        selectedDomainIds: opts?.selectedDomainIds,
      },
    );
    const selectionContext = this.selectionModelToContext(selectionModel);

    const ruleSelection = selectionModel.hasSelection
      ? {
          // 规则回退也纳入一跳邻居：选中图最优先，邻居次之
          priorityGraphIds: selectionModel.priorityGraphIds,
          selectedDomainIds: opts?.selectedDomainIds,
        }
      : undefined;

    if (!provider.hasKey) {
      return {
        suggestedGoals: this.ruleSuggestGoals(
          graphsRaw,
          domainNameMap,
          ruleSelection,
        ),
      };
    }

    // 目标建议必须覆盖全部图谱，避免前 N 张之外的图谱被遗漏（cap 传入全量）
    const graphContextSummary = await this.buildGraphContextSummary(
      supabase,
      userId,
      { cap: graphsRaw.length },
    );

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "cross_graph_goal_suggest",
      { graphContextSummary, domainSummary, selectionContext },
      userId,
      undefined,
      undefined,
    );

    const selectionInstruction = selectionContext
      ? `用户已在图谱地图上选中了特定图谱/领域（见下方「图谱地图选中内容」），学习目标必须围绕这些选中元素展开，优先覆盖选中的图谱与领域，其次再补充关联内容。`
      : "";
    const userMessage = `请根据以下图谱地图概览与领域分布，生成 5-6 个学习目标建议：
${selectionInstruction}
${selectionContext ? `图谱地图选中内容：\n${selectionContext}\n` : ""}
图谱地图概览：
${graphContextSummary}

领域分布：
${domainSummary}

要求：
1. 目标之间要明显不同，覆盖多种学习意图（如快速概览、系统入门、实践项目、深入掌握、考试/求职、兴趣探索）；
2. 每个目标应覆盖多个图谱/领域（引用 2-4 个图谱标题），不要只围绕单个图谱；
3. 结合图谱完成度与前置关系，优先推荐可填补知识缺口的目标；
4. 每个目标 20-50 字，简洁有动力，避免重复相近的表述。`;

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: opts?.model || provider.model,
        response_format: { type: "json_object" },
        // 调大 token 上限：deepseek 系模型 max_tokens 为 thinking + 正文合计上限，
        // 过小会挤占正文导致建议空/缺项；与 generateVariants 保持一致的 32000
        max_tokens: 32000,
      });

      const content = completion.choices[0].message.content || "";
      const parsed = parseAIResponse<{ suggestedGoals?: string[] }>(
        content,
        "cross_graph_goal_suggest",
      );
      const goals = (parsed.suggestedGoals ?? [])
        .map((g) => String(g).trim())
        .filter(Boolean)
        .slice(0, 6);

      if (goals.length > 0) return { suggestedGoals: goals };
      return {
        suggestedGoals: this.ruleSuggestGoals(
          graphsRaw,
          domainNameMap,
          ruleSelection,
        ),
      };
    } catch (error) {
      logger.error(
        "[GoalDrivenPath] suggestGoals failed, fallback to rule:",
        error,
      );
      return {
        suggestedGoals: this.ruleSuggestGoals(
          graphsRaw,
          domainNameMap,
          ruleSelection,
        ),
      };
    }
  }

  /**
   * 生成候选跨图谱学习路径变体（一次调用返回多条，不同侧重）。
   * 无 AI key / 解析失败时回退为规则算法生成的单条「系统全面」变体。
   */
  async generateVariants(
    supabase: SupabaseClient,
    userId: string,
    opts: {
      targetGoal: string;
      conversationTranscript?: string;
      dailyMinutes?: number;
      variantCount?: number;
      provider?: string;
      model?: string;
      selectedGraphIds?: string[];
      selectedDomainIds?: string[];
    },
  ): Promise<{ variants: CrossGraphPathVariant[] }> {
    const provider = opts.provider
      ? await getAIProvider(opts.provider as AIProviderType)
      : await getAIProviderForTask("text");

    const dailyMinutes = opts.dailyMinutes ?? 30;
    const variantCount = Math.min(3, Math.max(2, opts.variantCount ?? 3));

    const mapData = await graphCrudService.getGraphMap(supabase, userId);
    const graphsRaw = mapData.graphs ?? [];
    if (graphsRaw.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "图谱地图为空，无法生成候选路径",
      });
    }

    const graphIds = graphsRaw.map((g) => (g as { id: string }).id);
    const completionMap =
      await crossGraphLearningPathService.computeGraphCompletions(
        supabase,
        userId,
        graphIds,
      );

    // 用学习目标语义检索图谱，把与目标相关的图谱排到前面，
    // 确保截取图谱列表（CROSS_GRAPH_INPUT_CAP）时优先纳入相关图谱，而非按最后使用时间机械截取
    const orderedGraphsRaw = await this.rankGraphsByRelevance(
      supabase,
      userId,
      opts.targetGoal,
      graphsRaw,
    );

    const graphs: CrossGraphNodeInput[] = orderedGraphsRaw.map((g) => {
      const raw = g as {
        id: string;
        title?: string;
        description?: string;
        node_count?: number;
        nodes_count?: number;
        domainIds?: string[];
        domain_ids?: string[];
      };
      return {
        graphId: raw.id,
        title: raw.title ?? raw.id,
        description: raw.description ?? undefined,
        nodeCount: raw.node_count ?? raw.nodes_count ?? 0,
        completion: completionMap.get(raw.id) ?? 0,
        domainIds: raw.domainIds ?? raw.domain_ids ?? [],
      };
    });

    const relations: CrossGraphRelationInput[] = (mapData.relations ?? []).map(
      (r) => {
        const raw = r as {
          source_graph_id: string;
          target_graph_id: string;
          relation_type: string;
        };
        return {
          sourceGraphId: raw.source_graph_id,
          targetGraphId: raw.target_graph_id,
          relationType: (raw.relation_type ?? "related") as CrossGraphRelationInput["relationType"],
        };
      },
    );

    const selectionModel = await this.buildSelectionModel(supabase, userId, {
      selectedGraphIds: opts.selectedGraphIds,
      selectedDomainIds: opts.selectedDomainIds,
    });
    const selectionContext = this.selectionModelToContext(selectionModel);

    const fallback = () => {
      const rule = generateCrossGraphRulePath(graphs, relations);
      // 规则回退优先：选中图最前，一跳邻居次之
      const stages = this.prioritizeSelectedStages(
        rule.stages,
        selectionModel.priorityGraphIds,
      );
      return {
        variants: [rulePathToVariant("systematic", stages, rule.suggestions)],
      };
    };

    if (!provider.hasKey) {
      return fallback();
    }

    const graphContextSummary = await this.buildGraphContextSummary(
      supabase,
      userId,
      // 复用已按目标语义排序的图谱顺序，system 概览同样相关图谱优先
      { graphsOverride: orderedGraphsRaw },
    );

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "cross_graph_path_variants",
      {
        graphContextSummary,
        selectionContext,
        targetGoal: opts.targetGoal,
        conversationTranscript: opts.conversationTranscript ?? "",
        variantCount,
        dailyTimeMinutes: dailyMinutes,
      },
      userId,
      undefined,
      undefined,
    );

    // 领域 id → 名称映射：让候选路径生成感知领域
    const domainNameMap = await this.loadDomainNameMap(supabase, graphsRaw);

    const userMessage = this.buildVariantsUserMessage(
      graphs.map((g) => ({
        title: g.title,
        nodeCount: g.nodeCount,
        completion: Math.round(g.completion * 100) / 100,
        isCompleted: g.completion >= CROSS_GRAPH_COMPLETION_THRESHOLD,
        domainNames: g.domainIds
          .map((id) => domainNameMap.get(id))
          .filter((n): n is string => !!n),
      })),
      relations,
      opts.targetGoal,
      dailyMinutes,
      selectionContext,
    );

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: opts.model || provider.model,
        response_format: { type: "json_object" },
        max_tokens: 32000,
      });

      const content = completion.choices[0].message.content || "";
      const parsed = parseAIResponse<{
        variants?: Array<Record<string, unknown>>;
        suggestions?: string[];
      }>(content, "cross_graph_path_variants");

      const variants = this.normalizeVariants(parsed.variants ?? [], graphs);

      if (variants.length === 0) {
        logger.warn("[GoalDrivenPath] no valid variants parsed, fallback to rule");
        return fallback();
      }
      return { variants };
    } catch (error) {
      logger.error(
        "[GoalDrivenPath] generateVariants failed, fallback to rule:",
        error,
      );
      return fallback();
    }
  }

  /**
   * 保存用户选中的候选路径：先归档旧 active 跨图路径，再创建新的 cross_graph 路径。
   */
  async saveVariant(
    supabase: SupabaseClient,
    userId: string,
    opts: {
      variant: {
        id: string;
        name: string;
        description?: string;
        emphasis?: string;
        stages: Array<{
          graph_id: string;
          graph_title: string;
          order: number;
          priority: "high" | "medium" | "low";
          reason?: string;
          estimated_time: number;
        }>;
      };
      targetGoal?: string;
      dailyMinutes?: number;
    },
  ): Promise<{
    pathId: string;
    pathTitle: string;
    stages: VariantStage[];
    archivedOld: boolean;
  }> {
    const stages: VariantStage[] = opts.variant.stages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, index) => ({
        graphId: s.graph_id,
        graphTitle: s.graph_title,
        order: index,
        priority: s.priority,
        reason: s.reason ?? "",
        estimatedTime: s.estimated_time,
      }));

    if (stages.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "候选路径为空，无法保存",
      });
    }

    // 允许多条 active 跨图路径按「目标」并存：不同目标各自成路径，不归档旧路径。
    // （大调度对多路径的选择/切换由调度层后续适配，这里只保证生成链路允许多条并存。）
    const archivedOld = false;

    const savedPath = await learningPathService.createLearningPath(
      supabase,
      userId,
      {
        // 路径名体现学习目标，而非固定的「系统全面」等文案；目标过长时截断
        title: opts.targetGoal
          ? `${opts.targetGoal.trim().slice(0, 30)} · 学习路径`
          : opts.variant.name,
        description: opts.variant.description,
        goal: opts.targetGoal,
        path_type: "cross_graph",
        ai_generated: true,
        daily_minutes_target: opts.dailyMinutes,
        nodes: stages.map((s, index) => ({
          graph_id: s.graphId,
          order_index: index,
          title: s.graphTitle,
          description: s.reason,
          estimated_time: s.estimatedTime,
          is_milestone: s.priority === "high",
        })),
      },
    );

    logger.info("[GoalDrivenPath] saved variant", {
      userId,
      pathId: savedPath.id,
      archivedOld,
      stageCount: stages.length,
    });

    // P2 两级排课：大路径保存后自动排周窗口（失败不阻塞保存）
    stageWindowPlannerService
      .planStageWindows(supabase, userId, savedPath.id)
      .catch((err: unknown) => {
        logger.warn("[GoalDrivenPath] plan stage windows failed", {
          pathId: savedPath.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return {
      pathId: savedPath.id,
      pathTitle: savedPath.title,
      stages,
      archivedOld,
    };
  }

  // ── 私有工具 ───────────────────────────────────────────────

  private async streamMock(res: Response, content: string): Promise<void> {
    const chunks = content.split("");
    for (const chunk of chunks) {
      sendStreamChunk(res, chunk);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    sendStreamDone(res);
  }

  /** 无 AI key / AI 失败时，按领域聚合生成覆盖多图谱/领域的规则建议目标；
   *  若用户在图谱地图上选中了图谱/领域，则优先围绕选中元素（含一跳邻居）生成目标。 */
  private ruleSuggestGoals(
    graphsRaw: Array<Record<string, unknown>>,
    domainNameMap: Map<string, string>,
    selection?: { priorityGraphIds?: string[]; selectedDomainIds?: string[] },
  ): string[] {
    const priorityIdSet = new Set(selection?.priorityGraphIds ?? []);
    const selectedDomainSet = new Set(selection?.selectedDomainIds ?? []);
    const hasSelection = priorityIdSet.size > 0 || selectedDomainSet.size > 0;

    if (hasSelection) {
      return this.ruleSuggestGoalsForSelection(
        graphsRaw,
        domainNameMap,
        priorityIdSet,
        selectedDomainSet,
      );
    }

    const entries = this.groupGraphsByDomain(graphsRaw, domainNameMap);
    const goals: string[] = [];
    for (const entry of entries.slice(0, 3)) {
      const sample = entry.titles.slice(0, 3).join("、");
      goals.push(`系统掌握「${entry.name}」领域的核心图谱（${sample}）`);
    }
    if (entries.length >= 2) {
      goals.push(
        `将「${entries[0].name}」与「${entries[1].name}」知识结合，完成一个综合实践项目`,
      );
    }
    if (entries.length >= 3) {
      goals.push(
        `先建立全部图谱的整体概览，再深入「${entries[0].name}」领域`,
      );
    }
    goals.push("对整个图谱地图建立系统性概览，形成知识网络");
    return goals.slice(0, 6);
  }

  /** 围绕用户在图谱地图上选中的图谱（含一跳邻居）/领域生成目标建议 */
  private ruleSuggestGoalsForSelection(
    graphsRaw: Array<Record<string, unknown>>,
    domainNameMap: Map<string, string>,
    priorityIdSet: Set<string>,
    selectedDomainSet: Set<string>,
  ): string[] {
    const goals: string[] = [];

    // 选中的图谱（画布节点）+ 一跳邻居导向
    const selectedGraphTitles = graphsRaw
      .filter((raw) =>
        priorityIdSet.has((raw as { id: string }).id),
      )
      .map(
        (raw) =>
          (raw as { title?: string }).title ?? (raw as { id: string }).id,
      );
    if (selectedGraphTitles.length > 0) {
      goals.push(
        `围绕选中的图谱「${selectedGraphTitles.slice(0, 4).join("、")}」系统掌握其核心知识`,
      );
      goals.push(
        `以选中的「${selectedGraphTitles[0]}」为核心，连同其直接关联图谱一起学习，形成完整知识网络`,
      );
    }

    // 选中的领域导向
    const selectedDomainNames = Array.from(selectedDomainSet)
      .map((id) => domainNameMap.get(id))
      .filter((n): n is string => !!n);
    if (selectedDomainNames.length > 0) {
      goals.push(
        `深入掌握「${selectedDomainNames.slice(0, 3).join("、")}」领域的知识体系`,
      );
      const domainGraphTitles = graphsRaw
        .filter((raw) => {
          const ids =
            (raw as { domainIds?: string[] }).domainIds ??
            (raw as { domain_ids?: string[] }).domain_ids ??
            [];
          return ids.some((id) => selectedDomainSet.has(id));
        })
        .slice(0, 4)
        .map(
          (raw) =>
            (raw as { title?: string }).title ?? (raw as { id: string }).id,
        );
      if (domainGraphTitles.length > 0) {
        goals.push(
          `结合「${domainGraphTitles.join("、")}」完成一个综合实践项目，学以致用`,
        );
      }
    }

    // 补充系统性目标，保证覆盖完整知识网络
    goals.push("对整个图谱地图建立系统性概览，将选中内容与全局知识衔接");
    return goals.slice(0, 6);
  }

  /** 按领域聚合图谱标题（id → 名称），按图谱数量降序，未分类放最后 */
  private groupGraphsByDomain(
    graphsRaw: Array<Record<string, unknown>>,
    domainNameMap: Map<string, string>,
  ): Array<{ name: string; titles: string[] }> {
    const byDomain = new Map<string, string[]>();
    const uncategorized: string[] = [];
    for (const raw of graphsRaw) {
      const g = raw as {
        id: string;
        title?: string;
        domainIds?: string[];
        domain_ids?: string[];
      };
      const title = g.title ?? g.id;
      const ids = g.domainIds ?? g.domain_ids ?? [];
      if (ids.length === 0) {
        uncategorized.push(title);
        continue;
      }
      for (const id of ids) {
        const name = domainNameMap.get(id) ?? "未分类";
        const list = byDomain.get(name) ?? [];
        list.push(title);
        byDomain.set(name, list);
      }
    }
    const entries = Array.from(byDomain.entries())
      .map(([name, titles]) => ({ name, titles }))
      .sort((a, b) => b.titles.length - a.titles.length);
    if (uncategorized.length > 0) {
      entries.push({ name: "未分类", titles: uncategorized });
    }
    return entries;
  }

  /** 领域分布摘要（供 AI 建议目标参考） */
  private async rankGraphsByRelevance(
    supabase: SupabaseClient,
    userId: string,
    targetGoal: string,
    graphsRaw: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      // 用目标语义检索图谱：返回按相似度降序的相关图谱。
      // 低阈值+大 limit 尽量纳入更多候选；无 embedding / 未命中的图谱保持原顺序靠后兜底。
      const { similarGraphs } = await searchSimilarGraphs(
        supabase,
        userId,
        targetGoal,
        {
          threshold: 0.3,
          limit: Math.max(CROSS_GRAPH_INPUT_CAP, graphsRaw.length),
        },
      );
      const hits = similarGraphs ?? [];
      if (hits.length === 0) return graphsRaw;

      const hitIdSet = new Set(hits.map((h) => h.id));
      const ranked: Array<Record<string, unknown>> = [];
      const rankedIds = new Set<string>();
      // 相关图谱在前（保持相似度降序）
      for (const h of hits) {
        const graph = graphsRaw.find(
          (g) => (g as { id: string }).id === h.id,
        );
        if (graph && !rankedIds.has(h.id)) {
          ranked.push(graph);
          rankedIds.add(h.id);
        }
      }
      // 未命中/无 embedding 的图谱按原顺序补在后面，避免遗漏
      for (const g of graphsRaw) {
        const id = (g as { id: string }).id;
        if (!hitIdSet.has(id)) ranked.push(g);
      }
      return ranked;
    } catch (error) {
      logger.warn(
        "[GoalDrivenPath] rankGraphsByRelevance failed, keep default order:",
        error,
      );
      return graphsRaw;
    }
  }

  private buildDomainSummary(
    graphsRaw: Array<Record<string, unknown>>,
    domainNameMap: Map<string, string>,
  ): string {
    const entries = this.groupGraphsByDomain(graphsRaw, domainNameMap);
    if (entries.length === 0) return "（无领域信息）";
    return entries
      .map(
        (e) =>
          `- 领域「${e.name}」(${e.titles.length} 张): ${e.titles.join("、")}`,
      )
      .join("\n");
  }

  /** 从图谱的 domainIds 批量查询领域名称（id → name） */
  private async loadDomainNameMap(
    supabase: SupabaseClient,
    graphsRaw: Array<Record<string, unknown>>,
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const raw of graphsRaw) {
      const arr =
        (raw as { domainIds?: string[]; domain_ids?: string[] }).domainIds ??
        (raw as { domainIds?: string[]; domain_ids?: string[] }).domain_ids ??
        [];
      for (const id of arr) ids.add(id);
    }
    if (ids.size === 0) return new Map();

    const { data } = await supabase
      .from("domains")
      .select("id, name")
      .in("id", Array.from(ids));
    const map = new Map<string, string>();
    (data ?? []).forEach((d) => {
      map.set(
        (d as { id: string }).id,
        (d as { name: string }).name,
      );
    });
    return map;
  }

  /**
   * 构建「图谱地图选中内容」模型：把用户在图谱地图上选中的图谱（画布节点）与
   * 领域解析成结构化模型，并基于图谱关系做 BFS 展开一跳（详细）/二跳（简要）邻居。
   * 作为学习路径创建的主要上下文注入 AI 提示词。无选中时返回空模型。
   */
  private async buildSelectionModel(
    supabase: SupabaseClient,
    userId: string,
    selection: { selectedGraphIds?: string[]; selectedDomainIds?: string[] },
  ): Promise<SelectionModel> {
    const empty: SelectionModel = {
      hasSelection: false,
      selectedGraphs: [],
      oneHopGraphs: [],
      twoHopGraphs: [],
      priorityGraphIds: [],
      selectedDomains: [],
    };

    const selectedGraphIds = selection.selectedGraphIds ?? [];
    const selectedDomainIds = selection.selectedDomainIds ?? [];
    if (selectedGraphIds.length === 0 && selectedDomainIds.length === 0) {
      return empty;
    }

    const mapData = await graphCrudService.getGraphMap(supabase, userId);
    const graphsRaw = (mapData.graphs ?? []) as Array<Record<string, unknown>>;
    const domainNameMap = await this.loadDomainNameMap(supabase, graphsRaw);

    const graphById = new Map<string, { id: string; title: string }>();
    for (const raw of graphsRaw) {
      const id = (raw as { id: string }).id;
      graphById.set(id, {
        id,
        title: (raw as { title?: string }).title ?? id,
      });
    }

    const selectedSet = new Set(selectedGraphIds);
    const selectedGraphs = selectedGraphIds
      .map((id) => graphById.get(id))
      .filter((g): g is { id: string; title: string } => !!g);

    // 图谱关系 → 无向邻接表（图的关联不分方向）
    const adjacency = new Map<string, Map<string, Set<string>>>();
    const addEdge = (a: string, b: string, type: string) => {
      if (a === b) return;
      let fromMap = adjacency.get(a);
      if (!fromMap) {
        fromMap = new Map();
        adjacency.set(a, fromMap);
      }
      let set = fromMap.get(b);
      if (!set) {
        set = new Set();
        fromMap.set(b, set);
      }
      set.add(type);
    };
    for (const r of mapData.relations ?? []) {
      const rel = r as {
        source_graph_id: string;
        target_graph_id: string;
        relation_type?: string;
      };
      const type = rel.relation_type ?? "related";
      addEdge(rel.source_graph_id, rel.target_graph_id, type);
      addEdge(rel.target_graph_id, rel.source_graph_id, type);
    }

    // BFS 一跳：与任一选中图直接相邻
    const oneHopMap = new Map<string, Set<string>>();
    for (const id of selectedGraphIds) {
      const neighbors = adjacency.get(id);
      if (!neighbors) continue;
      for (const [nid, types] of neighbors) {
        if (selectedSet.has(nid)) continue;
        const acc = oneHopMap.get(nid) ?? new Set<string>();
        types.forEach((t) => acc.add(t));
        oneHopMap.set(nid, acc);
      }
    }
    const oneHopGraphs = Array.from(oneHopMap.entries())
      .map(([id, types]) => {
        const g = graphById.get(id);
        return g
          ? { id, title: g.title, relationTypes: Array.from(types) }
          : null;
      })
      .filter((g): g is { id: string; title: string; relationTypes: string[] } => !!g)
      .sort((a, b) => a.title.localeCompare(b.title, "zh"));

    // BFS 二跳：一跳邻居的邻居，去掉已选中/一跳；简要参照，限 30 个
    const oneHopSet = new Set(oneHopMap.keys());
    const twoHopSet = new Set<string>();
    for (const id of oneHopSet) {
      const neighbors = adjacency.get(id);
      if (!neighbors) continue;
      for (const nid of neighbors.keys()) {
        if (!selectedSet.has(nid) && !oneHopSet.has(nid)) {
          twoHopSet.add(nid);
        }
      }
    }
    const twoHopGraphs = Array.from(twoHopSet)
      .map((id) => graphById.get(id))
      .filter((g): g is { id: string; title: string } => !!g)
      .sort((a, b) => a.title.localeCompare(b.title, "zh"))
      .slice(0, 30);

    // 选中的领域
    const selectedDomainNames = Array.from(new Set(selectedDomainIds))
      .map((id) => domainNameMap.get(id))
      .filter((n): n is string => !!n);
    const selectedDomains = selectedDomainNames.map((name) => {
      const graphTitles = graphsRaw
        .filter((raw) => {
          const ids =
            (raw as { domainIds?: string[] }).domainIds ??
            (raw as { domain_ids?: string[] }).domain_ids ??
            [];
          return ids.some((did) => selectedDomainIds.includes(did));
        })
        .map(
          (raw) =>
            (raw as { title?: string }).title ?? (raw as { id: string }).id,
        );
      return { name, graphTitles };
    });

    const priorityGraphIds = Array.from(
      new Set([...selectedGraphIds, ...oneHopSet]),
    );

    return {
      hasSelection: true,
      selectedGraphs,
      oneHopGraphs,
      twoHopGraphs,
      priorityGraphIds,
      selectedDomains,
    };
  }

  /** 把选择模型渲染成「图谱地图选中内容」文本（无选中返回空串） */
  private selectionModelToContext(model: SelectionModel): string {
    if (!model.hasSelection) return "";
    const lines: string[] = [];

    if (model.selectedGraphs.length > 0) {
      lines.push(
        `- 用户当前选中的图谱（${model.selectedGraphs.length} 个，最优先学习对象）: ${model.selectedGraphs.map((g) => g.title).join("、")}`,
      );
    }

    if (model.oneHopGraphs.length > 0) {
      const detail = model.oneHopGraphs
        .map((g) => `  - ${g.title}（${g.relationTypes.join("/")}）`)
        .join("\n");
      lines.push(
        `- 与选中图谱直接相邻的图谱（距离1，次优先，可围绕选中展开）:\n${detail}`,
      );
    }

    if (model.twoHopGraphs.length > 0) {
      const titles = model.twoHopGraphs.map((g) => g.title).join("、");
      lines.push(
        `- 更远的关联图谱（距离2，简要参照，不必重点覆盖）: ${titles}`,
      );
    }

    if (model.selectedDomains.length > 0) {
      const domainLines = model.selectedDomains
        .map(
          (d) =>
            `- 领域「${d.name}」: ${d.graphTitles.join("、") || "（无图谱）"}`,
        )
        .join("\n");
      lines.push(
        `- 用户当前选中的领域（${model.selectedDomains.length} 个，重点学习范围）:\n${domainLines}`,
      );
    }

    return lines.join("\n");
  }

  /** 规则回退路径中，把用户选中的图谱阶段提前到靠前位置（保持相对顺序稳定） */
  private prioritizeSelectedStages(
    stages: CrossGraphStage[],
    selectedGraphIds?: string[],
  ): CrossGraphStage[] {
    const selectedSet = new Set(selectedGraphIds ?? []);
    if (selectedSet.size === 0) return stages;
    const selected = stages.filter((s) => selectedSet.has(s.graphId));
    const rest = stages.filter((s) => !selectedSet.has(s.graphId));
    return [...selected, ...rest];
  }

  private buildVariantsUserMessage(
    graphs: Array<{
      title: string;
      nodeCount: number;
      completion: number;
      isCompleted: boolean;
      domainNames?: string[];
    }>,
    relations: CrossGraphRelationInput[],
    targetGoal: string,
    dailyMinutes: number,
    selectionContext: string,
  ): string {
    // 输入控制：避免超大图谱地图一次性塞爆 prompt（关系仍全量用于排序，仅列举列表截断）
    const listedGraphs = graphs.slice(0, CROSS_GRAPH_INPUT_CAP);
    const omitted = graphs.length - listedGraphs.length;
    const graphById = new Map(graphs.map((g) => [g.title.toLowerCase(), g]));
    const edgesInfo = relations.map((r) => ({
      source: graphById.get(r.sourceGraphId.toLowerCase())?.title ?? r.sourceGraphId,
      target: graphById.get(r.targetGraphId.toLowerCase())?.title ?? r.targetGraphId,
      relationship: r.relationType,
    }));

    const selectionInstruction = selectionContext
      ? `用户在图谱地图上选中的图谱/领域应作为候选路径的优先对象，把它们放在靠前位置并赋予 high/medium 优先级；已完成(>=0.85)的选中图谱可放末尾但目标仍以它们为核心。
图谱地图选中内容：
${selectionContext}
`
      : "";

    return `请根据以下图谱地图与学习目标，生成 ${dailyMinutes} 分钟/天预算下的候选跨图谱学习路径。
学习目标：${targetGoal}
${selectionInstruction}图谱列表（含所属领域 domainNames）：${JSON.stringify(listedGraphs, null, 2)}
${
        omitted > 0
          ? `另有 ${omitted} 张图谱未在上方列出，仅在与目标强相关时才纳入，否则不要收录：`
          : ""
      }图谱关系（source → target，含前置/扩展/相关）：${JSON.stringify(edgesInfo, null, 2)}

要求：
1. 先评估每张图谱与学习目标的相关性，只把**与目标直接相关的图谱**纳入 path，与其无关的图谱**不要放入**（path 即完整子图，不会自动补齐未选中的图谱）；
2. 每个变体输出 2-4 条整体建议（suggestions）；
3. 每个变体内 path 的 nodeTitle 必须使用输入中的精确图谱标题；
4. 为每张图给出 priority（high/medium/low）与简短 reason（≤20 字）与 estimatedTime（分钟，5-60）；
5. 排序时尽量让同一领域的图谱相邻，先按领域组织再按前置关系推进。`;
  }

  /**
   * 归一化 AI 返回的变体数组。
   * 逻辑见模块级导出函数 normalizeVariants。
   */
  private normalizeVariants(
    rawVariants: Array<Record<string, unknown>>,
    graphs: CrossGraphNodeInput[],
  ): CrossGraphPathVariant[] {
    return normalizeVariants(rawVariants, graphs);
  }
}

export const goalDrivenPathService = new GoalDrivenPathService();
export { GoalDrivenPathService };

/** 规则算法阶段 → 变体结构（无 AI key / AI 失败时的保底） */
export function rulePathToVariant(
  emphasis: VariantEmphasis,
  stages: CrossGraphStage[],
  suggestions: string[],
): CrossGraphPathVariant {
  const name =
    emphasis === "systematic"
      ? "系统全面"
      : emphasis === "goal_oriented"
        ? "目标导向"
        : "快速概览";
  const description =
    emphasis === "systematic"
      ? "严格按前置依赖覆盖全部图谱的系统学习顺序"
      : emphasis === "goal_oriented"
        ? "聚焦目标相关图谱的目标驱动学习顺序"
        : "先建立全局概览再深入的高效学习顺序";
  return {
    id: emphasis,
    name,
    description,
    emphasis,
    stages: stages.map((s) => ({
      graphId: s.graphId,
      graphTitle: s.graphTitle,
      order: s.order,
      priority: s.priority,
      reason: s.reason,
      estimatedTime: 30,
    })),
    suggestions,
  };
}

/**
 * 归一化 AI 返回的变体数组：
 * 1. 每个变体的 path 按标题匹配图谱（精确→模糊），命中带 graphId；
 * 2. 未命中的图谱追加到末尾（保证覆盖全部图谱，与 generateCrossGraphAIPath 行为一致）；
 * 3. 同一变体内重复出现的图谱去重。
 */
export function normalizeVariants(
  rawVariants: Array<Record<string, unknown>>,
  graphs: CrossGraphNodeInput[],
): CrossGraphPathVariant[] {
  const graphByLowerTitle = new Map(
    graphs.map((g) => [g.title.toLowerCase(), g]),
  );

  const resolveGraph = (title: string): CrossGraphNodeInput | undefined => {
    const lower = title.toLowerCase();
    const exact = graphByLowerTitle.get(lower);
    if (exact) return exact;
    return graphs.find(
      (g) =>
        g.title.toLowerCase().includes(lower) ||
        lower.includes(g.title.toLowerCase()),
    );
  };

  const variants: CrossGraphPathVariant[] = [];
  for (const raw of rawVariants) {
    const rawPath = Array.isArray(raw.path)
      ? (raw.path as Array<Record<string, unknown>>)
      : [];
    const seen = new Set<string>();
    const stages: VariantStage[] = [];

    for (const item of rawPath) {
      const title = item?.nodeTitle ? String(item.nodeTitle) : "";
      if (!title) continue;
      const graph = resolveGraph(title);
      if (!graph || seen.has(graph.graphId)) continue;
      seen.add(graph.graphId);
      stages.push({
        graphId: graph.graphId,
        graphTitle: graph.title,
        order: stages.length,
        priority:
          item.priority === "low"
            ? "low"
            : item.priority === "medium"
              ? "medium"
              : "high",
        reason: item.reason ? String(item.reason).slice(0, 60) : "",
        estimatedTime:
          typeof item.estimatedTime === "number" && item.estimatedTime > 0
            ? Math.min(240, Math.max(5, Math.round(item.estimatedTime)))
            : 30,
      });
    }

    // 严格子图：仅保留 AI 判定的与目标相关的图谱，不自动补齐未选中的。
    // 因此 paths 中未出现的图谱一律不纳入 —— 路径即目标的子图。

    if (stages.length === 0) continue;

    const emphasis: VariantEmphasis =
      raw.emphasis === "goal_oriented" || raw.emphasis === "quick_overview"
        ? raw.emphasis
        : "systematic";

    variants.push({
      id: raw.id ? String(raw.id) : emphasis,
      name: raw.name ? String(raw.name) : emphasis,
      description: raw.description ? String(raw.description) : "",
      emphasis,
      estimatedWeeks:
        typeof raw.estimatedWeeks === "number" ? raw.estimatedWeeks : undefined,
      totalEstimatedMinutes:
        typeof raw.totalEstimatedMinutes === "number"
          ? raw.totalEstimatedMinutes
          : undefined,
      stages,
      suggestions: Array.isArray(raw.suggestions)
        ? raw.suggestions.map((s) => String(s))
        : [],
    });
  }

  return variants;
}
