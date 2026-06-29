import type {
  StructuredAnalysisResult,
  GraphRecommendation,
} from "../types";
import { logger } from "../../../utils/logger";

/**
 * 解析结构化分析结果。
 * 尝试将内容解析为 JSON 并校验 recommendations 字段，失败时返回 undefined。
 */
export function parseStructuredResult(
  content: string,
): StructuredAnalysisResult | undefined {
  try {
    const parsed = JSON.parse(content);
    if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      return {
        summary: parsed.summary || content,
        recommendations: parsed.recommendations.map(
          (r: GraphRecommendation, index: number) => ({
            ...r,
            id: r.id || `rec-${index}`,
            source_graph_idx: r.source_graph_idx ?? 0,
            target_graph_idx: r.target_graph_idx ?? 0,
            confidence: r.confidence ?? 0.8,
          }),
        ),
        graphIndex: parsed.graphIndex || parsed.graph_index,
      };
    }
  } catch {
    logger.warn("Failed to parse structured result as JSON");
  }
  return undefined;
}

/**
 * 根据工具调用消息生成自主分析摘要报告。
 */
export function generateAnalysisSummary(
  toolMessages: Array<{ toolName?: string; toolResult?: unknown }>,
): string {
  const summaryParts: string[] = ["# 自主分析报告\n"];

  const toolResults: Record<string, unknown[]> = {};

  for (const msg of toolMessages) {
    if (msg.toolName && msg.toolResult) {
      if (!toolResults[msg.toolName]) {
        toolResults[msg.toolName] = [];
      }
      toolResults[msg.toolName].push(msg.toolResult);
    }
  }

  summaryParts.push("## 执行的工具\n");
  for (const [toolName, results] of Object.entries(toolResults)) {
    summaryParts.push(`- **${toolName}**: ${results.length} 次调用`);
  }

  summaryParts.push("\n## 分析结果\n");
  summaryParts.push("基于工具调用结果，完成了以下分析：");

  for (const [toolName, results] of Object.entries(toolResults)) {
    const firstResult = results[0];
    if (firstResult && typeof firstResult === "object") {
      const typed = firstResult as Record<string, unknown>;
      if (typed.summary) {
        summaryParts.push(`\n### ${toolName}\n${String(typed.summary)}`);
      }
    }
  }

  return summaryParts.join("\n");
}

/**
 * 判断是否需要进行二次分析。
 * 根据结果中的标记字段（needs_deeper_analysis、has_gaps 等）决定。
 */
export function needsSecondaryAnalysis(results: unknown[]): boolean {
  if (!results || results.length === 0) {
    return false;
  }

  for (const result of results) {
    if (result && typeof result === "object") {
      const typedResult = result as Record<string, unknown>;
      if (
        typedResult.needs_deeper_analysis === true ||
        typedResult.has_gaps === true ||
        typedResult.incomplete === true ||
        (Array.isArray(typedResult.isolated_graphs) &&
          typedResult.isolated_graphs.length > 3) ||
        (Array.isArray(typedResult.recommendations) &&
          typedResult.recommendations.length > 5)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 从分析结果中识别需要深度分析的目标图谱 ID。
 * 最多返回 5 个去重后的目标。
 */
export function identifyDepthTargets(results: unknown[]): string[] {
  const targets: string[] = [];

  for (const result of results) {
    if (result && typeof result === "object") {
      const typedResult = result as Record<string, unknown>;
      if (Array.isArray(typedResult.graphs)) {
        for (const graph of typedResult.graphs) {
          if (
            graph &&
            typeof graph === "object" &&
            "id" in graph &&
            typeof graph.id === "string"
          ) {
            const graphObj = graph as Record<string, unknown>;
            if (
              graphObj.needs_analysis === true ||
              graphObj.complexity === "high" ||
              graphObj.isolated === true
            ) {
              targets.push(graphObj.id as string);
            }
          }
        }
      }

      if (Array.isArray(typedResult.isolated_graphs)) {
        for (const graph of typedResult.isolated_graphs) {
          if (
            graph &&
            typeof graph === "object" &&
            "id" in graph &&
            typeof graph.id === "string"
          ) {
            targets.push(graph.id as string);
          }
        }
      }

      if (Array.isArray(typedResult.priority_graphs)) {
        for (const graphId of typedResult.priority_graphs) {
          if (typeof graphId === "string") {
            targets.push(graphId);
          }
        }
      }
    }
  }

  const uniqueTargets = [...new Set(targets)];
  return uniqueTargets.slice(0, 5);
}
