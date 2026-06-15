import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

export interface GraphTraversalResult {
  knowledgePointId: string;
  title: string;
  content: string;
  hopDistance: number;
  relationshipPath: string;
  relationshipType: string;
}

export class GraphTraversalService {
  async getNeighbors(
    supabase: SupabaseClient,
    graphId: string,
    sourceKpIds: string[],
    maxHops: number = 2,
    relationshipTypes?: string[],
  ): Promise<GraphTraversalResult[]> {
    const params: Record<string, unknown> = {
      p_graph_id: graphId,
      p_source_ids: sourceKpIds,
      p_max_hops: maxHops,
    };

    if (relationshipTypes && relationshipTypes.length > 0) {
      params.p_relationship_types = relationshipTypes;
    }

    const { data, error } = await supabase.rpc('graph_traverse_neighbors', params);

    if (error) {
      logger.warn('Graph traversal error:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as GraphTraversalResult[]).map(row => ({
      knowledgePointId: row.knowledgePointId,
      title: row.title,
      content: row.content,
      hopDistance: row.hopDistance,
      relationshipPath: row.relationshipPath,
      relationshipType: row.relationshipType,
    }));
  }
}

export const graphTraversalService = new GraphTraversalService();
