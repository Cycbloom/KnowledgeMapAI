import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '../../../shared/types/errorCodes.js';

export interface GraphTemplateNode {
  id: string;
  title: string;
  level: string;
  parentId?: string;
  aiPrompt?: string;
  color?: string;
  x_position?: number;
  y_position?: number;
  position_zone?: string;
}

export interface GraphTemplateEdge {
  source: string;
  target: string;
  relationship_type?: string;
}

export interface GraphTemplateLayout {
  type: string;
  showAxes?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  axes?: {
    x?: { label?: string; min?: number; max?: number };
    y?: { label?: string; min?: number; max?: number };
  };
  zones?: Array<{
    id: string;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    color?: string;
  }>;
  timeline?: {
    direction: 'horizontal' | 'vertical';
    startLabel?: string;
    endLabel?: string;
  };
}

export interface GraphTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  category: 'learning' | 'story' | 'project' | 'analysis' | 'custom';
  is_system: boolean;
  nodes: GraphTemplateNode[];
  edges: GraphTemplateEdge[];
  layout?: GraphTemplateLayout;
  preview_image?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGraphTemplateData {
  name: string;
  description?: string;
  category?: 'learning' | 'story' | 'project' | 'analysis' | 'custom';
  nodes: GraphTemplateNode[];
  edges?: GraphTemplateEdge[];
  layout?: GraphTemplateLayout;
}

export interface UpdateGraphTemplateData {
  name?: string;
  description?: string;
  category?: 'learning' | 'story' | 'project' | 'analysis' | 'custom';
  nodes?: GraphTemplateNode[];
  edges?: GraphTemplateEdge[];
  layout?: GraphTemplateLayout;
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
}

export const graphTemplateService = new GraphTemplateService();
