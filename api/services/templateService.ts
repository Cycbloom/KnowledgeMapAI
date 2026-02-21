import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';
import { createKnowledgePointWithGraphNode } from '../utils/nodeHelpers.js';
import { logger } from '../utils/logger.js';

export class TemplateService {
  async listTemplates(supabase: SupabaseClient, category?: string) {
    const cacheKey = CacheKeys.TEMPLATES(category || 'all');
    
    return cacheService.getOrSet(cacheKey, async () => {
      let query = supabase
        .from('templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    });
  }

  async getTemplate(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found');
    
    return data;
  }

  async createTemplate(supabase: SupabaseClient, userId: string, templateData: any) {
    const { name, description, category, nodes, edges, layout } = templateData;
    
    const { data, error } = await supabase
      .from('templates')
      .insert([
        {
          user_id: userId,
          name,
          description,
          category,
          is_system: false,
          nodes,
          edges,
          layout,
        }
      ])
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.TEMPLATES('all'));
    await cacheService.del(CacheKeys.TEMPLATES(category));
    
    return data;
  }

  async updateTemplate(supabase: SupabaseClient, userId: string, id: string, updates: any) {
    const { data, error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found or access denied');

    const template = await this.getTemplate(supabase, id);
    await cacheService.del(CacheKeys.TEMPLATES('all'));
    await cacheService.del(CacheKeys.TEMPLATES(template.category));
    await cacheService.del(CacheKeys.TEMPLATE(id));
    
    return data;
  }

  async deleteTemplate(supabase: SupabaseClient, userId: string, id: string) {
    const { data, error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_system', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found or access denied');

    await cacheService.del(CacheKeys.TEMPLATES('all'));
    await cacheService.del(CacheKeys.TEMPLATES(data.category));
    await cacheService.del(CacheKeys.TEMPLATE(id));
    
    return { message: 'Template deleted successfully' };
  }

  async createGraphFromTemplate(
    supabase: SupabaseClient, 
    userId: string, 
    templateId: string, 
    title: string, 
    description: string = ''
  ) {
    const template = await this.getTemplate(supabase, templateId);
    
    const { data: graph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .insert([
        {
          user_id: userId,
          title,
          description,
          settings: {
            template_id: templateId,
            template_name: template.name,
            layout: template.layout,
          }
        }
      ])
      .select()
      .single();

    if (graphError) throw graphError;

    const graphId = graph.id;
    const nodeIdMap = new Map<string, string>();

    for (const templateNode of template.nodes) {
      const newNodeId = crypto.randomUUID();
      nodeIdMap.set(templateNode.id, newNodeId);

      await createKnowledgePointWithGraphNode(
        supabase,
        userId,
        {
          graph_id: graphId,
          title: templateNode.title,
          content: '',
          x_position: templateNode.x_position || 0,
          y_position: templateNode.y_position || 0,
          level: templateNode.level,
          properties: {
            ai_prompt: templateNode.aiPrompt,
            position_zone: templateNode.position_zone,
          },
        }
      );
    }

    for (const templateEdge of template.edges) {
      const sourceNodeId = nodeIdMap.get(templateEdge.source);
      const targetNodeId = nodeIdMap.get(templateEdge.target);

      if (!sourceNodeId || !targetNodeId) {
        logger.warn(`Skipping edge: node mapping not found`, templateEdge);
        continue;
      }

      const { error: edgeError } = await supabase
        .from('edges')
        .insert([
          {
            graph_id: graphId,
            source_knowledge_point_id: sourceNodeId,
            target_knowledge_point_id: targetNodeId,
            relationship_type: templateEdge.relationship_type || 'related',
          }
        ]);

      if (edgeError) throw edgeError;
    }

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));

    return graph;
  }
}

export const templateService = new TemplateService();