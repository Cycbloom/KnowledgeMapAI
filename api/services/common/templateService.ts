import { SupabaseClient } from '@supabase/supabase-js';
import { getPaginationParams, PaginationOptions } from '../../utils/pagination';
import { logger } from '../../utils/logger';

export interface TaskTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  category: string;
  title_template: string;
  description_template?: string;
  estimated_duration: number;
  tags: string[];
  priority: number;
  is_default: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category?: string;
  title_template: string;
  description_template?: string;
  estimated_duration?: number;
  tags?: string[];
  priority?: number;
  is_default?: boolean;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: string;
  title_template?: string;
  description_template?: string;
  estimated_duration?: number;
  tags?: string[];
  priority?: number;
  is_default?: boolean;
}

export interface TemplateFilters {
  category?: string;
  is_system?: boolean;
  search?: string;
}

export interface ApplyTemplateData {
  placeholders?: Record<string, string>;
  queue_level?: number;
  knowledge_point_id?: string;
  deadline?: string;
}

export const TEMPLATE_CATEGORIES = [
  { value: 'study', label: '学习', icon: '📚', color: 'blue' },
  { value: 'work', label: '工作', icon: '💼', color: 'purple' },
  { value: 'life', label: '生活', icon: '🏠', color: 'green' },
  { value: 'health', label: '健康', icon: '💪', color: 'red' },
  { value: 'custom', label: '自定义', icon: '⭐', color: 'amber' },
] as const;

export class TemplateService {
  async createTemplate(
    client: SupabaseClient,
    userId: string,
    templateData: CreateTemplateData
  ): Promise<TaskTemplate> {
    const { data, error } = await client
      .from('task_templates')
      .insert({
        user_id: userId,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category || 'custom',
        title_template: templateData.title_template,
        description_template: templateData.description_template,
        estimated_duration: templateData.estimated_duration ?? 25,
        tags: templateData.tags || [],
        priority: templateData.priority ?? 2,
        is_default: templateData.is_default ?? false,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data as TaskTemplate;
  }

  async updateTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    updates: UpdateTemplateData
  ): Promise<TaskTemplate> {
    const { data, error } = await client
      .from('task_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('user_id', userId)
      .eq('is_system', false)
      .select()
      .single();

    if (error) throw new Error(`Failed to update template: ${error.message}`);
    if (!data) throw new Error('Template not found or is system template');
    return data as TaskTemplate;
  }

  async deleteTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string
  ): Promise<void> {
    const { error } = await client
      .from('task_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId)
      .eq('is_system', false);

    if (error) throw new Error(`Failed to delete template: ${error.message}`);
  }

  async getTemplate(
    client: SupabaseClient,
    templateId: string
  ): Promise<TaskTemplate | null> {
    const { data, error } = await client
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }
    return data as TaskTemplate | null;
  }

  async getTemplates(
    client: SupabaseClient,
    userId: string,
    filters?: TemplateFilters,
    options?: PaginationOptions
  ): Promise<{ templates: TaskTemplate[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from('task_templates')
      .select('*', { count: 'exact' })
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order('is_system', { ascending: true })
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, end);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,title_template.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return { templates: data as TaskTemplate[], total: count || 0 };
  }

  async getTemplatesByCategory(
    client: SupabaseClient,
    userId: string,
    category: string
  ): Promise<TaskTemplate[]> {
    const { data, error } = await client
      .from('task_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .eq('category', category)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch templates by category: ${error.message}`);
    return data as TaskTemplate[];
  }

  async getSystemTemplates(client: SupabaseClient): Promise<TaskTemplate[]> {
    const { data, error } = await client
      .from('task_templates')
      .select('*')
      .eq('is_system', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch system templates: ${error.message}`);
    return data as TaskTemplate[];
  }

  async getUserTemplates(client: SupabaseClient, userId: string): Promise<TaskTemplate[]> {
    const { data, error } = await client
      .from('task_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch user templates: ${error.message}`);
    return data as TaskTemplate[];
  }

  async incrementUsageCount(
    client: SupabaseClient,
    templateId: string
  ): Promise<void> {
    const { error } = await client.rpc('increment_template_usage', {
      template_id: templateId,
    });

    if (error) {
      const { error: updateError } = await client
        .from('task_templates')
        .update({
          usage_count: client.rpc('increment_usage_count', { template_id: templateId }),
        } as never)
        .eq('id', templateId);

      if (updateError) {
        logger.warn('Failed to increment usage count:', updateError.message);
      }
    }
  }

  applyTemplate(
    template: TaskTemplate,
    data?: ApplyTemplateData
  ): { title: string; description?: string; estimated_duration: number; tags: string[]; priority: number } {
    let title = template.title_template;
    let description = template.description_template;

    if (data?.placeholders) {
      for (const [key, value] of Object.entries(data.placeholders)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), value);
        if (description) {
          description = description.replace(new RegExp(placeholder, 'g'), value);
        }
      }
    }

    const unresolvedPlaceholders = title.match(/\{\{[^}]+\}\}/g);
    if (unresolvedPlaceholders) {
      for (const placeholder of unresolvedPlaceholders) {
        const key = placeholder.slice(2, -2);
        title = title.replace(placeholder, key);
        if (description) {
          description = description.replace(placeholder, key);
        }
      }
    }

    return {
      title,
      description,
      estimated_duration: template.estimated_duration,
      tags: [...template.tags],
      priority: template.priority,
    };
  }

  extractPlaceholders(template: TaskTemplate): string[] {
    const titlePlaceholders = template.title_template.match(/\{\{([^}]+)\}\}/g) || [];
    const descPlaceholders = template.description_template?.match(/\{\{([^}]+)\}\}/g) || [];
    
    const allPlaceholders = [...titlePlaceholders, ...descPlaceholders];
    const uniqueKeys = new Set(
      allPlaceholders.map(p => p.slice(2, -2).trim())
    );
    
    return Array.from(uniqueKeys);
  }

  async setDefaultTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    category: string
  ): Promise<TaskTemplate> {
    await client
      .from('task_templates')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('category', category);

    const { data, error } = await client
      .from('task_templates')
      .update({ is_default: true })
      .eq('id', templateId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to set default template: ${error.message}`);
    return data as TaskTemplate;
  }

  async getDefaultTemplate(
    client: SupabaseClient,
    userId: string,
    category: string
  ): Promise<TaskTemplate | null> {
    const { data, error } = await client
      .from('task_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .eq('category', category)
      .eq('is_default', true)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch default template: ${error.message}`);
    return data as TaskTemplate | null;
  }

  async duplicateTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    newName?: string
  ): Promise<TaskTemplate> {
    const original = await this.getTemplate(client, templateId);
    if (!original) throw new Error('Template not found');

    const { data, error } = await client
      .from('task_templates')
      .insert({
        user_id: userId,
        name: newName || `${original.name} (副本)`,
        description: original.description,
        category: original.category,
        title_template: original.title_template,
        description_template: original.description_template,
        estimated_duration: original.estimated_duration,
        tags: original.tags,
        priority: original.priority,
        is_default: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to duplicate template: ${error.message}`);
    return data as TaskTemplate;
  }
}

export const templateService = new TemplateService();
