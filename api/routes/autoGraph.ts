import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { getAIProviderForTask, getAIProvider } from '../services/ai/factory.js';
import { promptService } from '../services/promptService.js';
import { graphService } from '../services/graphService.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

const autoGraphSchema = z.object({
  topic: z.string().min(2).max(200),
  depth: z.number().min(1).max(5).default(3),
  style: z.enum(['academic', 'practical', 'beginner']).default('academic'),
  sources: z.array(z.string()).optional(),
  graph_id: z.string().uuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

const autoGraphStreamSchema = z.object({
  topic: z.string().min(2).max(200),
  depth: z.number().min(1).max(5).default(3),
  style: z.enum(['academic', 'practical', 'beginner']).default('academic'),
  sources: z.array(z.string()).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post('/auto-graph', requireAuth, validate(autoGraphSchema), async (req: AuthRequest, res: Response) => {
  const { topic, depth, style, sources, graph_id, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    throw new AppError('AI provider not configured', 503, ErrorCodes.INTERNAL_ERROR);
  }

  try {
    const systemPrompt = `你是一个知识图谱生成专家。请根据用户提供的主题，生成一个结构化的知识图谱。

要求：
1. 生成一个层级结构的知识图谱，包含根节点、核心节点、子节点等
2. 每个节点需要有标题、内容描述和层级
3. 节点之间需要有明确的关系
4. 深度为 ${depth} 层
5. 风格为 ${style === 'academic' ? '学术风格' : style === 'practical' ? '实用风格' : '入门风格'}

请返回 JSON 格式：
{
  "nodes": [
    { "id": "唯一ID", "title": "节点标题", "content": "节点内容描述", "level": "root|core|sub|normal|leaf" }
  ],
  "edges": [
    { "source": "源节点ID", "target": "目标节点ID", "relationship": "contains|related|depends_on" }
  ],
  "suggestions": ["建议添加的内容1", "建议添加的内容2"]
}

注意：
- 节点ID使用简单的数字或字母，如 "1", "2", "a", "b" 等
- level 必须是 root, core, sub, normal, leaf 之一
- relationship 必须是 contains, related, depends_on 之一`;

    const sourcesContext = sources && sources.length > 0 
      ? `\n\n参考来源：\n${sources.join('\n')}` 
      : '';

    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `主题：${topic}${sourcesContext}` }
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 8000,
    });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch (e) {
      logger.error('JSON Parse Error:', { content: content?.slice(-100) });
      throw new AppError('AI 生成内容解析失败', 422, ErrorCodes.INTERNAL_ERROR);
    }

    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter((n: any) => n.title && n.title.trim() !== "");
    }

    res.json(parsed);

  } catch (error: any) {
    logger.error('Auto Graph Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '知识图谱生成失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/auto-graph-stream', requireAuth, validate(autoGraphStreamSchema), async (req: AuthRequest, res: Response) => {
  const { topic, depth, style, sources, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!provider.hasKey) {
    res.write(`data: ${JSON.stringify({ error: 'AI provider not configured', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
    return;
  }

  try {
    res.write(`data: ${JSON.stringify({ status: 'analyzing', message: '正在分析主题...' })}\n\n`);

    const systemPrompt = `你是一个知识图谱生成专家。请根据用户提供的主题，逐步生成一个结构化的知识图谱。

要求：
1. 生成一个层级结构的知识图谱，包含根节点、核心节点、子节点等
2. 每个节点需要有标题、内容描述和层级
3. 节点之间需要有明确的关系
4. 深度为 ${depth} 层
5. 风格为 ${style === 'academic' ? '学术风格' : style === 'practical' ? '实用风格' : '入门风格'}

请逐步输出，每次输出一个节点或一条边，格式如下：
- 节点：NODE|id|title|content|level
- 边：EDGE|source|target|relationship

最后输出建议：SUGGESTIONS|建议1;建议2;建议3`;

    const sourcesContext = sources && sources.length > 0 
      ? `\n\n参考来源：\n${sources.join('\n')}` 
      : '';

    const stream = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `主题：${topic}${sourcesContext}` }
      ],
      model: model || provider.model,
      stream: true,
      max_tokens: 8000,
    });

    let buffer = '';
    const nodes: any[] = [];
    const edges: any[] = [];
    const suggestions: string[] = [];

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      buffer += content;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('NODE|')) {
          const parts = line.split('|');
          if (parts.length >= 5) {
            const node = {
              id: parts[1],
              title: parts[2],
              content: parts[3],
              level: parts[4]
            };
            nodes.push(node);
            res.write(`data: ${JSON.stringify({ type: 'node', data: node })}\n\n`);
          }
        } else if (line.startsWith('EDGE|')) {
          const parts = line.split('|');
          if (parts.length >= 4) {
            const edge = {
              source: parts[1],
              target: parts[2],
              relationship: parts[3]
            };
            edges.push(edge);
            res.write(`data: ${JSON.stringify({ type: 'edge', data: edge })}\n\n`);
          }
        } else if (line.startsWith('SUGGESTIONS|')) {
          const sugs = line.replace('SUGGESTIONS|', '').split(';').filter(s => s.trim());
          suggestions.push(...sugs);
          res.write(`data: ${JSON.stringify({ type: 'suggestions', data: sugs })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: { nodes, edges, suggestions } 
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    logger.error('Auto Graph Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || '知识图谱生成失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

router.post('/save-auto-graph', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id, nodes, edges } = req.body;

  if (!graph_id) {
    throw new AppError('Graph ID is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    throw new AppError('No nodes provided', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const nodeMap = new Map<string, string>();
    
    const nodesToInsert = nodes
      .filter((node: any) => node.title && node.title.trim() !== "")
      .map((node: any, index: number) => {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        if (node.id) nodeMap.set(node.id, uuid);
        
        const angle = (index / nodes.length) * Math.PI * 2;
        const radius = 10 + Math.random() * 20;
        
        return {
          id: uuid,
          graph_id,
          title: node.title,
          content: node.content || '',
          x_position: Math.round(Math.cos(angle) * radius),
          y_position: Math.round(Math.sin(angle) * radius),
          level: node.level || 'normal',
          properties: { 
            source: 'ai-auto-graph',
            generated_at: new Date().toISOString()
          }
        };
      });

    if (nodesToInsert.length === 0) {
      return res.json({ success: true, nodeCount: 0, edgeCount: 0 });
    }

    const { error: nodeError } = await req.supabase!
      .from('nodes')
      .insert(nodesToInsert);

    if (nodeError) throw new AppError(nodeError.message, 500, ErrorCodes.INTERNAL_ERROR);

    const edgesToInsert: any[] = [];
    if (edges && Array.isArray(edges)) {
      edges.forEach((edge: any) => {
        const sourceUuid = nodeMap.get(edge.source);
        const targetUuid = nodeMap.get(edge.target);
        
        if (sourceUuid && targetUuid) {
          edgesToInsert.push({
            source_node_id: sourceUuid,
            target_node_id: targetUuid,
            relationship_type: edge.relationship || 'related',
            graph_id
          });
        }
      });
    }

    if (edgesToInsert.length > 0) {
      const { error: edgeError } = await req.supabase!
        .from('edges')
        .insert(edgesToInsert);
        
      if (edgeError) logger.error('Edge insertion error:', edgeError);
    }

    res.json({ 
      success: true, 
      nodeCount: nodesToInsert.length, 
      edgeCount: edgesToInsert.length 
    });

  } catch (error: any) {
    logger.error('Save Auto Graph Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '保存图谱失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
