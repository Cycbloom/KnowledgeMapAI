import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import { getAIProviderForTask } from "../ai/factory";
import { createNodeWithCrossGraphReuse } from "./utils";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import {
  generateChildSuggestions,
  generateGraphSkeleton,
} from "../ai/nodeSuggestionService";
import { graphLockService } from "../common/graphLockService";
import { graphTaskService } from "../scheduler/graphTaskService";
import { cacheService, CacheKeys } from "../common/cacheService";
import {
  getGraphNodeTitleMap,
  canReuseNode,
} from "../graph/graphDuplicateService";
import {
  buildGraphMetaContext,
  buildGraphDisambiguationContext,
} from "../graph/graphDisambiguationContext";

interface RecursiveGraphPayload {
  graph_id: string;
  topic: string;
  depth?: number;
  style?: string;
  customPrompt?: string;
  sources?: string[];
  batchSessionId?: string;
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

      const { graph_id, topic, depth = 3, style = "academic", customPrompt, sources } = payload;

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
      // 本批次创建的节点（按创建顺序）。不用 title 做 key：
      // generic 同名节点会新建多个，title→id 的 Map 会被后创建的覆盖，导致部分节点无法作为父节点被深度展开。
      const createdNodes: Array<{ id: string; title: string; level: string }> = [];

      // 图内已有节点（title → {kpId, specificity}）：
      // 复用判定仅当双方均为 specific（精确专名）才成立，泛化名称（generic）
      // 即使同名也新建独立节点，避免「项目现状」「未来展望」等跨上下文语义串味。
      const existingNodeTitles = await getGraphNodeTitleMap(supabase, graph_id);

      // 骨架生成发生在已有图谱上：注入图谱级上下文，让 AI 按当前图谱主题生成 root/core
      const graphMeta = await buildGraphMetaContext(supabase, graph_id);

      const { root: rootData, coreNodes, description } = await generateGraphSkeleton(
        supabase,
        {
          topic,
          style: style as "academic" | "practical" | "beginner" | "custom",
          customPrompt,
          sources,
          provider,
          userId,
          graphId: graph_id,
          sessionId,
          disambiguation: graphMeta,
        },
      );

      // 深度拓展时，将 AI 生成的详细图谱描述回写至图谱记录（与 AI 制图 initGraph 行为一致），
      // 使图谱介绍更丰富；语言跟随模型输出的 {{outputLanguage}}。
      const graphDescription =
        typeof description === "string" && description.trim()
          ? description.trim()
          : undefined;
      if (graphDescription) {
        const { error: descErr } = await supabase
          .from("knowledge_graphs")
          .update({ description: graphDescription })
          .eq("id", graph_id);
        if (descErr) {
          logger.warn("Failed to update graph description after deep expand", descErr);
        } else {
          // 描述已变更，主动失效用户图谱列表与图谱地图缓存，确保前端拉到最新描述
          cacheService.del([
            CacheKeys.USER_GRAPHS(userId),
            CacheKeys.GRAPH_MAP(userId),
          ]);
        }
      }

      const rootNodeResult = await createNodeWithCrossGraphReuse(
        supabase,
        userId,
        graph_id,
        {
          title: rootData.title,
          content: rootData.content || "",
          level: "root",
          x_position: 400,
          y_position: 300,
          specificity: rootData.specificity,
        },
      );

