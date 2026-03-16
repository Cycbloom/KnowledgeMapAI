import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { generateContentSchema, generateLearningMaterialSchema, annotateTermsSchema, podcastScriptSchema, } from "../../schemas/index.js";
import { ErrorCodes } from "../../constants/errorCodes.js";
import { AppError } from "../../middleware/errorHandler.js";
import { aiService } from "../../services/ai/aiService.js";
import { getMockResponse } from "../../services/ai/mock.js";
import { getAIProviderForTask, getAIProvider, } from "../../services/ai/factory.js";
import { logger } from "../../utils/logger.js";
import { promptService } from "../../services/ai/promptService.js";
import { supabaseAdmin } from "../../supabase.js";
import { setSSEHeaders, sendStreamChunk, sendStreamDone, sendStreamError, } from "./utils.js";
const router = Router();
router.get("/status", requireAuth, async (_req, res) => {
    const provider = await getAIProviderForTask("text");
    res.json({
        enabled: provider.hasKey,
        provider: provider.providerType,
        model: provider.model,
    });
});
router.post("/annotate-terms", requireAuth, validate(annotateTermsSchema), async (req, res) => {
    const { content, graph_id } = req.body;
    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 503, ErrorCodes.INTERNAL_ERROR);
    }
    try {
        const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, "annotate_terms", { nodeContent: content }, req.user.id, graph_id);
        const prompt = systemPrompt ||
            `请分析以下内容，识别其中的专业术语。对于每个术语，提供一个简短的解释（不超过20字）。
请返回一个 JSON 格式的数组，包含对象 { "term": "术语", "explanation": "解释" }。

内容：
${content}`;
        const completion = await provider.client.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "你是一个专业的学术编辑。请仅返回 JSON 格式的数据。不要包含 markdown 代码块标记。",
                },
                { role: "user", content: prompt },
            ],
            model: provider.model,
            response_format: { type: "json_object" },
        });
        const aiContent = completion.choices[0].message.content || "{}";
        let terms = [];
        try {
            const parsed = JSON.parse(aiContent);
            if (Array.isArray(parsed)) {
                terms = parsed;
            }
            else if (parsed.terms && Array.isArray(parsed.terms)) {
                terms = parsed.terms;
            }
            else {
                const values = Object.values(parsed);
                const arrayVal = values.find((v) => Array.isArray(v));
                if (arrayVal)
                    terms = arrayVal;
            }
        }
        catch (e) {
            logger.error("Failed to parse annotation terms JSON", {
                aiContent,
                error: e,
            });
        }
        let annotatedContent = content || "";
        if (terms.length > 0) {
            const placeholders = [];
            annotatedContent = annotatedContent.replace(/```[\s\S]*?```|`[^`]*`/g, (match) => {
                placeholders.push(match);
                return `__CODE_BLOCK_${placeholders.length - 1}__`;
            });
            terms.forEach(({ term, explanation }) => {
                if (!term || !explanation)
                    return;
                const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const index = annotatedContent.indexOf(term);
                if (index !== -1) {
                    const regex = new RegExp(`(?<!\\[)${escapedTerm}(?!\\]\\(term:)`);
                    annotatedContent = annotatedContent.replace(regex, `[${term}](term:${explanation})`);
                }
            });
            placeholders.forEach((code, i) => {
                annotatedContent = annotatedContent.replace(`__CODE_BLOCK_${i}__`, () => code);
            });
        }
        res.json({ content: annotatedContent });
    }
    catch (error) {
        const err = error;
        logger.error("Annotate Terms Error:", error);
        res.status(500).json({ error: err.message || "Annotation failed" });
    }
});
router.post("/podcast/script", requireAuth, validate(podcastScriptSchema), async (req, res) => {
    const { topic, content } = req.body;
    try {
        const script = await aiService.generatePodcastScript(topic, content);
        res.json({ script });
    }
    catch (error) {
        const err = error;
        logger.error("Podcast Script Generation Error:", error);
        res.status(500).json({ error: err.message });
    }
});
router.post("/generate-content", requireAuth, validate(generateContentSchema), async (req, res) => {
    const { topic, context, provider: providerType, model, graph_id, level, } = req.body;
    const provider = providerType
        ? await getAIProvider(providerType)
        : await getAIProviderForTask("text");
    if (!provider.hasKey) {
        return res.json({ content: getMockResponse("content", topic) });
    }
    try {
        const templateContext = {
            topic,
            context: context || "General knowledge",
            isRoot: level === "root" || level === "core",
            isNormal: level === "sub" || level === "normal",
            isLeaf: level === "leaf",
        };
        const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, "generate_content", templateContext, req.user.id, graph_id);
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
                },
            ],
            model: model || provider.model,
        });
        res.json({ content: completion.choices[0].message.content });
    }
    catch (error) {
        const err = error;
        logger.error("AI Error:", error);
        res.status(500).json({ error: err.message || "AI 生成失败" });
    }
});
router.post("/learning-material", requireAuth, validate(generateLearningMaterialSchema), async (req, res) => {
    const { topic, context, level, provider, model } = req.body;
    try {
        const content = await aiService.generateLearningMaterial(topic, context, {
            provider,
            model,
            level,
        });
        res.json({ content });
    }
    catch (error) {
        const err = error;
        logger.error("AI Learning Material Error:", error);
        res.status(500).json({ error: err.message || "AI 生成学习内容失败" });
    }
});
router.post("/generate-content-stream", requireAuth, validate(generateContentSchema), async (req, res) => {
    const { topic, context, level, provider: providerType, model, graph_id, } = req.body;
    const provider = providerType
        ? await getAIProvider(providerType)
        : await getAIProviderForTask("text");
    setSSEHeaders(res);
    if (!provider.hasKey) {
        const mockContent = getMockResponse("content", topic);
        const chunks = mockContent.split("");
        const sendMockChunks = async () => {
            for (const chunk of chunks) {
                sendStreamChunk(res, chunk);
                await new Promise((resolve) => setTimeout(resolve, 30));
            }
            sendStreamDone(res);
        };
        sendMockChunks();
        return;
    }
    try {
        const templateContext = {
            topic,
            context: context || "General knowledge",
            isRoot: level === "root" || level === "core",
            isNormal: level === "sub" || level === "normal",
            isLeaf: level === "leaf",
        };
        const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, "generate_content", templateContext, req.user.id, graph_id);
        const stream = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
                },
            ],
            model: model || provider.model,
            stream: true,
        });
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                sendStreamChunk(res, content);
            }
        }
        sendStreamDone(res);
    }
    catch (error) {
        const err = error;
        logger.error("AI Stream Error:", error);
        sendStreamError(res, err.message || "AI 生成失败", ErrorCodes.INTERNAL_ERROR);
    }
});
export default router;
//# sourceMappingURL=content.js.map