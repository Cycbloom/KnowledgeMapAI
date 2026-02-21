import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema, uuidParamsSchema, batchDeleteNodesSchema, batchUpdatePositionsSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { aiService } from '../services/aiService.js';
import { achievementService } from '../services/achievementService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const REUSE_SIMILARITY_THRESHOLD = 0.85;

function buildNodeFromResult(gn: any): any {
  if (!gn) return null;
  
  const kp = gn.knowledge_points;
  return {
    id: kp?.id || gn.knowledge_point_id,
    graph_id: gn.graph_id,
    graph_node_id: gn.id,
    title: kp?.title || '',
    content: kp?.content || '',
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    properties: kp?.properties || {},
    learning_material: kp?.learning_material || '',
    is_accepted: gn.is_accepted,
    knowledge_point_id: gn.knowledge_point_id,
    visibility: kp?.visibility || 'private',
    owner_id: kp?.owner_id,
    created_at: kp?.created_at || gn.created_at,
    updated_at: kp?.updated_at || gn.updated_at,
  };
}

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
      const tags = properties?.tags?.join(', ') || '';
      const textToEmbed = [title, content, tags].filter(Boolean).join('\n');
      
      if (textToEmbed) {
        const embedding = await aiService.generateEmbedding(textToEmbed);
        
        if (embedding) {
          const { data: similarKps } = await req.supabase!.rpc('search_similar_knowledge_points', {
            p_query_embedding: embedding,
            p_user_id: req.user.id,
            p_match_threshold: REUSE_SIMILARITY_THRESHOLD,
            p_match_count: 1
          });
          
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
    const kpData: any = {
      title,
      content: content || '',
      learning_material: learning_material || '',
      properties: properties || {},
      visibility: 'private',
      owner_id: req.user.id,
    };

    try {
      const tags = properties?.tags?.join(', ') || '';
      const textToEmbed = [title, content, tags].filter(Boolean).join('\n');
      
      if (textToEmbed) {
        const embedding = await aiService.generateEmbedding(textToEmbed);
        if (embedding) {
          kpData.embedding = embedding;
        }
      }
    } catch (error) {
      logger.warn('Failed to generate embedding for new knowledge point:', error);
    }

    const { data: newKp, error: kpError } = await req.supabase!
      .from('knowledge_points')
      .insert([kpData])
      .select()
      .single();

    if (kpError) {
      logger.error('Create knowledge point error:', kpError);
      throw new AppError(kpError.message || '创建知识点失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    knowledgePointId = newKp.id;
  }

  const graphNodeData: any = {
    graph_id,
    knowledge_point_id: knowledgePointId,
    x_position: x_position ?? Math.round((Math.random() - 0.5) * 20),
    y_position: y_position ?? Math.round((Math.random() - 0.5) * 20),
    level: level || 'normal',
    is_accepted: is_accepted ?? true,
  };

  const { data: graphNode, error: gnError } = await req.supabase!
    .from('graph_nodes')
    .insert([graphNodeData])
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
    .single();

  if (gnError) {
    if (gnError.code === '23505') {
      throw new AppError('该知识点已存在于当前图谱中', 400, ErrorCodes.VALIDATION_ERROR);
    }
    logger.error('Create graph node error:', gnError);
    throw new AppError(gnError.message || '创建图谱节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  const result = buildNodeFromResult(graphNode);
  if (reusedKnowledgePoint) {
    result._reused = true;
  }

  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  cacheService.del(CacheKeys.LEARNING_PATH(graph_id));

  achievementService.updateCreationStats(req.user.id).catch(console.error);

  res.status(201).json(result);
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
    const { data: legacyNode, error: legacyError } = await req.supabase!
      .from('nodes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (legacyError || !legacyNode) {
      throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
    }

    return res.json(legacyNode);
  }

  res.json(buildNodeFromResult(graphNode));
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
    const { data, error } = await req.supabase!
      .from('nodes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message || '更新节点失败', 500, ErrorCodes.INTERNAL_ERROR);
    if (!data) throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);

    cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, data.graph_id));
    cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));
    cacheService.del(CacheKeys.LEARNING_PATH(data.graph_id));

    return res.json(data);
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

  if (kpUpdates.title || kpUpdates.content || updates.properties?.tags) {
    try {
      const currentKp = existingNode.knowledge_points as any;
      const title = kpUpdates.title || currentKp?.title || '';
      const content = kpUpdates.content || currentKp?.content || '';
      const tags = updates.properties?.tags || currentKp?.properties?.tags || [];
      
      const textToEmbed = [title, content, Array.isArray(tags) ? tags.join(', ') : '']
        .filter(Boolean)
        .join('\n');

      if (textToEmbed) {
        const embedding = await aiService.generateEmbedding(textToEmbed);
        if (embedding) {
          kpUpdates.embedding = embedding;
        }
      }
    } catch (error) {
      logger.warn('Failed to generate embedding for updated node:', error);
    }
  }

  if (Object.keys(kpUpdates).length > 0) {
    const { error: kpError } = await req.supabase!
      .from('knowledge_points')
      .update(kpUpdates)
      .eq('id', existingNode.knowledge_point_id);

    if (kpError) {
      logger.error('Update knowledge point error:', kpError);
      throw new AppError(kpError.message || '更新知识点失败', 500, ErrorCodes.INTERNAL_ERROR);
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

  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, existingNode.graph_id));
  cacheService.del(CacheKeys.STUDY_CARDS(existingNode.graph_id));
  cacheService.del(CacheKeys.LEARNING_PATH(existingNode.graph_id));

  res.json(buildNodeFromResult(updatedNode));
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

    if (nodeError || !graphNode) {
      const { data: legacyNode, error: legacyError } = await req.supabase!
        .from('nodes')
        .select('id, title, content, embedding, graph_id')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (legacyError || !legacyNode) {
        throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
      }

      let embedding = legacyNode.embedding;

      if (!embedding && (legacyNode.content || legacyNode.title)) {
        const textToEmbed = legacyNode.content || legacyNode.title;
        embedding = await aiService.generateEmbedding(textToEmbed);
        
        if (embedding) {
          await req.supabase!
            .from('nodes')
            .update({ embedding })
            .eq('id', id);
        }
      }

      if (!embedding) {
        return res.json([]);
      }

      const { data: relatedNodes, error: matchError } = await req.supabase!.rpc('match_nodes', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit + 1,
        p_user_id: req.user.id
      });

      if (matchError) throw matchError;

      const results = (relatedNodes || [])
        .filter((n: any) => n.id !== id)
        .slice(0, limit);

      return res.json(results);
    }

    const kp = graphNode.knowledge_points as any;
    let embedding = kp?.embedding;

    if (!embedding && (kp?.content || kp?.title)) {
      const textToEmbed = kp.content || kp.title;
      embedding = await aiService.generateEmbedding(textToEmbed);
      
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

    const { data: relatedKps, error: matchError } = await req.supabase!.rpc('search_similar_knowledge_points', {
      p_query_embedding: embedding,
      p_user_id: req.user.id,
      p_match_threshold: 0.5,
      p_match_count: limit + 1
    });

    if (matchError) throw matchError;

    const results = (relatedKps || [])
      .filter((kp: any) => kp.id !== id)
      .slice(0, limit);

    res.json(results);

  } catch (error: any) {
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
    const { data, error } = await req.supabase!
      .from('nodes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('graph_id')
      .single();

    if (error) throw new AppError(error.message || '删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);
    if (!data) throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);

    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, data.graph_id));
    await cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));
    await cacheService.del(CacheKeys.LEARNING_PATH(data.graph_id));

    return res.json({ message: '节点已删除' });
  }

  if (hardDelete) {
    const { data: result, error: deleteError } = await req.supabase!.rpc('hard_delete_knowledge_point', {
      p_knowledge_point_id: id,
      p_user_id: req.user.id
    });

    if (deleteError) {
      logger.error('Hard delete knowledge point error:', deleteError);
      throw new AppError(deleteError.message || '彻底删除知识点失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    if (!result?.success) {
      throw new AppError(result?.error || '删除失败', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graphNode.graph_id));
    await cacheService.del(CacheKeys.STUDY_CARDS(graphNode.graph_id));
    await cacheService.del(CacheKeys.LEARNING_PATH(graphNode.graph_id));

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

  await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graphNode.graph_id));
  await cacheService.del(CacheKeys.STUDY_CARDS(graphNode.graph_id));
  await cacheService.del(CacheKeys.LEARNING_PATH(graphNode.graph_id));

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
    const { data: legacyNodes } = await req.supabase!
      .from('nodes')
      .select('graph_id')
      .in('id', node_ids);
      
    if (!legacyNodes || legacyNodes.length === 0) {
      return res.json({ message: '未找到匹配的节点', count: 0 });
    }

    const { error, count } = await req.supabase!
      .from('nodes')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', node_ids);

    if (error) throw new AppError(error.message || '批量删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);

    const graphIds = [...new Set(legacyNodes.map((n: { graph_id: string }) => n.graph_id))];
    for (const gid of graphIds) {
      await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
      await cacheService.del(CacheKeys.STUDY_CARDS(gid));
      await cacheService.del(CacheKeys.LEARNING_PATH(gid));
    }
    await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));

    return res.json({ message: `成功删除 ${count} 个节点`, count });
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
    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
    await cacheService.del(CacheKeys.STUDY_CARDS(gid));
    await cacheService.del(CacheKeys.LEARNING_PATH(gid));
  }
  await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));

  res.json({ message: `成功删除 ${graphNodes.length} 个节点`, count: graphNodes.length });
});

