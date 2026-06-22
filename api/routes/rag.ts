import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { ragService } from '../services/ai';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { performanceMonitor, enrichMetadata } from '../services/ai';
import { getSupabaseAdmin } from '../supabase';
import { getAIProviderForTask } from '../services/ai';

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
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
  use_graph_context: z.boolean().optional(),
  graph_hops: z.number().min(1).max(3).optional(),
  search_mode: z.enum(['semantic', 'keyword', 'hybrid']).optional(),
});

const ragSearchSchema = z.object({
  query: z.string().min(1, '搜索内容不能为空'),
  graph_id: z.string().uuid().optional(),
  match_threshold: z.number().min(0).max(1).optional(),
  match_count: z.number().min(1).max(20).optional(),
  use_graph_context: z.boolean().optional(),
  graph_hops: z.number().min(1).max(3).optional(),
  search_mode: z.enum(['semantic', 'keyword', 'hybrid']).optional(),
});

const analyzeGapsSchema = z.object({
  graph_id: z.string().uuid('无效的图谱ID'),
});

router.post('/chat', requireAuth, validate(ragChatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, current_node_id, history, provider, model, language, session_id, use_graph_context, graph_hops, search_mode } = req.body;
  const sessionId = session_id || crypto.randomUUID();

  try {
    const startTime = Date.now();
    const result = await ragService.chat(message, req.user.id, {
      graphId: graph_id,
      currentNodeId: current_node_id,
      history,
      provider,
      model,
      language,
      sessionId,
      useGraphContext: use_graph_context,
      graphHops: graph_hops,
      searchMode: search_mode,
    });
    const duration = Date.now() - startTime;

    const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
      graphId: graph_id,
      userId: req.user.id,
      topic: message?.slice(0, 50),
    });

    await performanceMonitor.recordLog({
      operation: 'rag_chat',
      provider: (await getAIProviderForTask('text')).providerType,
      model: model || (await getAIProviderForTask('text')).model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      duration,
      success: true,
      metadata: enrichedMetadata,
      sessionId,
    });

    res.json(result);
  } catch (error) {
    logger.error('RAG Chat Error:', error);
    throw new AppError((error as Error).message || '智能问答失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/chat/stream', requireAuth, validate(ragChatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, current_node_id, history, provider, model, language, session_id, use_graph_context, graph_hops, search_mode } = req.body;
  const sessionId = session_id || crypto.randomUUID();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sessionId);

  try {
    const startTime = Date.now();
    const sources = await ragService.streamChat(
      message,
      req.user.id,
      (content) => {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      },
      {
        graphId: graph_id,
        currentNodeId: current_node_id,
        history,
        provider,
        model,
        language,
        sessionId,
        useGraphContext: use_graph_context,
        graphHops: graph_hops,
        searchMode: search_mode,
      }
    );
    const duration = Date.now() - startTime;

    const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
      graphId: graph_id,
      userId: req.user.id,
      topic: message?.slice(0, 50),
    });

    await performanceMonitor.recordLog({
      operation: 'rag_stream_chat',
      provider: (await getAIProviderForTask('text')).providerType,
      model: model || (await getAIProviderForTask('text')).model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      duration,
      success: true,
      metadata: enrichedMetadata,
      sessionId,
    });

    res.write(`data: ${JSON.stringify({ sources })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('RAG Stream Chat Error:', error);
    res.write(`data: ${JSON.stringify({ error: (error as Error).message || '智能问答失败', code: ErrorCodes.SYSTEM_INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

router.post('/search', requireAuth, validate(ragSearchSchema), async (req: AuthRequest, res: Response) => {
  const { query, graph_id, match_threshold, match_count, use_graph_context, graph_hops, search_mode } = req.body;

  try {
    const results = await ragService.search(query, req.user.id, {
      graphId: graph_id,
      matchThreshold: match_threshold,
      matchCount: match_count,
      useGraphContext: use_graph_context,
      graphHops: graph_hops,
      searchMode: search_mode,
    });

    res.json({ results });
  } catch (error) {
    logger.error('RAG Search Error:', error);
    throw new AppError((error as Error).message || '语义搜索失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/analyze-gaps', requireAuth, validate(analyzeGapsSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.body;

  try {
    const result = await ragService.analyzeKnowledgeGaps(graph_id, req.user.id);
    res.json(result);
  } catch (error) {
    logger.error('Knowledge Gap Analysis Error:', error);
    throw new AppError((error as Error).message || '知识盲区分析失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
