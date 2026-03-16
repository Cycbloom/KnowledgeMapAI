import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
export class GraphTemplateService {
    async getTemplates(client, category) {
        let query = client
            .from('templates')
            .select('*')
            .order('is_system', { ascending: true })
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) {
            logger.error('Failed to fetch graph templates:', error);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
        return { templates: (data || []) };
    }
    async getTemplate(client, templateId) {
        const { data, error } = await client
            .from('templates')
            .select('*')
            .eq('id', templateId)
            .single();
        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to fetch graph template:', error);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
        return data;
    }
    async createTemplate(client, userId, templateData) {
        const { data, error } = await client
            .from('templates')
            .insert({
            user_id: userId,
            name: templateData.name,
            description: templateData.description,
            category: templateData.category || 'custom',
            nodes: templateData.nodes,
            edges: templateData.edges || [],
            layout: templateData.layout,
            is_system: false,
        })
            .select()
            .single();
        if (error) {
            logger.error('Failed to create graph template:', error);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
        return data;
    }
    async updateTemplate(client, templateId, userId, updates) {
        const { data, error } = await client
            .from('templates')
            .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
            .eq('id', templateId)
            .eq('user_id', userId)
            .eq('is_system', false)
            .select()
            .single();
        if (error) {
            logger.error('Failed to update graph template:', error);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
        if (!data) {
            throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
        }
        return data;
    }
    async deleteTemplate(client, templateId, userId) {
        const { error } = await client
            .from('templates')
            .delete()
            .eq('id', templateId)
            .eq('user_id', userId)
            .eq('is_system', false);
        if (error) {
            logger.error('Failed to delete graph template:', error);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
    }
}
export const graphTemplateService = new GraphTemplateService();
//# sourceMappingURL=graphTemplateService.js.map