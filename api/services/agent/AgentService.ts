import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import type { Response } from "express";
import { ToolRegistry } from "./ToolRegistry";
import { SessionManager } from "./SessionManager";
import type {
  AgentSession,
  AgentSSEEvent,
  CreateSessionOptions,
  ExecuteResult,
  ToolContext,
  SkillDefinition,
  AgentTool,
  StructuredAnalysisResult,
  GraphRecommendation,
  AnalysisGoal,
  PendingAction,
} from "./types";
import { getAIProviderForTask } from "../ai/factory";
import { logger } from "../../utils/logger";
import { allTools } from "./tools";
import { getStrategyForGoal } from "./strategies/ToolSelectionStrategy";
import { indexMappingService } from "../indexMapping/IndexMappingService";

function generateActionDescription(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const descriptions: Record<
    string,
    (args: Record<string, unknown>) => string
  > = {
    create_node: (a) => `在图谱中创建节点「${a.title ?? ""}」`,
    create_edge: (a) => `创建关系：${a.relationship_type ?? ""}`,
    create_graph_relation: (a) => `在图谱间创建${a.relation_type ?? ""}关系`,
    create_study_card: (a) =>
      `创建学习卡片：${((a.question as string) ?? "").substring(0, 30)}`,
    update_node: (a) => `更新知识点「${a.title ?? ""}」的内容`,
  };
  const generator = descriptions[toolName];
  return generator ? generator(args) : `执行操作：${toolName}`;
}

export class AgentService {
  private toolRegistry: ToolRegistry;
  private sessionManager: SessionManager;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.toolRegistry = new ToolRegistry();
    this.sessionManager = new SessionManager(supabase);

    allTools.forEach((tool) => this.toolRegistry.register(tool));

