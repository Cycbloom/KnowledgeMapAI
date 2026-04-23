import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
} from "./index";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { domainContextService } from "../ai/domainContextService";
import { logger } from "../../utils/logger";
import { generateNodesForGraph } from "./utils";
import { checkDuplicateGraphTopic } from "../../utils/similaritySearch";
import { aiService } from "../ai/index";
import { performanceMonitor, enrichMetadata } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";

interface GraphDomainInfo {
  domainId: string;
  domainName: string;
  parentId: string | null;
  parentName: string | null;
}

async function getGraphDomainInfo(
  supabase: SupabaseClient,
  graphId: string,
): Promise<GraphDomainInfo | null> {
  const { data: graphDomains, error } = await supabase
    .from("graph_domains")
    .select(
      `
      domain_id,
      is_primary,
      domains(
        id,
        name,
        parent_id
      )
    `,
    )
    .eq("graph_id", graphId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error || !graphDomains) {
    return null;
  }

  const domain = Array.isArray(graphDomains.domains)
    ? graphDomains.domains[0]
    : graphDomains.domains;

  if (!domain) {
    return null;
  }

  let parentName: string | null = null;
  if (domain.parent_id) {
    const { data: parentDomain } = await supabase
      .from("domains")
      .select("name")
      .eq("id", domain.parent_id)
      .maybeSingle();
    parentName = parentDomain?.name || null;
  }

  return {
    domainId: domain.id,
    domainName: domain.name,
    parentId: domain.parent_id,
    parentName,
  };
}

