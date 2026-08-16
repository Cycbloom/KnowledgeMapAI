import { SupabaseClient } from '@supabase/supabase-js';
import { asyncTaskService } from '../asyncTaskService';
import { graphVersionService } from './graphVersionService';
import { backboneValidatorService } from '../ai/backboneValidatorService';
import { BackboneModule, TITLE_TO_BACKBONE_MODULE } from '../../../shared/types/graph';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';
import i18next from 'i18next';

class GraphExpansionService {
  async batchInitialize(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
    style: string = 'academic',
    sessionId?: string,
  ) {
    const { data: graphs, error: graphsError } = await notDeleted(supabase
      .from('knowledge_graphs')
      .select('id, title')
      .in('id', graphIds)
      .eq('user_id', userId)
      );

    if (graphsError || !graphs || graphs.length === 0) {
      throw new AppError(i18next.t('graphMap.expansion.errors.noValidGraph'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const results: Array<{
      graphId: string;
      title: string;
      taskId?: string;
      status: 'pending' | 'skipped';
      reason?: string;
    }> = [];

    const batchSessionId = sessionId || crypto.randomUUID();

    for (const graph of graphs) {
      const { data: existingNodes } = await supabase
        .from('knowledge_points')
        .select('id')
        .eq('graph_id', graph.id)
        .limit(1);

      if (existingNodes && existingNodes.length > 0) {
        results.push({
          graphId: graph.id,
          title: graph.title,
          status: 'skipped',
          reason: i18next.t('graphMap.expansion.reasons.graphHasNodes'),
        });
        continue;
      }

      const task = await asyncTaskService.createTask(
        userId,
        'recursive_graph_generation',
        {
          graph_id: graph.id,
          topic: graph.title,
          depth: 2,
          style,
          batchSessionId,
        },
        i18next.t('graphMap.expansion.messages.initGraphTaskTitle', { title: graph.title }),
      );

      results.push({
        graphId: graph.id,
        title: graph.title,
        taskId: task.id,
        status: 'pending',
      });
    }

    return {
      success: true,
      results,
      summary: (() => {
        // 单趟统计，替代两次 filter 扫描
        let pending = 0;
        let skipped = 0;
        for (const r of results) {
          if (r.status === 'pending') pending++;
          else if (r.status === 'skipped') skipped++;
        }
        return {
          total: graphIds.length,
          pending,
          skipped,
        };
      })(),
    };
  }

  async initializeGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    style: string = 'academic',
  ) {
    const { data: graph, error: graphError } = await notDeleted(supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .eq('id', graphId)
      .eq('user_id', userId)
      )
      .single();

    if (graphError || !graph) {
      throw new AppError(i18next.t('graphMap.expansion.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: existingNodes } = await supabase
      .from('knowledge_points')
      .select('id')
      .eq('graph_id', graphId)
      .limit(1);

    if (existingNodes && existingNodes.length > 0) {
      throw new AppError(
        i18next.t('graphMap.expansion.errors.graphAlreadyHasNodes'),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    await graphVersionService.autoSnapshot(
      supabase,
      graphId,
      'pre_ai_expand',
      userId,
    ).catch((err) => logger.error('Auto snapshot error:', err));

    const task = await asyncTaskService.createTask(
      userId,
      'recursive_graph_generation',
      {
        graph_id: graphId,
        topic: graph.title,
        depth: 2,
        style,
      },
      i18next.t('graphMap.expansion.messages.initGraphTaskTitle', { title: graph.title }),
    );

    return {
      success: true,
      taskId: task.id,
      graphId,
      message: i18next.t('graphMap.expansion.messages.initTaskCreated'),
    };
  }

  async validateBackbone(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    nodes: Array<{
      id: string;
      title: string;
      properties?: { backboneModule?: BackboneModule };
    }>,
    context?: string,
    useAI?: boolean,
  ) {
    const { data: graph } = await notDeleted(supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('id', graphId)
      .eq('user_id', userId)
      )
      .single();

    if (!graph) {
      throw new AppError(i18next.t('graphMap.expansion.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const validationContext = context || i18next.t('graphMap.expansion.messages.graphTopicContext', { title: graph.title });

    let result;
    if (useAI) {
      result = await backboneValidatorService.validateNodesWithAI(
        nodes,
        validationContext,
        {
          graphId,
          userId,
        },
      );
    } else {
      result = await backboneValidatorService.validateNodes(nodes, {
        graphId,
        userId,
      });
    }

    logger.info('Backbone validation completed', {
      graphId,
      userId,
      valid: result.valid,
      correctionCount: result.corrections.length,
      errorCount: result.errors.length,
    });

    return result;
  }

  async fixBackboneModules(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    const { data: graph, error: graphError } = await notDeleted(supabase
      .from('knowledge_graphs')
      .select('id, template_type')
      .eq('id', graphId)
      .eq('user_id', userId)
      )
      .single();

    if (graphError || !graph) {
      throw new AppError(i18next.t('graphMap.expansion.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (graph.template_type !== 'topic_research') {
      throw new AppError(
        i18next.t('graphMap.expansion.errors.topicResearchOnly'),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const { data: coreNodes, error: nodesError } = await notDeleted(supabase
      .from('graph_nodes')
      .select(
        `
          id,
          knowledge_points (
            id,
            title,
            properties
          )
        `,
      )
      .eq('graph_id', graphId)
      );

    if (nodesError) {
      logger.error('查询核心节点失败', {
        graphId,
        error: nodesError.message,
      });
      throw new AppError(i18next.t('graphMap.expansion.errors.queryNodesFailed'), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const details: Array<{
      nodeId: string;
      title: string;
      fixed: boolean;
      assignedModule?: BackboneModule;
    }> = [];
    let fixedCount = 0;

    for (const graphNode of coreNodes || []) {
      const kp = Array.isArray(graphNode.knowledge_points)
        ? graphNode.knowledge_points[0]
        : graphNode.knowledge_points;

      if (!kp) continue;

      const properties = (kp.properties || {}) as Record<string, unknown>;
      const currentModule = properties.backboneModule as
        | BackboneModule
        | undefined;

      if (currentModule) {
        details.push({
          nodeId: kp.id,
          title: kp.title,
          fixed: false,
        });
        continue;
      }

      const matchedModule = TITLE_TO_BACKBONE_MODULE[kp.title.trim()];

      if (!matchedModule) {
        details.push({
          nodeId: kp.id,
          title: kp.title,
          fixed: false,
        });
        continue;
      }

      const updatedProperties = {
        ...properties,
        backboneModule: matchedModule,
      };

      const { error: updateError } = await supabase
        .from('knowledge_points')
        .update({ properties: updatedProperties })
        .eq('id', kp.id);

      if (updateError) {
        logger.error('更新节点属性失败', {
          nodeId: kp.id,
          error: updateError.message,
        });
        details.push({
          nodeId: kp.id,
          title: kp.title,
          fixed: false,
        });
        continue;
      }

      fixedCount++;
      details.push({
        nodeId: kp.id,
        title: kp.title,
        fixed: true,
        assignedModule: matchedModule,
      });
    }

    logger.info('骨干模块修复完成', {
      graphId,
      userId,
      fixedCount,
      totalNodes: details.length,
    });

    return {
      success: true,
      fixedCount,
      totalNodes: details.length,
      details,
    };
  }
}

export const graphExpansionService = new GraphExpansionService();