    setInterval(() => this.expirePendingActions(), 60 * 1000);
  }

  registerTool(tool: AgentTool): void {
    this.toolRegistry.register(tool);
  }

  private sendSSE(res: Response, event: AgentSSEEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  async createSession(
    userId: string,
    options: CreateSessionOptions,
  ): Promise<AgentSession> {
    return this.sessionManager.create(userId, {
      skillId: options.skillId,
      graphIds: options.graphIds,
    });
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    return this.sessionManager.get(sessionId);
  }

  async getSessionsByUserId(
    userId: string,
  ): Promise<Omit<AgentSession, "messages" | "toolCalls">[]> {
    return this.sessionManager.getByUserId(userId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionManager.deleteSession(sessionId);
  }

  async executeSession(
    sessionId: string,
    userId: string,
    res: Response,
    customPrompt?: string,
  ): Promise<void> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      this.sendSSE(res, {
        type: "session_failed",
        data: { error: "Session not found" },
      });
      res.end();
      return;
    }

    await this.sessionManager.update(sessionId, { status: "running" });

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

    await this.sessionManager.addMessage(sessionId, {
      role: "system",
      content: systemPrompt,
    });
    await this.sessionManager.addMessage(sessionId, {
      role: "user",
      content: userPrompt,
    });

    const aiProvider = await getAIProviderForTask("text");
    const skillAllowWrite = skill?.allowWrite ?? false;
    const allToolsDefinitions =
      this.toolRegistry.getToolDefinitions(skillAllowWrite);

    const filteredTools = skill?.tools
      ? allToolsDefinitions.filter((t) => skill.tools.includes(t.name))
      : allToolsDefinitions;

    const maxIterations = skill?.maxIterations || 20;

    await this.runReActLoop(
      sessionId,
      messages,
      context,
      skill ?? null,
      aiProvider,
      filteredTools,
      res,
      maxIterations,
    );
  }

  async resumeSession(
    sessionId: string,
    userId: string,
    res: Response,
  ): Promise<void> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      this.sendSSE(res, {
        type: "session_failed",
        data: { error: "Session not found" },
      });
      res.end();
      return;
    }

    if (session.status !== "running") {
      this.sendSSE(res, {
        type: "session_failed",
        data: {
          error: `Session is in ${session.status} state, expected running`,
        },
      });
      res.end();
      return;
    }

    // Rebuild LLM context from session messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    for (const msg of session.messages) {
      if (msg.role === "system") {
        messages.push({ role: "system", content: msg.content });
      } else if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        messages.push({ role: "assistant", content: msg.content });
      } else if (msg.role === "tool") {
        messages.push({
          role: "tool",
          content: msg.content,
          tool_call_id:
            ((msg.toolResult as Record<string, unknown>)
              ?.tool_call_id as string) ?? `tc-${msg.id}`,
        });
      }
    }

    // Rebuild tool context
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
    const aiProvider = await getAIProviderForTask("text");
    const skillAllowWrite = skill?.allowWrite ?? false;
    const allToolsDefinitions =
      this.toolRegistry.getToolDefinitions(skillAllowWrite);
    const filteredTools = skill?.tools
      ? allToolsDefinitions.filter((t) => skill.tools.includes(t.name))
      : allToolsDefinitions;

    const maxIterations = skill?.maxIterations || 20;

    await this.runReActLoop(
      sessionId,
      messages,
      context,
      skill ?? null,
      aiProvider,
      filteredTools,
      res,
      maxIterations,
    );
  }

  private async runReActLoop(
    sessionId: string,
    messages: OpenAI.ChatCompletionMessageParam[],
    context: ToolContext,
    _skill: SkillDefinition | null,
    aiProvider: { client: OpenAI; model: string },
    filteredTools: ReturnType<ToolRegistry["getToolDefinitions"]>,
    res: Response,
    maxIterations: number,
  ): Promise<void> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      this.sendSSE(res, {
        type: "session_failed",
        data: { error: "Session not found" },
      });
      res.end();
      return;
    }

    let iterations = maxIterations;
    let finalResult = "";

    while (iterations-- > 0 && session.status === "running") {
      try {
        const completion = await aiProvider.client.chat.completions.create({
          messages,
          model: aiProvider.model,
          tools:
            filteredTools.length > 0
              ? filteredTools.map((t) => ({
                  type: "function" as const,
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                  },
                }))
              : undefined,
          tool_choice: filteredTools.length > 0 ? "auto" : undefined,
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
            const tool = this.toolRegistry.get(toolName);

            this.sendSSE(res, {
              type: "tool_call_start",
              data: { toolName, args },
            });

            await this.sessionManager.addToolCall(sessionId, {
              toolName,
              args,
              status: "running",
            });

            // Check if this is a write tool that requires confirmation
            if (
              tool &&
              (tool.category === "write" || tool.requiresConfirmation)
            ) {
              const actionId = crypto.randomUUID();
              const description = generateActionDescription(toolName, args);

              // Insert the pending action into database
              const { error: insertError } = await this.supabase
                .from("agent_pending_actions")
                .insert({
                  id: actionId,
                  session_id: sessionId,
                  tool_name: toolName,
                  args,
                  category: tool.category ?? "write",
                  risk_level: tool.riskLevel ?? "low",
                  description,
                  status: "pending",
                });

              if (insertError) {
                logger.error("Failed to insert pending action:", insertError);
              }

              // Add a message indicating the action is pending
              await this.sessionManager.addMessage(sessionId, {
                role: "tool",
                content: JSON.stringify({
                  pending: true,
                  actionId,
                  description,
                }),
                toolName,
                toolArgs: args,
                toolResult: { pending: true, actionId, description },
              });

              messages.push({
                role: "tool",
                content: JSON.stringify({
                  pending: true,
                  actionId,
                  description,
                }),
                tool_call_id: toolCall.id,
              });
            } else {
              // Read tool: execute directly as before
              const result = await this.toolRegistry.execute(
                toolName,
                args,
                context,
              );

              await this.sessionManager.addMessage(sessionId, {
                role: "tool",
                content: JSON.stringify(result),
                toolName,
                toolArgs: args,
                toolResult: result,
              });

              this.sendSSE(res, {
                type: "tool_call_result",
                data: { toolName, result },
              });

              messages.push({
                role: "tool",
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }
          }

          // After processing all tool calls, check if any pending actions were created
          const { data: pendingData } = await this.supabase
            .from("agent_pending_actions")
            .select("id")
            .eq("session_id", sessionId)
            .eq("status", "pending");

          const hasPendingActions = (pendingData?.length ?? 0) > 0;

          if (hasPendingActions) {
            await this.sessionManager.update(sessionId, {
              status: "awaiting_confirmation",
            });
            const pendingActions = await this.getPendingActions(sessionId);
            this.sendSSE(res, {
              type: "awaiting_confirmation",
              data: { pendingActions },
            });
            // Do not close SSE stream - it will be reused by resumeSession
            return;
          }
        } else if (response.message.content) {
          // Try to parse as structured result
          let finalContent = response.message.content;
          const directParsed = this.parseStructuredResult(finalContent);

          if (!directParsed) {
            // If direct parse fails, re-request with JSON format
            try {
              const jsonCompletion =
                await aiProvider.client.chat.completions.create({
                  messages: [
                    ...messages,
                    { role: "assistant", content: finalContent },
                    {
                      role: "user",
                      content:
                        "请将上述分析结果以 JSON 格式输出，包含 summary 和 recommendations 字段。",
                    },
                  ],
                  model: aiProvider.model,
                  response_format: { type: "json_object" },
                });
              finalContent =
                jsonCompletion.choices[0]?.message?.content || finalContent;
            } catch (e) {
              logger.warn("Failed to re-request with JSON format", e);
            }
          }

          finalResult = finalContent;
          await this.sessionManager.addMessage(sessionId, {
            role: "assistant",
            content: finalContent,
          });

          this.sendSSE(res, {
            type: "agent_message",
            data: { content: finalContent },
          });
          break;
        }
      } catch (error) {
        const err = error as Error;
        logger.error("Agent execution error:", error);
        await this.sessionManager.update(sessionId, { status: "failed" });
        this.sendSSE(res, {
          type: "session_failed",
          data: { error: err.message },
        });
        res.end();
        return;
      }
    }

    const structuredResult = this.parseStructuredResult(finalResult);

    await this.sessionManager.update(sessionId, {
      status: "completed",
      result: finalResult,
      structuredResult,
    });

    const finalSession = await this.sessionManager.get(sessionId);
    this.sendSSE(res, {
      type: "session_completed",
      data: { session: finalSession },
    });
    res.end();
  }

  async executeWithAutonomy(
    sessionId: string,
    userId: string,
    goal: AnalysisGoal,
  ): Promise<ExecuteResult> {
    const strategy = getStrategyForGoal(goal);
    if (!strategy) {
      throw new Error(`No strategy found for goal: ${goal}`);
    }

    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    await this.sessionManager.update(sessionId, { status: "running" });

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
      await this.sessionManager.update(sessionId, { status: "failed" });
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
    const session = await this.sessionManager.get(sessionId);

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

        await this.sessionManager.addToolCall(sessionId, {
          toolName,
          args: {},
          status: "running",
        });

        const result = await this.toolRegistry.execute(toolName, {}, context);

        await this.sessionManager.addMessage(sessionId, {
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
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    for (const toolName of tools) {
      try {
        const tool = this.toolRegistry.get(toolName);
        if (!tool) {
          continue;
        }

        await this.sessionManager.addToolCall(sessionId, {
          toolName,
          args: { target_id: targetId },
          status: "running",
        });

        const result = await this.toolRegistry.execute(
          toolName,
          { graph_id: targetId, target_id: targetId },
          context,
        );

        await this.sessionManager.addMessage(sessionId, {
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

  private async finalizeSession(sessionId: string): Promise<ExecuteResult> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const toolMessages = session.messages.filter((m) => m.role === "tool");
    const analysisSummary = this.generateAnalysisSummary(toolMessages);

    await this.sessionManager.update(sessionId, {
      status: "completed",
      result: analysisSummary,
    });

    const finalSession = await this.sessionManager.get(sessionId);
    return { session: finalSession! };
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

  private mapRowToPendingAction(row: Record<string, unknown>): PendingAction {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      toolName: row.tool_name as string,
      args: row.args as Record<string, unknown>,
      category: row.category as PendingAction["category"],
      riskLevel: row.risk_level as PendingAction["riskLevel"],
      description: row.description as string,
      status: row.status as PendingAction["status"],
      result: row.result as unknown | undefined,
      createdAt: new Date(row.created_at as string),
      executedAt: row.executed_at
        ? new Date(row.executed_at as string)
        : undefined,
    };
  }

  async getPendingActions(sessionId: string): Promise<PendingAction[]> {
    const { data, error } = await this.supabase
      .from("agent_pending_actions")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to query pending actions:", error);
      return [];
    }

    return (data ?? []).map((row) => this.mapRowToPendingAction(row));
  }

  async confirmAction(
    sessionId: string,
    actionId: string,
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    needsResume?: boolean;
  }> {
    // Query the action from database
    const { data: actionData, error: queryError } = await this.supabase
      .from("agent_pending_actions")
      .select("*")
      .eq("id", actionId)
      .eq("session_id", sessionId)
      .single();

    if (queryError || !actionData) {
      return { success: false, error: "Action not found" };
    }
    if (actionData.status !== "pending") {
      return {
        success: false,
        error: `Action is already ${actionData.status}`,
      };
    }

    try {
      const session = await this.sessionManager.get(sessionId);
      const context: ToolContext = {
        supabase: this.supabase,
        userId: session?.userId ?? "",
        graphIds: session?.graphIds,
      };

      const result = await this.toolRegistry.execute(
        actionData.tool_name,
        actionData.args as Record<string, unknown>,
        context,
      );

      // Update database status to 'executed'
      const { error: updateError } = await this.supabase
        .from("agent_pending_actions")
        .update({
          status: "executed",
          result,
          executed_at: new Date().toISOString(),
        })
        .eq("id", actionId);

      if (updateError) {
        logger.error(
          "Failed to update action status to executed:",
          updateError,
        );
      }

      // Check if there are more pending actions
      const { data: remainingData } = await this.supabase
        .from("agent_pending_actions")
        .select("id")
        .eq("session_id", sessionId)
        .eq("status", "pending");

      if ((remainingData?.length ?? 0) === 0) {
        // Resume the session
        await this.sessionManager.update(sessionId, { status: "running" });
        return { success: true, result, needsResume: true };
      }

      return { success: true, result };
    } catch (error) {
      // Update database status to 'failed'
      const { error: updateError } = await this.supabase
        .from("agent_pending_actions")
        .update({
          status: "failed",
          result: { error: (error as Error).message },
          executed_at: new Date().toISOString(),
        })
        .eq("id", actionId);

      if (updateError) {
        logger.error("Failed to update action status to failed:", updateError);
      }

      return { success: false, error: (error as Error).message };
    }
  }

  async rejectAction(
    sessionId: string,
    actionId: string,
  ): Promise<{ success: boolean; error?: string; needsResume?: boolean }> {
    // Query the action from database
    const { data: actionData, error: queryError } = await this.supabase
      .from("agent_pending_actions")
      .select("*")
      .eq("id", actionId)
      .eq("session_id", sessionId)
      .single();

    if (queryError || !actionData) {
      return { success: false, error: "Action not found" };
    }
    if (actionData.status !== "pending") {
      return {
        success: false,
        error: `Action is already ${actionData.status}`,
      };
    }

    // Update database status to 'rejected'
    const { error: updateError } = await this.supabase
      .from("agent_pending_actions")
      .update({ status: "rejected" })
      .eq("id", actionId);

    if (updateError) {
      logger.error("Failed to update action status to rejected:", updateError);
      return { success: false, error: "Failed to reject action" };
    }

    // Check if there are more pending actions
    const { data: remainingData } = await this.supabase
      .from("agent_pending_actions")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "pending");

    if ((remainingData?.length ?? 0) === 0) {
      await this.sessionManager.update(sessionId, { status: "running" });
      return { success: true, needsResume: true };
    }

    return { success: true };
  }

  async batchConfirmActions(
    sessionId: string,
    actionIds: string[],
  ): Promise<{
    results: Array<{
      actionId: string;
      success: boolean;
      result?: unknown;
      error?: string;
      needsResume?: boolean;
    }>;
    needsResume?: boolean;
  }> {
    const results: Array<{
      actionId: string;
      success: boolean;
      result?: unknown;
      error?: string;
      needsResume?: boolean;
    }> = [];
    for (const actionId of actionIds) {
      const result = await this.confirmAction(sessionId, actionId);
      results.push({ actionId, ...result });
    }
    const needsResume = results.some((r) => r.needsResume);
    return { results, needsResume: needsResume || undefined };
  }

  async batchRejectActions(
    sessionId: string,
    actionIds: string[],
  ): Promise<{
    results: Array<{
      actionId: string;
      success: boolean;
      error?: string;
      needsResume?: boolean;
    }>;
    needsResume?: boolean;
  }> {
    const results: Array<{
      actionId: string;
      success: boolean;
      error?: string;
      needsResume?: boolean;
    }> = [];
    for (const actionId of actionIds) {
      const result = await this.rejectAction(sessionId, actionId);
      results.push({ actionId, ...result });
    }
    const needsResume = results.some((r) => r.needsResume);
    return { results, needsResume: needsResume || undefined };
  }

  async expirePendingActions(): Promise<void> {
    // Batch update expired pending actions
    const { data: expiredActions, error: updateError } = await this.supabase
      .from("agent_pending_actions")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .select("session_id");

    if (updateError) {
      logger.error("Failed to expire pending actions:", updateError);
      return;
    }

    if (!expiredActions || expiredActions.length === 0) {
      return;
    }

    // Check affected sessions for remaining pending actions
    const affectedSessionIds = [
      ...new Set(expiredActions.map((a) => a.session_id as string)),
    ];
    for (const sessionId of affectedSessionIds) {
      const { data: remainingData } = await this.supabase
        .from("agent_pending_actions")
        .select("id")
        .eq("session_id", sessionId)
        .eq("status", "pending");

      if ((remainingData?.length ?? 0) === 0) {
        const session = await this.sessionManager.get(sessionId);
        if (session?.status === "awaiting_confirmation") {
          await this.sessionManager.update(sessionId, {
            status: "interrupted",
          });
        }
      }
    }
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
    if (graphIds && graphIds.length > 0) {
      return `请分析我选中的知识图谱（共 ${graphIds.length} 个），重点关注这些图谱之间的关系和结构。`;
    }
    return "请分析我的知识图谱";
  }
}

export const SKILLS: SkillDefinition[] = [
  {
    id: "quick_analysis",
    name: "快速分析",
    description: "快速获取图谱概览和基本建议",
    systemPrompt: `你是知识图谱快速分析助手。

请快速分析用户的知识图谱，提供简洁的概览和基本建议。

## 分析要求
1. 使用 get_graph_overview 工具获取图谱概览
2. 输出简洁明了的分析报告（不超过 500 字）
3. 如发现明显问题，给出 2-3 条核心建议

## 输出格式
用简洁的 Markdown 格式输出：
- **总体概览**：一句话总结
- **关键发现**：2-3 个要点
- **建议**：2-3 条核心建议`,
    userPromptTemplate: "请快速分析我的知识图谱",
    tools: ["get_graph_overview"],
    maxIterations: 5,
  },
  {
    id: "deep_analysis",
    name: "深度分析",
    description: "深入分析图谱结构和关系",
    systemPrompt: `你是知识图谱深度分析专家。

请深入分析用户的知识图谱，提供全面详细的分析报告。

## 分析维度
1. **知识完整性** - 评估知识体系的完整性和覆盖范围
2. **关系发现** - 发现潜在的图谱关联和知识关系
3. **孤岛检测** - 发现没有关联的孤立图谱
4. **跨领域发现** - 发现跨学科知识交叉点
5. **学习路径** - 规划最优学习顺序

## 分析策略
1. 首先使用 get_graph_overview 获取全局概览
2. 根据初步结果，选择合适的工具进行深入分析
3. 对重点图谱进行结构分析
4. 综合所有信息生成详细报告

## 输出格式要求
1. 用 Markdown 格式输出详细分析报告
2. 包含数据支撑和具体分析
3. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出推荐列表：
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
    userPromptTemplate: "请深入分析我的知识图谱，提供全面的分析报告",
    tools: [
      "get_graph_overview",
      "get_graph_details",
      "get_graph_nodes",
      "get_graph_relations",
      "get_isolated_graphs",
      "get_domain_distribution",
      "get_knowledge_coverage",
      "get_similar_graphs",
      "analyze_graph_structure",
      "search_graphs",
    ],
    maxIterations: 20,
  },
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
  {
    id: "auto_fix_islands",
    name: "自动修复知识孤岛",
    description: "检测孤立的知识图谱，并自动提议创建关联关系来消除孤岛",
    systemPrompt: `你是知识图谱修复助手，专门负责检测和修复知识孤岛。

请按以下步骤操作：
1. 使用 get_isolated_graphs 工具检测所有孤立的图谱
2. 对每个孤岛图谱，使用 get_similar_graphs 发现相似图谱
3. 使用 create_graph_relation 工具为孤岛图谱提议创建关联关系
4. 所有创建关系的操作需要用户确认后才会执行

重要规则：
1. 只在确实存在语义关联时才提议创建关系
2. 每个关系的 context 字段要清晰说明为什么建立这个关联
3. 如果找不到合适的关联目标，不要强行创建关系
4. 关系类型选择：prerequisite（前置依赖）、extension（扩展）、related（相关）、cross_domain（跨领域）

输出格式：
用 Markdown 格式输出修复报告，包括：
- 检测到的孤岛图谱列表
- 提议创建的关联关系及理由
- 无法修复的孤岛及建议`,
    userPromptTemplate: "请检测我的知识图谱中的孤岛，并自动提议修复方案",
    tools: [
      "get_isolated_graphs",
      "get_similar_graphs",
      "get_graph_overview",
      "get_graph_details",
      "create_graph_relation",
    ],
    maxIterations: 15,
    allowWrite: true,
  },
  {
    id: "auto_expand_knowledge",
    name: "自动扩展知识",
    description: "分析图谱结构，识别可扩展的知识点，并提议创建新节点和关系",
    systemPrompt: `你是知识扩展助手，负责帮助用户扩展知识图谱。

请按以下步骤操作：
1. 使用 analyze_graph_structure 分析图谱结构特征
2. 识别叶子节点（没有下游关系的知识点）和可扩展方向
3. 使用 create_node 工具提议创建新的知识点节点
4. 使用 create_edge 工具提议创建新的知识关系
5. 所有创建操作需要用户确认后才会执行

扩展策略：
1. 对叶子节点：考虑添加更细分的子知识点
2. 对缺少前置关系的节点：考虑添加前置知识节点
3. 对缺少关联的节点：考虑添加跨领域关联

重要规则：
1. 新节点的标题和内容要具体、有价值
2. 新关系要选择正确的 relationship_type
3. 不要过度扩展，每次建议不超过 5 个新节点
4. 确保新节点与现有知识体系有合理的逻辑关系

输出格式：
用 Markdown 格式输出扩展报告，包括：
- 当前图谱结构分析
- 提议新增的知识点及理由
- 提议新增的关系及理由`,
    userPromptTemplate: "请分析我的知识图谱，提议扩展方案",
    tools: [
      "analyze_graph_structure",
      "get_graph_details",
      "get_graph_nodes",
      "get_node_relations",
      "create_node",
      "create_edge",
    ],
    maxIterations: 15,
    allowWrite: true,
  },
];
