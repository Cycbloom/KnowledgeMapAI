import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { graphService } from '../services/graphService.js';
import { taskService } from '../services/taskService.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

const createPrerequisiteSchema = z.object({
  topic: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  auto_generate: z.boolean().default(true),
});

const batchCreateSchema = z.object({
  topics: z.array(z.object({
    topic: z.string().min(2).max(200),
    description: z.string().max(500).optional(),
    mastery_level: z.string(),
  })).min(1).max(5),
  depth: z.number().min(1).max(3).default(2),
  style: z.enum(['academic', 'practical', 'beginner']).default('academic'),
});

interface GraphRelation {
  id: string;
  sourceGraphId: string;
  targetGraphId: string;
  relationType: 'prerequisite' | 'extension' | 'related';
  context: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  targetGraph?: {
    id: string;
    title: string;
    description: string | null;
    nodeCount?: number;
  };
}

router.get('/:graphId/relations', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id')
      .eq('id', graphId)
      .single();

    if (!graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const { data: outgoingRelations } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at
      `)
      .eq('source_graph_id', graphId);

    const { data: incomingRelations } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at
      `)
      .eq('target_graph_id', graphId);

    const targetGraphIds = [
      ...(outgoingRelations || []).map(r => r.target_graph_id),
      ...(incomingRelations || []).map(r => r.source_graph_id)
    ].filter(Boolean);

    const { data: relatedGraphs } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .in('id', targetGraphIds);

    const { data: nodeCounts } = await supabase
      .from('nodes')
      .select('graph_id')
      .in('graph_id', targetGraphIds)
      .is('deleted_at', null);

    const nodeCountMap = new Map<string, number>();
    (nodeCounts || []).forEach(n => {
      nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
    });

    const graphMap = new Map(relatedGraphs?.map(g => [g.id, g]) || []);

    const prerequisites: GraphRelation[] = [];
    const extensions: GraphRelation[] = [];
    const related: GraphRelation[] = [];

    (outgoingRelations || []).forEach(r => {
      const targetGraph = graphMap.get(r.target_graph_id);
      const relation: GraphRelation = {
        id: r.id,
        sourceGraphId: r.source_graph_id,
        targetGraphId: r.target_graph_id,
        relationType: r.relation_type,
        context: r.context,
        metadata: r.metadata || {},
        createdAt: r.created_at,
        targetGraph: targetGraph ? {
          id: targetGraph.id,
          title: targetGraph.title,
          description: targetGraph.description,
          nodeCount: nodeCountMap.get(targetGraph.id) || 0
        } : undefined
      };

      if (r.relation_type === 'prerequisite') prerequisites.push(relation);
      else if (r.relation_type === 'extension') extensions.push(relation);
      else related.push(relation);
    });

    (incomingRelations || []).forEach(r => {
      const sourceGraph = graphMap.get(r.source_graph_id);
      const relation: GraphRelation = {
        id: r.id,
        sourceGraphId: r.source_graph_id,
        targetGraphId: r.target_graph_id,
        relationType: r.relation_type,
        context: r.context,
        metadata: r.metadata || {},
        createdAt: r.created_at,
        targetGraph: sourceGraph ? {
          id: sourceGraph.id,
          title: sourceGraph.title,
          description: sourceGraph.description,
          nodeCount: nodeCountMap.get(sourceGraph.id) || 0
        } : undefined
      };

      if (r.relation_type === 'extension') {
        prerequisites.push({
          ...relation,
          relationType: 'prerequisite',
          context: relation.context || `${sourceGraph?.title || '其他图谱'} 是当前图谱的前置知识`
        });
      }
    });

    res.json({ prerequisites, extensions, related });

  } catch (error: any) {
    logger.error('Get Graph Relations Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '获取关联图谱失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/:graphId/prerequisite-graph', requireAuth, validate(createPrerequisiteSchema), async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const { topic, description, auto_generate } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, title, user_id')
      .eq('id', graphId)
      .single();

    if (!sourceGraph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const { data: existingGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('user_id', req.user.id)
      .ilike('title', topic)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    let targetGraphId: string;
    let targetGraph: any;
    let isNew = false;

    if (existingGraph) {
      targetGraphId = existingGraph.id;
      targetGraph = existingGraph;
    } else {
      const { data: newGraph, error: createError } = await supabase
        .from('knowledge_graphs')
        .insert({
          user_id: req.user.id,
          title: topic,
          description: description || `${sourceGraph.title} 的前置知识`,
          parent_graph_id: graphId
        })
        .select()
        .single();

      if (createError || !newGraph) {
        throw new AppError('创建图谱失败', 500, ErrorCodes.INTERNAL_ERROR);
      }

      targetGraphId = newGraph.id;
      targetGraph = newGraph;
      isNew = true;

      if (auto_generate) {
        await taskService.createTask(
          req.user.id,
          'recursive_graph_generation',
          {
            graph_id: targetGraphId,
            topic,
            depth: 2,
            style: 'academic'
          },
          `生成知识图谱：${topic}`
        );
      }
    }

    const { data: existingRelation } = await supabase
      .from('graph_relations')
      .select('id')
      .eq('source_graph_id', graphId)
      .eq('target_graph_id', targetGraphId)
      .eq('relation_type', 'prerequisite')
      .maybeSingle();

    let relation;
    if (!existingRelation) {
      const { data: newRelation } = await supabase
        .from('graph_relations')
        .insert({
          source_graph_id: graphId,
          target_graph_id: targetGraphId,
          relation_type: 'prerequisite',
          context: `学习「${sourceGraph.title}」前建议先掌握「${topic}」`
        })
        .select()
        .single();

      relation = newRelation;
    } else {
      relation = existingRelation;
    }

    res.json({
      graphId: targetGraphId,
      graph: targetGraph,
      relation,
      isNew
    });

  } catch (error: any) {
    logger.error('Create Prerequisite Graph Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '创建前置图谱失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/:graphId/prerequisite-graphs/batch', requireAuth, validate(batchCreateSchema), async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const { topics, depth, style } = req.body;
  const supabase = req.supabase!;

  logger.info('Batch create prerequisite graphs:', { graphId, topics, depth, style, userId: req.user.id });

  try {
    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('id', graphId)
      .single();

    if (!sourceGraph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const results: Array<{
      topic: string;
      graphId: string;
      graph: any;
      isNew: boolean;
      taskId?: string;
    }> = [];

    for (const item of topics) {
      logger.info('Processing topic:', item.topic);

      const { data: existingGraph, error: existingError } = await supabase
        .from('knowledge_graphs')
        .select('id, title')
        .eq('user_id', req.user.id)
        .ilike('title', item.topic)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      logger.info('Existing graph check:', { topic: item.topic, existingGraph, existingError });

      if (existingGraph) {
        const { data: existingRelation } = await supabase
          .from('graph_relations')
          .select('id')
          .eq('source_graph_id', graphId)
          .eq('target_graph_id', existingGraph.id)
          .eq('relation_type', 'prerequisite')
          .maybeSingle();

        if (!existingRelation) {
          await supabase
            .from('graph_relations')
            .insert({
              source_graph_id: graphId,
              target_graph_id: existingGraph.id,
              relation_type: 'prerequisite',
              context: `学习「${sourceGraph.title}」前建议先掌握「${item.topic}」`
            });
        }

        results.push({
          topic: item.topic,
          graphId: existingGraph.id,
          graph: existingGraph,
          isNew: false
        });
      } else {
        logger.info('Creating new graph for topic:', item.topic);
        
        const { data: newGraph, error: createError } = await supabase
          .from('knowledge_graphs')
          .insert({
            user_id: req.user.id,
            title: item.topic,
            description: item.description || `${sourceGraph.title} 的前置知识`,
            parent_graph_id: graphId
          })
          .select()
          .single();

        logger.info('New graph created:', { newGraph, createError });

        if (newGraph) {
          await supabase
            .from('graph_relations')
            .insert({
              source_graph_id: graphId,
              target_graph_id: newGraph.id,
              relation_type: 'prerequisite',
              context: `学习「${sourceGraph.title}」前建议先掌握「${item.topic}」`
            });

          const task = await taskService.createTask(
            req.user.id,
            'recursive_graph_generation',
            {
              graph_id: newGraph.id,
              topic: item.topic,
              depth: depth || 2,
              style: style || 'academic'
            },
            `生成知识图谱：${item.topic}`
          );

          results.push({
            topic: item.topic,
            graphId: newGraph.id,
            graph: newGraph,
            isNew: true,
            taskId: task.id
          });
        }
      }
    }

    logger.info('Batch create results:', { count: results.length, results: results.map(r => ({ topic: r.topic, graphId: r.graphId, isNew: r.isNew, taskId: r.taskId })) });

    res.json({ created: results });

  } catch (error: any) {
    logger.error('Batch Create Prerequisite Graphs Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '批量创建前置图谱失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.delete('/:graphId/relations/:relationId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId, relationId } = req.params;
  const supabase = req.supabase!;

  try {
    const { error } = await supabase
      .from('graph_relations')
      .delete()
      .eq('id', relationId)
      .eq('source_graph_id', graphId);

    if (error) {
      throw new AppError('删除关联失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({ success: true });

  } catch (error: any) {
    logger.error('Delete Graph Relation Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '删除关联失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
