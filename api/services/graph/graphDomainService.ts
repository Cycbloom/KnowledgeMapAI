import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export const graphDomainService = {
  async migrateGraphDomainIfNeeded(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    if (!supabase) return;
    const { data: graph } = await supabase
      .from("knowledge_graphs")
      .select("domain")
      .eq("id", graphId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!graph?.domain) return;
    const { data: existing } = await supabase
      .from("graph_domains")
      .select("id")
      .eq("graph_id", graphId)
      .maybeSingle();
    if (existing) return;
    const { data: domain } = await supabase
      .from("domains")
      .select("id")
      .eq("name", graph.domain)
      .eq("user_id", userId)
      .maybeSingle();
    if (!domain) return;
    const { error } = await supabase.from("graph_domains").insert({
      graph_id: graphId,
      domain_id: domain.id,
      is_primary: true,
    });
    if (error) {
      logger.warn("懒迁移 graph_domains 失败", { graphId, error: error.message });
    } else {
      logger.info("懒迁移 graph_domains 成功", {
        graphId,
        domainName: graph.domain,
      });
    }
  },

  async getGraphDomains(supabase: SupabaseClient, graphId: string) {
    if (!supabase) return [];
    const { data: graphDomains } = await supabase
      .from("graph_domains")
      .select(
        `
        id, graph_id, domain_id, is_primary, created_at,
        domains(id, name, description, color, icon, parent_id, sort_order, is_system)
      `,
      )
      .eq("graph_id", graphId);
    return (
      graphDomains
        ?.map((gd) => {
          const domain = Array.isArray(gd.domains) ? gd.domains[0] : gd.domains;
          if (!domain) return null;
          return {
            id: domain.id,
            name: domain.name,
            description: domain.description,
            color: domain.color,
            icon: domain.icon,
            parent_id: domain.parent_id,
            sort_order: domain.sort_order,
            is_system: domain.is_system,
            is_primary: gd.is_primary,
          };
        })
        .filter(Boolean) || []
    );
  },

  async updateGraphDomains(
    supabase: SupabaseClient,
    graphId: string,
    domains: Array<{ domain_id: string; is_primary?: boolean }> | undefined,
  ) {
    if (!supabase || !domains) return;
    const hasPrimary = domains.some((d) => d.is_primary);
    const normalized = domains.map((d) => ({
      ...d,
      is_primary: hasPrimary ? d.is_primary : domains.indexOf(d) === 0,
    }));
    await supabase.from("graph_domains").delete().eq("graph_id", graphId);
    if (normalized.length > 0) {
      const { error } = await supabase.from("graph_domains").insert(
        normalized.map((d) => ({
          graph_id: graphId,
          domain_id: d.domain_id,
          is_primary: d.is_primary ?? false,
        })),
      );
      if (error) {
        logger.error("更新 graph_domains 失败", {
          graphId,
          error: error.message,
        });
        throw error;
      }
      logger.info(`已更新图谱 ${graphId} 的 ${normalized.length} 个领域关联`);
    }
  },

  async listGraphsByDomains(
    supabase: SupabaseClient,
    userId: string,
    domainIds: string[],
  ) {
    if (!domainIds || domainIds.length === 0) {
      return { graphs: [], total: 0 };
    }

    const { data: graphDomains } = await supabase
      .from("graph_domains")
      .select("graph_id")
      .in("domain_id", domainIds);
    const filteredGraphIds =
      graphDomains?.map((gd) => gd.graph_id).filter(Boolean) || [];

    if (filteredGraphIds.length === 0) {
      return { graphs: [], total: 0 };
    }

    const { data: graphs, error } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      .in("id", filteredGraphIds)
      )
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g) => g.id) || [];
    const countMap = new Map<string, number>();
    if (graphIds.length > 0) {
      const { data: nodeCounts } = await notDeleted(supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds)
        );
      nodeCounts?.forEach((n) => {
        countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
      });
    }

    const result = (graphs || []).map((g) => ({
      id: g.id,
      user_id: g.user_id,
      title: g.title,
      description: g.description,
      is_public: g.is_public,
      is_favorite: g.is_favorite,
      created_at: g.created_at,
      updated_at: g.updated_at,
      deleted_at: g.deleted_at,
      nodes_count: countMap.get(g.id) || 0,
      template_type: g.template_type,
    }));

    return { graphs: result, total: result.length };
  },
};
