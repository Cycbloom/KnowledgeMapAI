import { SupabaseClient } from '@supabase/supabase-js';
import { graphRelationService } from './graphRelationService';
import { asyncTaskService } from '../asyncTaskService';
import { checkDuplicateGraphTopic } from '../../utils/similaritySearch';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { notDeleted } from '../common/softDeleteHelper';
import i18next from 'i18next';

interface FormattedRelation {
  id: string;
  sourceGraphId: string;
  targetGraphId: string;
  relationType: string;
  context?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  targetGraph?: {
    id: string;
    title: string;
    description?: string | null;
    nodeCount: number;
  };
}

interface RelationsWithDetailsResult {
  prerequisites: FormattedRelation[];
  extensions: FormattedRelation[];
  related: FormattedRelation[];
}

interface CreatePrerequisiteGraphData {
  topic: string;
  description?: string;
  auto_generate?: boolean;
}

interface CreatePrerequisiteGraphResult {
  graphId: string;
  graph: { id: string; title: string; description?: string | null };
  relation: unknown;
  isNew: boolean;
}

interface BatchCreatePrerequisiteGraphsData {
  topics: Array<{
    topic: string;
    description?: string;
    mastery_level: string;
  }>;
  depth?: number;
  style?: string;
}

interface BatchCreateResultItem {
  topic: string;
  graphId: string;
  graph: { id: string; title: string };
  isNew: boolean;
  taskId?: string;
  similarity?: number;
  matchedTitle?: string;
}

interface CreateRelationWithChecksData {
  source_graph_id: string;
  target_graph_id: string;
  relation_type: string;
  context?: string;
}

interface InfiniteExpansionOptions {
  max_depth?: number;
  max_graphs_per_level?: number;
  relation_types?: string[];
  auto_generate_nodes?: boolean;
  node_depth?: number;
}

