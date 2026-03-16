import { aiService } from '../services/ai/aiService.js';
import { logger } from './logger.js';
export async function searchSimilarKnowledgePoints(supabase, userId, text, options = {}) {
    const { threshold = 0.85, limit = 10 } = options;
    try {
        const embedding = await aiService.generateEmbedding(text);
        if (!embedding) {
            logger.warn('Failed to generate embedding for similarity search');
            return [];
        }
        const { data, error } = await supabase.rpc('search_similar_knowledge_points', {
            p_query_embedding: embedding,
            p_user_id: userId,
            p_match_threshold: threshold,
            p_match_count: limit,
        });
        if (error) {
            logger.error('Similarity search error:', error);
            return [];
        }
        return (data || []);
    }
    catch (error) {
        logger.error('Similarity search failed:', error);
        return [];
    }
}
export async function checkAndReuseKnowledgePoint(supabase, userId, title, _content, threshold = 0.85) {
    const similar = await searchSimilarKnowledgePoints(supabase, userId, title, { threshold, limit: 1 });
    if (similar.length > 0 && similar[0].similarity >= threshold) {
        return { shouldReuse: true, existingKpId: similar[0].id };
    }
    return { shouldReuse: false };
}
export async function searchSimilarGraphs(supabase, userId, topic, options = {}) {
    const { threshold = 0.85, limit = 10, excludeGraphId } = options;
    try {
        const embedding = await aiService.generateEmbedding(topic);
        if (!embedding) {
            logger.warn('Failed to generate embedding for graph topic similarity search');
            return { similarGraphs: [] };
        }
        const { data, error } = await supabase.rpc('search_similar_graphs', {
            p_query_embedding: embedding,
            p_user_id: userId,
            p_match_threshold: threshold,
            p_match_count: limit,
            p_exclude_graph_id: excludeGraphId || null,
        });
        if (error) {
            logger.error('Graph similarity search error:', error);
            return { similarGraphs: [], embedding };
        }
        return {
            similarGraphs: (data || []),
            embedding
        };
    }
    catch (error) {
        logger.error('Graph similarity search failed:', error);
        return { similarGraphs: [] };
    }
}
export async function checkDuplicateGraphTopic(supabase, userId, topic, options = {}) {
    const { threshold = 0.85 } = options;
    const { similarGraphs, embedding } = await searchSimilarGraphs(supabase, userId, topic, options);
    const isDuplicate = similarGraphs.length > 0 && similarGraphs[0].similarity >= threshold;
    return {
        isDuplicate,
        similarGraphs,
        embedding,
    };
}
//# sourceMappingURL=similaritySearch.js.map