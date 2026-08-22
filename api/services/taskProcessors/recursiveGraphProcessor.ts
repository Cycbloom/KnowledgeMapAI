import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import { getAIProviderForTask } from "../ai/factory";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getAutoGraphPrompt } from "./utils";
import { performanceMonitor, enrichMetadata } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";
import { graphLockService } from "../common/graphLockService";
import { notDeleted } from '../common/softDeleteHelper';

interface RecursiveGraphPayload {
  graph_id: string;
  topic: string;
  depth?: number;
  style?: string;
  batchSessionId?: string;
  [key: string]: unknown;
}

interface CoreNodeRef {
  title: string;
  content?: string;
  [key: string]: unknown;
}

export class RecursiveGraphProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: RecursiveGraphPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(
      `Starting recursive graph generation task ${taskId} for user ${userId}`,
      { payload },
    );

    const sessionId = payload.batchSessionId || crypto.randomUUID();

    try {
      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "init",
          progress: 0,
        },
        undefined,
        undefined,
        userId,
      );

      const { graph_id, topic, depth = 3, style = "academic" } = payload;

      logger.info(
        `Processing graph ${graph_id} with topic "${topic}", depth ${depth}, style ${style}`,
      );

      let lockAcquired = false;
      const maxRetries = 30;
      const retryDelay = 2000;

      for (let i = 0; i < maxRetries; i++) {
        lockAcquired = await graphLockService.acquireLock(graph_id, taskId);
        if (lockAcquired) break;

        const lockInfo = graphLockService.getLockInfo(graph_id);
        logger.info(
          `[GraphLockService] Waiting for lock on graph ${graph_id} (attempt ${i + 1}/${maxRetries}), locked by task ${lockInfo?.taskId}`,
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      if (!lockAcquired) {
        throw new AppError(
          `Failed to acquire lock for graph ${graph_id} after ${maxRetries} attempts`,
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }

      const { data: graph } = await supabase
        .from("knowledge_graphs")
        .select("id, title")
        .eq("id", graph_id)
        .single();

      if (!graph) {
        throw new AppError("Graph not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        throw new AppError("AI provider not configured", 503, ErrorCodes.AI_SERVICE_UNAVAILABLE);
      }

      let totalNodes = 0;
      let totalEdges = 0;
      const nodeMap = new Map<string, string>();

      const { data: existingNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select("knowledge_points(title)")
        .eq("graph_id", graph_id)
        );

      const existingNodeTitles = new Set<string>();
      if (existingNodes) {
        for (const node of existingNodes) {
          if (node.knowledge_points) {
            const kp = Array.isArray(node.knowledge_points)
              ? node.knowledge_points[0]
              : node.knowledge_points;
            if (kp && kp.title) {
              existingNodeTitles.add(kp.title);
            }
          }
        }
      }

      const systemPrompt = await getAutoGraphPrompt(
        supabase,
        userId,
        graph_id,
        "init",
        {
          topic,
          isAcademic: style === "academic",
          hasSources: false,
          isInit: true,
        },
      );

      const enrichedMetadata = await enrichMetadata(supabase, {
        graphId: graph_id,
        userId,
        topic,
        style,
        depth,
      });

      const initStartTime = Date.now();
      const initCompletion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `主题：${topic}\n\n请生成知识图谱的根节点和核心节点。`,
          },
        ],
        model: provider.model,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });
      const initDuration = Date.now() - initStartTime;

      const initUsage = initCompletion.usage;
      if (initUsage) {
        const cost = pricingService.calculateCost(
          provider.providerType,
          provider.model,
          initUsage.prompt_tokens,
          initUsage.completion_tokens,
          0,
        );
        await performanceMonitor.recordLog({
          operation: "recursive_graph_init",
          provider: provider.providerType,
          model: provider.model,
          inputTokens: initUsage.prompt_tokens,
          outputTokens: initUsage.completion_tokens,
          totalTokens: initUsage.prompt_tokens + initUsage.completion_tokens,
          cachedInputTokens: 0,
          duration: initDuration,
          success: true,
          estimatedCost: cost,
          metadata: enrichedMetadata,
          sessionId,
        });
      }

      const initParsed = JSON.parse(
        initCompletion.choices[0].message.content ||
          '{"root": null, "coreNodes": []}',
      );

      const coreNodes: CoreNodeRef[] = initParsed.coreNodes || [];
      // 复杂度降低：预构建核心节点标题 Set，替代下方 filter 内对每条 nodeMap 项 O(n) 的 coreNodes.some() 扫描
      const coreNodeTitleSet = new Set(coreNodes.map((c) => c.title));
      const rootData = initParsed.root || {
        title: topic,
        content: `${topic}的核心概念`,
      };

      const rootNodeResult = await createKnowledgePointWithGraphNode(
        supabase,
        userId,
        {
          graph_id,
          title: rootData.title,
          content: rootData.content || "",
          level: "root",
          x_position: 400,
          y_position: 300,
        },
      );

      if (rootNodeResult) {
        nodeMap.set(rootData.title, rootNodeResult.id);
        totalNodes++;

        for (const coreNode of coreNodes) {
          if (existingNodeTitles.has(coreNode.title)) {
            logger.info(
              `[GraphTaskService] Skipping duplicate node: ${coreNode.title}, parent: ${rootData.title}`,
            );
            continue;
          }

          const childNodeResult = await createKnowledgePointWithGraphNode(
            supabase,
            userId,
            {
              graph_id,
              title: coreNode.title,
              content: coreNode.content || "",
              level: "core",
              x_position: 200 + Math.random() * 400,
              y_position: 500 + Math.random() * 200,
            },
          );

          if (childNodeResult) {
            nodeMap.set(coreNode.title, childNodeResult.id);
            totalNodes++;
            existingNodeTitles.add(coreNode.title);

            await supabase.from("edges").insert({
              graph_id,
              source_knowledge_point_id: rootNodeResult.id,
              target_knowledge_point_id: childNodeResult.id,
              relationship_type: "contains",
            });
            totalEdges++;
          }
        }
      }

      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "init_complete",
          progress: 30,
          totalNodes,
        },
        undefined,
        undefined,
        userId,
      );

      if (depth >= 2) {
        const coreNodeEntries = Array.from(nodeMap.entries()).filter(
          ([title]) => title !== rootData.title,
        );
        logger.info(
          `Starting depth 2 expansion for ${coreNodeEntries.length} core nodes`,
        );

        for (let i = 0; i < coreNodeEntries.length; i++) {
          control.throwIfAborted();
          const [nodeTitle, nodeId] = coreNodeEntries[i];

          logger.debug(
            `Expanding core node ${i + 1}/${coreNodeEntries.length}: ${nodeTitle}`,
          );
          await updateTaskStatus(
            supabase,
            taskId,
            "in_progress",
            {
              stage: "expanding",
              progress: 30 + Math.round((i / coreNodeEntries.length) * 40),
              currentNode: nodeTitle,
            },
            undefined,
            undefined,
            userId,
          );

          try {
            const expandPrompt = await getAutoGraphPrompt(
              supabase,
              userId,
              graph_id,
              "expand",
              {
                nodeTitle,
                nodeContent: "",
                nodeLevel: "core",
                isAcademic: style === "academic",
                hasExistingChildren: false,
                existingChildren: "",
              },
            );

            const expandStartTime = Date.now();
            const expandCompletion =
              await provider.client.chat.completions.create({
                messages: [
                  { role: "system", content: expandPrompt },
                  { role: "user", content: `请为「${nodeTitle}」生成子节点。` },
                ],
                model: provider.model,
                response_format: { type: "json_object" },
                max_tokens: 3000,
              });
            const expandDuration = Date.now() - expandStartTime;

            const expandUsage = expandCompletion.usage;
            if (expandUsage) {
              const cost = pricingService.calculateCost(
                provider.providerType,
                provider.model,
                expandUsage.prompt_tokens,
                expandUsage.completion_tokens,
                0,
              );
              await performanceMonitor.recordLog({
                operation: "recursive_graph_expand_depth2",
                provider: provider.providerType,
                model: provider.model,
                inputTokens: expandUsage.prompt_tokens,
                outputTokens: expandUsage.completion_tokens,
                totalTokens:
                  expandUsage.prompt_tokens + expandUsage.completion_tokens,
                cachedInputTokens: 0,
                duration: expandDuration,
                success: true,
                estimatedCost: cost,
                metadata: {
                  ...enrichedMetadata,
                  nodeTitle,
                  nodeId,
                  nodeLevel: "core",
                },
                sessionId,
              });
            }

            const expandParsed = JSON.parse(
              expandCompletion.choices[0].message.content || '{"children": []}',
            );
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 5)) {
              if (existingNodeTitles.has(child.title)) {
                logger.info(
                  `[GraphTaskService] Skipping duplicate node: ${child.title}, parent: ${nodeTitle}`,
                );
                continue;
              }

              const subNodeResult = await createKnowledgePointWithGraphNode(
                supabase,
                userId,
                {
                  graph_id,
                  title: child.title,
                  content: child.content || "",
                  level: "sub",
                  x_position: 100 + Math.random() * 600,
                  y_position: 700 + Math.random() * 200,
                },
              );

              if (subNodeResult) {
                nodeMap.set(child.title, subNodeResult.id);
                totalNodes++;
                existingNodeTitles.add(child.title);

                await supabase.from("edges").insert({
                  graph_id,
                  source_knowledge_point_id: nodeId,
                  target_knowledge_point_id: subNodeResult.id,
                  relationship_type: "contains",
                });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand node ${nodeTitle}:`, expandError);
          }
        }
      }

      if (depth >= 3) {
        logger.info(`Starting depth 3 expansion for sub-nodes`);
        const subNodeEntries = Array.from(nodeMap.entries()).filter(
          ([title]) => {
            return (
              title !== rootData.title &&
              !coreNodeTitleSet.has(title)
            );
          },
        );

        for (let i = 0; i < Math.min(subNodeEntries.length, 10); i++) {
          control.throwIfAborted();
          const [nodeTitle, nodeId] = subNodeEntries[i];

          logger.debug(
            `Expanding sub-node ${i + 1}/${Math.min(subNodeEntries.length, 10)}: ${nodeTitle}`,
          );
          await updateTaskStatus(
            supabase,
            taskId,
            "in_progress",
            {
              stage: "deep_expanding",
              progress:
                70 + Math.round((i / Math.min(subNodeEntries.length, 10)) * 25),
              currentNode: nodeTitle,
            },
            undefined,
            undefined,
            userId,
          );

          try {
            const expandPrompt = await getAutoGraphPrompt(
              supabase,
              userId,
              graph_id,
              "expand",
              {
                nodeTitle,
                nodeContent: "",
                nodeLevel: "sub",
                isAcademic: style === "academic",
                hasExistingChildren: false,
                existingChildren: "",
              },
            );

            const expandStartTime = Date.now();
            const expandCompletion =
              await provider.client.chat.completions.create({
                messages: [
                  { role: "system", content: expandPrompt },
                  { role: "user", content: `请为「${nodeTitle}」生成子节点。` },
                ],
                model: provider.model,
                response_format: { type: "json_object" },
                max_tokens: 2000,
              });
            const expandDuration = Date.now() - expandStartTime;

            const expandUsage = expandCompletion.usage;
            if (expandUsage) {
              const cost = pricingService.calculateCost(
                provider.providerType,
                provider.model,
                expandUsage.prompt_tokens,
                expandUsage.completion_tokens,
                0,
              );
              await performanceMonitor.recordLog({
                operation: "recursive_graph_expand_depth3",
                provider: provider.providerType,
                model: provider.model,
                inputTokens: expandUsage.prompt_tokens,
                outputTokens: expandUsage.completion_tokens,
                totalTokens:
                  expandUsage.prompt_tokens + expandUsage.completion_tokens,
                cachedInputTokens: 0,
                duration: expandDuration,
                success: true,
                estimatedCost: cost,
                metadata: {
                  ...enrichedMetadata,
                  nodeTitle,
                  nodeId,
                  nodeLevel: "sub",
                },
                sessionId,
              });
            }

            const expandParsed = JSON.parse(
              expandCompletion.choices[0].message.content || '{"children": []}',
            );
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 3)) {
              if (existingNodeTitles.has(child.title)) {
                logger.info(
                  `[GraphTaskService] Skipping duplicate node: ${child.title}, parent: ${nodeTitle}`,
                );
                continue;
              }

              const leafNodeResult = await createKnowledgePointWithGraphNode(
                supabase,
                userId,
                {
                  graph_id,
                  title: child.title,
                  content: child.content || "",
                  level: "leaf",
                  x_position: 50 + Math.random() * 700,
                  y_position: 900 + Math.random() * 200,
                },
              );

              if (leafNodeResult) {
                totalNodes++;
                existingNodeTitles.add(child.title);

                await supabase.from("edges").insert({
                  graph_id,
                  source_knowledge_point_id: nodeId,
                  target_knowledge_point_id: leafNodeResult.id,
                  relationship_type: "contains",
                });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand sub-node ${nodeTitle}:`, expandError);
          }
        }
      }

      logger.info(
        `Graph generation completed for graph ${graph_id}: ${totalNodes} nodes, ${totalEdges} edges`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        {
          success: true,
          totalNodes,
          totalEdges,
          graphId: graph_id,
        },
        undefined,
        undefined,
        userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Recursive graph generation task ${taskId} ${error.reason}`);
        await updateTaskStatus(
          supabase,
          taskId,
          error.reason,
          undefined,
          undefined,
          undefined,
          userId,
        );
        return;
      }
      logger.error(
        `Recursive graph generation failed for task ${taskId}:`,
        error,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "failed",
        null,
        undefined,
        error instanceof Error ? error.message : String(error),
        userId,
      );
    } finally {
      const { graph_id } = payload;
      if (graph_id) {
        graphLockService.releaseLock(graph_id, taskId);
      }
    }
  }
}

registerProcessor("recursive_graph_generation", new RecursiveGraphProcessor());