export class InfiniteExpansionProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: any,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
  ): Promise<void> {
    logger.info(
      `Starting infinite graph expansion task ${taskId} for user ${userId}`,
      { payload },
    );

    try {
      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "init",
          progress: 0,
          current_node: "初始化无限扩展任务...",
          current_depth: 0,
          total_graphs_created: 0,
          total_nodes_created: 0,
          created_graphs: [],
        },
        undefined,
        undefined,
        userId,
      );

      const {
        source_graph_id,
        source_graph_title,
        source_graph_description,
        max_depth = 2,
        max_graphs_per_level = 3,
        relation_types = ["prerequisite", "extension", "related"],
        auto_generate_nodes = true,
        node_depth = 2,
      } = payload;

      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        throw new Error("AI provider not configured");
      }

      let totalGraphsCreated = 0;
      let totalNodesCreated = 0;
      const createdGraphs: Array<{
        id: string;
        title: string;
        relation_type: string;
        depth: number;
        node_count: number;
      }> = [];

      const processedGraphs = new Set<string>();
      const queue: Array<{
        graphId: string;
        graphTitle: string;
        depth: number;
      }> = [
        { graphId: source_graph_id, graphTitle: source_graph_title, depth: 0 },
      ];

      const estimatedTotal = Math.pow(
        max_graphs_per_level * relation_types.length,
        max_depth,
      );
      let processedCount = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (
          processedGraphs.has(current.graphId) ||
          current.depth >= max_depth
        ) {
          continue;
        }
        processedGraphs.add(current.graphId);
        processedCount++;

        const progress = Math.min(
          95,
          Math.round((processedCount / Math.max(1, estimatedTotal)) * 100),
        );

        await updateTaskStatus(
          supabase,
          taskId,
          "in_progress",
          {
            stage: "expanding",
            progress,
            current_node: `正在分析「${current.graphTitle}」`,
            current_depth: current.depth + 1,
            max_depth,
            current_graph_title: current.graphTitle,
            total_graphs_created: totalGraphsCreated,
            total_nodes_created: totalNodesCreated,
            created_graphs: createdGraphs,
          },
          undefined,
          undefined,
          userId,
        );

        const currentDomainInfo = await getGraphDomainInfo(
          supabase,
          current.graphId,
        );

        let domainContext = "";
        if (currentDomainInfo) {
          try {
            domainContext = await domainContextService.getDomainContext(
              supabase,
              currentDomainInfo.domainId,
              userId,
            );
          } catch (e) {
            logger.warn("Failed to get domain context:", e);
          }
        }

        const systemPrompt = await promptService.getRenderedPrompt(
          supabase,
          "infinite_graph_expansion",
          {
            domainTitle: current.graphTitle,
            domainDescription: source_graph_description,
            maxGraphsPerLevel: max_graphs_per_level,
            domainContext: domainContext || undefined,
            parentDomainName: currentDomainInfo?.parentName || undefined,
          },
          userId,
        );

        const enrichedMetadata = await enrichMetadata(supabase, {
          graphId: current.graphId,
          userId,
          topic: current.graphTitle,
          depth: current.depth,
        });

        const startTime = Date.now();
        const completion = await provider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `请分析这个知识领域，找出与之相关的其他独立知识领域。`,
            },
          ],
          model: provider.model,
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });
        const duration = Date.now() - startTime;

        const usage = completion.usage;
        if (usage) {
          const cost = pricingService.calculateCost(
            provider.providerType,
            provider.model,
            usage.prompt_tokens,
            usage.completion_tokens,
            0
          );
          await performanceMonitor.recordLog({
            operation: 'infinite_graph_expansion',
            provider: provider.providerType,
            model: provider.model,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.prompt_tokens + usage.completion_tokens,
            cachedInputTokens: 0,
            duration,
            success: true,
            estimatedCost: cost,
            metadata: enrichedMetadata,
          });
        }

        const parsed = JSON.parse(
          completion.choices[0].message.content ||
            '{"prerequisite":[],"extension":[],"related":[]}',
        );

        for (const relationType of relation_types) {
          const suggestions = parsed[relationType] || [];

          for (const suggestion of suggestions.slice(0, max_graphs_per_level)) {
            const duplicateCheck = await checkDuplicateGraphTopic(
              supabase,
              userId,
              suggestion.title,
              { threshold: 0.85 },
            );

            let targetGraphId: string | undefined;

            if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
              targetGraphId = duplicateCheck.similarGraphs[0].id;
              logger.info(
                `Reusing existing graph "${duplicateCheck.similarGraphs[0].title}" (similarity: ${(duplicateCheck.similarGraphs[0].similarity * 100).toFixed(1)}%) for suggested topic "${suggestion.title}"`,
              );
            } else {
              let embedding: number[] | null = null;
              try {
                embedding = duplicateCheck.embedding ?? null;
                if (!embedding) {
                  embedding = await aiService.generateEmbedding(
                    suggestion.title,
                  );
                }
              } catch (e) {
                logger.warn("Failed to generate embedding for new graph:", e);
                embedding = null;
              }

              const { data: newGraph } = await supabase
                .from("knowledge_graphs")
                .insert({
                  user_id: userId,
                  title: suggestion.title,
                  description: suggestion.description || "",
                  domain: currentDomainInfo?.domainName || null,
                  embedding: embedding ?? undefined,
                })
                .select("id")
                .single();

              if (newGraph) {
                targetGraphId = newGraph.id;
                totalGraphsCreated++;

                if (currentDomainInfo) {
                  const { error: domainError } = await supabase
                    .from("graph_domains")
                    .insert({
                      graph_id: newGraph.id,
                      domain_id: currentDomainInfo.domainId,
                      is_primary: true,
                    });

                  if (domainError) {
                    logger.warn("Failed to create graph_domains association:", {
                      graphId: newGraph.id,
                      domainId: currentDomainInfo.domainId,
                      error: domainError.message,
                    });
                  }
                }

                if (auto_generate_nodes && targetGraphId) {
                  await updateTaskStatus(
                    supabase,
                    taskId,
                    "in_progress",
                    {
                      stage: "generating_nodes",
                      progress: Math.min(95, progress + 2),
                      current_node: `为「${suggestion.title}」生成知识点...`,
                      current_depth: current.depth + 1,
                      max_depth,
                      total_graphs_created: totalGraphsCreated,
                      total_nodes_created: totalNodesCreated,
                      created_graphs: createdGraphs,
                    },
                    undefined,
                    undefined,
                    userId,
                  );

                  const nodeCount = await generateNodesForGraph(
                    supabase,
                    targetGraphId,
                    suggestion.title,
                    suggestion.description,
                    node_depth,
                    provider,
                    userId,
                  );
                  totalNodesCreated += nodeCount;

                  createdGraphs.push({
                    id: targetGraphId,
                    title: suggestion.title,
                    relation_type: relationType,
                    depth: current.depth + 1,
                    node_count: nodeCount,
                  });
                } else if (targetGraphId) {
                  createdGraphs.push({
                    id: targetGraphId,
                    title: suggestion.title,
                    relation_type: relationType,
                    depth: current.depth + 1,
                    node_count: 0,
                  });
                }

                if (targetGraphId) {
                  queue.push({
                    graphId: targetGraphId,
                    graphTitle: suggestion.title,
                    depth: current.depth + 1,
                  });
                }
              }
            }

            if (targetGraphId) {
              let sourceId = current.graphId;
              let targetId = targetGraphId;

              if (relationType === "prerequisite") {
                sourceId = targetGraphId;
                targetId = current.graphId;
              }

              const { data: existingRelation } = await supabase
                .from("graph_relations")
                .select("id")
                .eq("source_graph_id", sourceId)
                .eq("target_graph_id", targetId)
                .eq("relation_type", relationType)
                .maybeSingle();

              if (!existingRelation) {
                await supabase.from("graph_relations").insert({
                  source_graph_id: sourceId,
                  target_graph_id: targetId,
                  relation_type: relationType,
                  context: suggestion.reason,
                });
              }
            }
          }
        }
      }

      logger.info(
        `Infinite expansion completed: ${totalGraphsCreated} graphs, ${totalNodesCreated} nodes`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        {
          success: true,
          progress: 100,
          current_node: "扩展完成",
          total_graphs_created: totalGraphsCreated,
          total_nodes_created: totalNodesCreated,
          created_graphs: createdGraphs,
          source_graph_id,
          source_graph_title,
        },
        undefined,
        undefined,
        userId,
      );
    } catch (error: any) {
      logger.error(
        `Infinite graph expansion failed for task ${taskId}:`,
        error,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "failed",
        null,
        undefined,
        error.message,
        userId,
      );
    }
  }
}

registerProcessor("infinite_graph_expansion", new InfiniteExpansionProcessor());
