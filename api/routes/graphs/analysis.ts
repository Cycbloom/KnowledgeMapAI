import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema } from "../../schemas/index";
import { graphService } from "../../services/graph/index";
import { aiService } from "../../services/ai/aiService";
import { domainContextService } from "../../services/ai/domainContextService";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { z } from "zod";

const analyzeDomainSchema = z.object({
  domain: z.string().min(2).max(200),
  count: z.number().min(5).max(30).default(10),
  context_domain_id: z.string().uuid().optional(),
});

const router = Router();

// Get nodes and edges for a graph (Optional Auth)
router.get(
  "/:id/nodes",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const data = await graphService.getGraphNodes(req.supabase!, userId, id);

    // Update last_used_at when user opens their own graph
    if (userId) {
      graphService
        .updateLastUsedAt(req.supabase!, id, userId)
        .catch((err) => logger.error("Update last used at failed:", err));
    }

    res.json(data);
  },
);

// Get node status (Optional Auth - Public view has no status)
router.get(
  "/:id/node-status",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const data = userId
      ? await graphService.getGraphNodeStatus(req.supabase!, userId, id)
      : [];
    res.json(data);
  },
);

// Get learning path for a graph (Optional Auth)
router.get(
  "/:id/learning-path",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Reuse logic: users can see path if they can see the graph
    const data = await graphService.getLearningPath(req.supabase!, userId, id);
    res.json({ path: data });
  },
);

// Analyze graph structure (Auth Required)
router.get(
  "/:id/analyze",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const analysis = await graphService.analyzeGraph(
        req.supabase!,
        userId,
        id,
      );
      res.json(analysis);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "图谱分析失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Get missing connection suggestions (Auth Required)
router.get(
  "/:id/missing-connections",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const maxSuggestions = parseInt(req.query.max as string) || 10;

    try {
      const suggestions = await graphService.findMissingConnections(
        req.supabase!,
        userId,
        id,
        maxSuggestions,
      );
      res.json({ suggestions });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "获取连接建议失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Analyze domain topic and return recommended graphs (Auth Required)
router.post(
  "/domain/analyze",
  requireAuth,
  validate({ body: analyzeDomainSchema }),
  async (req: AuthRequest, res: Response) => {
    const { domain, count = 10, context_domain_id, session_id } = req.body;
    const userId = req.user.id;

    try {
      const { data: existingGraphs } = await req
        .supabase!.from("knowledge_graphs")
        .select("id, title, description")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const existingTitles = (existingGraphs || []).map((g) =>
        g.title.toLowerCase(),
      );

      let domainContext = "";
      let domainName = "";

      if (context_domain_id) {
        try {
          const context = await domainContextService.getDomainContext(
            req.supabase!,
            context_domain_id,
            userId,
          );
          domainContext = context;

          const { data: domainInfo } = await req
            .supabase!.from("domains")
            .select("name")
            .eq("id", context_domain_id)
            .single();
          domainName = domainInfo?.name || "";

          logger.info("使用领域上下文进行分析", {
            domainId: context_domain_id,
            domainName,
            userId,
          });
        } catch (error) {
          logger.warn("获取领域上下文失败，将使用全局分析", {
            domainId: context_domain_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const basePrompt = `你是知识图谱专家。用户想学习「${domain}」领域。

请推荐 ${count} 个该领域的知识图谱主题，并分析它们之间的学习依赖关系。

要求：
1. 推荐主题覆盖领域各方面，避免重复
2. 分析主题之间的学习依赖关系（如：学A之前需要先学B）
3. 优先级：high(核心基础)/medium(重要内容)/low(扩展内容)
4. 简述不超过60字
${domainContext ? `5. 基于上述已有内容，推荐新的、不重复的知识点\n6. 避免推荐与已有图谱主题过于相似的内容` : ""}

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ]
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

已有图谱：${existingTitles.length > 0 ? existingTitles.slice(0, 15).join("、") : "无"}`;

      const finalPrompt = domainContext
        ? domainContextService.buildDomainAwarePrompt(
            basePrompt,
            domainContext,
            domainName,
          )
        : basePrompt;

      const response = await aiService.chat(
        [
          {
            role: "system",
            content:
              "你是一个知识图谱专家，擅长分析领域知识结构、推荐学习路径、识别知识点之间的依赖关系。请用中文回复。确保返回有效的JSON格式。",
          },
          { role: "user", content: finalPrompt },
        ],
        { timeout: 60000, sessionId: session_id, operation: "domain_analysis" },
      );

      let recommendations: Array<{
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
      }> = [];

      let graphRelations: Array<{
        from_title: string;
        to_title: string;
        type: "prerequisite" | "extension" | "related";
        reason?: string;
      }> = [];

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const graphs =
            parsed.graphs || parsed.list || parsed.recommendations || [];

          for (const item of graphs) {
            if (typeof item === "string") {
              const parts = item.split("|");
              if (parts.length >= 3) {
                const [title, description, priority] = parts.map((s) =>
                  s.trim(),
                );
                if (title && !existingTitles.includes(title.toLowerCase())) {
                  recommendations.push({
                    title,
                    description: description || "",
                    priority: (["high", "medium", "low"].includes(priority)
                      ? priority
                      : "medium") as "high" | "medium" | "low",
                  });
                }
              }
            } else if (typeof item === "object" && item.title) {
              if (!existingTitles.includes(item.title.toLowerCase())) {
                recommendations.push({
                  title: item.title,
                  description: item.description || "",
                  priority: item.priority || "medium",
                });
              }
            }
          }

          const relations = parsed.relations || [];
          for (const rel of relations) {
            if (rel.from && rel.to && rel.type) {
              graphRelations.push({
                from_title: rel.from,
                to_title: rel.to,
                type: rel.type as "prerequisite" | "extension" | "related",
                reason: rel.reason,
              });
            }
          }
        }
      } catch {
        logger.warn("Failed to parse domain analysis response as JSON");
      }

      if (domainContext && existingTitles.length > 0) {
        const beforeCount = recommendations.length;
        const existingSet = new Set(existingTitles.map((t) => t.toLowerCase()));
        recommendations = recommendations.filter((rec) => {
          const titleLower = rec.title.toLowerCase();
          const isTooSimilar = Array.from(existingSet).some(
            (existing) =>
              titleLower.includes(existing) || existing.includes(titleLower),
          );
          return !isTooSimilar;
        });

        if (recommendations.length !== beforeCount) {
          logger.info("应用领域上下文过滤", {
            before: beforeCount,
            after: recommendations.length,
          });
        }
      }

      const validTitles = new Set(
        recommendations.map((r) => r.title.toLowerCase()),
      );
      const existingTitlesSet = new Set(existingTitles);

      graphRelations = graphRelations.filter((rel) => {
        const fromLower = rel.from_title.toLowerCase();
        const toLower = rel.to_title.toLowerCase();
        const fromIsValid =
          validTitles.has(fromLower) || existingTitlesSet.has(fromLower);
        const toIsValid =
          validTitles.has(toLower) || existingTitlesSet.has(toLower);
        return fromIsValid && toIsValid;
      });

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.title.localeCompare(b.title, "zh-CN");
      });

      res.json({
        recommendations: recommendations.slice(0, count),
        relations: graphRelations,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "领域分析失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;