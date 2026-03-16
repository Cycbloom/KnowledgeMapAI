import { Router } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { textToGraphSchema, urlToTextSchema } from "../../schemas/index.js";
import { ErrorCodes } from "../../constants/errorCodes.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers.js";
import { cacheService, CacheKeys } from "../../services/common/cacheService.js";
import { aiService } from "../../services/ai/aiService.js";
import { getAIProviderForTask, getAIProvider, } from "../../services/ai/factory.js";
import { edgeService } from "../../services/graph/index.js";
import { logger } from "../../utils/logger.js";
import { promptService } from "../../services/ai/promptService.js";
import { supabaseAdmin } from "../../supabase.js";
import { scrapeUrl } from "../../utils/scraper.js";
import { upload } from "./utils.js";
const router = Router();
router.post("/text-to-graph", requireAuth, validate(textToGraphSchema), async (req, res) => {
    const { text, graph_id, action = "analyze", nodes, edges, provider: providerType, model, } = req.body;
    if (action === "save") {
        if (!graph_id) {
            throw new AppError("Graph ID is required for saving", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!nodes || !Array.isArray(nodes)) {
            throw new AppError("No nodes provided for saving", 400, ErrorCodes.VALIDATION_ERROR);
        }
        try {
            const nodeMap = new Map();
            const createdNodes = [];
            const validNodes = nodes.filter((node) => node.title && node.title.trim() !== "");
            if (validNodes.length === 0) {
                return res.json({
                    success: true,
                    nodeCount: 0,
                    edgeCount: 0,
                    message: "No valid nodes found to save",
                });
            }
            for (const node of validNodes) {
                const result = await createKnowledgePointWithGraphNode(req.supabase, req.user.id, {
                    graph_id,
                    title: node.title,
                    content: node.content || "",
                    x_position: Math.round((Math.random() - 0.5) * 50),
                    y_position: Math.round((Math.random() - 0.5) * 50),
                    level: node.level || "leaf",
                    properties: { ...node.properties, source: "ai-text-to-graph" },
                });
                if (result) {
                    if (node.id)
                        nodeMap.set(node.id, result.knowledge_point_id || result.id);
                    createdNodes.push({
                        id: result.id,
                        title: node.title,
                        content: node.content,
                        knowledge_point_id: result.knowledge_point_id,
                    });
                }
            }
            let edgeCount = 0;
            if (edges && Array.isArray(edges)) {
                for (const edge of edges) {
                    const sourceKPId = nodeMap.get(edge.source);
                    const targetKPId = nodeMap.get(edge.target);
                    if (sourceKPId && targetKPId) {
                        try {
                            await edgeService.create(req.supabase, {
                                graph_id,
                                source_knowledge_point_id: sourceKPId,
                                target_knowledge_point_id: targetKPId,
                                relationship_type: edge.relationship || "related",
                            });
                            edgeCount++;
                        }
                        catch (err) {
                            logger.warn("Failed to create edge:", err);
                        }
                    }
                }
            }
            cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
            cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
            return res.json({
                success: true,
                nodeCount: createdNodes.length,
                edgeCount,
            });
        }
        catch (error) {
            const err = error;
            logger.error("Save Graph Error:", error);
            throw new AppError(err.message || "Failed to save graph", 500, ErrorCodes.INTERNAL_ERROR);
        }
    }
    if (!text || text.length < 10) {
        throw new AppError("Text content must be at least 10 characters long", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const provider = providerType
        ? await getAIProvider(providerType)
        : await getAIProviderForTask("text");
    if (!provider.hasKey) {
        return res.json({
            nodes: [
                {
                    id: "mock_1",
                    title: "核心主题 (Mock)",
                    content: "这是核心主题",
                    level: "root",
                },
                {
                    id: "mock_2",
                    title: "主要分支 A",
                    content: "分支 A 的描述",
                    level: "core",
                },
                {
                    id: "mock_3",
                    title: "主要分支 B",
                    content: "分支 B 的描述",
                    level: "core",
                },
                {
                    id: "mock_4",
                    title: "子节点 A1",
                    content: "A 的子节点",
                    level: "sub",
                },
                {
                    id: "mock_5",
                    title: "子节点 B1",
                    content: "B 的子节点",
                    level: "sub",
                },
            ],
            edges: [
                { source: "mock_1", target: "mock_2", relationship: "contains" },
                { source: "mock_1", target: "mock_3", relationship: "contains" },
                { source: "mock_2", target: "mock_4", relationship: "related" },
                { source: "mock_3", target: "mock_5", relationship: "related" },
            ],
        });
    }
    try {
        const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, "text_to_graph", {}, req.user.id, graph_id);
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Text: ${text.substring(0, 15000)}` },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 8000,
        });
        const content = completion.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
        }
        catch {
            throw new AppError("AI 生成内容过长被截断，请尝试减少文本量或分段生成。", 422, ErrorCodes.INTERNAL_ERROR);
        }
        if (parsed.nodes) {
            parsed.nodes = parsed.nodes.filter((n) => n.title && n.title.trim() !== "");
        }
        res.json(parsed);
    }
    catch (error) {
        const err = error;
        logger.error("AI Text-to-Graph Error:", error);
        throw new AppError(err.message || "AI processing failed", 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/document-to-graph", requireAuth, upload.single("file"), async (req, res) => {
    const { graph_id, provider: providerOverride, model: modelOverride, } = req.body;
    const file = req.file;
    const provider = await getAIProviderForTask("text", providerOverride, modelOverride);
    if (!file) {
        throw new AppError("No file uploaded", 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 500, ErrorCodes.INTERNAL_ERROR);
    }
    try {
        let text = "";
        if (file.mimetype === "application/pdf") {
            try {
                const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
                let data;
                if (typeof pdfParse === "function") {
                    data = await pdfParse(file.buffer);
                }
                else if (pdfParse.PDFParse) {
                    const parser = new pdfParse.PDFParse({ data: file.buffer });
                    const result = await parser.getText();
                    data = {
                        text: result.text,
                        numpages: result.numpages || 0,
                        info: result.info,
                    };
                }
                else {
                    throw new Error("Unsupported pdf-parse version/structure");
                }
                text = data.text;
                logger.info("PDF Extraction Result", {
                    fileName: originalName,
                    pageCount: data.numpages,
                    textLength: text?.length || 0,
                });
            }
            catch (pdfErr) {
                const err = pdfErr;
                logger.error("PDF Parse detailed error:", pdfErr);
                throw new AppError(`PDF parsing failed: ${err.message}`, 500, ErrorCodes.INTERNAL_ERROR);
            }
        }
        else {
            text = file.buffer.toString("utf-8");
            logger.info("Text/MD Extraction Result", {
                fileName: file.originalname,
                textLength: text.length,
            });
        }
        if (!text || text.trim().length < 20) {
            throw new AppError("Document extraction failed: No readable text found", 400, ErrorCodes.VALIDATION_ERROR);
        }
        logger.info(`Sending ${text.length} characters to AI for graph generation...`);
        const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, "document_to_graph", {}, req.user.id, graph_id);
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `文件名: ${file.originalname}\n文本内容:\n\n${text.substring(0, 15000)}`,
                },
            ],
            model: provider.model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });
        const content = completion.choices[0].message.content;
        const parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
        if (parsed.nodes) {
            parsed.nodes = parsed.nodes.filter((n) => n.title && n.title.trim() !== "");
        }
        res.json(parsed);
    }
    catch (error) {
        const err = error;
        logger.error("Document-to-Graph Error:", error);
        res
            .status(500)
            .json({ error: err.message || "Document processing failed" });
    }
});
router.post("/image-to-graph", requireAuth, upload.single("file"), async (req, res) => {
    const { provider: providerOverride, model: modelOverride } = req.body;
    const file = req.file;
    if (!file) {
        throw new AppError("No image uploaded", 400, ErrorCodes.VALIDATION_ERROR);
    }
    try {
        const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const result = await aiService.generateGraphFromImage(base64Image, {
            provider: providerOverride,
            model: modelOverride,
        });
        if (result.nodes) {
            result.nodes = result.nodes.filter((n) => {
                const node = n;
                return node.title && node.title.trim() !== "";
            });
        }
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger.error("Image-to-Graph Error:", error);
        res.status(500).json({ error: err.message || "Image processing failed" });
    }
});
router.post("/url-to-text", requireAuth, validate(urlToTextSchema), async (req, res) => {
    const { url } = req.body;
    try {
        const result = await scrapeUrl(url);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger.error("URL Scraping Error:", error);
        res
            .status(500)
            .json({ error: err.message || "Failed to fetch URL content" });
    }
});
export default router;
//# sourceMappingURL=document.js.map