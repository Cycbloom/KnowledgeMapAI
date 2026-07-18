import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../templateEngine';
import {
  PromptTemplate,
  PromptListOptions,
  PromptCreateData,
  PromptUpdateData,
  PromptScope,
} from './types';
import { DEFAULT_PROMPTS } from './templates';
import { OUTPUT_SCHEMAS } from './schemas';
import { logger } from '@/utils/logger';

export class MobilePromptService {
  private templateCache: Map<string, { template: PromptTemplate; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000;

  async list(
    supabase: SupabaseClient,
    options: PromptListOptions = {},
  ): Promise<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }> {
    const { userId, graphId } = options;

    const { data: systemTemplates, error: sysError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('scope', 'system');

    if (sysError) throw sysError;

    let userQuery = supabase
      .from('prompt_templates')
      .select('*')
      .eq('scope', 'user');

    if (userId) {
      userQuery = userQuery.eq('user_id', userId);
    }

    const { data: userTemplates, error: userError } = await userQuery;

    if (userError) throw userError;

    let graphTemplates: PromptTemplate[] = [];
    if (graphId) {
      const { data: gTemplates, error: gError } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('scope', 'graph')
        .eq('graph_id', graphId);

      if (gError) throw gError;
      graphTemplates = gTemplates || [];
    }

    return {
      system: systemTemplates || [],
      user: userTemplates || [],
      graph: graphTemplates,
    };
  }

  async get(
    supabase: SupabaseClient,
    id: string,
  ): Promise<PromptTemplate | null> {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async create(
    supabase: SupabaseClient,
    data: PromptCreateData,
  ): Promise<PromptTemplate> {
    const { code, scope, template_content, user_id, graph_id } = data;

    const insertData: Record<string, unknown> = {
      code,
      scope,
      template_content,
      user_id: scope === 'system' ? null : user_id,
      graph_id: scope === 'graph' ? graph_id : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('prompt_templates')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return result;
  }

  async update(
    supabase: SupabaseClient,
    id: string,
    data: PromptUpdateData,
  ): Promise<PromptTemplate> {
    const updateData: Record<string, unknown> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('prompt_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (result) {
      this.invalidateCache(result);
    }

    return result;
  }

  async delete(supabase: SupabaseClient, id: string): Promise<void> {
    const { data: temp } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (temp) {
      this.invalidateCache(temp);
    }
  }

  async getRenderedPrompt(
    supabase: SupabaseClient,
    code: string,
    context: Record<string, unknown>,
    userId?: string,
    graphId?: string,
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);

    let content = '';

    if (!template) {
      const defaultPrompt = DEFAULT_PROMPTS[code];
      if (defaultPrompt) {
        try {
          content = TemplateEngine.render(defaultPrompt, context);
        } catch (e) {
          logger.error(`[PromptService] Failed to render default prompt ${code}`, e);
          content = defaultPrompt;
        }
      } else {
        logger.warn(`[PromptService] No template found for code: ${code}. Using empty fallback.`);
        content = '';
      }
    } else {
      try {
        content = TemplateEngine.render(template.template_content, context);
      } catch (e) {
        logger.error(`[PromptService] Failed to render prompt ${code}`, e);
        content = template.template_content;
      }
    }

    if (OUTPUT_SCHEMAS[code]) {
      content += `\n\n${OUTPUT_SCHEMAS[code]}`;
    }

    return content;
  }

  async getTemplate(
    supabase: SupabaseClient,
    code: string,
    userId?: string,
    graphId?: string,
  ): Promise<PromptTemplate | null> {
    const cacheKey = this.getCacheKey(code, userId, graphId);

    const cached = this.templateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.template;
    }

    const query = supabase
      .from('prompt_templates')
      .select('*')
      .eq('code', code);

    const { data: templates, error } = await query;
    if (error) throw error;

    if (!templates || templates.length === 0) return null;

    const relevant = templates.filter((t) => {
      if (t.scope === 'system') return true;
      if (t.scope === 'user' && t.user_id === userId) return true;
      if (t.scope === 'graph' && t.graph_id === graphId) return true;
      return false;
    });

    const getWeight = (t: PromptTemplate) => {
      if (t.scope === 'graph' && t.graph_id === graphId) return 3;
      if (t.scope === 'user' && t.user_id === userId) return 2;
      if (t.scope === 'system') return 1;
      return 0;
    };

    const sorted = relevant.sort((a, b) => getWeight(b) - getWeight(a));
    const bestMatch = sorted[0];

    if (bestMatch) {
      this.templateCache.set(cacheKey, {
        template: bestMatch,
        timestamp: Date.now(),
      });
    }

    return bestMatch || null;
  }

  async saveTemplate(
    supabase: SupabaseClient,
    template: Partial<PromptTemplate>,
  ) {
    const { data, error } = await supabase
      .from('prompt_templates')
      .upsert(
        {
          ...template,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'code,scope,user_id,graph_id' },
      )
      .select()
      .single();

    if (error) throw error;

    this.invalidateCache(data);

    return data;
  }

  async deleteTemplate(supabase: SupabaseClient, id: string) {
    const { data: temp } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;

    if (temp) {
      this.invalidateCache(temp);
    }
  }

  async resetToDefault(
    supabase: SupabaseClient,
    code: string,
    scope: PromptScope,
    userId?: string,
    graphId?: string,
  ) {
    let query = supabase
      .from('prompt_templates')
      .delete()
      .eq('code', code)
      .eq('scope', scope);

    if (scope === 'user' && userId) query = query.eq('user_id', userId);
    if (scope === 'graph' && graphId) query = query.eq('graph_id', graphId);

    const { error } = await query;
    if (error) throw error;

    this.invalidateCacheByKey(code, userId, graphId);
  }

  private getCacheKey(code: string, userId?: string, graphId?: string): string {
    return `${code}:${userId || 'system'}:${graphId || 'none'}`;
  }

  private invalidateCache(template: PromptTemplate) {
    const cacheKey = this.getCacheKey(
      template.code,
      template.user_id,
      template.graph_id,
    );
    this.templateCache.delete(cacheKey);
  }

  private invalidateCacheByKey(code: string, userId?: string, graphId?: string) {
    const cacheKey = this.getCacheKey(code, userId, graphId);
    this.templateCache.delete(cacheKey);
  }

  clearCache() {
    this.templateCache.clear();
  }
}

export const mobilePromptService = new MobilePromptService();
