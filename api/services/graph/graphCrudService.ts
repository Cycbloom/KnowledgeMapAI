import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { cacheService, CacheKeys, CacheTTL } from "../common/cacheService";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export class GraphCrudService {
  async getGraphMap(supabase: SupabaseClient, userId: string) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_MAP(userId),
      async () => {
        try {
          const { data, error } = await supabase.rpc('get_graph_map_data', {
            p_user_id: userId,
          });

          if (!error && data) {
            return data as { graphs: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> };
          }

          logger.warn('get_graph_map_data RPC failed, falling back:', error?.message);
        } catch (err) {
          logger.warn('get_graph_map_data RPC error, falling back:', err);
        }

        return this.getGraphMapFallback(supabase, userId);
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`, 'graphMap'],
    );
  }

  private async getGraphMapFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, title, description, created_at, is_public, domain")
      .eq("user_id", userId)
      )
      .order("last_used_at", { ascending: false });

    const graphIds = (graphs || []).map((g) => g.id);

    const [nodeCountsResult, relationsResult] = await Promise.all([
      notDeleted(supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds)
        ),
      supabase
        .from("graph_relations")
        .select(
          "id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at",
        )
        .or(
          `source_graph_id.in.(${graphIds.join(
            ",",
          )}),target_graph_id.in.(${graphIds.join(",")})`,
        ),
    ]);

    const nodeCountMap = new Map<string, number>();
    (nodeCountsResult.data || []).forEach((n) => {
      nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
    });

    const graphsWithCounts = (graphs || []).map((g) => ({
      ...g,
      node_count: nodeCountMap.get(g.id) || 0,
    }));

    return {
      graphs: graphsWithCounts,
      relations: relationsResult.data || [],
    };
  }

  async getTags(supabase: SupabaseClient, userId: string) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_TAGS(userId),
      async () => {
        try {
          const { data, error } = await supabase.rpc('get_user_graph_tags', {
            p_user_id: userId,
          });

          if (!error && data) {
            return { tags: data as Array<{ name: string; count: number }> };
          }

          logger.warn('get_user_graph_tags RPC failed, falling back:', error?.message);
        } catch (err) {
          logger.warn('get_user_graph_tags RPC error, falling back:', err);
        }

        return this.getTagsFallback(supabase, userId);
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`, 'tags'],
    );
  }

  private async getTagsFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("user_id", userId)
      );

    const graphIds = (graphs || []).map((g) => g.id);

    if (graphIds.length === 0) {
      return { tags: [] };
    }

    const { data: graphNodes } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
          graph_id,
          knowledge_points (
            properties
          )
        `,
      )
      .in("graph_id", graphIds)
      );

    const tagMap = new Map<string, number>();

    (graphNodes || []).forEach((gn) => {
      const kp = gn.knowledge_points as { properties?: { tags?: string[] } } | { properties?: { tags?: string[] } }[] | null;
      const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
      const tags = props?.tags || [];
      tags.forEach((tag: string) => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    });

    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { tags };
  }

  async getDomains(supabase: SupabaseClient, userId: string) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_DOMAINS(userId),
      async () => {
        const { data: graphs } = await notDeleted(supabase
          .from("knowledge_graphs")
          .select("domain")
          .eq("user_id", userId)
          )
          .not("domain", "is", null);

        const domainMap = new Map<string, number>();
        (graphs || []).forEach((g) => {
          if (g.domain) {
            domainMap.set(g.domain, (domainMap.get(g.domain) || 0) + 1);
          }
        });

        const domains = Array.from(domainMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return { domains };
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`, 'domains'],
    );
  }

  async analyzeMap(supabase: SupabaseClient, userId: string) {
    const { data: graphs } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, title, description")
      .eq("user_id", userId)
      );

    const graphIds = (graphs || []).map((g) => g.id);

    const { data: relations } = await supabase
      .from("graph_relations")
      .select("source_graph_id, target_graph_id, relation_type")
      .or(
        `source_graph_id.in.(${graphIds.join(
          ",",
        )}),target_graph_id.in.(${graphIds.join(",")})`,
      );

    const connectedGraphIds = new Set<string>();
    (relations || []).forEach((r) => {
      connectedGraphIds.add(r.source_graph_id);
      connectedGraphIds.add(r.target_graph_id);
    });

    const isolatedGraphs = (graphs || [])
      .filter((g) => !connectedGraphIds.has(g.id))
      .map((g) => ({ id: g.id, title: g.title }));

    const graphRelationCount = new Map<string, number>();
    (relations || []).forEach((r) => {
      graphRelationCount.set(
        r.source_graph_id,
        (graphRelationCount.get(r.source_graph_id) || 0) + 1,
      );
      graphRelationCount.set(
        r.target_graph_id,
        (graphRelationCount.get(r.target_graph_id) || 0) + 1,
      );
    });

    const missingPrerequisites = (graphs || [])
      .filter((g) => {
        const asTarget = (relations || []).filter(
          (r) =>
            r.target_graph_id === g.id && r.relation_type === "prerequisite",
        );
        return asTarget.length === 0 && (graphRelationCount.get(g.id) || 0) > 0;
      })
      .slice(0, 5)
      .map((g) => ({
        graph_id: g.id,
        graph_title: g.title,
        suggested_topics: ["基础概念", "入门知识", "前置理论"].slice(0, 2),
      }));

    const suggestedPaths: Array<{
      from: string;
      from_title: string;
      to: string;
      to_title: string;
      via: string[];
    }> = [];

    const graphMap = new Map((graphs || []).map((g) => [g.id, g.title]));

    (relations || []).forEach((r) => {
      if (r.relation_type === "prerequisite" && suggestedPaths.length < 5) {
        const fromGraph = graphMap.get(r.target_graph_id);
        const toGraph = graphMap.get(r.source_graph_id);
        if (fromGraph && toGraph) {
          suggestedPaths.push({
            from: r.target_graph_id,
            from_title: fromGraph,
            to: r.source_graph_id,
            to_title: toGraph,
            via: [],
          });
        }
      }
    });

    const mergeSuggestions: Array<{
      graph_ids: string[];
      graph_titles: string[];
      reason: string;
    }> = [];

    const titleGroups = new Map<string, string[]>();
    (graphs || []).forEach((g) => {
      const key = g.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
      if (!titleGroups.has(key)) titleGroups.set(key, []);
      titleGroups.get(key)!.push(g.id);
    });

    titleGroups.forEach((ids, _key) => {
      if (ids.length > 1) {
        mergeSuggestions.push({
          graph_ids: ids,
          graph_titles: ids.map((id) => graphMap.get(id) || ""),
          reason: "图谱名称相似，可能存在重复",
        });
      }
    });

    return {
      isolated_graphs: isolatedGraphs,
      missing_prerequisites: missingPrerequisites,
      suggested_paths: suggestedPaths,
      merge_suggestions: mergeSuggestions.slice(0, 3),
    };
  }

  async getResearchProgress(supabase: SupabaseClient, graphId: string) {
    const { data: modules, error: modError } = await supabase
      .from("graph_backbone_modules")
      .select("*")
      .eq("graph_id", graphId)
      .order("display_order", { ascending: true });

    if (modError) throw modError;

    if (!modules || modules.length === 0) {
      return { modules: [], totalNodes: 0, totalLiterature: 0 };
    }

    // 按模块分别查询，使用 SQL JSONB 条件在数据库层过滤
    const moduleStats = await Promise.all(
      modules.map(async (mod: { module_type: string; title: string; icon: string; color: string }) => {
        const { data: moduleNodes, error: gnError } = await notDeleted(supabase
          .from("graph_nodes")
          .select(
            `
            id,
            knowledge_points (
              id,
              properties
            )
          `,
          )
          .eq("graph_id", graphId)
          )
          .eq("knowledge_points.properties->>backboneModule", mod.module_type);

        if (gnError) {
          logger.error("Get module nodes error:", gnError);
        }

        const sources = new Set<string>();
        (moduleNodes || []).forEach((gn) => {
          const kp = gn.knowledge_points as Array<{ properties?: { sources?: Array<{ title?: string }> } }> | { properties?: { sources?: Array<{ title?: string }> } } | null;
          const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
          const nodeSources = props?.sources || [];
          nodeSources.forEach((s: { title?: string }) => {
            if (s.title) sources.add(s.title);
          });
        });

        return {
          module_type: mod.module_type,
          title: mod.title,
          icon: mod.icon,
          color: mod.color,
          nodeCount: (moduleNodes || []).length,
          literatureCount: sources.size,
        };
      }),
    );

    const totalNodes = moduleStats.reduce((sum, m) => sum + m.nodeCount, 0);
    const totalLiterature = moduleStats.reduce(
      (sum, m) => sum + m.literatureCount,
      0,
    );

    return { modules: moduleStats, totalNodes, totalLiterature };
  }

  async getLiterature(
    supabase: SupabaseClient,
    graphId: string,
    moduleFilter?: string,
  ) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_LITERATURE(graphId, moduleFilter),
      async () => {
        const { data: graphNodes, error: gnError } = await notDeleted(supabase
          .from("graph_nodes")
          .select(
            `
          knowledge_points (
            id,
            title,
            properties
          )
        `,
          )
          .eq("graph_id", graphId)
          );

        if (gnError) throw gnError;

        const literatureMap = new Map<
          string,
          {
            title: string;
            authors: string[];
            year: number;
            type: string;
            url: string;
            conceptCount: number;
            modules: string[];
          }
        >();

        for (const gn of graphNodes || []) {
          const kp = gn.knowledge_points as {
            id?: string;
            title?: string;
            properties?: {
              sources?: Array<{
                title?: string;
                authors?: string[];
                year?: number;
                type?: string;
                url?: string;
              }>;
              backboneModule?: string;
            };
          } | undefined;
          if (!kp) continue;
          const props = kp.properties || {};
          const sources = props.sources || [];
          const backboneModule = props.backboneModule as string | undefined;

          for (const source of sources) {
            if (!source.title) continue;
            const key = source.title + (source.url || "");
            const existing = literatureMap.get(key);
            if (existing) {
              existing.conceptCount++;
              if (backboneModule && !existing.modules.includes(backboneModule)) {
                existing.modules.push(backboneModule);
              }
            } else {
              literatureMap.set(key, {
                title: source.title,
                authors: source.authors || [],
                year: source.year || 0,
                type: source.type || "document",
                url: source.url || "",
                conceptCount: 1,
                modules: backboneModule ? [backboneModule] : [],
              });
            }
          }
        }

        let literature = Array.from(literatureMap.values());

        if (moduleFilter) {
          literature = literature.filter((l) => l.modules.includes(moduleFilter));
        }

        literature.sort(
          (a, b) => b.year - a.year || b.conceptCount - a.conceptCount,
        );

        return { literature, totalCount: literature.length };
      },
      CacheTTL.DYNAMIC,
      [`graph:${graphId}`, 'literature'],
    );
  }

  async updateViewMode(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    viewMode: string,
  ) {
    const { data: graph, error: graphError } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      )
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const currentSettings = (graph.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      viewMode,
    };

    const { data: updatedGraph, error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw new AppError("更新视图模式失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return updatedGraph;
  }
}

export const graphCrudService = new GraphCrudService();