export class GraphRelationsRouteService {
  async getRelationsWithDetails(
    supabase: SupabaseClient,
    _userId: string,
    graphId: string,
  ): Promise<RelationsWithDetailsResult> {
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id')
      .eq('id', graphId)
      .single();

    if (!graph) {
      throw new AppError(i18next.t('graphMap.relations.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const relations = await graphRelationService.getRelations(supabase, graphId);

    const allGraphIds = [
      ...relations.outgoing.map((r) => r.target_graph_id),
      ...relations.incoming.map((r) => r.source_graph_id),
    ].filter(Boolean);

    const { data: relatedGraphs } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .in('id', allGraphIds);

    const { data: nodeCounts } = await notDeleted(supabase
      .from('graph_nodes')
      .select('graph_id')
      .in('graph_id', allGraphIds)
      );

    const nodeCountMap = new Map<string, number>();
    (nodeCounts || []).forEach((n: { graph_id: string }) => {
      nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
    });

    const graphMap = new Map(relatedGraphs?.map((g) => [g.id, g]) || []);

    const prerequisites: FormattedRelation[] = [];
    const extensions: FormattedRelation[] = [];
    const related: FormattedRelation[] = [];

    relations.outgoing.forEach((r) => {
      const targetGraph = graphMap.get(r.target_graph_id);
      const relation: FormattedRelation = {
        id: r.id,
        sourceGraphId: r.source_graph_id,
        targetGraphId: r.target_graph_id,
        relationType: r.relation_type,
        context: r.context,
        metadata: r.metadata || {},
        createdAt: r.created_at,
        targetGraph: targetGraph
          ? {
              id: targetGraph.id,
              title: targetGraph.title,
              description: targetGraph.description,
              nodeCount: nodeCountMap.get(targetGraph.id) || 0,
            }
          : undefined,
      };

      if (r.relation_type === 'prerequisite') prerequisites.push(relation);
      else if (r.relation_type === 'extension') extensions.push(relation);
      else related.push(relation);
    });

    relations.incoming.forEach((r) => {
      const sourceGraph = graphMap.get(r.source_graph_id);
      const relation: FormattedRelation = {
        id: r.id,
        sourceGraphId: r.source_graph_id,
        targetGraphId: r.target_graph_id,
        relationType: r.relation_type,
        context: r.context,
        metadata: r.metadata || {},
        createdAt: r.created_at,
        targetGraph: sourceGraph
          ? {
              id: sourceGraph.id,
              title: sourceGraph.title,
              description: sourceGraph.description,
              nodeCount: nodeCountMap.get(sourceGraph.id) || 0,
            }
          : undefined,
      };

      if (r.relation_type === 'extension') {
        prerequisites.push({
          ...relation,
          relationType: 'prerequisite',
          context:
            relation.context ||
            `${sourceGraph?.title || '其他图谱'} 是当前图谱的前置知识`,
        });
      }
    });

    return { prerequisites, extensions, related };
  }

  async createPrerequisiteGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    data: CreatePrerequisiteGraphData,
  ): Promise<CreatePrerequisiteGraphResult> {
    const { topic, description, auto_generate } = data;

    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, title, user_id')
      .eq('id', graphId)
      .single();

    if (!sourceGraph) {
      throw new AppError(i18next.t('graphMap.relations.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const duplicateCheck = await checkDuplicateGraphTopic(
      supabase,
      userId,
      topic,
      { threshold: 0.85 },
    );

    let targetGraphId: string;
    let targetGraph: { id: string; title: string; description?: string | null } | undefined;
    let isNew = false;

    if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
      targetGraphId = duplicateCheck.similarGraphs[0].id;
      targetGraph = duplicateCheck.similarGraphs[0];
      logger.info(
        `Reusing existing graph "${targetGraph.title}" (similarity: ${(duplicateCheck.similarGraphs[0].similarity * 100).toFixed(1)}%) for topic "${topic}"`,
      );
    } else {
      const { data: newGraph, error: createError } = await supabase
        .from('knowledge_graphs')
        .insert({
          user_id: userId,
          title: topic,
          description: description || '',
          parent_graph_id: graphId,
          embedding: duplicateCheck.embedding,
        })
        .select()
        .single();

      if (createError || !newGraph) {
        throw new AppError(i18next.t('graphMap.relations.errors.createGraphFailed'), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      targetGraphId = newGraph.id;
      targetGraph = newGraph;
      isNew = true;

      if (auto_generate) {
        await asyncTaskService.createTask(
          userId,
          'recursive_graph_generation',
          {
            graph_id: targetGraphId,
            topic,
            depth: 2,
            style: 'academic',
          },
          `生成知识图谱：${topic}`,
        );
      }
    }

    const exists = await graphRelationService.checkRelationExists(
      supabase,
      graphId,
      targetGraphId,
      'prerequisite',
    );

    let relation;
    if (!exists) {
      relation = await graphRelationService.createRelation(supabase, {
        source_graph_id: graphId,
        target_graph_id: targetGraphId,
        relation_type: 'prerequisite',
        context: `学习「${sourceGraph.title}」前建议先掌握「${topic}」`,
      });
    }

    return {
      graphId: targetGraphId,
      graph: targetGraph ?? { id: targetGraphId, title: topic, description: '' },
      relation,
      isNew,
    };
  }

  async batchCreatePrerequisiteGraphs(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    data: BatchCreatePrerequisiteGraphsData,
  ): Promise<{ created: BatchCreateResultItem[] }> {
    const { topics, depth, style } = data;

    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('id', graphId)
      .single();

    if (!sourceGraph) {
      throw new AppError(i18next.t('graphMap.relations.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const results: BatchCreateResultItem[] = [];

    for (const item of topics) {
      const duplicateCheck = await checkDuplicateGraphTopic(
        supabase,
        userId,
        item.topic,
        { threshold: 0.85 },
      );

      if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
        const existingGraph = duplicateCheck.similarGraphs[0];
        const similarity = existingGraph.similarity;

        logger.info(
          `Reusing existing graph "${existingGraph.title}" (similarity: ${(similarity * 100).toFixed(1)}%) for prerequisite topic "${item.topic}"`,
        );

        const exists = await graphRelationService.checkRelationExists(
          supabase,
          graphId,
          existingGraph.id,
          'prerequisite',
        );
        if (!exists) {
          await graphRelationService.createRelation(supabase, {
            source_graph_id: graphId,
            target_graph_id: existingGraph.id,
            relation_type: 'prerequisite',
            context: `学习「${sourceGraph.title}」前建议先掌握「${existingGraph.title}」`,
          });
        }

        results.push({
          topic: item.topic,
          graphId: existingGraph.id,
          graph: {
            id: existingGraph.id,
            title: existingGraph.title,
          },
          isNew: false,
          similarity,
          matchedTitle: existingGraph.title,
        });
      } else {
        const { data: newGraph } = await supabase
          .from('knowledge_graphs')
          .insert({
            user_id: userId,
            title: item.topic,
            description: item.description || '',
            parent_graph_id: graphId,
            embedding: duplicateCheck.embedding,
          })
          .select()
          .single();

        if (newGraph) {
          await graphRelationService.createRelation(supabase, {
            source_graph_id: graphId,
            target_graph_id: newGraph.id,
            relation_type: 'prerequisite',
            context: `学习「${sourceGraph.title}」前建议先掌握「${item.topic}」`,
          });

          const task = await asyncTaskService.createTask(
            userId,
            'recursive_graph_generation',
            {
              graph_id: newGraph.id,
              topic: item.topic,
              depth: depth || 2,
              style: style || 'academic',
            },
            `生成知识图谱：${item.topic}`,
          );

          results.push({
            topic: item.topic,
            graphId: newGraph.id,
            graph: newGraph,
            isNew: true,
            taskId: task.id,
          });
        }
      }
    }

    return { created: results };
  }

  async createRelationWithChecks(
    supabase: SupabaseClient,
    userId: string,
    data: CreateRelationWithChecksData,
  ): Promise<unknown> {
    const { source_graph_id, target_graph_id, relation_type, context } = data;

    if (source_graph_id === target_graph_id) {
      throw new AppError(i18next.t('graphMap.relations.errors.selfReferenceNotAllowed'), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, title')
      .eq('id', source_graph_id)
      .single();

    const { data: targetGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, title')
      .eq('id', target_graph_id)
      .single();

    if (!sourceGraph || !targetGraph) {
      throw new AppError(i18next.t('graphMap.relations.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (sourceGraph.user_id !== userId) {
      throw new AppError(i18next.t('graphMap.relations.errors.noPermission'), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const exists = await graphRelationService.checkRelationExists(
      supabase,
      source_graph_id,
      target_graph_id,
      relation_type as 'prerequisite' | 'extension' | 'related' | 'cross_domain',
    );
    if (exists) {
      throw new AppError(i18next.t('graphMap.relations.errors.relationExists'), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const newRelation = await graphRelationService.createRelation(supabase, {
      source_graph_id,
      target_graph_id,
      relation_type: relation_type as 'prerequisite' | 'extension' | 'related' | 'cross_domain',
      context: context || `${sourceGraph.title} → ${targetGraph.title}`,
    });

    return newRelation;
  }

  async deleteRelationWithCheck(
    supabase: SupabaseClient,
    userId: string,
    relationId: string,
  ): Promise<void> {
    const { data: relation } = await supabase
      .from('graph_relations')
      .select('id, source_graph_id')
      .eq('id', relationId)
      .single();

    if (!relation) {
      throw new AppError(i18next.t('graphMap.relations.errors.relationNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('user_id')
      .eq('id', relation.source_graph_id)
      .single();

    if (!sourceGraph || sourceGraph.user_id !== userId) {
      throw new AppError(i18next.t('graphMap.relations.errors.noPermissionToDelete'), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    await graphRelationService.deleteRelation(supabase, relationId);
  }

  async startInfiniteExpansion(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    options: InfiniteExpansionOptions = {},
  ): Promise<{ taskId: string; status: string; message: string }> {
    // 宽度拓展依赖图谱语义查重（checkDuplicateGraphTopic），
    // 若有缺口则自动补全缺失的 embedding，避免出现同名/近似重复图谱
    await asyncTaskService.ensureEmbeddingBackfill(userId);

    const {
      max_depth = 2,
      max_graphs_per_level = 3,
      relation_types = ['prerequisite', 'extension', 'related'],
      auto_generate_nodes = true,
      node_depth = 2,
    } = options;

    const { data: sourceGraph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, title, description')
      .eq('id', graphId)
      .single();

    if (!sourceGraph) {
      throw new AppError(i18next.t('graphMap.relations.errors.graphNotFound'), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (sourceGraph.user_id !== userId) {
      throw new AppError(i18next.t('graphMap.relations.errors.noPermission'), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const task = await asyncTaskService.createTask(
      userId,
      'infinite_graph_expansion',
      {
        source_graph_id: graphId,
        source_graph_title: sourceGraph.title,
        source_graph_description: sourceGraph.description,
        max_depth,
        max_graphs_per_level,
        relation_types,
        auto_generate_nodes,
        node_depth,
      },
    );

    return {
      taskId: task.id,
      status: 'pending',
      message: i18next.t('graphMap.relations.messages.infiniteExpansionCreated'),
    };
  }
}

export const graphRelationsRouteService = new GraphRelationsRouteService();