      if (rootNodeResult) {
        createdNodes.push({
          id: rootNodeResult.id,
          title: rootData.title,
          level: "root",
        });
        totalNodes++;

        for (const coreNode of coreNodes) {
          const existing = existingNodeTitles.get(coreNode.title);
          if (existing && canReuseNode(coreNode.specificity, existing.specificity)) {
            logger.info(
              `[GraphTaskService] Skipping duplicate node: ${coreNode.title}, parent: ${rootData.title}`,
            );
            continue;
          }

          const childNodeResult = await createNodeWithCrossGraphReuse(
            supabase,
            userId,
            graph_id,
            {
              title: coreNode.title,
              content: coreNode.content || "",
              level: "core",
              x_position: 200 + Math.random() * 400,
              y_position: 500 + Math.random() * 200,
              specificity: coreNode.specificity,
            },
          );

          if (childNodeResult) {
            createdNodes.push({
              id: childNodeResult.id,
              title: coreNode.title,
              level: "core",
            });
            totalNodes++;
            existingNodeTitles.set(coreNode.title, {
              knowledgePointId: childNodeResult.id,
              specificity: coreNode.specificity,
            });

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
        const coreNodeEntries = createdNodes.filter((n) => n.level === "core");
        logger.info(
          `Starting depth 2 expansion for ${coreNodeEntries.length} core nodes`,
        );

        for (let i = 0; i < coreNodeEntries.length; i++) {
          control.throwIfAborted();
          const { title: nodeTitle, id: nodeId } = coreNodeEntries[i];

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
            const disambiguation = await buildGraphDisambiguationContext(
              supabase,
              graph_id,
              nodeId,
            );
            const { children } = await generateChildSuggestions(supabase, {
              nodeTitle,
              nodeContent: "",
              nodeLevel: "core",
              style: style as "academic" | "practical" | "beginner" | "custom",
              customPrompt,
              provider,
              userId,
              graphId: graph_id,
              sessionId,
              disambiguation,
            });

            for (const child of children.slice(0, 5)) {
              const existing = existingNodeTitles.get(child.title);
              if (existing && canReuseNode(child.specificity, existing.specificity)) {
                logger.info(
                  `[GraphTaskService] Skipping duplicate node: ${child.title}, parent: ${nodeTitle}`,
                );
                continue;
              }

              const subNodeResult = await createNodeWithCrossGraphReuse(
                supabase,
                userId,
                graph_id,
                {
                  title: child.title,
                  content: child.content || "",
                  level: "sub",
                  x_position: 100 + Math.random() * 600,
                  y_position: 700 + Math.random() * 200,
                  specificity: child.specificity,
                },
              );

              if (subNodeResult) {
                createdNodes.push({
                  id: subNodeResult.id,
                  title: child.title,
                  level: "sub",
                });
                totalNodes++;
                existingNodeTitles.set(child.title, {
                  knowledgePointId: subNodeResult.id,
                  specificity: child.specificity,
                });

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
        const subNodeEntries = createdNodes.filter((n) => n.level === "sub");

        for (let i = 0; i < Math.min(subNodeEntries.length, 10); i++) {
          control.throwIfAborted();
          const { title: nodeTitle, id: nodeId } = subNodeEntries[i];

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
            const disambiguation = await buildGraphDisambiguationContext(
              supabase,
              graph_id,
              nodeId,
            );
            const { children } = await generateChildSuggestions(supabase, {
              nodeTitle,
              nodeContent: "",
              nodeLevel: "sub",
              style: style as "academic" | "practical" | "beginner" | "custom",
              customPrompt,
              provider,
              userId,
              graphId: graph_id,
              sessionId,
              disambiguation,
            });

            for (const child of children.slice(0, 3)) {
              const existing = existingNodeTitles.get(child.title);
              if (existing && canReuseNode(child.specificity, existing.specificity)) {
                logger.info(
                  `[GraphTaskService] Skipping duplicate node: ${child.title}, parent: ${nodeTitle}`,
                );
                continue;
              }

              const leafNodeResult = await createNodeWithCrossGraphReuse(
                supabase,
                userId,
                graph_id,
                {
                  title: child.title,
                  content: child.content || "",
                  level: "leaf",
                  x_position: 50 + Math.random() * 700,
                  y_position: 900 + Math.random() * 200,
                  specificity: child.specificity,
                },
              );

              if (leafNodeResult) {
                totalNodes++;
                existingNodeTitles.set(child.title, {
                  knowledgePointId: leafNodeResult.id,
                  specificity: child.specificity,
                });

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

      // 深度拓展新建了知识点 → 同步图谱大任务：为每个新知识点补建子任务并重算大任务进度。
      // 本处理器经 createNodeWithCrossGraphReuse 直建节点，不触发 node_created 事件，
      // 需显式同步（与 ExpandGraphProcessor 一致），否则学习任务缺少新节点的子任务。
      if (graph_id) {
        try {
          await graphTaskService.syncTaskWithGraphChanges(supabase, graph_id);
        } catch (err) {
          logger.warn(
            "[RecursiveGraphProcessor] sync task after expansion failed",
            {
              graphId: graph_id,
              error: err instanceof Error ? err.message : String(err),
            },
          );
        }
      }

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
