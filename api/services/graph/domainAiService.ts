import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { aiService } from "../ai/aiService";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { notDeleted } from '../common/softDeleteHelper';
import { cacheService, CacheKeys } from "../common/cacheService";
import i18next from "i18next";
import {
  cosineSimilarity,
  type AutoClassifiedDomain,
  type AutoClassifyGraphInfo,
} from "./domainShared";
import type { DomainCrudService } from "./domainCrudService";

/**
 * 领域 AI 服务：AI 生成颜色、领域推荐、自动分类与分类结果应用。
 * 应用分类时复用 DomainCrudService 的 createDomain 与自身 generateColor。
 */
export class DomainAiService {
  constructor(private readonly crudService: DomainCrudService) {}

  async generateColor(
    name: string,
    description?: string,
  ): Promise<{ color: string; reason: string }> {
    const DEFAULT_COLOR = "#6366F1";

    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.warn("AI 服务不可用，使用默认颜色", { name });
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
      }

      const prompt = `你是一个色彩设计专家。根据以下领域的名称和描述，推荐一个合适的 HEX 颜色值。

领域名称：${name}
${description ? `领域描述：${description}` : ""}

要求：
1. 返回一个 HEX 格式的颜色值（#RRGGBB）
2. 颜色应该与领域的语义、情感或联想相关（例如：海洋→蓝色系，火焰→红色/橙色系）
3. 只返回 JSON 格式：{"color": "#HEX值", "reason": "推荐理由"}`;

      const response = await aiService.chat([
        { role: "user", content: prompt },
      ]);

