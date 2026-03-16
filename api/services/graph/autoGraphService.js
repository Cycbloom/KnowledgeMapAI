import { graphNodeService } from './graphNodeService.js';
import { edgeService } from './edgeService.js';
import { taskService } from '../taskService.js';
import { logger } from '../../utils/logger.js';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;
const BATCH_SIZE = 50;
export class AutoGraphService {
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async retry(fn, retries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
        let lastError = null;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (i < retries - 1) {
                    logger.warn(`Retry ${i + 1}/${retries} after error: ${lastError.message}`);
                    await this.sleep(delayMs * (i + 1));
                }
            }
        }
        throw lastError;
    }
    async processAINodes(supabase, userId, graphId, nodes) {
        const validNodes = nodes.filter(node => node.title && node.title.trim() !== '');
        if (validNodes.length === 0) {
            return { nodeCount: 0, edgeCount: 0, graphNodeIds: [], nodeMapping: {} };
        }
        logger.info(`Processing ${validNodes.length} nodes for graph ${graphId}`);
        const nodeMap = new Map();
        const graphNodeIds = [];
        const failedNodes = [];
        logger.info('Creating knowledge points in batches (without embedding)...');
        const knowledgePoints = await this.createKnowledgePointsBatch(supabase, userId, validNodes);
        logger.info('Creating graph nodes...');
        for (let i = 0; i < validNodes.length; i++) {
            const nodeData = validNodes[i];
            const kp = knowledgePoints[i];
            if (!kp) {
                failedNodes.push(nodeData.title);
                continue;
            }
            try {
                const graphNode = await this.retry(() => graphNodeService.addToGraph(supabase, {
                    graph_id: graphId,
                    knowledge_point_id: kp.id,
                    x_position: nodeData.x_position,
                    y_position: nodeData.y_position,
                    level: nodeData.level || 'normal',
                    is_accepted: true,
                }));
                nodeMap.set(nodeData.tempId, {
                    graphNodeId: graphNode.id,
                    knowledgePointId: kp.id,
                });
                graphNodeIds.push(graphNode.id);
            }
            catch (error) {
                logger.error(`Failed to create graph node for: ${nodeData.title}`, error);
                failedNodes.push(nodeData.title);
            }
        }
        if (failedNodes.length > 0) {
            logger.warn(`Failed to create ${failedNodes.length} nodes: ${failedNodes.slice(0, 5).join(', ')}${failedNodes.length > 5 ? '...' : ''}`);
        }
        const edgesToCreate = [];
        for (const nodeData of validNodes) {
            if (nodeData.parentId) {
                let parentInfo = nodeMap.get(nodeData.parentId);
                const childInfo = nodeMap.get(nodeData.tempId);
                // If parentId is not in nodeMap, it might be an existing graph node UUID
                // Query the database to get its knowledge_point_id
                if (!parentInfo && childInfo) {
                    try {
                        const { data: existingNode, error } = await supabase
                            .from('graph_nodes')
                            .select('knowledge_point_id')
                            .eq('id', nodeData.parentId)
                            .eq('graph_id', graphId)
                            .single();
                        if (!error && existingNode) {
                            parentInfo = {
                                graphNodeId: nodeData.parentId,
                                knowledgePointId: existingNode.knowledge_point_id,
                            };
                        }
                    }
                    catch (e) {
                        logger.warn(`Could not find parent node ${nodeData.parentId} in database`);
                    }
                }
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
        logger.info(`Inserting ${edgesToCreate.length} edges in batch...`);
        const edgeCount = await this.createEdgesBatch(supabase, edgesToCreate);
        logger.info(`Completed: ${graphNodeIds.length} nodes, ${edgeCount} edges`);
        const validKnowledgePointIds = knowledgePoints
            .filter((kp) => kp !== null)
            .map(kp => kp.id);
        if (validKnowledgePointIds.length > 0) {
            try {
                await taskService.createTask(userId, 'embedding_generation', { knowledgePointIds: validKnowledgePointIds }, `嵌入生成 - ${validKnowledgePointIds.length}个知识点`);
                logger.info(`Created embedding generation task for ${validKnowledgePointIds.length} knowledge points`);
            }
            catch (error) {
                logger.error('Failed to create embedding generation task:', error);
            }
        }
        const nodeMappingRecord = {};
        for (const [tempId, info] of nodeMap) {
            nodeMappingRecord[tempId] = info;
        }
        return {
            nodeCount: graphNodeIds.length,
            edgeCount,
            graphNodeIds,
            nodeMapping: nodeMappingRecord,
        };
    }
    async createKnowledgePointsBatch(supabase, userId, nodes) {
        const results = new Array(nodes.length).fill(null);
        for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
            const batchNodes = nodes.slice(i, i + BATCH_SIZE);
            const records = batchNodes.map((node) => ({
                title: node.title,
                content: node.content || '',
                properties: {
                    source: 'ai-generated',
                    generated_at: new Date().toISOString()
                },
                embedding: null,
                visibility: 'private',
                owner_id: userId,
            }));
            try {
                const { data, error } = await supabase
                    .from('knowledge_points')
                    .insert(records)
                    .select('id');
                if (error) {
                    logger.error('Batch knowledge point insertion error:', error);
                    for (let j = 0; j < batchNodes.length; j++) {
                        try {
                            const { data: singleData, error: singleError } = await supabase
                                .from('knowledge_points')
                                .insert([{
                                    title: batchNodes[j].title,
                                    content: batchNodes[j].content || '',
                                    properties: { source: 'ai-generated' },
                                    embedding: null,
                                    visibility: 'private',
                                    owner_id: userId,
                                }])
                                .select('id')
                                .single();
                            if (singleError) {
                                logger.error(`Individual KP creation failed for: ${batchNodes[j].title}`, singleError);
                                results[i + j] = null;
                            }
                            else {
                                results[i + j] = singleData;
                            }
                        }
                        catch (e) {
                            logger.error(`Individual KP creation exception for: ${batchNodes[j].title}`, e);
                            results[i + j] = null;
                        }
                    }
                }
                else {
                    for (let j = 0; j < (data?.length || 0); j++) {
                        results[i + j] = data[j];
                    }
                }
            }
            catch (error) {
                logger.error('Knowledge point batch creation failed:', error);
            }
        }
        return results;
    }
    async createEdgesBatch(supabase, edges) {
        if (edges.length === 0)
            return 0;
        const edgeRecords = edges.map(e => ({
            graph_id: e.graph_id,
            source_knowledge_point_id: e.source_knowledge_point_id,
            target_knowledge_point_id: e.target_knowledge_point_id,
            relationship_type: e.relationship_type || 'contains',
        }));
        try {
            const { error } = await supabase
                .from('edges')
                .insert(edgeRecords);
            if (error) {
                logger.error('Batch edge insertion error:', error);
                let successCount = 0;
                for (const edge of edges) {
                    try {
                        await this.retry(() => edgeService.create(supabase, {
                            graph_id: edge.graph_id,
                            source_knowledge_point_id: edge.source_knowledge_point_id,
                            target_knowledge_point_id: edge.target_knowledge_point_id,
                            relationship_type: edge.relationship_type || 'contains',
                        }));
                        successCount++;
                    }
                    catch (e) {
                        logger.error('Individual edge insertion error:', e);
                    }
                }
                return successCount;
            }
            return edges.length;
        }
        catch (error) {
            logger.error('Batch edge insertion failed:', error);
            return 0;
        }
    }
}
export const autoGraphService = new AutoGraphService();
//# sourceMappingURL=autoGraphService.js.map