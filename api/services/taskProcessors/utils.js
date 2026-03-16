import { promptService } from '../ai/promptService.js';
import { createKnowledgePointWithGraphNode } from '../../utils/nodeHelpers.js';
import { logger } from '../../utils/logger.js';
import { getNextLevel } from '../../utils/levelUtils.js';
export async function getAutoGraphPrompt(supabase, userId, graphId, type, data) {
    const templateCode = type === 'init' ? 'auto_graph_init' : 'auto_graph_expand';
    return promptService.getRenderedPrompt(supabase, templateCode, data, userId, graphId);
}
export async function generateNodesForGraph(supabase, graphId, topic, description, depth, provider, userId) {
    try {
        let totalNodes = 0;
        const systemPrompt = await promptService.getRenderedPrompt(supabase, 'auto_graph_init', {
            topic,
            isCustom: false,
            isAcademic: true,
            isPractical: false,
            isBeginner: false,
            hasSources: false,
            sources: ''
        }, userId);
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `请为「${topic}」生成知识点。${description ? `\n\n领域描述：${description}` : ''}` }
            ],
            model: provider.model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });
        const parsed = JSON.parse(completion.choices[0].message.content || '{"root":null,"coreNodes":[]}');
        if (parsed.root) {
            const rootNodeResult = await createKnowledgePointWithGraphNode(supabase, userId || '', {
                graph_id: graphId,
                title: parsed.root.title || topic,
                content: parsed.root.content || '',
                level: 'root',
                x_position: 400,
                y_position: 300
            });
            if (rootNodeResult) {
                totalNodes++;
                const coreNodes = parsed.coreNodes || [];
                const coreNodeIds = [];
                for (let i = 0; i < coreNodes.length; i++) {
                    const coreNode = coreNodes[i];
                    const angle = (2 * Math.PI * i) / coreNodes.length;
                    const radius = 200;
                    const childNodeResult = await createKnowledgePointWithGraphNode(supabase, userId || '', {
                        graph_id: graphId,
                        title: coreNode.title,
                        content: coreNode.content || '',
                        level: 'core',
                        x_position: 400 + radius * Math.cos(angle),
                        y_position: 300 + radius * Math.sin(angle)
                    });
                    if (childNodeResult) {
                        totalNodes++;
                        coreNodeIds.push(childNodeResult.id);
                        await supabase
                            .from('edges')
                            .insert({
                            graph_id: graphId,
                            source_knowledge_point_id: rootNodeResult.id,
                            target_knowledge_point_id: childNodeResult.id,
                            relationship_type: 'contains'
                        });
                    }
                }
                if (depth > 1 && coreNodeIds.length > 0) {
                    for (let i = 0; i < coreNodes.length; i++) {
                        const coreNode = coreNodes[i];
                        const coreNodeId = coreNodeIds[i];
                        if (coreNodeId) {
                            const expandCount = await expandNodeForGraph(supabase, graphId, coreNodeId, coreNode.title, coreNode.content, 'core', depth - 1, provider, userId);
                            totalNodes += expandCount;
                        }
                    }
                }
            }
        }
        return totalNodes;
    }
    catch (error) {
        logger.warn(`Failed to generate nodes for ${topic}:`, error);
        return 0;
    }
}
export async function expandNodeForGraph(supabase, graphId, parentNodeId, parentNodeTitle, parentNodeContent, parentLevel, remainingDepth, provider, userId) {
    try {
        let totalNodes = 0;
        const systemPrompt = await promptService.getRenderedPrompt(supabase, 'auto_graph_expand', {
            nodeTitle: parentNodeTitle,
            nodeContent: parentNodeContent || '',
            nodeLevel: parentLevel,
            isCustom: false,
            isAcademic: true,
            isPractical: false,
            isBeginner: false,
            existingChildren: []
        }, userId);
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `请为「${parentNodeTitle}」生成子知识点。` }
            ],
            model: provider.model,
            response_format: { type: "json_object" },
            max_tokens: 3000,
        });
        const parsed = JSON.parse(completion.choices[0].message.content || '{"children":[]}');
        const children = parsed.children || [];
        if (children.length > 0) {
            const childNodeIds = [];
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const angle = (2 * Math.PI * i) / children.length;
                const radius = 150;
                const childNodeResult = await createKnowledgePointWithGraphNode(supabase, userId || '', {
                    graph_id: graphId,
                    title: child.title,
                    content: child.content || '',
                    level: getNextLevel(parentLevel),
                    x_position: 400 + radius * Math.cos(angle),
                    y_position: 300 + radius * Math.sin(angle)
                });
                if (childNodeResult) {
                    totalNodes++;
                    childNodeIds.push(childNodeResult.id);
                    await supabase
                        .from('edges')
                        .insert({
                        graph_id: graphId,
                        source_knowledge_point_id: parentNodeId,
                        target_knowledge_point_id: childNodeResult.id,
                        relationship_type: 'contains'
                    });
                }
            }
            if (remainingDepth > 1) {
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    const childNodeId = childNodeIds[i];
                    if (childNodeId) {
                        const expandCount = await expandNodeForGraph(supabase, graphId, childNodeId, child.title, child.content, getNextLevel(parentLevel), remainingDepth - 1, provider, userId);
                        totalNodes += expandCount;
                    }
                }
            }
        }
        return totalNodes;
    }
    catch (error) {
        logger.warn(`Failed to expand node ${parentNodeTitle}:`, error);
        return 0;
    }
}
//# sourceMappingURL=utils.js.map