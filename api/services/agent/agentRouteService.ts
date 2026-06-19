import { SupabaseClient } from '@supabase/supabase-js';
import { isIndexValue, buildIndexMap } from '../../../shared/utils/indexMapping';
import { logger } from '../../utils/logger';

interface RecommendationItem {
  id: string;
  source_graph_id: string;
  source_graph_title: string;
  target_graph_id: string;
  target_graph_title: string;
  relation_type: 'prerequisite' | 'extension' | 'related' | 'cross_domain';
  reason: string;
  confidence: number;
  source_graph_idx?: number | string;
  target_graph_idx?: number | string;
}

interface ApplyRecommendationsResult {
  created: number;
  errors?: string[];
}

export class AgentRouteService {
  async applyRecommendations(
    supabase: SupabaseClient,
    userId: string,
    recommendations: RecommendationItem[],
    graphIndex?: Record<string, string>,
  ): Promise<ApplyRecommendationsResult> {
    let created = 0;
    const errors: string[] = [];

    const { data: userGraphs } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const graphIdByIndex = buildIndexMap(userGraphs || []);
    const graphIdByTitle = new Map<string, string>();
    (userGraphs || []).forEach((g) => {
      graphIdByTitle.set(g.title, g.id);
    });

    if (graphIndex) {
      Object.entries(graphIndex).forEach(([idx, title]) => {
        const id = graphIdByTitle.get(title as string);
        if (id) {
          graphIdByIndex.set(parseInt(idx, 10), id);
        }
      });
    }

    const resolveGraphId = (
      idxOrId: number | string,
      title: string,
    ): string | null => {
      if (typeof idxOrId === 'string' && idxOrId.includes('-')) {
        return idxOrId;
      }
      if (isIndexValue(idxOrId)) {
        const idx =
          typeof idxOrId === 'number' ? idxOrId : parseInt(idxOrId, 10);
        return graphIdByIndex.get(idx) || null;
      }
      return graphIdByTitle.get(title) || null;
    };

    for (const rec of recommendations) {
      const sourceGraphId = resolveGraphId(
        rec.source_graph_idx ?? rec.source_graph_id,
        rec.source_graph_title,
      );
      const targetGraphId = resolveGraphId(
        rec.target_graph_idx ?? rec.target_graph_id,
        rec.target_graph_title,
      );

      if (!sourceGraphId || !targetGraphId) {
        errors.push(
          `图谱不存在或无权限: ${rec.source_graph_title} -> ${rec.target_graph_title}`,
        );
        continue;
      }

      const { error: insertError } = await supabase
        .from('graph_relations')
        .upsert(
          {
            source_graph_id: sourceGraphId,
            target_graph_id: targetGraphId,
            relation_type: rec.relation_type,
            context: rec.reason,
            source: 'ai_suggested',
            confidence: rec.confidence,
          },
          {
            onConflict: 'source_graph_id,target_graph_id,relation_type',
          },
        );

      if (insertError) {
        errors.push(
          `创建关系失败: ${rec.source_graph_title} -> ${rec.target_graph_title}: ${insertError.message}`,
        );
      } else {
        created++;
      }
    }

    logger.info('Applied recommendations', {
      userId,
      total: recommendations.length,
      created,
      errors: errors.length,
    });

    return {
      created,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const agentRouteService = new AgentRouteService();
