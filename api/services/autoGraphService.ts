import { SupabaseClient } from '@supabase/supabase-js';
import { knowledgePointService } from './knowledgePointService.js';
import { graphNodeService } from './graphNodeService.js';
import { edgeService } from './edgeService.js';
import { logger } from '../utils/logger.js';
import { checkAndReuseKnowledgePoint } from '../utils/similaritySearch.js';

const REUSE_SIMILARITY_THRESHOLD = 0.85;

export interface AINodeData {
  tempId: string;
  parentId: string | null;
  title: string;
  content: string;
  level: string;
  x_position: number;
  y_position: number;
}

export interface CreateGraphNodeResult {
  graphNodeId: string;
  knowledgePointId: string;
  reused: boolean;
}

export interface CreateEdgeData {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
}

export interface ProcessAINodesOptions {
  auto_reuse?: boolean;
  reuse_threshold?: number;
}

export interface ProcessAINodesResult {
  nodeCount: number;
  edgeCount: number;
  reusedCount: number;
  graphNodeIds: string[];
}

export class AutoGraphService {
  async createGraphNode(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    nodeData: {
      title: string;
      content?: string;
      level?: string;
      x_position?: number;
      y_position?: number;
    },
    options: {
      auto_reuse?: boolean;
      reuse_threshold?: number;
    } = {}
  ): Promise<CreateGraphNodeResult> {
    const { auto_reuse = true, reuse_threshold = REUSE_SIMILARITY_THRESHOLD } = options;
    let knowledgePointId: string | null = null;
    let reused = false;

    if (auto_reuse) {
      try {
        const reuseResult = await checkAndReuseKnowledgePoint(
          supabase,
          userId,
          nodeData.title,
          nodeData.content,
          reuse_threshold
        );

        if (reuseResult.shouldReuse && reuseResult.existingKpId) {
          knowledgePointId = reuseResult.existingKpId;
          reused = true;
          logger.info(`Auto-reusing knowledge point: ${knowledgePointId} for: ${nodeData.title}`);
        }
      } catch (error) {
        logger.warn('Failed to search for similar knowledge points during auto-graph:', error);
      }
    }

    if (!knowledgePointId) {
      const newKp = await knowledgePointService.create(supabase, {
        title: nodeData.title,
        content: nodeData.content || '',
        properties: {
          source: 'ai-generated',
          generated_at: new Date().toISOString()
        },
        visibility: 'private',
        owner_id: userId,
      });

      knowledgePointId = newKp.id;
    }

    const graphNode = await graphNodeService.addToGraph(supabase, {
      graph_id: graphId,
      knowledge_point_id: knowledgePointId,
      x_position: nodeData.x_position ?? Math.round((Math.random() - 0.5) * 20),
      y_position: nodeData.y_position ?? Math.round((Math.random() - 0.5) * 20),
      level: nodeData.level as any || 'normal',
      is_accepted: true,
    });

    return {
      graphNodeId: graphNode.id,
      knowledgePointId: knowledgePointId,
      reused,
    };
  }

  async createEdge(
    supabase: SupabaseClient,
    data: CreateEdgeData
  ): Promise<void> {
    await edgeService.create(supabase, {
      graph_id: data.graph_id,
      source_knowledge_point_id: data.source_knowledge_point_id,
      target_knowledge_point_id: data.target_knowledge_point_id,
      relationship_type: data.relationship_type || 'contains',
    });
  }

  async processAINodes(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    nodes: AINodeData[],
    options: ProcessAINodesOptions = {}
  ): Promise<ProcessAINodesResult> {
    const { auto_reuse = true, reuse_threshold = REUSE_SIMILARITY_THRESHOLD } = options;

    const validNodes = nodes.filter(node => node.title && node.title.trim() !== '');

    if (validNodes.length === 0) {
      return { nodeCount: 0, edgeCount: 0, reusedCount: 0, graphNodeIds: [] };
    }

    const nodeMap = new Map<string, { graphNodeId: string; knowledgePointId: string; reused: boolean }>();
    const graphNodeIds: string[] = [];
    let reusedCount = 0;

    for (const nodeData of validNodes) {
      try {
        const result = await this.createGraphNode(
          supabase,
          userId,
          graphId,
          {
            title: nodeData.title,
            content: nodeData.content,
            level: nodeData.level,
            x_position: nodeData.x_position,
            y_position: nodeData.y_position,
          },
          { auto_reuse, reuse_threshold }
        );

        nodeMap.set(nodeData.tempId, result);
        graphNodeIds.push(result.graphNodeId);

        if (result.reused) {
          reusedCount++;
        }
      } catch (error) {
        logger.error(`Failed to create graph node for: ${nodeData.title}`, error);
      }
    }

    const edgesToCreate: CreateEdgeData[] = [];

    for (const nodeData of validNodes) {
      if (nodeData.parentId) {
        const parentInfo = nodeMap.get(nodeData.parentId);
        const childInfo = nodeMap.get(nodeData.tempId);

        if (parentInfo && childInfo) {
          edgesToCreate.push({
            graph_id: graphId,
            source_knowledge_point_id: parentInfo.knowledgePointId,
            target_knowledge_point_id: childInfo.knowledgePointId,
            relationship_type: 'contains',
          });
        }
      }
    }

    logger.info(`Total edges to insert: ${edgesToCreate.length}`);

    for (const edgeData of edgesToCreate) {
      try {
        await this.createEdge(supabase, edgeData);
      } catch (error) {
        logger.error('Edge insertion error:', error);
      }
    }

    return {
      nodeCount: graphNodeIds.length,
      edgeCount: edgesToCreate.length,
      reusedCount,
      graphNodeIds,
    };
  }
}

export const autoGraphService = new AutoGraphService();
