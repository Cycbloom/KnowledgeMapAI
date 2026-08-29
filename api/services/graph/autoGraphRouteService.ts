import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

interface EmbeddingStatusResult {
  pendingCount: number;
  /** 缺失 embedding 的图谱数量，供图谱向量回填前后对比 */
  graphPendingCount: number;
}

interface TemplateData {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  layoutSuggestion: string;
  estimatedNodes?: number;
  difficulty: string;
  tags: string[];
  reasoning?: string;
}

export class AutoGraphRouteService {
  async getTemplate(
    supabase: SupabaseClient,
    templateId: string,
  ): Promise<TemplateData> {
    const { data, error } = await supabase
      .from('graph_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      throw new AppError(
        '模板不存在或无权访问',
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      nodes: data.template_data?.nodes || [],
      edges: data.template_data?.edges || [],
      layoutSuggestion: data.layout_suggestion || 'radial',
      estimatedNodes: data.estimated_nodes,
      difficulty: data.difficulty || 'medium',
      tags: data.tags || [],
      reasoning: undefined,
    };
  }

  async getEmbeddingStatus(
    supabase: SupabaseClient,
  ): Promise<EmbeddingStatusResult> {
    try {
      const { count } = await supabase
        .from('knowledge_points')
        .select('*', { count: 'exact', head: true })
        .is('embedding', null);

      const { count: graphCount } = await supabase
        .from('knowledge_graphs')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .is('embedding', null);

      return {
        pendingCount: count || 0,
        graphPendingCount: graphCount || 0,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Get embedding status error:', error);
      throw new AppError(
        err.message || '获取嵌入状态失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }
}

export const autoGraphRouteService = new AutoGraphRouteService();
