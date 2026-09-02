import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";
import { cacheService } from "../common/cacheService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";
import { normalizeTitle, type HierarchySuggestion } from "./conceptAggregationShared";

/**
 * 概念层级与别名服务：AI 层级识别、父节点设置、批量层级应用、别名增删。
 */
export class ConceptHierarchyService {
  async identifyHierarchy(
    _supabase: SupabaseClient,
    graphId: string,
    concepts: Array<{ id: string; title: string }>,
  ): Promise<HierarchySuggestion[]> {
    if (concepts.length < 2) {
      logger.info("Insufficient concepts for hierarchy identification");
      return [];
    }

    logger.info(
      `Starting hierarchy identification for graph ${graphId} with ${concepts.length} concepts`,
    );

    try {
      const conceptList = concepts
        .map((c) => `- ${c.id}: ${c.title}`)
        .join("\n");

      const prompt = `分析以下概念之间的 is-a（属于/包含）层级关系。

概念列表：
${conceptList}

请识别哪些概念可能是其他概念的父级（更抽象的概念）或子级（更具体的概念）。
只返回明确的层级关系，置信度低于 0.5 的不要返回。

请以 JSON 数组格式返回，每个元素包含：
- parentId: 父概念ID
- parentTitle: 父概念标题
- childId: 子概念ID
- childTitle: 子概念标题
- confidence: 置信度 (0-1)

只返回 JSON 数组，不要其他内容。`;

      const response = await aiService.chat(
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        { operation: "identify_hierarchy" },
      );

      if (!response) {
        logger.warn("AI service returned empty response for hierarchy identification");
        return [];
      }

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn("Failed to parse hierarchy suggestions from AI response");
        return [];
      }

      const suggestions: HierarchySuggestion[] = JSON.parse(jsonMatch[0]);

      const validSuggestions = suggestions.filter(
        (s) =>
          s.parentId &&
          s.childId &&
          s.confidence >= 0.5 &&
          s.parentId !== s.childId,
      );

      logger.info(
        `Identified ${validSuggestions.length} hierarchy suggestions`,
      );

      return validSuggestions;
    } catch (error) {
      logger.error("Error in hierarchy identification:", error);
      return [];
    }
  }

  async updateNodeParent(
    supabase: SupabaseClient,
    graphId: string,
    childKnowledgePointId: string,
    parentKnowledgePointId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await notDeleted(supabase
      .from("graph_nodes")
      .update({ parent_id: parentKnowledgePointId })
      .eq("knowledge_point_id", childKnowledgePointId)
      .eq("graph_id", graphId)
      );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async addAliases(
    supabase: SupabaseClient,
    knowledgePointId: string,
    aliases: string[],
  ): Promise<void> {
    if (aliases.length === 0) {
      logger.info("No aliases to add");
      return;
    }

    const { data: kp, error: fetchError } = await supabase
      .from("knowledge_points")
      .select("id, title, properties")
      .eq("id", knowledgePointId)
      .single();

    if (fetchError || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: `Knowledge point not found: ${knowledgePointId}` });
    }

    const properties =
      (kp.properties as { aliases?: string[] }) || {};
    const existingAliases: string[] = properties.aliases || [];
    const normalizedTitle = normalizeTitle(
      resolveLocalizedText(kp.title as LocalizedText),
    );

    // 复杂度降低：预构建规范化别名 Set，避免 filter 内层重复 O(n) 的 some() 线性扫描
    const normalizedAliasSet = new Set(
      existingAliases.map((a) => normalizeTitle(a)),
    );

    const uniqueNewAliases = aliases.filter((alias) => {
      const normalizedAlias = normalizeTitle(alias);
      const isDuplicate = normalizedAliasSet.has(normalizedAlias);
      const isSameAsTitle = normalizedAlias === normalizedTitle;
      return !isDuplicate && !isSameAsTitle && alias.trim().length > 0;
    });

    if (uniqueNewAliases.length === 0) {
      logger.info(`No new unique aliases to add for ${knowledgePointId}`);
      return;
    }

    const updatedAliases = [...existingAliases, ...uniqueNewAliases];

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          aliases: updatedAliases,
        },
      })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to add aliases for ${knowledgePointId}:`,
        updateError,
      );
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to add aliases: ${updateError.message}` });
    }

    logger.info(
      `Added ${uniqueNewAliases.length} aliases to ${knowledgePointId}: [${uniqueNewAliases.join(", ")}]`,
    );
  }

  async removeAlias(
    supabase: SupabaseClient,
    knowledgePointId: string,
    alias: string,
  ): Promise<void> {
    const { data: kp, error: fetchError } = await supabase
      .from("knowledge_points")
      .select("id, properties")
      .eq("id", knowledgePointId)
      .single();

    if (fetchError || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: `Knowledge point not found: ${knowledgePointId}` });
    }

    const properties =
      (kp.properties as { aliases?: string[] }) || {};
    const existingAliases: string[] = properties.aliases || [];

    const normalizedTarget = normalizeTitle(alias);
    const filteredAliases = existingAliases.filter(
      (a) => normalizeTitle(a) !== normalizedTarget,
    );

    if (filteredAliases.length === existingAliases.length) {
      logger.info(`Alias "${alias}" not found in ${knowledgePointId}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          aliases: filteredAliases,
        },
      })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to remove alias from ${knowledgePointId}:`,
        updateError,
      );
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to remove alias: ${updateError.message}` });
    }

    logger.info(`Removed alias "${alias}" from ${knowledgePointId}`);
  }

  async batchUpdateHierarchy(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    relations: Array<{ parentId: string; childId: string }>,
  ): Promise<{
    appliedCount: number;
    failedCount: number;
    errors?: Array<{ parentId: string; childId: string; error: string }>;
  }> {
    let appliedCount = 0;
    const errors: Array<{
      parentId: string;
      childId: string;
      error: string;
    }> = [];

    for (const relation of relations) {
      try {
        const result = await this.updateNodeParent(
          supabase,
          graphId,
          relation.childId,
          relation.parentId,
        );

        if (!result.success) {
          errors.push({
            parentId: relation.parentId,
            childId: relation.childId,
            error: result.error || "Unknown error",
          });
          logger.warn("Failed to apply hierarchy relation", {
            parentId: relation.parentId,
            childId: relation.childId,
            error: result.error,
          });
        } else {
          appliedCount++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({
          parentId: relation.parentId,
          childId: relation.childId,
          error: errorMessage,
        });
      }
    }

    await cacheService.invalidateGraphNodesCache(userId, graphId);

    logger.info("Hierarchy relations applied", {
      graphId,
      appliedCount,
      failedCount: errors.length,
      userId,
    });

    if (errors.length > 0) {
      logger.warn("Some hierarchy relations failed to apply", {
        errors,
      });
    }

    return {
      appliedCount,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
