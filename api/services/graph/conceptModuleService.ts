import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import i18next from "i18next";
import { notDeleted } from '../common/softDeleteHelper';
import { conceptSimilarityService } from "./conceptSimilarityService";

/**
 * 概念模块分析服务：检测未分类知识点是否需要新建骨干模块、模块间内容重叠。
 */
export class ConceptModuleService {
  async detectNewModuleNeeds(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      threshold?: number;
    } = {},
  ): Promise<{
    unclassifiedCount: number;
    needsNewModule: boolean;
    suggestedModules?: Array<{
      title: string;
      description: string;
      reasoning: string;
    }>;
  }> {
    const threshold = options.threshold ?? 10;

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          properties
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error(
        "Failed to fetch graph nodes for module detection:",
        gnError,
      );
      return { unclassifiedCount: 0, needsNewModule: false };
    }

    const unclassified: Array<{ id: string; title: string }> = [];

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        properties?: { backboneModule?: string };
      };
      if (kp && !kp.properties?.backboneModule) {
        unclassified.push({ id: kp.id, title: kp.title });
      }
    }

    if (unclassified.length < threshold) {
      return {
        unclassifiedCount: unclassified.length,
        needsNewModule: false,
      };
    }

    const suggestedModules: Array<{
      title: string;
      description: string;
      reasoning: string;
    }> = [];

    if (unclassified.length >= threshold) {
      suggestedModules.push({
        title: i18next.t("graphMap.api.defaults.otherImportantConcepts"),
        description: `包含 ${unclassified.length} 个尚未分类的知识点，建议根据内容主题创建新的分类模块`,
        reasoning: `图谱中存在 ${unclassified.length} 个未归类到现有骨干模块的知识点，可能代表被忽略的研究领域`,
      });
    }

    return {
      unclassifiedCount: unclassified.length,
      needsNewModule: unclassified.length >= threshold,
      suggestedModules:
        suggestedModules.length > 0 ? suggestedModules : undefined,
    };
  }

  async detectModuleOverlap(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      similarityThreshold?: number;
    } = {},
  ): Promise<{
    overlaps: Array<{
      module1: string;
      module2: string;
      similarity: number;
      suggestion: string;
    }>;
  }> {
    const threshold = options.similarityThreshold ?? 0.7;

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content,
          properties,
          embedding
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch nodes for overlap detection:", gnError);
      return { overlaps: [] };
    }

    const moduleNodes = new Map<
      string,
      Array<{ id: string; title: string; embedding: number[] }>
    >();

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        content?: string;
        properties?: { backboneModule?: string };
        embedding?: number[];
      };
      if (!kp) continue;

      const module = kp.properties?.backboneModule;
      if (!module) continue;

      if (!moduleNodes.has(module)) {
        moduleNodes.set(module, []);
      }
      if (kp.embedding) {
        const list = moduleNodes.get(module);
        if (list) {
          list.push({
            id: kp.id,
            title: kp.title,
            embedding: kp.embedding,
          });
        }
      }
    }

    const modules = Array.from(moduleNodes.entries());
    const overlaps: Array<{
      module1: string;
      module2: string;
      similarity: number;
      suggestion: string;
    }> = [];

    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const [mod1, nodes1] = modules[i];
        const [mod2, nodes2] = modules[j];

        if (nodes1.length === 0 || nodes2.length === 0) continue;

        let totalSimilarity = 0;
        let pairCount = 0;

        for (const node1 of nodes1) {
          for (const node2 of nodes2) {
            const similarity = await conceptSimilarityService.calculateSimilarity(
              node1.embedding,
              node2.embedding,
            );
            totalSimilarity += similarity;
            pairCount++;
          }
        }

        const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

        if (avgSimilarity >= threshold) {
          overlaps.push({
            module1: mod1,
            module2: mod2,
            similarity: Math.round(avgSimilarity * 100) / 100,
            suggestion: `模块 "${mod1}" 和 "${mod2}" 的内容高度重叠（相似度 ${Math.round(avgSimilarity * 100)}%），建议考虑合并或重新划分`,
          });
        }
      }
    }

    return { overlaps };
  }
}
