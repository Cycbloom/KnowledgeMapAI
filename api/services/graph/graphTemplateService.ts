import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type {
  Template,
  TemplateNode,
  TemplateEdge,
  TemplateLayout,
  GenerationConfig,
  PreviewData,
  TemplateDifficulty,
  LayoutSuggestion,
  TemplateCategory,
} from '../../../shared/types/graph';

export type {
  Template,
  TemplateNode,
  TemplateEdge,
  TemplateLayout,
  GenerationConfig,
  PreviewData,
  TemplateDifficulty,
  LayoutSuggestion,
  TemplateCategory,
};

export type GraphTemplateNode = TemplateNode;
export type GraphTemplateEdge = TemplateEdge;
export type GraphTemplateLayout = TemplateLayout;
export type GraphTemplate = Template;

export interface CreateGraphTemplateData {
  name: string;
  description?: string;
  category?: TemplateCategory;
  nodes: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  generation_config?: GenerationConfig;
  preview_data?: PreviewData;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface UpdateGraphTemplateData {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  nodes?: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  generation_config?: GenerationConfig;
  preview_data?: PreviewData;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface TemplateFilterOptions {
  category?: TemplateCategory | 'all';
  tags?: string[];
  difficulty?: TemplateDifficulty;
  is_system?: boolean;
  search?: string;
}

export interface TemplateSearchResult {
  templates: GraphTemplate[];
  total: number;
  page: number;
  page_size: number;
}

export class GraphTemplateService {
  async getTemplates(
    client: SupabaseClient,
    category?: string
  ): Promise<{ templates: GraphTemplate[] }> {
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

    return { templates: (data || []) as GraphTemplate[] };
  }

  async getTemplate(
    client: SupabaseClient,
    templateId: string
  ): Promise<GraphTemplate | null> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch graph template:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data as GraphTemplate | null;
  }

  async createTemplate(
    client: SupabaseClient,
    userId: string,
    templateData: CreateGraphTemplateData
  ): Promise<GraphTemplate> {
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
        generation_config: templateData.generation_config,
        preview_data: templateData.preview_data,
        tags: templateData.tags || [],
        difficulty: templateData.difficulty || 'medium',
        estimated_nodes: templateData.estimated_nodes || 10,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create graph template:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data as GraphTemplate;
  }

  async updateTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    updates: UpdateGraphTemplateData
  ): Promise<GraphTemplate> {
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

    return data as GraphTemplate;
  }

  async deleteTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string
  ): Promise<void> {
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

  async searchTemplates(
    client: SupabaseClient,
    filters: TemplateFilterOptions,
    page: number = 1,
    pageSize: number = 20
  ): Promise<TemplateSearchResult> {
    let query = client
      .from('templates')
      .select('*', { count: 'exact' });

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters.difficulty) {
      query = query.eq('difficulty', filters.difficulty);
    }

    if (filters.is_system !== undefined) {
      query = query.eq('is_system', filters.is_system);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const offset = (page - 1) * pageSize;
    query = query
      .range(offset, offset + pageSize - 1)
      .order('is_system', { ascending: true })
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to search templates:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return {
      templates: (data || []) as GraphTemplate[],
      total: count || 0,
      page,
      page_size: pageSize,
    };
  }

  async getTemplatesByTag(
    client: SupabaseClient,
    tag: string
  ): Promise<{ templates: GraphTemplate[] }> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .contains('tags', [tag])
      .order('is_system', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch templates by tag:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return { templates: (data || []) as GraphTemplate[] };
  }

  async getTemplatesByDifficulty(
    client: SupabaseClient,
    difficulty: TemplateDifficulty
  ): Promise<{ templates: GraphTemplate[] }> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .eq('difficulty', difficulty)
      .order('is_system', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch templates by difficulty:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return { templates: (data || []) as GraphTemplate[] };
  }

  async addTagToTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    tag: string
  ): Promise<GraphTemplate> {
    const template = await this.getTemplate(client, templateId);
    if (!template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }

    if (template.is_system) {
      throw new AppError(ErrorCodes.FORBIDDEN);
    }

    if (template.user_id !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN);
    }

    const currentTags = template.tags || [];
    if (currentTags.includes(tag)) {
      return template;
    }

    const updatedTags = [...currentTags, tag];

    const { data, error } = await client
      .from('templates')
      .update({
        tags: updatedTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to add tag to template:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data as GraphTemplate;
  }

  async removeTagFromTemplate(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    tag: string
  ): Promise<GraphTemplate> {
    const template = await this.getTemplate(client, templateId);
    if (!template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }

    if (template.is_system) {
      throw new AppError(ErrorCodes.FORBIDDEN);
    }

    if (template.user_id !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN);
    }

    const currentTags = template.tags || [];
    const updatedTags = currentTags.filter((t) => t !== tag);

    const { data, error } = await client
      .from('templates')
      .update({
        tags: updatedTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to remove tag from template:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data as GraphTemplate;
  }

  async getAllTags(client: SupabaseClient): Promise<{ tags: string[] }> {
    const { data, error } = await client
      .from('templates')
      .select('tags')
      .not('tags', 'is', null);

    if (error) {
      logger.error('Failed to fetch all tags:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const allTags = new Set<string>();
    for (const row of data || []) {
      if (row.tags && Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          allTags.add(tag);
        }
      }
    }

    return { tags: Array.from(allTags).sort() };
  }

  async getTemplatesWithFilters(
    client: SupabaseClient,
    options: {
      category?: TemplateCategory | 'all';
      tags?: string[];
      difficulty?: TemplateDifficulty;
      is_system?: boolean;
      search?: string;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<TemplateSearchResult> {
    const {
      category,
      tags,
      difficulty,
      is_system,
      search,
      page = 1,
      page_size = 20,
    } = options;

    return this.searchTemplates(
      client,
      {
        category,
        tags,
        difficulty,
        is_system,
        search,
      },
      page,
      page_size
    );
  }

  async getSystemTemplates(
    client: SupabaseClient
  ): Promise<{ templates: GraphTemplate[] }> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .eq('is_system', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch system templates:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return { templates: (data || []) as GraphTemplate[] };
  }

  async getUserTemplates(
    client: SupabaseClient,
    userId: string
  ): Promise<{ templates: GraphTemplate[] }> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch user templates:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return { templates: (data || []) as GraphTemplate[] };
  }

  async getTemplatesByCategory(
    client: SupabaseClient,
    category: TemplateCategory
  ): Promise<{ templates: GraphTemplate[] }> {
    const { data, error } = await client
      .from('templates')
      .select('*')
      .eq('category', category)
      .order('is_system', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch templates by category:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return { templates: (data || []) as GraphTemplate[] };
  }

  async updateTemplateGenerationConfig(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    generationConfig: GenerationConfig
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, {
      generation_config: generationConfig,
    });
  }

  async updateTemplatePreviewData(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    previewData: PreviewData
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, {
      preview_data: previewData,
    });
  }

  async updateTemplateDifficulty(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    difficulty: TemplateDifficulty
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, { difficulty });
  }

  async updateTemplateEstimatedNodes(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    estimatedNodes: number
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, {
      estimated_nodes: estimatedNodes,
    });
  }

  async updateTemplateLayoutSuggestion(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    layoutSuggestion: LayoutSuggestion
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, {
      layout_suggestion: layoutSuggestion,
    });
  }

  async batchUpdateTags(
    client: SupabaseClient,
    templateId: string,
    userId: string,
    tags: string[]
  ): Promise<GraphTemplate> {
    return this.updateTemplate(client, templateId, userId, { tags });
  }
}

export const graphTemplateService = new GraphTemplateService();