router.post('/nodes/batch-update-positions', requireAuth, validate(batchUpdatePositionsSchema), async (req: AuthRequest, res: Response) => {
  const { positions } = req.body;

  const nodeIds = positions.map((p: { id: string }) => p.id);
  
  const { data: graphNodes, error: findError } = await req.supabase!
    .from('graph_nodes')
    .select('id, graph_id, knowledge_point_id')
    .in('knowledge_point_id', nodeIds)
    .is('deleted_at', null);

  if (findError) {
    logger.error('Find nodes for batch position update error:', findError);
  }

  if (!graphNodes || graphNodes.length === 0) {
    const { data: legacyNodes } = await req.supabase!
      .from('nodes')
      .select('id, graph_id')
      .in('id', nodeIds);
      
    if (!legacyNodes || legacyNodes.length === 0) {
      return res.json({ message: '未找到匹配的节点', count: 0 });
    }

    const updatePromises = positions.map((pos: { id: string; x_position: number; y_position: number }) => 
      req.supabase!
        .from('nodes')
        .update({ 
          x_position: pos.x_position, 
          y_position: pos.y_position 
        })
        .eq('id', pos.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      logger.error('Batch position update errors:', errors);
    }

    const graphIds = [...new Set(legacyNodes.map((n: { graph_id: string }) => n.graph_id))];
    for (const gid of graphIds) {
      await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
    }

    return res.json({ message: `成功更新 ${positions.length} 个节点位置`, count: positions.length });
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
    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
  }

  res.json({ message: `成功更新 ${positions.length} 个节点位置`, count: positions.length });
});

router.get('/nodes/:id/knowledge-point-graphs', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data, error } = await req.supabase!.rpc('get_knowledge_point_graphs', {
    p_knowledge_point_id: id,
    p_user_id: req.user.id
  });

  if (error) {
    logger.error('Get knowledge point graphs error:', error);
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }

  res.json(data || []);
});

