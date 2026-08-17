import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProviderClient } from "@shared/types/ai";
import type { Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "@shared/types/errorCodes";
import { ToolRegistry } from "./ToolRegistry";
import { SessionManager } from "./SessionManager";
import type {
  AgentSession,
  CreateSessionOptions,
  ExecuteResult,
  ToolContext,
  SkillDefinition,
  AgentTool,
  AnalysisGoal,
  PendingAction,
} from "./types";
import { getAIProviderForTask } from "../ai/factory";
import { logger } from "../../utils/logger";
import { allTools } from "./tools";
import { getStrategyForGoal } from "./strategies/ToolSelectionStrategy";
import { indexMappingService } from "../indexMapping/IndexMappingService";
import { SKILLS } from "./skills";
import {
  parseStructuredResult,
  generateAnalysisSummary,
  needsSecondaryAnalysis,
  identifyDepthTargets,
} from "./utils/analysisUtils";
import { SSEWriter } from "./SSEWriter";

// 重新导出 SKILLS 以保持对外 API 不变（index.ts 仍从本模块导出）
export { SKILLS };

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
    const sseWriter = new SSEWriter(res);
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      sseWriter.send({
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

    const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: unknown }> = [
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

    // 预构建 Set，替代 filter 内 skill.tools.includes(t.name) 的 O(tools*skillTools) 扫描
    const filteredTools = skill?.tools
      ? (() => {
          const skillToolSet = new Set(skill.tools);
          return allToolsDefinitions.filter((t) => skillToolSet.has(t.name));
        })()
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
    const sseWriter = new SSEWriter(res);
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      sseWriter.send({
        type: "session_failed",
        data: { error: "Session not found" },
      });
      res.end();
      return;
    }

    if (session.status !== "running") {
      sseWriter.send({
        type: "session_failed",
        data: {
          error: `Session is in ${session.status} state, expected running`,
        },
      });
      res.end();
      return;
    }

    // Rebuild LLM context from session messages
    const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: unknown }> = [];

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
    // 预构建 Set，替代 filter 内 skill.tools.includes(t.name) 的 O(tools*skillTools) 扫描
    const filteredTools = skill?.tools
      ? (() => {
          const skillToolSet = new Set(skill.tools);
          return allToolsDefinitions.filter((t) => skillToolSet.has(t.name));
        })()
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
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: unknown }>,
    context: ToolContext,
    _skill: SkillDefinition | null,
    aiProvider: { client: AIProviderClient; model: string },
    filteredTools: ReturnType<ToolRegistry["getToolDefinitions"]>,
    res: Response,
    maxIterations: number,
  ): Promise<void> {
    const sseWriter = new SSEWriter(res);
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      sseWriter.send({
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

            sseWriter.send({
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

              sseWriter.send({
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
            sseWriter.send({
              type: "awaiting_confirmation",
              data: { pendingActions },
            });
            // Do not close SSE stream - it will be reused by resumeSession
            return;
          }
        } else if (response.message.content) {
          // Try to parse as structured result
          let finalContent = response.message.content;
          const directParsed = parseStructuredResult(finalContent);

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

          sseWriter.send({
            type: "agent_message",
            data: { content: finalContent },
          });
          break;
        }
      } catch (error) {
        const err = error as Error;
        logger.error("Agent execution error:", error);
        await this.sessionManager.update(sessionId, { status: "failed" });
        sseWriter.send({
          type: "session_failed",
          data: { error: err.message },
        });
        res.end();
        return;
      }
    }

    const structuredResult = parseStructuredResult(finalResult);

    await this.sessionManager.update(sessionId, {
      status: "completed",
      result: finalResult,
      structuredResult,
    });

    const finalSession = await this.sessionManager.get(sessionId);
    sseWriter.send({
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
      throw new AppError(`No strategy found for goal: ${goal}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new AppError("Session not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
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

      if (needsSecondaryAnalysis(primaryResults)) {
        await this.executeToolSet(
          sessionId,
          strategy.secondaryTools,
          userId,
          context,
        );
      }

      const depthTargets = identifyDepthTargets(primaryResults);
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
      throw new AppError(`Autonomous execution failed: ${err.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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
      throw new AppError("Session not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
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

  private async executeDepthAnalysis(
    sessionId: string,
    targetId: string,
    tools: string[],
    _userId: string,
    context: ToolContext,
  ): Promise<void> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new AppError("Session not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
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
      throw new AppError("Session not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const toolMessages = session.messages.filter((m) => m.role === "tool");
    const analysisSummary = generateAnalysisSummary(toolMessages);

    await this.sessionManager.update(sessionId, {
      status: "completed",
      result: analysisSummary,
    });

    const finalSession = await this.sessionManager.get(sessionId);
    if (!finalSession) {
      throw new AppError("Session not found after update", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    return { session: finalSession };
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

    // 单次批量查询剩余 pending 动作，替代逐 session 查询（O(n) 次 → 1 次）
    const { data: remainingRows } = await this.supabase
      .from("agent_pending_actions")
      .select("session_id")
      .eq("status", "pending")
      .in("session_id", affectedSessionIds);

    const sessionsWithRemaining = new Set(
      (remainingRows ?? []).map((r) => r.session_id as string),
    );

    for (const sessionId of affectedSessionIds) {
      if (!sessionsWithRemaining.has(sessionId)) {
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
