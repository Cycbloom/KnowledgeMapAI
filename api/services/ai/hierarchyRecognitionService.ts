import { getAIProviderForTask } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  withTimeoutAndRetry,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";

export interface ConceptForAnalysis {
  id: string;
  title: string;
}

export interface HierarchySuggestion {
  parentTitle: string;
  childTitle: string;
  confidence: number;
}

interface HierarchyAIResponse {
  parent: string;
  child: string;
  confidence: number;
}

export class HierarchyRecognitionService {
  async analyzeHierarchy(
    concepts: ConceptForAnalysis[],
    options?: {
      provider?: AIProviderType;
      model?: string;
      maxSuggestions?: number;
      userId?: string;
      graphId?: string;
      language?: string;
      sessionId?: string;
    },
  ): Promise<HierarchySuggestion[]> {
    if (concepts.length < 2) {
      logger.info("Not enough concepts for hierarchy analysis", {
        conceptCount: concepts.length,
      });
      return [];
    }

    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      logger.info("No AI provider available for hierarchy analysis");
      return [];
    }

    try {
      const model = options?.model || provider.model;

      return withAIMonitoring(
        {
          operation: "analyzeHierarchy",
          provider: provider.providerType,
          model,
          metadata: {
            conceptCount: concepts.length,
            maxSuggestions: options?.maxSuggestions || 10,
          },
          sessionId: options?.sessionId,
        },
        async () => {
          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "concept_hierarchy",
            {},
            options?.userId,
            options?.graphId,
            options?.language,
          );

          const userMessage = this.buildUserMessage(concepts);

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content:
                      systemPrompt ||
                      this.getDefaultSystemPrompt(),
                  },
                  { role: "user", content: userMessage },
                ],
                model,
                response_format: { type: "json_object" },
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Hierarchy Analysis retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<HierarchyAIResponse[]>(
            rawContent,
            "Hierarchy Analysis",
          );

          let suggestions = (parsed || []).map((item) => ({
            parentTitle: item.parent,
            childTitle: item.child,
            confidence: Math.min(Math.max(item.confidence, 0), 1),
          }));

          suggestions = this.filterValidSuggestions(suggestions, concepts);
          suggestions = this.removeCycles(suggestions);
          suggestions = this.deduplicate(suggestions);
          suggestions = this.sortByConfidence(suggestions);

          const maxSuggestions = options?.maxSuggestions || 10;
          if (suggestions.length > maxSuggestions) {
            suggestions = suggestions.slice(0, maxSuggestions);
          }

          return {
            result: suggestions,
            usage: completion.usage,
          };
        },
      );
    } catch (error) {
      logger.error("Hierarchy analysis failed", error);
      return [];
    }
  }

  private buildUserMessage(concepts: ConceptForAnalysis[]): string {
    const conceptList = concepts
      .map((c, i) => `${i + 1}. ${c.title}`)
      .join("\n");

    return `请分析以下概念之间的层级关系（is-a 父子关系）：

${conceptList}

请识别其中的上下位关系，返回 JSON 数组格式。`;
  }

  private getDefaultSystemPrompt(): string {
    return `你是一个知识图谱专家，专门分析概念之间的层次关系（is-a 关系）。

任务：分析给定的概念列表，识别其中的上下位（父子）层级关系。

规则：
1. 只输出明确的 is-a 关系（如"深度学习" is-a "机器学习"）
2. 不输出相关关系或部分-整体关系
3. 置信度范围 0.0-1.0，≥0.7 为高置信度
4. 输出格式为 JSON 数组

输出格式：
[
  {"parent": "父概念名称", "child": "子概念名称", "confidence": 0.92}
]

注意：
- 确保没有循环依赖（A是B的父，B又是A的父）
- 一个子概念通常只有一个直接父概念
- 优先选择最直接的父子关系`;
  }

  private filterValidSuggestions(
    suggestions: HierarchySuggestion[],
    concepts: ConceptForAnalysis[],
  ): HierarchySuggestion[] {
    const validTitles = new Set(concepts.map((c) => c.title));

    return suggestions.filter(
      (s) =>
        s.parentTitle &&
        s.childTitle &&
        s.parentTitle !== s.childTitle &&
        validTitles.has(s.parentTitle) &&
        validTitles.has(s.childTitle) &&
        s.confidence >= 0.5,
    );
  }

  private removeCycles(
    suggestions: HierarchySuggestion[],
  ): HierarchySuggestion[] {
    const parentToChildren = new Map<string, Set<string>>();

    for (const s of suggestions) {
      if (!parentToChildren.has(s.parentTitle)) {
        parentToChildren.set(s.parentTitle, new Set());
      }
      parentToChildren.get(s.parentTitle)?.add(s.childTitle);
    }

    const hasCycle = (
      current: string,
      target: string,
      visited: Set<string>,
    ): boolean => {
      if (current === target) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      const children = parentToChildren.get(current);
      if (!children) return false;

      for (const child of children) {
        if (hasCycle(child, target, visited)) return true;
      }
      return false;
    };

    return suggestions.filter((s) => !hasCycle(s.childTitle, s.parentTitle, new Set()));
  }

  private deduplicate(
    suggestions: HierarchySuggestion[],
  ): HierarchySuggestion[] {
    const seen = new Map<string, HierarchySuggestion>();

    for (const s of suggestions) {
      const key = `${s.parentTitle}->${s.childTitle}`;
      const existing = seen.get(key);

      if (!existing || s.confidence > existing.confidence) {
        seen.set(key, s);
      }
    }

    return Array.from(seen.values());
  }

  private sortByConfidence(
    suggestions: HierarchySuggestion[],
  ): HierarchySuggestion[] {
    return [...suggestions].sort((a, b) => b.confidence - a.confidence);
  }
}

export const hierarchyRecognitionService = new HierarchyRecognitionService();