router.post('/edges', requireAuth, validate(createEdgeSchema), async (req: AuthRequest, res: Response) => {
  const { source_node_id, target_node_id, relationship_type } = req.body;

  const { data: sourceGn, error: sourceError } = await req.supabase!
    .from('graph_nodes')
    .select('id, graph_id, knowledge_point_id')
    .eq('knowledge_point_id', source_node_id)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: targetGn, error: targetError } = await req.supabase!
    .from('graph_nodes')
    .select('id, graph_id, knowledge_point_id')
    .eq('knowledge_point_id', target_node_id)
    .is('deleted_at', null)
    .maybeSingle();

  let graphId: string | undefined;

  if (sourceGn && targetGn) {
    graphId = sourceGn.graph_id;

    const { data: existingEdge } = await req.supabase!
      .from('edges')
      .select('id, deleted_at')
      .eq('source_graph_node_id', sourceGn.id)
      .eq('target_graph_node_id', targetGn.id)
      .eq('graph_id', graphId)
      .maybeSingle();

    let data: any;
    let error: any;

    if (existingEdge) {
      if (existingEdge.deleted_at) {
        const result = await req.supabase!
          .from('edges')
          .update({ deleted_at: null })
          .eq('id', existingEdge.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        data = existingEdge;
        error = null;
      }
    } else {
      const result = await req.supabase!
        .from('edges')
        .insert([{
          source_node_id,
          target_node_id,
          source_graph_node_id: sourceGn.id,
          target_graph_node_id: targetGn.id,
          relationship_type: relationship_type || 'related',
          graph_id: graphId
        }])
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) throw new AppError(error.message || '创建边失败', 500, ErrorCodes.INTERNAL_ERROR);

    cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graphId!));
    cacheService.del(CacheKeys.LEARNING_PATH(graphId!));

    return res.status(201).json(data);
  }

  const { data: sourceNode, error: legacySourceError } = await req.supabase!
    .from('nodes')
    .select('id, graph_id')
    .eq('id', source_node_id)
    .is('deleted_at', null)
    .single();

  if (legacySourceError || !sourceNode) {
    throw new AppError('Source node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  const { data: targetNode, error: legacyTargetError } = await req.supabase!
    .from('nodes')
    .select('id')
    .eq('id', target_node_id)
    .is('deleted_at', null)
    .single();

  if (legacyTargetError || !targetNode) {
    throw new AppError('Target node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  const { data: existingEdge } = await req.supabase!
    .from('edges')
    .select('id, deleted_at')
    .eq('source_node_id', source_node_id)
    .eq('target_node_id', target_node_id)
    .eq('relationship_type', relationship_type || 'related')
    .maybeSingle();

  let data: any;
  let error: any;

  if (existingEdge) {
    if (existingEdge.deleted_at) {
      const result = await req.supabase!
        .from('edges')
        .update({ deleted_at: null })
        .eq('id', existingEdge.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      data = existingEdge;
      error = null;
    }
  } else {
    const result = await req.supabase!
      .from('edges')
      .insert([
        { source_node_id, target_node_id, relationship_type, graph_id: sourceNode.graph_id }
      ])
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw new AppError(error.message || '创建边失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, sourceNode.graph_id));
  cacheService.del(CacheKeys.LEARNING_PATH(sourceNode.graph_id));
  
  res.status(201).json(data);
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
    cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graphId));
    cacheService.del(CacheKeys.LEARNING_PATH(graphId));
  }
  
  res.json({ message: 'Edge deleted' });
});

export default router;
