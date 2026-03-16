import { logger } from '../../utils/logger.js';
export const cleanJsonString = (str) => {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    }
    else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
};
export const parseAIResponse = (content, context) => {
    if (!content || content.trim() === '') {
        logger.error(`[AI] Empty response for ${context}`);
        throw new Error(`Empty AI response for ${context}`);
    }
    const cleaned = cleanJsonString(content);
    try {
        return JSON.parse(cleaned);
    }
    catch (e) {
        logger.warn(`[AI] JSON Parse Error (${context}). Attempting regex fallback.`);
        logger.debug(`[AI] Raw content length: ${content.length}, first 200 chars: ${content.substring(0, 200)}`);
        const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            }
            catch (e2) {
                logger.error(`[AI] Regex fallback also failed for ${context}`);
                logger.debug(`[AI] Matched content: ${match[0].substring(0, 500)}`);
                throw new Error(`Failed to parse AI response for ${context}`);
            }
        }
        logger.error(`[AI] No JSON found in response for ${context}`);
        throw new Error(`Failed to parse AI response for ${context}`);
    }
};
export const buildTutorContext = (context) => {
    let contextStr = '';
    if (context.currentNodeId && context.currentNodeTitle) {
        contextStr += `\nCurrent Node:\n- Title: ${context.currentNodeTitle}\n- Content: ${context.currentNodeContent || '(No content)'}\n`;
    }
    if (context.existingNodes && context.existingNodes.length > 0) {
        contextStr += `\nExisting Nodes in Graph:\n${context.existingNodes.slice(0, 20).join(', ')}\n`;
    }
    if (context.userProgress) {
        contextStr += `\nUser Progress:\n- Mastered: ${context.userProgress.masteredCount || 0} nodes\n- Due for review: ${context.userProgress.dueCount || 0} nodes\n`;
    }
    if (context.learningPath && context.learningPath.length > 0) {
        contextStr += `\nSuggested Learning Path:\n${context.learningPath.join(' → ')}\n`;
    }
    return contextStr || 'No specific context provided.';
};
export function buildNodeContext(node, options = {}) {
    const { includeContent = true, includeProperties = false, includeLearningMaterial = false, maxContentLength = 500 } = options;
    const parts = [];
    if (node.title) {
        parts.push(`标题: ${node.title}`);
    }
    if (includeContent && node.content) {
        const content = node.content.length > maxContentLength
            ? node.content.substring(0, maxContentLength) + '...'
            : node.content;
        parts.push(`内容: ${content}`);
    }
    if (includeLearningMaterial && node.learning_material) {
        parts.push(`学习材料: ${node.learning_material}`);
    }
    if (includeProperties && node.properties) {
        const tags = node.properties.tags;
        if (tags && tags.length > 0) {
            parts.push(`标签: ${tags.join(', ')}`);
        }
    }
    return parts.join('\n');
}
export function buildNodesContext(nodes, options = {}) {
    return nodes.map((n, i) => `[${i + 1}] ${buildNodeContext(n, options)}`).join('\n\n');
}
//# sourceMappingURL=utils.js.map