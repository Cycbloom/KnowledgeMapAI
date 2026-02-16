import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { getAIProviderForTask, getAIProvider } from '../services/ai/factory.js';
import { promptService } from '../services/promptService.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { scrapeUrl } from '../utils/scraper.js';
import { z } from 'zod';

const router = Router();

const URL_PATTERN = /^https?:\/\/.+/;

async function processSource(source: string): Promise<string> {
  const trimmed = source.trim();
  
  if (URL_PATTERN.test(trimmed)) {
    try {
      logger.info(`Fetching URL content: ${trimmed}`);
      const result = await scrapeUrl(trimmed);
      return `【来源: ${result.title}】\n${result.text.slice(0, 3000)}`;
    } catch (error) {
      logger.warn(`Failed to scrape URL: ${trimmed}`, error);
      return `【URL: ${trimmed}】(无法获取内容)`;
    }
  }
  
  return trimmed;
}

const initGraphSchema = z.object({
  topic: z.string().min(2).max(200),
  style: z.enum(['academic', 'practical', 'beginner']).default('academic'),
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
  style: z.enum(['academic', 'practical', 'beginner']).default('academic'),
  existing_children: z.array(z.object({
    title: z.string(),
    content: z.string().optional(),
  })).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post('/init', requireAuth, validate(initGraphSchema), async (req: AuthRequest, res: Response) => {
  const { topic, style, sources, graph_id, provider: providerType, model } = req.body;
  const supabase = req.supabase!;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    throw new AppError('AI provider not configured', 503, ErrorCodes.INTERNAL_ERROR);
  }

  try {
    let processedSources: string[] = [];
    if (sources && sources.length > 0) {
      processedSources = await Promise.all(sources.map(processSource));
    }

    const templateData: Record<string, any> = {
      topic,
      isAcademic: style === 'academic',
      isPractical: style === 'practical',
      hasSources: processedSources.length > 0,
      sources: processedSources.join('\n\n---\n\n'),
      isInit: true
    };

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      'auto_graph_init',
      templateData,
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `主题：${topic}${processedSources.length > 0 ? `\n\n参考来源：\n${processedSources.join('\n\n---\n\n')}` : ''}` }
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"root": null, "coreNodes": []}');
    } catch (e) {
      logger.error('JSON Parse Error:', { content: content?.slice(-100) });
      throw new AppError('AI 生成内容解析失败', 422, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({
      root: parsed.root || { title: topic, content: `${topic}的核心概念和知识体系` },
      coreNodes: parsed.coreNodes || []
    });

  } catch (error: any) {
    logger.error('Auto Graph Init Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '知识图谱初始化失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/expand', requireAuth, validate(expandNodeSchema), async (req: AuthRequest, res: Response) => {
  const { 
    node_id, 
    node_title, 
    node_content, 
    node_level,
    graph_id, 
    style, 
    existing_children,
    provider: providerType, 
    model 
  } = req.body;
  const supabase = req.supabase!;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    throw new AppError('AI provider not configured', 503, ErrorCodes.INTERNAL_ERROR);
  }

  try {
    const templateData: Record<string, any> = {
      nodeTitle: node_title,
      nodeContent: node_content || '',
      nodeLevel: node_level || 'normal',
      isAcademic: style === 'academic',
      isPractical: style === 'practical',
      hasExistingChildren: existing_children && existing_children.length > 0,
      existingChildren: existing_children?.map((c: any) => c.title).join('、') || ''
    };

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      'auto_graph_expand',
      templateData,
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请为「${node_title}」生成子节点。${existing_children && existing_children.length > 0 ? `\n\n已有的子节点：${existing_children.map((c: any) => c.title).join('、')}\n请生成新的、不同的子节点。` : ''}` }
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"children": []}');
    } catch (e) {
      logger.error('JSON Parse Error:', { content: content?.slice(-100) });
      throw new AppError('AI 生成内容解析失败', 422, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({
      parentNodeId: node_id,
      children: parsed.children || []
    });

  } catch (error: any) {
    logger.error('Auto Graph Expand Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '节点展开失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/save-nodes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id, nodes } = req.body;

  if (!graph_id) {
    throw new AppError('Graph ID is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    throw new AppError('No nodes provided', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const { data: existingNodes } = await req.supabase!
      .from('nodes')
      .select('id')
      .eq('graph_id', graph_id);

    const existingCount = existingNodes?.length || 0;

    const nodesWithTempId = nodes
      .filter((node: any) => node.title && node.title.trim() !== "")
      .map((node: any, index: number) => {
        const angle = ((existingCount + index) / (existingCount + nodes.length)) * Math.PI * 2;
        const radius = 15 + (existingCount + index) * 2;
        
        // Use frontend's id directly as tempId to maintain parent-child relationships
        const tempId = node.id || `temp-${index}`;
        
        return {
          tempId,
          parentId: node.parentId || null,
          graph_id,
          title: node.title,
          content: node.content || '',
          x_position: Math.round(Math.cos(angle) * radius),
          y_position: Math.round(Math.sin(angle) * radius),
          level: node.level || 'normal',
          properties: { 
            source: 'ai-generated',
            generated_at: new Date().toISOString()
          }
        };
      });

    if (nodesWithTempId.length === 0) {
      return res.json({ success: true, nodeCount: 0, edgeCount: 0 });
    }

    const nodesToInsert = nodesWithTempId.map(({ tempId, parentId, ...node }) => node);
    
    const { data: insertedNodes, error: nodeError } = await req.supabase!
      .from('nodes')
      .insert(nodesToInsert)
      .select('id, title');

    if (nodeError) throw new AppError(nodeError.message, 500, ErrorCodes.INTERNAL_ERROR);

    const titleToDbId = new Map<string, string>();
    insertedNodes?.forEach((node: any) => {
      titleToDbId.set(node.title, node.id);
    });

    logger.info('Title to DB ID mapping:', Object.fromEntries(titleToDbId));
    logger.info('Nodes with temp ID:', nodesWithTempId.map(n => ({ tempId: n.tempId, parentId: n.parentId, title: n.title })));

    const edgesToInsert: any[] = [];
    
    nodesWithTempId.forEach((nodeData) => {
      if (nodeData.parentId) {
        const parentNode = nodesWithTempId.find(n => n.tempId === nodeData.parentId);
        if (parentNode) {
          const parentDbId = titleToDbId.get(parentNode.title);
          const childDbId = titleToDbId.get(nodeData.title);
          
          logger.info(`Creating edge: ${parentNode.title}(${parentDbId}) -> ${nodeData.title}(${childDbId})`);
          
          if (parentDbId && childDbId) {
            edgesToInsert.push({
              source_node_id: parentDbId,
              target_node_id: childDbId,
              relationship_type: 'contains',
              graph_id
            });
          }
        }
      }
    });

    logger.info(`Total edges to insert: ${edgesToInsert.length}`);

    if (edgesToInsert.length > 0) {
      const { error: edgeError } = await req.supabase!
        .from('edges')
        .insert(edgesToInsert);
        
      if (edgeError) {
        logger.error('Edge insertion error:', edgeError);
      }
    }

    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
    await cacheService.del(CacheKeys.GRAPH_NODES('public', graph_id));

    res.json({ 
      success: true, 
      nodeCount: nodesWithTempId.length, 
      edgeCount: edgesToInsert.length,
      nodes: insertedNodes
    });

  } catch (error: any) {
    logger.error('Save Nodes Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '保存节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
