import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { getAIProviderForTask, getAIProvider } from "../services/ai/factory.js";
import { promptService } from "../services/ai/promptService.js";
import { cacheService, CacheKeys } from "../services/common/cacheService.js";
import { logger } from "../utils/logger.js";
import { scrapeUrl } from "../utils/scraper.js";
import { autoGraphService, graphNodeService } from "../services/graph/index.js";
import { embeddingService } from "../services/ai/embeddingService.js";
import { z } from "zod";
import { saveNodesSchema } from "../schemas/index.js";
const router = Router();
const URL_PATTERN = /^https?:\/\/.+/;
async function processSource(source) {
    const trimmed = source.trim();
    if (URL_PATTERN.test(trimmed)) {
        try {
            logger.info(`Fetching URL content: ${trimmed}`);
            const result = await scrapeUrl(trimmed);
            return `【来源: ${result.title}】\n${result.text.slice(0, 3000)}`;
        }
        catch (error) {
            logger.warn(`Failed to scrape URL: ${trimmed}`, error);
            return `【URL: ${trimmed}】(无法获取内容)`;
        }
    }
    return trimmed;
}
const initGraphSchema = z.object({
    topic: z.string().min(2).max(200),
    style: z
        .enum(["academic", "practical", "beginner", "custom"])
        .default("academic"),
    customPrompt: z.string().optional(),
    sources: z.array(z.string()).optional(),
    graph_id: z.string().uuid().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
});
const expandNodeSchema = z.object({
    node_id: z.string().min(1),
    node_title: z.string().min(1),
    node_content: z.string().optional(),
    node_level: z.string().optional(),
    graph_id: z.string().min(1),
    style: z
        .enum(["academic", "practical", "beginner", "custom"])
        .default("academic"),
    customPrompt: z.string().optional(),
    existing_children: z
        .array(z.object({
        title: z.string(),
        content: z.string().optional(),
    }))
        .optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
});
const optimizePromptSchema = z.object({
    topic: z.string().min(1),
    currentPrompt: z.string().optional(),
});
router.post("/init", requireAuth, validate(initGraphSchema), async (req, res) => {
    const { topic, style, customPrompt, sources, graph_id, provider: providerType, model, } = req.body;
    const supabase = req.supabase;
    const provider = providerType
        ? await getAIProvider(providerType)
        : await getAIProviderForTask("text");
    if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 503, ErrorCodes.INTERNAL_ERROR);
    }
    try {
        let processedSources = [];
        if (sources && sources.length > 0) {
            processedSources = await Promise.all(sources.map(processSource));
        }
        let systemPrompt;
        if (style === "custom" && customPrompt) {
            systemPrompt = await promptService.getRenderedPrompt(supabase, "auto_graph_init", {
                topic,
                isCustom: true,
                customPrompt,
                hasSources: processedSources.length > 0,
                sources: processedSources.join("\n\n---\n\n"),
                isInit: true,
            }, req.user.id, graph_id);
        }
        else {
            const templateData = {
                topic,
                isAcademic: style === "academic",
                isPractical: style === "practical",
                hasSources: processedSources.length > 0,
                sources: processedSources.join("\n\n---\n\n"),
                isInit: true,
            };
            systemPrompt = await promptService.getRenderedPrompt(supabase, "auto_graph_init", templateData, req.user.id, graph_id);
        }
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `主题：${topic}${processedSources.length > 0 ? `\n\n参考来源：\n${processedSources.join("\n\n---\n\n")}` : ""}`,
                },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });
        const content = completion.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(content || '{"root": null, "coreNodes": []}');
        }
        catch (e) {
            logger.error("JSON Parse Error:", { content: content?.slice(-100) });
            throw new AppError("AI 生成内容解析失败", 422, ErrorCodes.INTERNAL_ERROR);
        }
        res.json({
            root: parsed.root || {
                title: topic,
                content: `${topic}的核心概念和知识体系`,
            },
            coreNodes: parsed.coreNodes || [],
        });
    }
    catch (error) {
        logger.error("Auto Graph Init Error:", error);
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message || "知识图谱初始化失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/expand", requireAuth, validate(expandNodeSchema), async (req, res) => {
    const { node_id, node_title, node_content, node_level, graph_id, style, customPrompt, existing_children, provider: providerType, model, } = req.body;
    const supabase = req.supabase;
    const provider = providerType
        ? await getAIProvider(providerType)
        : await getAIProviderForTask("text");
    if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 503, ErrorCodes.INTERNAL_ERROR);
    }
    try {
        let systemPrompt;
        if (style === "custom" && customPrompt) {
            systemPrompt = await promptService.getRenderedPrompt(supabase, "auto_graph_expand", {
                nodeTitle: node_title,
                nodeContent: node_content || "",
                nodeLevel: node_level || "normal",
                isCustom: true,
                customPrompt,
                hasExistingChildren: existing_children && existing_children.length > 0,
                existingChildren: existing_children?.map((c) => c.title).join("、") || "",
            }, req.user.id, graph_id);
        }
        else {
            const templateData = {
                nodeTitle: node_title,
                nodeContent: node_content || "",
                nodeLevel: node_level || "normal",
                isAcademic: style === "academic",
                isPractical: style === "practical",
                hasExistingChildren: existing_children && existing_children.length > 0,
                existingChildren: existing_children?.map((c) => c.title).join("、") || "",
            };
            systemPrompt = await promptService.getRenderedPrompt(supabase, "auto_graph_expand", templateData, req.user.id, graph_id);
        }
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `请为「${node_title}」生成子节点。${existing_children && existing_children.length > 0 ? `\n\n已有的子节点：${existing_children.map((c) => c.title).join("、")}\n请生成新的、不同的子节点。` : ""}`,
                },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 3000,
        });
        const content = completion.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(content || '{"children": []}');
        }
        catch (e) {
            logger.error("JSON Parse Error:", { content: content?.slice(-100) });
            throw new AppError("AI 生成内容解析失败", 422, ErrorCodes.INTERNAL_ERROR);
        }
        res.json({
            parentNodeId: node_id,
            children: parsed.children || [],
        });
    }
    catch (error) {
        logger.error("Auto Graph Expand Error:", error);
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message || "节点展开失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/optimize-prompt", requireAuth, validate(optimizePromptSchema), async (req, res) => {
    const { topic, currentPrompt } = req.body;
    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 503, ErrorCodes.INTERNAL_ERROR);
    }
    try {
        const systemPrompt = `You are a prompt optimization expert. Your task is to improve the user's custom prompt for generating knowledge graph nodes.

## Guidelines for Optimization
1. Make the instructions more specific and actionable
2. Add constraints on content length, depth, and style
3. Include examples of desired output format
4. Ensure the prompt is clear and unambiguous
5. Keep the user's original intent

## Output Format
Return a JSON object with:
{
  "optimizedPrompt": "The improved prompt text"
}

Respond in Chinese.`;
        const userMessage = `主题：${topic}

${currentPrompt ? `用户当前的自定义规则：\n${currentPrompt}` : "用户尚未输入任何规则，请根据主题生成一个合适的默认规则。"}

请优化这个规则，使其更适合生成知识图谱节点。`;
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            model: provider.model,
            response_format: { type: "json_object" },
            max_tokens: 1000,
        });
        const content = completion.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(content || '{"optimizedPrompt": ""}');
        }
        catch (e) {
            throw new AppError("优化结果解析失败", 422, ErrorCodes.INTERNAL_ERROR);
        }
        res.json({ optimizedPrompt: parsed.optimizedPrompt || "" });
    }
    catch (error) {
        logger.error("Optimize Prompt Error:", error);
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message || "优化失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/save-nodes", requireAuth, validate(saveNodesSchema), async (req, res) => {
    const { graph_id, nodes } = req.body;
    try {
        const existingGraphNodes = await graphNodeService.getGraphNodes(req.supabase, graph_id);
        const existingCount = existingGraphNodes?.length || 0;
        const nodesWithTempId = nodes
            .filter((node) => node.title && node.title.trim() !== "")
            .map((node, index) => {
            const angle = ((existingCount + index) / (existingCount + nodes.length)) *
                Math.PI *
                2;
            const radius = 15 + (existingCount + index) * 2;
            const tempId = node.id || `temp-${index}`;
            return {
                tempId,
                parentId: node.parentId || null,
                title: node.title,
                content: node.content || "",
                level: node.level || "normal",
                x_position: Math.round(Math.cos(angle) * radius),
                y_position: Math.round(Math.sin(angle) * radius),
            };
        });
        if (nodesWithTempId.length === 0) {
            return res.json({ success: true, nodeCount: 0, edgeCount: 0 });
        }
        const result = await autoGraphService.processAINodes(req.supabase, req.user.id, graph_id, nodesWithTempId);
        await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
        await cacheService.del(CacheKeys.GRAPH_NODES("public", graph_id));
        const nodeMapping = result.nodeMapping;
        res.json({
            success: true,
            nodeCount: result.nodeCount,
            edgeCount: result.edgeCount,
            nodeMapping,
        });
    }
    catch (error) {
        logger.error("Save nodes error:", error);
        throw new AppError(error.message || "保存节点失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/generate-embeddings", async (req, res) => {
    try {
        const { limit = 100 } = req.body || {};
        const result = await embeddingService.generateEmbeddingsBatch(req.supabase, Math.min(limit, 500));
        res.json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        logger.error("Generate embeddings error:", error);
        throw new AppError(error.message || "生成嵌入向量失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/embedding-status", async (req, res) => {
    try {
        const status = embeddingService.getStatus();
        const { count } = await req
            .supabase.from("knowledge_points")
            .select("*", { count: "exact", head: true })
            .is("embedding", null);
        res.json({
            ...status,
            pendingCount: count || 0,
        });
    }
    catch (error) {
        logger.error("Get embedding status error:", error);
        throw new AppError(error.message || "获取嵌入状态失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
export default router;
//# sourceMappingURL=autoGraph.js.map