      let parsed: { color: string; reason: string };
      try {
        const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        logger.warn("AI 返回的 JSON 解析失败，使用默认颜色", {
          name,
          rawResponse: response.slice(0, 200),
        });
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
      }

      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(parsed.color)) {
        logger.warn("AI 返回的颜色格式无效，使用默认颜色", {
          name,
          color: parsed.color,
        });
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
      }

      logger.info("AI 生成领域颜色成功", { name, color: parsed.color });

      return {
        color: parsed.color,
        reason: parsed.reason || "",
      };
    } catch (error) {
      const err = error as Error;
      logger.error("AI 生成领域颜色失败", { error: err.message, name });
      return {
        color: DEFAULT_COLOR,
        reason: "使用了默认颜色",
      };
    }
  }

  async recommendDomains(
    supabase: SupabaseClient,
    userId: string,
    title: string,
    description?: string,
  ): Promise<{
    recommendations: Array<{
      id: string;
      name: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    const { data: domains, error } = await notDeleted(supabase
      .from("domains")
      .select("id, name, description, color")
      .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
      );

    if (error) {
      logger.error("获取领域列表失败", { error: error.message, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.fetchListFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!domains || domains.length === 0) {
      return { recommendations: [] };
    }

    const prompt = `你是知识分类专家。根据以下图谱信息，从给定的领域列表中选择最匹配的 3-5 个领域。

图谱标题：${title}
${description ? `图谱描述：${description}` : ''}

可选领域列表：
${domains.map((d, i) => `${i + 1}. ${d.name}${d.description ? ` (${d.description})` : ``}`).join('\n')}

要求：
1. 分析图谱内容与哪个领域最相关
2. 返回 JSON 数组，每个元素包含：
   - id: 领域ID
   - name: 领域名称
   - confidence: 匹配置信度 (0-1之间的数字)
   - reason: 推荐理由（一句话）
3. 只返回最相关的 3-5 个领域
4. confidence 总和不需要等于 1，每个独立评分`;

    try {
      const response = await aiService.chat(
        [
          { role: "system", content: "你是一个知识分类专家，擅长分析内容并推荐合适的分类。" },
          { role: "user", content: prompt },
        ],
        { timeout: 30000 },
      );

      let parsed: Array<{ id: string; name: string; confidence: number; reason: string }>;
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, { message: i18next.t("graphMap.domains.errors.extractJsonFailed") });
        }
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("AI 推荐响应解析失败", { response, error: parseError instanceof Error ? parseError.message : String(parseError) });
        return { recommendations: [] };
      }

      const validDomainIds = new Set(domains.map((d) => d.id));
      const validRecommendations = parsed
        .filter((rec) => validDomainIds.has(rec.id))
        .slice(0, 5);

      return { recommendations: validRecommendations };
    } catch (error) {
      logger.warn("AI 领域推荐服务不可用，返回空数组", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { recommendations: [] };
    }
  }

  async autoClassifyGraphs(
    supabase: SupabaseClient,
    userId: string,
    options?: { graph_ids?: string[]; max_domains?: number },
  ): Promise<{ domains: AutoClassifiedDomain[]; graphs: AutoClassifyGraphInfo[] }> {
    let query = notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .eq("user_id", userId),
    );
    if (options?.graph_ids && options.graph_ids.length > 0) {
      query = query.in("id", options.graph_ids);
    }
    const { data: graphs, error } = await query.order("created_at", {
      ascending: true,
    });

    if (error) {
      logger.error("自动分类：查询图谱失败", { error: error.message, userId });
      throw new AppError(
        i18next.t("graphMap.api.errors.queryGraphFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const graphList = (graphs || []).filter(
      (g) => typeof g.title === "string" && g.title.length > 0,
    ) as Array<{ id: string; title: string; description: string | null }>;

    if (graphList.length === 0) {
      return { domains: [], graphs: [] };
    }

    // 已有关联领域（多对多），用于前端展示，避免与既有领域重复
    const graphIdList = graphList.map((g) => g.id);
    const { data: graphDomains } = await supabase
      .from("graph_domains")
      .select("graph_id, domain_id")
      .in("graph_id", graphIdList);

    const domainIds = Array.from(
      new Set((graphDomains || []).map((gd) => gd.domain_id)),
    );
    const { data: domainRows } =
      domainIds.length > 0
        ? await supabase
            .from("domains")
            .select("id, name")
            .in("id", domainIds)
        : { data: [] as Array<{ id: string; name: string }> };

    const domainNameById = new Map(
      (domainRows || []).map((d) => [d.id, d.name]),
    );
    const existingByGraph = new Map<string, string[]>();
    (graphDomains || []).forEach((gd) => {
      const name = domainNameById.get(gd.domain_id);
      if (!name) return;
      const list = existingByGraph.get(gd.graph_id) || [];
      list.push(name);
      existingByGraph.set(gd.graph_id, list);
    });

    const graphsInfo: AutoClassifyGraphInfo[] = graphList.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description || "",
      existing_domains: existingByGraph.get(g.id) || [],
    }));

    // 图谱过多时截断，避免单次 prompt 过大
    const MAX_GRAPHS = 300;
    const sample = graphsInfo.slice(0, MAX_GRAPHS);

    const maxDomains =
      options?.max_domains ??
      Math.min(15, Math.max(3, Math.ceil(sample.length / 3)));

    const graphLines = sample
      .map(
        (g, i) =>
          `${i}. ${g.title}${g.description ? ` | ${g.description.slice(0, 200)}` : ""}`,
      )
      .join("\n");

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      logger.warn("自动分类：AI 服务不可用，返回空候选", { userId });
      return { domains: [], graphs: graphsInfo };
    }

    // 提示词由 promptService 统一管理（数据库权威源，可在设置中编辑），
    // 缺失时回退到 DEFAULT_PROMPTS['auto_domain_classify'] 兜底
    let systemPrompt: string;
    try {
      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_domain_classify",
        { graphList: graphLines, maxDomains },
        userId,
      );
    } catch (promptError) {
      logger.warn("自动分类：加载提示词失败，使用空内容", {
        error:
          promptError instanceof Error ? promptError.message : String(promptError),
      });
      systemPrompt = "";
    }

    if (!systemPrompt) {
      logger.warn("自动分类：未获取到提示词，返回空候选", { userId });
      return { domains: [], graphs: graphsInfo };
    }

    try {
      const response = await aiService.chat(
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: "请根据以上图谱列表按主题进行聚类分类，只输出 JSON 数组。",
          },
        ],
        { timeout: 60000 },
      );

      let parsed: Array<{
        name: string;
        description: string;
        graph_indices: unknown;
      }>;
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return { domains: [], graphs: graphsInfo };
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("自动分类：AI 响应解析失败", {
          rawResponse: response.slice(0, 300),
          error:
            parseError instanceof Error ? parseError.message : String(parseError),
        });
        return { domains: [], graphs: graphsInfo };
      }

      const indexSet = new Set(sample.map((_, i) => i));
      const domains: AutoClassifiedDomain[] = [];
      parsed.forEach((candidate, idx) => {
        if (
          !candidate ||
          typeof candidate.name !== "string" ||
          candidate.name.trim().length < 2
        ) {
          return;
        }
        const indices = Array.isArray(candidate.graph_indices)
          ? (candidate.graph_indices as unknown[])
              .map((n) => Number(n))
              .filter((n) => indexSet.has(n))
          : [];
        const uniqueIndices = Array.from(new Set(indices));
        if (uniqueIndices.length === 0) return;
        const assigned = uniqueIndices.map((i) => sample[i]);
        domains.push({
          suggestion_id: String(idx),
          name: candidate.name.trim().slice(0, 200),
          description: (candidate.description || "").trim().slice(0, 1000),
          graph_ids: assigned.map((g) => g.id),
          graph_titles: assigned.map((g) => g.title),
        });
      });

      // 领域至少要包含足够图谱才建议为独立领域，避免单薄领域泛滥
      const MIN_GRAPHS_PER_DOMAIN = 4;
      const validDomains = domains
        .filter((d) => d.graph_ids.length >= MIN_GRAPHS_PER_DOMAIN)
        .slice(0, maxDomains);
      if (domains.length !== validDomains.length) {
        logger.info("自动分类：过滤掉图谱数过少的候选领域", {
          before: domains.length,
          after: validDomains.length,
          minGraphs: MIN_GRAPHS_PER_DOMAIN,
          userId,
        });
      }

      return { domains: validDomains, graphs: graphsInfo };
    } catch (error) {
      logger.warn("自动分类：AI 服务调用失败，返回空候选", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { domains: [], graphs: graphsInfo };
    }
  }

  async applyClassifiedDomains(
    supabase: SupabaseClient,
    userId: string,
    items: Array<{
      name: string;
      description?: string;
      color?: string;
      graph_ids: string[];
    }>,
  ): Promise<{
    created: Array<{ id: string; name: string; graphCount: number }>;
  }> {
    const created: Array<{ id: string; name: string; graphCount: number }> =
      [];

    const { data: ownedRows } = await notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("user_id", userId),
    );
    const ownedIds = new Set((ownedRows || []).map((g) => g.id));

    // 领域语义去重：预取用户已有领域，用 embedding 余弦相似度判断候选是否与现有领域重复
    const SIMILARITY_THRESHOLD = 0.85;
    const { data: existingDomainsRows } = await notDeleted(
      supabase
        .from("domains")
        .select("id, name"),
    );
    const existingDomains = (existingDomainsRows || []).filter(
      (d) =>
        typeof d.name === "string" && (d.name as string).trim().length > 0,
    ) as Array<{ id: string; name: string }>;
    const domainVecCache = new Map<string, number[]>();
    const getDomainVec = async (name: string): Promise<number[] | null> => {
      const cached = domainVecCache.get(name);
      if (cached) return cached;
      const vec = await aiService.generateEmbedding(name);
      if (vec) domainVecCache.set(name, vec);
      return vec;
    };

    for (const item of items) {
      const name = item.name.trim();
      if (name.length < 2) continue;

      const validGraphIds = Array.from(
        new Set((item.graph_ids || []).filter((id) => ownedIds.has(id))),
      );

      // 1) 尝试语义去重：候选名与已有领域名高度相似 → 复用该领域，仅追加关联
      let reusedDomainId = "";
      let reusedDomainName = "";
      try {
        const candidateVec = await aiService.generateEmbedding(name);
        if (candidateVec) {
          let bestSim = 0;
          for (const ed of existingDomains) {
            const edVec = await getDomainVec(ed.name);
            if (!edVec) continue;
            const sim = cosineSimilarity(candidateVec, edVec);
            if (sim > bestSim) {
              bestSim = sim;
              reusedDomainId = ed.id;
              reusedDomainName = ed.name;
            }
          }
          if (bestSim < SIMILARITY_THRESHOLD) {
            reusedDomainId = "";
          } else {
            logger.info("自动分类：嵌入去重命中，复用已有领域", {
              candidate: name,
              existing: reusedDomainName,
              similarity: bestSim,
              userId,
            });
          }
        } else {
          reusedDomainId = "";
        }
      } catch (embedError) {
        // embedding 服务不可用时不强行去重，退回新建
        logger.warn("自动分类：领域去重嵌入失败，转为新建", {
          error: embedError instanceof Error ? embedError.message : String(embedError),
          name,
          userId,
        });
        reusedDomainId = "";
      }

      if (reusedDomainId) {
        if (validGraphIds.length > 0) {
          const rows = validGraphIds.map((graphId) => ({
            graph_id: graphId,
            domain_id: reusedDomainId,
            is_primary: false,
          }));
          const { error } = await supabase
            .from("graph_domains")
            .upsert(rows, { onConflict: "graph_id,domain_id" });
          if (error) {
            logger.error("自动分类：复用领域建立图谱-领域关联失败", {
              error: error.message,
              domainId: reusedDomainId,
              userId,
            });
            throw new AppError(
              i18next.t("graphMap.domainPicker.setFailed"),
              500,
              ErrorCodes.SYSTEM_INTERNAL_ERROR,
            );
          }
        }
        created.push({
          id: reusedDomainId,
          name: reusedDomainName,
          graphCount: validGraphIds.length,
        });
        continue;
      }

      // 2) 无重复 → 新建领域并归类
      let color = item.color;
      if (!color) {
        color = (await this.generateColor(name, item.description || undefined))
          .color;
      }

      const domain = await this.crudService.createDomain(supabase, userId, {
        name,
        color,
        description: item.description?.trim() || undefined,
      });

      if (validGraphIds.length > 0) {
        const rows = validGraphIds.map((graphId) => ({
          graph_id: graphId,
          domain_id: domain.id,
          is_primary: false,
        }));
        const { error } = await supabase
          .from("graph_domains")
          .upsert(rows, { onConflict: "graph_id,domain_id" });

        if (error) {
          logger.error("自动分类：建立图谱-领域关联失败", {
            error: error.message,
            domainId: domain.id,
            userId,
          });
          throw new AppError(
            i18next.t("graphMap.domainPicker.setFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }
      }

      created.push({
        id: domain.id,
        name: domain.name,
        graphCount: validGraphIds.length,
      });
    }

    // 使后端图谱地图/领域缓存失效，前端重新拉取到含新领域关联的最新数据
    try {
      await cacheService.del([
        CacheKeys.GRAPH_MAP(userId),
        CacheKeys.GRAPH_DOMAINS(userId),
      ]);
    } catch (cacheError) {
      logger.warn("自动分类：清理图谱地图缓存失败", {
        error:
          cacheError instanceof Error ? cacheError.message : String(cacheError),
        userId,
      });
    }

    return { created };
  }
}
