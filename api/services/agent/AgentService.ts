import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import { ToolRegistry } from "./ToolRegistry";
import { SessionManager } from "./SessionManager";
import type {
  AgentSession,
  CreateSessionOptions,
  ExecuteResult,
  ToolContext,
  SkillDefinition,
  AgentTool,
  StructuredAnalysisResult,
  GraphRecommendation,
  AnalysisGoal,
} from "./types";
import { getAIProviderForTask } from "../ai/factory";
import { logger } from "../../utils/logger";
import { allTools } from "./tools";
import { getStrategyForGoal } from "./strategies/ToolSelectionStrategy";
import { indexMappingService } from "../indexMapping/IndexMappingService";

export class AgentService {
  private toolRegistry: ToolRegistry;
  private sessionManager: SessionManager;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.toolRegistry = new ToolRegistry();
    this.sessionManager = SessionManager.getInstance();

    allTools.forEach((tool) => this.toolRegistry.register(tool));
  }

  registerTool(tool: AgentTool): void {
    this.toolRegistry.register(tool);
  }

  createSession(userId: string, options: CreateSessionOptions): AgentSession {
    return this.sessionManager.create(userId, {
      skillId: options.skillId,
      graphIds: options.graphIds,
    });
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessionManager.get(sessionId);
  }

  async executeSession(
    sessionId: string,
    userId: string,
    customPrompt?: string,
  ): Promise<ExecuteResult> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    this.sessionManager.update(sessionId, { status: "running" });

    const graphIndexMap = await indexMappingService.buildGraphIndexMap(
      userId,
      this.supabase,
    );

    const context: ToolContext = {
      supabase: this.supabase,
      userId,
      graphIds: session.graphIds,
      graphIndexMap,
    };

    const skill = session.skillId
      ? SKILLS.find((s) => s.id === session.skillId)
      : null;

    const systemPrompt = this.getSystemPrompt(skill);
    const userPrompt =
      customPrompt || this.getUserPrompt(skill, session.graphIds);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    this.sessionManager.addMessage(sessionId, {
      role: "system",
      content: systemPrompt,
    });
    this.sessionManager.addMessage(sessionId, {
      role: "user",
      content: userPrompt,
    });

    const aiProvider = await getAIProviderForTask("text");
    const tools = this.toolRegistry.getToolDefinitions();

    let maxIterations = 20;
    let finalResult = "";

    while (maxIterations-- > 0 && session.status === "running") {
      try {
        const completion = await aiProvider.client.chat.completions.create({
          messages,
          model: aiProvider.model,
          tools:
            tools.length > 0
              ? tools.map((t) => ({
                  type: "function" as const,
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                  },
                }))
              : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
        });

        const response = completion.choices[0];

        if (
          response.message.tool_calls &&
          response.message.tool_calls.length > 0
        ) {
          messages.push({
            role: "assistant",
            content: response.message.content || null,
            tool_calls: response.message.tool_calls,
          });

          for (const toolCall of response.message.tool_calls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            this.sessionManager.addToolCall(sessionId, {
              toolName,
              args,
              status: "running",
            });

            const result = await this.toolRegistry.execute(
              toolName,
              args,
              context,
            );

            this.sessionManager.addMessage(sessionId, {
              role: "tool",
              content: JSON.stringify(result),
              toolName,
              toolArgs: args,
              toolResult: result,
            });

            messages.push({
              role: "tool",
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          }
        } else if (response.message.content) {
          finalResult = response.message.content;
          this.sessionManager.addMessage(sessionId, {
            role: "assistant",
            content: response.message.content,
          });
          break;
        }
      } catch (error) {
        const err = error as Error;
        logger.error("Agent execution error:", error);
        this.sessionManager.update(sessionId, { status: "failed" });
        throw new Error(`Agent execution failed: ${err.message}`);
      }
    }

    const structuredResult = this.parseStructuredResult(finalResult);

    this.sessionManager.update(sessionId, {
      status: "completed",
      result: finalResult,
      structuredResult,
    });

    return { session: this.sessionManager.get(sessionId)! };
  }

  async executeWithAutonomy(
    sessionId: string,
    userId: string,
    goal: AnalysisGoal,
  ): Promise<ExecuteResult> {
    const strategy = getStrategyForGoal(goal);
    if (!strategy) {
      return this.executeSession(sessionId, userId);
    }

    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    this.sessionManager.update(sessionId, { status: "running" });

    const graphIndexMap = await indexMappingService.buildGraphIndexMap(
      userId,
      this.supabase,
    );

    const context: ToolContext = {
      supabase: this.supabase,
      userId,
      graphIds: session.graphIds,
      graphIndexMap,
    };

    try {
      const primaryResults = await this.executeToolSet(
        sessionId,
        strategy.primaryTools,
        userId,
        context,
      );

      if (this.needsSecondaryAnalysis(primaryResults)) {
        await this.executeToolSet(
          sessionId,
          strategy.secondaryTools,
          userId,
          context,
        );
      }

      const depthTargets = this.identifyDepthTargets(primaryResults);
      for (const target of depthTargets) {
        await this.executeDepthAnalysis(
          sessionId,
          target,
          strategy.depthTools,
          userId,
          context,
        );
      }

      return this.finalizeSession(sessionId);
    } catch (error) {
      const err = error as Error;
      logger.error("Autonomous execution error:", error);
      this.sessionManager.update(sessionId, { status: "failed" });
      throw new Error(`Autonomous execution failed: ${err.message}`);
    }
  }

  private async executeToolSet(
    sessionId: string,
    toolNames: string[],
    _userId: string,
    context: ToolContext,
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    const session = this.sessionManager.get(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    for (const toolName of toolNames) {
      try {
        const tool = this.toolRegistry.get(toolName);
        if (!tool) {
          logger.warn(`Tool not found: ${toolName}`);
          continue;
        }

        this.sessionManager.addToolCall(sessionId, {
          toolName,
          args: {},
          status: "running",
        });

        const result = await this.toolRegistry.execute(toolName, {}, context);

        this.sessionManager.addMessage(sessionId, {
          role: "tool",
          content: JSON.stringify(result),
          toolName,
          toolArgs: {},
          toolResult: result,
        });

        results.push(result);
      } catch (error) {
        logger.error(`Error executing tool ${toolName}:`, error);
        results.push({ error: (error as Error).message, toolName });
      }
    }

    return results;
  }

  private needsSecondaryAnalysis(results: unknown[]): boolean {
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

  private identifyDepthTargets(results: unknown[]): string[] {
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

  private async executeDepthAnalysis(
    sessionId: string,
    targetId: string,
    tools: string[],
    _userId: string,
    context: ToolContext,
  ): Promise<void> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    for (const toolName of tools) {
      try {
        const tool = this.toolRegistry.get(toolName);
        if (!tool) {
          continue;
        }

        this.sessionManager.addToolCall(sessionId, {
          toolName,
          args: { target_id: targetId },
          status: "running",
        });

        const result = await this.toolRegistry.execute(
          toolName,
          { graph_id: targetId, target_id: targetId },
          context,
        );

        this.sessionManager.addMessage(sessionId, {
          role: "tool",
          content: JSON.stringify(result),
          toolName,
          toolArgs: { target_id: targetId },
          toolResult: result,
        });
      } catch (error) {
        logger.error(
          `Error in depth analysis for ${targetId} with ${toolName}:`,
          error,
        );
      }
    }
  }

  private finalizeSession(sessionId: string): ExecuteResult {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const toolMessages = session.messages.filter((m) => m.role === "tool");
    const analysisSummary = this.generateAnalysisSummary(toolMessages);

    this.sessionManager.update(sessionId, {
      status: "completed",
      result: analysisSummary,
    });

    return { session: this.sessionManager.get(sessionId)! };
  }

  private generateAnalysisSummary(
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

  private parseStructuredResult(
    content: string,
  ): StructuredAnalysisResult | undefined {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
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
      }

      const objectMatch = content.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);
      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
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
      }
    } catch (e) {
      logger.warn("Failed to parse structured result:", e);
    }
    return undefined;
  }

  private getSystemPrompt(skill?: SkillDefinition | null): string {
    if (skill) {
      return skill.systemPrompt;
    }
    return `你是一个知识图谱分析助手。你可以使用提供的工具来分析用户的知识图谱。

请根据用户的请求，选择合适的工具获取信息，然后进行分析和回答。

## 目标识别
在开始分析前，请先识别用户的分析目标：
- **知识完整性分析** (knowledge_completeness): 评估知识体系的完整性和覆盖范围
- **关系发现** (relation_discovery): 发现潜在的图谱关联和知识关系
- **学习优化** (learning_optimization): 规划学习路径和优化学习顺序
- **孤岛检测** (island_detection): 发现没有关联的孤立图谱
- **跨领域发现** (cross_domain): 发现跨学科知识交叉点
- **自定义分析** (custom): 根据用户具体需求进行分析

## 分析策略
根据识别的目标，选择合适的分析策略：
1. 首先使用主要工具获取基础信息
2. 根据初步结果决定是否需要次要工具
3. 对重点目标进行深度分析

重要规则：
1. 先使用工具获取必要的信息，不要假设或编造数据
2. 分析结果要基于实际获取的数据
3. 如果需要更多信息，可以多次调用工具
4. 最终给出清晰、有价值的分析报告

输出格式要求：
- 先用 Markdown 格式输出分析报告
- 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出推荐列表
- JSON 格式如下：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``;
  }

  private getUserPrompt(
    skill?: SkillDefinition | null,
    graphIds?: string[],
  ): string {
    if (skill) {
      let prompt = skill.userPromptTemplate;
      if (graphIds && graphIds.length > 0) {
        prompt += `\n\n请重点关注以下图谱：${graphIds.join(", ")}`;
      }
      return prompt;
    }
    return "请分析我的知识图谱";
  }
}

export const SKILLS: SkillDefinition[] = [
  {
    id: "island_detection",
    name: "知识孤岛检测",
    description: "发现没有关联的图谱",
    systemPrompt: `你是知识图谱分析专家，专门负责检测知识孤岛。

请分析用户的知识图谱，找出所有没有与其他图谱建立关联的孤立图谱。

输出格式要求：
1. 先用 Markdown 格式输出分析报告，包括：
   - 总体概述
   - 孤立图谱列表及建议
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出推荐列表：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``,
    userPromptTemplate:
      "请分析我的知识图谱，找出所有的知识孤岛（没有关联的图谱），并推荐可能的关联",
    tools: [
      "get_graph_overview",
      "get_graph_relations",
      "get_isolated_graphs",
      "get_domain_distribution",
      "get_knowledge_coverage",
    ],
  },
  {
    id: "relation_recommendation",
    name: "关系推荐",
    description: "推荐潜在的图谱关系",
    systemPrompt: `你是知识关系发现专家。

请分析用户的知识图谱，发现潜在的图谱关系并给出推荐。

输出格式要求：
1. 先用 Markdown 格式输出分析报告，包括：
   - 现有关系概述
   - 推荐的新关系及理由
2. 在报告末尾用 JSON 格式输出推荐列表：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``,
    userPromptTemplate: "请分析我的知识图谱，推荐潜在的图谱关系",
    tools: [
      "get_graph_details",
      "get_graph_nodes",
      "search_graphs",
      "get_graph_overview",
      "get_graph_relations",
      "get_similar_graphs",
      "analyze_graph_structure",
    ],
  },
  {
    id: "learning_path",
    name: "学习路径规划",
    description: "规划最优学习顺序",
    systemPrompt: `你是学习路径规划专家。

请分析用户的知识图谱，规划最优的学习路径。

输出格式要求：
1. 用 Markdown 格式输出学习路径建议
2. 如果有推荐的图谱关系（如前置依赖），在报告末尾用 JSON 格式输出`,
    userPromptTemplate: "请分析我的知识图谱，规划最优的学习路径",
    tools: [
      "get_graph_overview",
      "get_graph_relations",
      "get_learning_paths",
      "get_prerequisite_chain",
      "analyze_difficulty",
    ],
  },
  {
    id: "cross_domain",
    name: "跨领域发现",
    description: "发现跨学科知识交叉",
    systemPrompt: `你是跨学科知识发现专家。

请分析用户的知识图谱，发现跨领域的知识交叉点。

输出格式要求：
1. 用 Markdown 格式输出跨领域分析
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出`,
    userPromptTemplate: "请分析我的知识图谱，发现跨领域的知识交叉点",
    tools: ["get_graph_details", "search_graphs", "get_graph_overview"],
  },
  {
    id: "knowledge_gaps",
    name: "知识缺口分析",
    description: "识别知识体系空白",
    systemPrompt: `你是知识体系分析专家。

请分析用户的知识图谱，识别知识体系中的缺口。

输出格式要求：
1. 用 Markdown 格式输出知识缺口分析
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出`,
    userPromptTemplate: "请分析我的知识图谱，识别知识体系中的缺口",
    tools: [
      "get_graph_overview",
      "get_graph_nodes",
      "get_knowledge_coverage",
      "analyze_merge_candidates",
      "analyze_graph_structure",
    ],
  },
  {
    id: "knowledge_completeness",
    name: "知识完整性分析",
    description: "分析知识体系的完整性和覆盖度",
    systemPrompt: `你是知识体系完整性分析专家。

请全面分析用户的知识图谱，评估知识体系的完整性。

分析维度：
1. 知识覆盖度 - 各领域的图谱分布
2. 连接完整性 - 图谱间的关联程度
3. 孤岛检测 - 识别孤立的知识点
4. 合并建议 - 发现重复或相似的图谱

输出格式要求：
1. 用 Markdown 格式输出完整性分析报告
2. 在报告末尾用 JSON 格式输出推荐列表`,
    userPromptTemplate: "请分析我的知识体系完整性，评估覆盖度和关联程度",
    tools: [
      "get_graph_overview",
      "get_domain_distribution",
      "get_isolated_graphs",
      "get_knowledge_coverage",
      "analyze_merge_candidates",
    ],
  },
  {
    id: "merge_analysis",
    name: "合并建议分析",
    description: "分析可能需要合并的相似图谱",
    systemPrompt: `你是知识图谱合并分析专家。

请分析用户的知识图谱，找出可能需要合并的相似图谱。

分析维度：
1. 标题相似度 - 图谱标题的相似程度
2. 内容重叠 - 知识点的重叠程度
3. 关联关系 - 是否存在直接关联

输出格式要求：
1. 用 Markdown 格式输出合并建议报告
2. 在报告末尾用 JSON 格式输出推荐列表`,
    userPromptTemplate: "请分析我的知识图谱，找出可能需要合并的相似图谱",
    tools: [
      "get_graph_overview",
      "analyze_merge_candidates",
      "get_similar_graphs",
    ],
  },
];
