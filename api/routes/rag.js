import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { ragService } from '../services/ai/ragService.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
const router = Router();
const ragChatSchema = z.object({
    message: z.string().min(1, '消息不能为空'),
    graph_id: z.string().uuid().optional(),
    current_node_id: z.string().uuid().optional(),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
    })).optional(),
    provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
    model: z.string().optional(),
});
const ragSearchSchema = z.object({
    query: z.string().min(1, '搜索内容不能为空'),
    graph_id: z.string().uuid().optional(),
    match_threshold: z.number().min(0).max(1).optional(),
    match_count: z.number().min(1).max(20).optional(),
});
const analyzeGapsSchema = z.object({
    graph_id: z.string().uuid('无效的图谱ID'),
});
router.post('/chat', requireAuth, validate(ragChatSchema), async (req, res) => {
    const { message, graph_id, current_node_id, history, provider, model } = req.body;
    try {
        const result = await ragService.chat(message, req.user.id, {
            graphId: graph_id,
            currentNodeId: current_node_id,
            history,
            provider,
            model
        });
        res.json(result);
    }
    catch (error) {
        logger.error('RAG Chat Error:', error);
        throw new AppError(error.message || '智能问答失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post('/chat/stream', requireAuth, validate(ragChatSchema), async (req, res) => {
    const { message, graph_id, current_node_id, history, provider, model } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
        const sources = await ragService.streamChat(message, req.user.id, (content) => {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }, {
            graphId: graph_id,
            currentNodeId: current_node_id,
            history,
            provider,
            model
        });
        res.write(`data: ${JSON.stringify({ sources })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (error) {
        logger.error('RAG Stream Chat Error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message || '智能问答失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
        res.end();
    }
});
router.post('/search', requireAuth, validate(ragSearchSchema), async (req, res) => {
    const { query, graph_id, match_threshold, match_count } = req.body;
    try {
        const results = await ragService.semanticSearch(query, req.user.id, {
            graphId: graph_id,
            matchThreshold: match_threshold,
            matchCount: match_count
        });
        res.json({ results });
    }
    catch (error) {
        logger.error('RAG Search Error:', error);
        throw new AppError(error.message || '语义搜索失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post('/analyze-gaps', requireAuth, validate(analyzeGapsSchema), async (req, res) => {
    const { graph_id } = req.body;
    try {
        const result = await ragService.analyzeKnowledgeGaps(graph_id, req.user.id);
        res.json(result);
    }
    catch (error) {
        logger.error('Knowledge Gap Analysis Error:', error);
        throw new AppError(error.message || '知识盲区分析失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
export default router;
//# sourceMappingURL=rag.js.map