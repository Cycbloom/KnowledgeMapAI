import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../utils/templateEngine.js';
import { cacheService, CacheKeys } from './cache.js';
import { logger } from '../utils/logger.js';

export type PromptScope = 'system' | 'user' | 'graph';

export interface PromptTemplate {
  id: string;
  code: string;
  scope: PromptScope;
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

// Fixed output schemas (Hidden from user editing)
const OUTPUT_SCHEMAS: Record<string, string> = {
  expand_knowledge: `
Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.
Example format: { "suggestions": [{ "title": "Example Title", "content": "Example content" }] }
Please respond in Chinese.`,

  generate_cards: `
Return a JSON object with a 'cards' array. Each card object must have: 
- 'type' (qa|choice|true_false|multi_choice|fill_in_the_blank|essay)
- 'question'
- 'answer'
- 'explanation' (Detailed analysis/reasoning)
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)

Please respond in Chinese.`,

  branch_suggestions: `
Return a JSON object with a 'suggestions' array. Each object must have:
- 'id': Unique identifier for this suggestion
- 'title': Brief, catchy title for the branch (max 20 chars)
- 'description': Short description explaining what this branch explores (max 100 chars)
- 'priority': 'high', 'medium', or 'low' based on importance
- 'estimatedDifficulty': Number from 1-5 indicating difficulty
- 'relatedTopics': Array of 2-3 related topic keywords
Example format: { "suggestions": [{ "id": "branch_1", "title": "深入原理", "description": "探索核心原理", "priority": "high", "estimatedDifficulty": 4, "relatedTopics": ["theory", "fundamentals"] }] }
Please respond in Chinese.`,

  text_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
Please respond in Chinese.`,

  document_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
Please respond in Chinese.`,

  recommend_connections: `
Return a JSON object with a 'recommendations' array. Each item should have 'node_id', 'node_title', and 'reason'.
Respond in Chinese.`
};

export class PromptService {
  
  /**
   * Get the final rendered prompt string
   * Includes priority logic (Graph > User > System) and Schema appending
   */
  async getRenderedPrompt(
    supabase: SupabaseClient, 
    code: string, 
    context: Record<string, any>, 
    userId?: string, 
    graphId?: string
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);
    
    let content = '';
    
    if (!template) {
        logger.warn(`No template found for code: ${code}. Using empty fallback.`);
        content = '';
    } else {
        try {
            content = TemplateEngine.render(template.template_content, context);
        } catch (e) {
            logger.error(`Failed to render prompt ${code}`, e);
            content = template.template_content;
        }
    }

    // Append fixed schema if exists
    if (OUTPUT_SCHEMAS[code]) {
        content += '\n\n' + OUTPUT_SCHEMAS[code];
    }
    
    return content;
  }

  /**
   * Get the raw template object based on priority
   */
  async getTemplate(
    supabase: SupabaseClient, 
    code: string, 
    userId?: string, 
    graphId?: string
  ): Promise<PromptTemplate | null> {
    const cacheKey = CacheKeys.PROMPT_TEMPLATE(code, userId || 'system', graphId || 'none');
    
    // Try cache first
    const cached = await cacheService.get<PromptTemplate>(cacheKey);
    if (cached) return cached;

    // Fetch all relevant templates for this code
    // We fetch system templates, user templates (if userId), and graph templates (if graphId)
    let query = supabase
      .from('prompt_templates')
      .select('*')
      .eq('code', code);
      
    // Construct OR filter manually or just fetch more and filter in memory (usually few templates per code)
    // Supabase OR with complex conditions can be tricky.
    // Let's use a simple approach: fetch all with this code.
    // CAUTION: This might return other users' templates if RLS is bypassed or not working.
    // But since we pass `supabase` client which (usually) has user context, RLS should apply.
    // If RLS applies, we only see: System + My User + My Graph.
    // If we use service role (admin), we see ALL.
    // So we MUST filter in memory to be safe if client is admin.
    
    const { data: templates, error } = await query;
    if (error) throw error;
    
    if (!templates || templates.length === 0) return null;
    
    // Filter relevant templates
    const relevant = templates.filter(t => {
        if (t.scope === 'system') return true;
        if (t.scope === 'user' && t.user_id === userId) return true;
        if (t.scope === 'graph' && t.graph_id === graphId) return true;
        return false;
    });

    // Sort by priority: Graph > User > System
    const getWeight = (t: PromptTemplate) => {
        if (t.scope === 'graph' && t.graph_id === graphId) return 3;
        if (t.scope === 'user' && t.user_id === userId) return 2;
        if (t.scope === 'system') return 1;
        return 0;
    };
    
    const sorted = relevant.sort((a, b) => getWeight(b) - getWeight(a));
    const bestMatch = sorted[0];

    // Cache the result (short TTL to allow quick updates, e.g. 60s)
    if (bestMatch) {
        await cacheService.set(cacheKey, bestMatch, 60);
    }
    
    return bestMatch || null;
  }

  // Management Methods
  
  async saveTemplate(supabase: SupabaseClient, template: Partial<PromptTemplate>) {
      const { data, error } = await supabase
        .from('prompt_templates')
        .upsert({
            ...template,
            updated_at: new Date().toISOString()
        }, { onConflict: 'code,scope,user_id,graph_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      // Invalidate cache
      const userId = template.user_id || 'system';
      const graphId = template.graph_id || 'none';
      await cacheService.del(CacheKeys.PROMPT_TEMPLATE(template.code!, userId, graphId));
      
      return data;
  }
  
  async deleteTemplate(supabase: SupabaseClient, id: string) {
      // Get template first to know keys for cache invalidation
      const { data: temp } = await supabase.from('prompt_templates').select('*').eq('id', id).single();
      
      const { error } = await supabase.from('prompt_templates').delete().eq('id', id);
      if (error) throw error;
      
      if (temp) {
          const userId = temp.user_id || 'system';
          const graphId = temp.graph_id || 'none';
          await cacheService.del(CacheKeys.PROMPT_TEMPLATE(temp.code, userId, graphId));
      }
  }
  
  async resetToDefault(supabase: SupabaseClient, code: string, scope: PromptScope, userId?: string, graphId?: string) {
      // Delete the specific override
      let query = supabase.from('prompt_templates').delete().eq('code', code).eq('scope', scope);
      
      if (scope === 'user' && userId) query = query.eq('user_id', userId);
      if (scope === 'graph' && graphId) query = query.eq('graph_id', graphId);
      
      const { error } = await query;
      if (error) throw error;
      
      // Invalidate cache
      await cacheService.del(CacheKeys.PROMPT_TEMPLATE(code, userId || 'system', graphId || 'none'));
  }
}

export const promptService = new PromptService();
