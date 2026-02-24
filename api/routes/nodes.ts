import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema, uuidParamsSchema, batchDeleteNodesSchema, batchUpdatePositionsSchema } from '../schemas/index.js';
import { cacheService } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { aiService } from '../services/aiService.js';
import { achievementService } from '../services/achievementService.js';
import { logger } from '../utils/logger.js';
import { knowledgePointService } from '../services/knowledgePointService.js';
import { graphNodeService } from '../services/graphNodeService.js';
import { edgeService } from '../services/edgeService.js';
import { buildNodeFromGraphNode } from '../utils/nodeHelpers.js';

const router = Router();

const REUSE_SIMILARITY_THRESHOLD = 0.85;

router.post('/nodes', requireAuth, validate(createNodeSchema), async (req: AuthRequest, res: Response) => {
  const { 
    id, 
    graph_id, 
    title, 
    content, 
    x_position, 
    y_position, 
    properties, 
    level, 
    is_accepted,
    learning_material,
    knowledge_point_id: existingKpId,
    reuse_existing = true
  } = req.body;

  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id, user_id')
    .eq('id', graph_id)
    .single();

  if (!graph) {
    throw new AppError('未经授权访问图谱', 403, ErrorCodes.FORBIDDEN);
  }

  let knowledgePointId = existingKpId;
  let reusedKnowledgePoint = false;

  if (!knowledgePointId && reuse_existing) {
    try {
      if (title) {
        const embedding = await aiService.generateEmbedding(title);
        
        if (embedding) {
          const similarKps = await knowledgePointService.searchSimilar(
            req.supabase!,
            embedding,
            req.user.id,
            REUSE_SIMILARITY_THRESHOLD,
            1
          );
          
          if (similarKps && similarKps.length > 0) {
            knowledgePointId = similarKps[0].id;
            reusedKnowledgePoint = true;
            logger.info(`Reusing existing knowledge point: ${knowledgePointId} for title: ${title}`);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to search for similar knowledge points:', error);
    }
  }

  if (!knowledgePointId) {
    const newKp = await knowledgePointService.create(req.supabase!, {
      title,
      content: content || '',
      learning_material: learning_material || '',
      properties: properties || {},
      visibility: 'private',
      owner_id: req.user.id,
    });

    knowledgePointId = newKp.id;
  }

  try {
    const graphNode = await graphNodeService.addToGraph(req.supabase!, {
      graph_id,
      knowledge_point_id: knowledgePointId,
      x_position,
      y_position,
      level,
      is_accepted,
    });

    const result = buildNodeFromGraphNode(graphNode);
    if (result && reusedKnowledgePoint) {
      (result as any)._reused = true;
    }

    await cacheService.invalidateGraphCache(req.user.id, graph_id);
    await cacheService.invalidateUserGraphsCache(req.user.id);

    achievementService.updateCreationStats(req.user.id).catch(console.error);

    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('已存在于当前图谱中')) {
      throw new AppError('该知识点已存在于当前图谱中', 400, ErrorCodes.VALIDATION_ERROR);
    }
    logger.error('Create graph node error:', error);
    throw new AppError(message || '创建图谱节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data: graphNode, error } = await req.supabase!
    .from('graph_nodes')
    .select(`
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      deleted_at,
      created_at,
      updated_at,
      knowledge_points (
        id,
        title,
        content,
        learning_material,
        properties,
        visibility,
        owner_id,
        created_at,
        updated_at
      )
    `)
    .eq('knowledge_point_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('Get node error:', error);
    throw new AppError('获取节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  if (!graphNode) {
    throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  res.json(buildNodeFromGraphNode(graphNode));
});

router.put('/nodes/:id', requireAuth, validate(updateNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const { data: existingNode, error: findError } = await req.supabase!
    .from('graph_nodes')
    .select(`
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      knowledge_points (
        id,
        title,
        content,
        learning_material,
        properties,
        visibility,
        owner_id
      )
    `)
    .eq('knowledge_point_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (findError) {
    logger.error('Find node error:', findError);
  }

  if (!existingNode) {
    throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  const kpUpdates: any = {};
  const gnUpdates: any = {};

  if (updates.title !== undefined) kpUpdates.title = updates.title;
  if (updates.content !== undefined) kpUpdates.content = updates.content;
  if (updates.learning_material !== undefined) kpUpdates.learning_material = updates.learning_material;
  if (updates.properties !== undefined) kpUpdates.properties = updates.properties;
  if (updates.visibility !== undefined) kpUpdates.visibility = updates.visibility;

  if (updates.x_position !== undefined) gnUpdates.x_position = updates.x_position;
  if (updates.y_position !== undefined) gnUpdates.y_position = updates.y_position;
  if (updates.level !== undefined) gnUpdates.level = updates.level;
  if (updates.is_accepted !== undefined) gnUpdates.is_accepted = updates.is_accepted;

  if (Object.keys(kpUpdates).length > 0) {
    try {
      await knowledgePointService.update(req.supabase!, existingNode.knowledge_point_id, kpUpdates);
    } catch (error: unknown) {
      logger.error('Update knowledge point error:', error);
      const message = error instanceof Error ? error.message : '更新知识点失败';
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  if (Object.keys(gnUpdates).length > 0) {
    const { error: gnError } = await req.supabase!
      .from('graph_nodes')
      .update(gnUpdates)
      .eq('id', existingNode.id);

    if (gnError) {
      logger.error('Update graph node error:', gnError);
      throw new AppError(gnError.message || '更新图谱节点失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  const { data: updatedNode, error: refetchError } = await req.supabase!
    .from('graph_nodes')
    .select(`
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      created_at,
      updated_at,
      knowledge_points (
        id,
        title,
        content,
        learning_material,
        properties,
        visibility,
        owner_id,
        created_at,
        updated_at
      )
    `)
    .eq('id', existingNode.id)
    .single();

  if (refetchError || !updatedNode) {
    throw new AppError('获取更新后的节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  await cacheService.invalidateGraphCache(req.user.id, existingNode.graph_id);
  await cacheService.invalidateStudyCache(existingNode.graph_id);

  res.json(buildNodeFromGraphNode(updatedNode));
});

router.get('/nodes/:id/related', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 5;

  try {
    const { data: graphNode, error: nodeError } = await req.supabase!
      .from('graph_nodes')
      .select(`
        id,
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content,
          embedding
        )
      `)
      .eq('knowledge_point_id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (nodeError) {
      logger.error('Find node for related error:', nodeError);
    }
    
    if (!graphNode) {
      throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
    }

    const kp = graphNode.knowledge_points as any;
    let embedding = kp?.embedding;

    if (!embedding && kp?.title) {
      embedding = await aiService.generateEmbedding(kp.title);
      
      if (embedding) {
        await req.supabase!
          .from('knowledge_points')
          .update({ embedding })
          .eq('id', kp.id);
      }
    }

    if (!embedding) {
      return res.json([]);
    }

    const relatedKps = await knowledgePointService.searchSimilar(
      req.supabase!,
      embedding,
      req.user.id,
      0.5,
      limit + 1
    );

    const results = (relatedKps || [])
      .filter((kp: any) => kp.id !== id)
      .slice(0, limit);

    res.json(results);

  } catch (error: unknown) {
    logger.error('Related nodes error:', error);
    if (error instanceof AppError) throw error;
    res.status(500).json({ error: 'Failed to fetch related nodes' });
  }
});

router.delete('/nodes/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const hardDeleteParam = req.query.hard_delete;
  const hardDelete = hardDeleteParam === 'true' || hardDeleteParam === '1';

  const { data: graphNode, error: findError } = await req.supabase!
    .from('graph_nodes')
    .select(`
      id,
      graph_id,
      knowledge_point_id,
      knowledge_points (
        id,
        owner_id
      )
    `)
    .eq('knowledge_point_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (findError) {
    logger.error('Find node for delete error:', findError);
  }

  if (!graphNode) {
    throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  if (hardDelete) {
    const result = await knowledgePointService.delete(req.supabase!, id, req.user.id);

    if (!result?.success) {
      throw new AppError('删除失败', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await cacheService.invalidateGraphCache(req.user.id, graphNode.graph_id);

    return res.json({ 
      message: '知识点已彻底删除',
      affected_graphs: result.affected_graphs,
      deleted_graph_nodes: result.deleted_graph_nodes,
      deleted_edges: result.deleted_edges,
      deleted_cards: result.deleted_cards
    });
  }

  const { error: softDeleteError } = await req.supabase!.rpc('soft_delete_graph_node', {
    p_graph_node_id: graphNode.id,
    p_user_id: req.user.id
  });

  if (softDeleteError) {
    logger.error('Soft delete graph node error:', softDeleteError);
    throw new AppError(softDeleteError.message || '删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  await cacheService.invalidateGraphCache(req.user.id, graphNode.graph_id);

  res.json({ message: '节点已从当前图谱移除' });
});

router.post('/nodes/batch-delete', requireAuth, validate(batchDeleteNodesSchema), async (req: AuthRequest, res: Response) => {
  const { node_ids } = req.body;

  const { data: graphNodes, error: findError } = await req.supabase!
    .from('graph_nodes')
    .select('id, graph_id, knowledge_point_id')
    .in('knowledge_point_id', node_ids)
    .is('deleted_at', null);

  if (findError) {
    logger.error('Find nodes for batch delete error:', findError);
  }

  if (!graphNodes || graphNodes.length === 0) {
    return res.json({ message: '未找到匹配的节点', count: 0 });
  }

  const graphNodeIds = graphNodes.map(gn => gn.id);
  const { error: deleteError } = await req.supabase!
    .from('graph_nodes')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', graphNodeIds);

  if (deleteError) {
    throw new AppError(deleteError.message || '批量删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  const graphIds = [...new Set(graphNodes.map(gn => gn.graph_id))];
  for (const gid of graphIds) {
    await cacheService.invalidateGraphCache(req.user.id, gid);
  }
  await cacheService.invalidateUserGraphsCache(req.user.id);

  res.json({ message: `成功删除 ${graphNodes.length} 个节点`, count: graphNodes.length });
});

router.post('/nodes/batch-update-positions', requireAuth, validate(batchUpdatePositionsSchema), async (req: AuthRequest, res: Response) => {
  const { positions } = req.body;

  const { data: graphNodes, error: findError } = await req.supabase!
    .from('graph_nodes')
    .select('id, graph_id, knowledge_point_id')
    .in('knowledge_point_id', positions.map((p: { id: string }) => p.id))
    .is('deleted_at', null);

  if (findError) {
    logger.error('Find nodes for batch position update error:', findError);
  }

  if (!graphNodes || graphNodes.length === 0) {
    return res.json({ message: '未找到匹配的节点', count: 0 });
  }

  const kpIdToGnId = new Map(graphNodes.map(gn => [gn.knowledge_point_id, gn.id]));

  const updatePromises = positions
    .filter((pos: { id: string }) => kpIdToGnId.has(pos.id))
    .map((pos: { id: string; x_position: number; y_position: number }) => 
      req.supabase!
        .from('graph_nodes')
        .update({ 
          x_position: pos.x_position, 
          y_position: pos.y_position 
        })
        .eq('id', kpIdToGnId.get(pos.id))
    );

  const results = await Promise.all(updatePromises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    logger.error('Batch position update errors:', errors);
  }

  const graphIds = [...new Set(graphNodes.map(gn => gn.graph_id))];
  for (const gid of graphIds) {
    await cacheService.invalidateGraphCache(req.user.id, gid);
  }

  res.json({ message: `成功更新 ${positions.length} 个节点位置`, count: positions.length });
});

router.get('/nodes/:id/knowledge-point-graphs', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const data = await knowledgePointService.getGraphs(req.supabase!, id, req.user.id);

  res.json(data || []);
});

router.post('/edges', requireAuth, validate(createEdgeSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type } = req.body;

  try {
    const edge = await edgeService.create(req.supabase!, {
      graph_id,
      source_knowledge_point_id,
      target_knowledge_point_id,
      relationship_type: relationship_type || 'related',
    });

    await cacheService.invalidateGraphCache(req.user.id, graph_id);

    res.status(201).json({
      id: edge.id,
      graph_id: edge.graph_id,
      source_knowledge_point_id: edge.source_knowledge_point_id,
      target_knowledge_point_id: edge.target_knowledge_point_id,
      relationship_type: edge.relationship_type,
      weight: edge.weight,
      created_at: edge.created_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('源知识点不在当前图谱中')) {
      throw new AppError('Source node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
    }
    if (message.includes('目标知识点不在当前图谱中')) {
      throw new AppError('Target node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
    }
    throw new AppError(message || '创建边失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.delete('/edges/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data: edge, error } = await req.supabase!
    .from('edges')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('graph_id')
    .single();

  if (error) throw new AppError(error.message || '删除边失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  if (!edge) {
    throw new AppError('Edge not found or unauthorized', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  
  const graphId = edge.graph_id;
  if (graphId) {
    await cacheService.invalidateGraphCache(req.user.id, graphId);
  }
  
  res.json({ message: 'Edge deleted' });
});

export default router;
