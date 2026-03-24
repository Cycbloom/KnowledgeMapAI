import { supabaseAdmin } from "../supabase.js";
import { taskService, Task } from "../services/taskService.js";
import { aiService } from "../services/ai/aiService.js";
import { getNextLevel } from "../utils/graphUtils.js";
import { cacheService, CacheKeys } from "../services/common/cacheService.js";
import { createKnowledgePointWithGraphNode } from "../utils/nodeHelpers.js";
import { logger } from "../utils/logger.js";

class TaskProcessor {
  public async processTask(task: Task) {
    console.log(`[TaskProcessor] Processing task ${task.id} (${task.type})`);

    try {
      // Update status to processing
      await taskService.updateTaskStatus(supabaseAdmin, task.id, "processing");

      let result;
      switch (task.type) {
        case "generate_questions":
          result = await this.handleGenerateQuestions(task);
          break;
        case "batch_generate_questions":
        case "recursive_graph_generation":
        case "infinite_graph_expansion":
        case "embedding_generation":
          await taskService.processTask(
            task.id,
            task.user_id,
            task.type,
            task.payload,
          );
          return;
        case "expand_graph":
          result = await this.handleExpandGraph(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Update status to completed
      await taskService.updateTaskStatus(
        supabaseAdmin,
        task.id,
        "completed",
        result,
      );
      console.log(`[TaskProcessor] Task ${task.id} completed`);

      // Invalidate cache
      if (task.type === "expand_graph") {
        // We need user_id and graph_id to invalidate cache properly
        // task.user_id is available
        // task.payload.graph_id is available
        const { graph_id } = task.payload;
        if (graph_id && task.user_id) {
          await cacheService.del(CacheKeys.GRAPH_NODES(task.user_id, graph_id));
          console.log(
            `[TaskProcessor] Cache invalidated for graph ${graph_id}`,
          );
        }
      }
    } catch (error: any) {
      logger.error(`Task ${task.id} failed:`, error);
      await taskService.updateTaskStatus(
        supabaseAdmin,
        task.id,
        "failed",
        undefined,
        error.message,
      );
    }
  }

  private async handleGenerateQuestions(task: Task) {
    const { knowledge_point_id, node_id, node_title, node_content, config } = task.payload;
    const nodeId = knowledge_point_id || node_id;
    let totalCount = 0;
    const errors: string[] = [];

    const { data: graphNodeData } = await supabaseAdmin
      .from("graph_nodes")
      .select("graph_id, knowledge_point_id")
      .eq("knowledge_point_id", nodeId)
      .is("deleted_at", null)
      .single();
    const graph_id = graphNodeData?.graph_id;

    // Truncate content to avoid context overflow
    const MAX_CONTENT_LENGTH = 15000;
    const truncatedContent = node_content
      ? node_content.substring(0, MAX_CONTENT_LENGTH)
      : "";

    // Determine types and counts
    // config: { types: string[], count: number, pack_template?: string, provider?: string, model?: string }
    const types =
      config?.types && Array.isArray(config.types) && config.types.length > 0
        ? config.types
        : ["qa", "choice"]; // Default types
    const totalRequestCount = config?.count || 5;
    const provider = config?.provider || task.payload.provider;
    const model = config?.model || task.payload.model;

    // Pre-calculate counts for each type
    let remainingCount = totalRequestCount;
    const tasksToRun: { type: string; count: number }[] = [];

    for (let i = 0; i < types.length; i++) {
      const countPerType = Math.ceil(remainingCount / (types.length - i));
      remainingCount -= countPerType;
      if (countPerType > 0) {
        tasksToRun.push({ type: types[i], count: countPerType });
      }
    }

    logger.debug(
      `Generating questions for node ${node_title}. Types: ${types.join(",")}, Total: ${totalRequestCount}`,
    );

    // Concurrency control
    const CONCURRENCY = 3;
    let completedTasks = 0;
    let lastProgressUpdateAt = 0;

    const maybeUpdateProgress = async (typeLabel: string) => {
      const now = Date.now();
      // Throttle DB writes: at most once per second, plus always at 100%
      const progress = Math.round((completedTasks / tasksToRun.length) * 100);
      if (progress < 100 && now - lastProgressUpdateAt < 1000) {
        return;
      }
      lastProgressUpdateAt = now;
      await taskService.updateTaskStatus(supabaseAdmin, task.id, "processing", {
        progress,
        current_node: `正在生成 ${typeLabel}...`,
      });
    };

    // Helper function to process a single type
    const processType = async ({
      type,
      count,
    }: {
      type: string;
      count: number;
    }) => {
      try {
        // Generate for specific type
        const aiResult = await aiService.generateCards(
          node_title,
          truncatedContent,
          {
            type: type as any,
            count,
            provider,
            model,
          },
        );
        const cards = aiResult.cards || [];

        // Insert cards into database
        if (cards.length > 0) {
          const cardsToInsert = cards.map((card: any) => ({
            user_id: task.user_id,
            knowledge_point_id: nodeId,
            graph_id,
            question: card.question,
            answer: card.answer,
            explanation: card.explanation,
            card_type: card.type || type,
            options: card.options ? JSON.stringify(card.options) : null,
            next_review: new Date().toISOString(),
            difficulty: 1,
            fsrs_state: 0,
            fsrs_stability: 0,
            fsrs_difficulty: 0,
            fsrs_elapsed_days: 0,
            fsrs_scheduled_days: 0,
            fsrs_retrievability: 0,
          }));

          const { error } = await supabaseAdmin
            .from("study_cards")
            .insert(cardsToInsert);

          if (error) {
            console.error(
              `[TaskProcessor] Failed to insert cards for type ${type}:`,
              error,
            );
            errors.push(`Failed to insert ${type}: ${error.message}`);
          } else {
            totalCount += cards.length;
          }
        } else {
          console.warn(`[TaskProcessor] AI returned 0 cards for type ${type}`);
        }
      } catch (err: any) {
        logger.error(`Error generating type ${type}:`, err);
        errors.push(`Failed to generate ${type}: ${err.message}`);
      } finally {
        completedTasks++;
        await maybeUpdateProgress(this.getTypeName(type));
      }
    };

    // Execute in chunks
    for (let i = 0; i < tasksToRun.length; i += CONCURRENCY) {
      const chunk = tasksToRun.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((t) => processType(t)));
    }

    // Ensure we end at 100% even if throttled
    await taskService.updateTaskStatus(supabaseAdmin, task.id, "processing", {
      progress: 100,
      current_node: "生成完成，正在收尾...",
    });

    if (totalCount === 0 && errors.length > 0) {
      throw new Error(`Failed to generate cards: ${errors.join("; ")}`);
    }

    // Invalidate cache if graph_id is available
    if (graph_id) {
      await cacheService.del(CacheKeys.STUDY_CARDS(graph_id));
    }

    return {
      count: totalCount,
      progress: 100,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private getTypeName(type: string): string {
    const map: Record<string, string> = {
      qa: "问答题",
      choice: "单选题",
      true_false: "判断题",
      multi_choice: "多选题",
      fill_in_the_blank: "填空题",
      essay: "解答题",
    };
    return map[type] || type;
  }

  private async handleExpandGraph(task: Task) {
    const {
      graph_id,
      node_id,
      node_title,
      node_content,
      existing_nodes,
      child_nodes,
      provider,
      model,
    } = task.payload;

    const { data: allGraphNodes } = await supabaseAdmin
      .from("graph_nodes")
      .select(
        `
        knowledge_points (
          title
        )
      `,
      )
      .eq("graph_id", graph_id)
      .is("deleted_at", null);

    const latestExistingNodes =
      allGraphNodes
        ?.map((gn: any) => gn.knowledge_points?.title)
        .filter(Boolean) ||
      existing_nodes ||
      [];

    const { data: currentEdges } = await supabaseAdmin
      .from("edges")
      .select("target_knowledge_point_id")
      .eq("source_knowledge_point_id", node_id)
      .is("deleted_at", null);

    let latestChildNodes: string[] = [];
    if (currentEdges && currentEdges.length > 0) {
      const targetIds = currentEdges.map((e: any) => e.target_knowledge_point_id);
      const { data: childGraphNodeData } = await supabaseAdmin
        .from("graph_nodes")
        .select(
          `
          knowledge_points (
            title
          )
        `,
        )
        .in("knowledge_point_id", targetIds)
        .is("deleted_at", null);
      latestChildNodes =
        childGraphNodeData
          ?.map((gn: any) => gn.knowledge_points?.title)
          .filter(Boolean) || [];
    } else {
      latestChildNodes = child_nodes || [];
    }

    const { data: currentGraphNode } = await supabaseAdmin
      .from("graph_nodes")
      .select("id, x_position, y_position, level")
      .eq("knowledge_point_id", node_id)
      .is("deleted_at", null)
      .single();

    if (!currentGraphNode) throw new Error("Source node not found");

    const aiResult = await aiService.expandKnowledge(
      node_title,
      node_content,
      latestExistingNodes,
      latestChildNodes,
      {
        provider,
        model,
        contextLevel: currentGraphNode.level,
        userId: task.user_id,
        graphId: graph_id,
      },
    );
    const suggestions = aiResult.suggestions;

    const newNodes: any[] = [];
    const newEdges: any[] = [];

    const newLevel = getNextLevel(currentGraphNode.level);

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      for (const item of suggestions) {
        const suggestion = item as { title: string; content?: string };
        const { data: existingGraphNode } = await supabaseAdmin
          .from("graph_nodes")
          .select("id, knowledge_point_id, knowledge_points (id, title)")
          .eq("graph_id", graph_id)
          .eq("knowledge_points.title", suggestion.title)
          .is("deleted_at", null)
          .single();

        if (existingGraphNode) {
          const existingKpId =
            (existingGraphNode as any).knowledge_points?.id ||
            existingGraphNode.knowledge_point_id;
          if (existingKpId && existingKpId !== node_id) {
            const { data: existingEdge } = await supabaseAdmin
              .from("edges")
              .select("id")
              .or(
                `and(source_knowledge_point_id.eq.${node_id},target_knowledge_point_id.eq.${existingKpId}),and(source_knowledge_point_id.eq.${existingKpId},target_knowledge_point_id.eq.${node_id})`,
              )
              .is("deleted_at", null)
              .single();

            if (!existingEdge) {
              const { data: edge } = await supabaseAdmin
                .from("edges")
                .insert({
                  graph_id,
                  source_knowledge_point_id: node_id,
                  target_knowledge_point_id: existingKpId,
                  relationship_type: "related",
                })
                .select()
                .single();

              if (edge) newEdges.push(edge);
            }
          }
        } else {
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 4;
          const x = Math.round(
            currentGraphNode.x_position + Math.cos(angle) * radius,
          );
          const y = Math.round(
            currentGraphNode.y_position + Math.sin(angle) * radius,
          );

          const newNodeResult = await createKnowledgePointWithGraphNode(
            supabaseAdmin,
            task.user_id,
            {
              graph_id,
              title: suggestion.title,
              content: suggestion.content || "",
              x_position: x,
              y_position: y,
              level: newLevel,
            },
          );

          if (newNodeResult) {
            newNodes.push({ id: newNodeResult.id, title: suggestion.title });

            const { data: edge, error: edgeError } = await supabaseAdmin
              .from("edges")
              .insert({
                graph_id,
                source_knowledge_point_id: node_id,
                target_knowledge_point_id: newNodeResult.id,
                relationship_type: "related",
              })
              .select()
              .single();

            if (edgeError) throw edgeError;
            if (edge) newEdges.push(edge);
          }
        }
      }
    }

    return {
      nodesCreated: newNodes.length,
      edgesCreated: newEdges.length,
      nodeTitles: newNodes.map((n) => n.title),
    };
  }
}

export const taskProcessor = new TaskProcessor();
