import { SupabaseClient } from '@supabase/supabase-js';
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
import { renderPromptContent } from '@shared/template/renderPrompt';

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

    if (result) {
      this.invalidateCache(result);
    }

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
    language?: string,
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);

    let content = '';

    if (!template) {
      const defaultPrompt = DEFAULT_PROMPTS[code];
      if (defaultPrompt) {
        content = defaultPrompt;
      } else {
        logger.warn(`[PromptService] No template found for code: ${code}. Using empty fallback.`);
        content = '';
      }
    } else {
      content = template.template_content;
    }

    // 统一渲染收尾（shared/renderPrompt）：变量渲染 + schema 追加 +
    // outputLanguage/categoryOptions 兜底 + 语言指令
    return renderPromptContent({
      content,
      context,
      language,
      schema: OUTPUT_SCHEMAS[code],
    });
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
    const { code, scope, user_id, graph_id, template_content } = template;

    if (!code || !scope || typeof template_content !== 'string') {
      throw new Error('Invalid template data');
    }

    // prompt_templates 的唯一索引均为部分索引（WHERE scope = ...），PostgreSQL
    // 的 ON CONFLICT 推断无法匹配部分索引（报 42P10），因此不能使用 upsert。
    // 改为手动 upsert：按 (code, scope, user_id, graph_id) 命中则 UPDATE，
    // 未命中则 INSERT。
    let query = supabase
      .from('prompt_templates')
      .select('id')
      .eq('code', code)
      .eq('scope', scope);

    if (scope === 'user') {
      query = query.eq('user_id', user_id ?? '').is('graph_id', null);
    } else if (scope === 'graph') {
      query = query.eq('user_id', user_id ?? '').eq('graph_id', graph_id ?? '');
    } else {
      query = query.is('user_id', null).is('graph_id', null);
    }

    const { data: existing, error: findError } = await query
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      return this.update(supabase, existing.id, {
        code,
        template_content,
      });
    }

    return this.create(supabase, {
      code,
      scope,
      template_content,
      user_id,
      graph_id,
    });
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
