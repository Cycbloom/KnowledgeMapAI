import { getSupabaseAdmin } from "../supabase";
import { asyncTaskService } from "../services/asyncTaskService";
import type { Task } from "@shared/types/common";
import { aiService } from "../services/ai/aiService";
import { getNextLevel } from "../utils/levelUtils";
import { createKnowledgePointWithGraphNode } from "../utils/nodeHelpers";
import { logger } from "../utils/logger";
import { appEventBus } from "../services/core/eventBus";
import type { AIProviderType } from "@shared/types";
import type {
  AITaskCompletedPayload,
  AITaskFailedPayload,
} from "@shared/types/events";

interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
}

interface NewNodeInfo {
  id: string;
  title: string;
}

interface EdgeInfo {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
}

interface GraphNodeWithKnowledgePoint {
  id: string;
  knowledge_point_id: string;
  knowledge_points: {
    id: string;
    title: string;
  } | {
    id: string;
    title: string;
  }[] | null;
}

class TaskProcessor {
  public async processTask(task: Task) {
    const payload = JSON.parse(task.context || "{}");
    logger.debug(
      `[TaskProcessor] Processing task ${task.id} (${task.task_type})`,
    );

    try {
      await asyncTaskService.updateTaskStatus(getSupabaseAdmin(), task.id, "in_progress");

      let result;
      switch (task.task_type) {
        case "generate_questions":
          result = await this.handleGenerateQuestions(task);
          break;
        case "batch_generate_questions":
        case "recursive_graph_generation":
        case "infinite_graph_expansion":
        case "embedding_generation":
          await asyncTaskService.processTask(
            task.id,
            task.user_id,
            task.task_type,
            payload,
          );
          return;
        case "expand_graph":
          result = await this.handleExpandGraph(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.task_type}`);
      }

      await asyncTaskService.updateTaskStatus(
        getSupabaseAdmin(),
        task.id,
        "completed",
        result,
      );
      logger.debug(`[TaskProcessor] Task ${task.id} completed`);

      appEventBus.publish(
        "ai_task_completed",
        {
          taskId: task.id,
          taskType: task.task_type,
          userId: task.user_id,
          graphId: payload?.graph_id,
          result,
        } as AITaskCompletedPayload,
        task.user_id,
        "task_processor",
      );
    } catch (error: unknown) {
      logger.error(`Task ${task.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await asyncTaskService.updateTaskStatus(
        getSupabaseAdmin(),
        task.id,
        "failed",
        undefined,
        undefined,
        errorMessage,
      );

      appEventBus.publish(
        "ai_task_failed",
        {
          taskId: task.id,
          taskType: task.task_type,
          userId: task.user_id,
          graphId: payload?.graph_id,
          error: errorMessage,
        } as AITaskFailedPayload,
        task.user_id,
        "task_processor",
      );
    }
  }

  private async handleGenerateQuestions(task: Task) {
    const payload = JSON.parse(task.context || "{}");
    const { knowledge_point_id, node_id, node_title, node_content, config } =
      payload;
    const nodeId = knowledge_point_id || node_id;
    let totalCount = 0;
    const errors: string[] = [];

    const { data: graphNodeData } = await getSupabaseAdmin()
      .from("graph_nodes")
      .select("graph_id, knowledge_point_id")
      .eq("knowledge_point_id", nodeId)
      .is("deleted_at", null)
      .single();
    const graph_id = graphNodeData?.graph_id;

    // Truncate content to avoid context overflow
    const MAX_CONTENT_LENGTH = 15000;
    const truncatedContent = node_content
      ? String(node_content).substring(0, MAX_CONTENT_LENGTH)
      : "";

    // Determine types and counts
    // config: { types: string[], count: number, pack_template?: string, provider?: string, model?: string }
    const types =
      config?.types && Array.isArray(config.types) && config.types.length > 0
        ? config.types
        : ["qa", "choice"]; // Default types
    const totalRequestCount = config?.count || 5;
    const provider = config?.provider || payload?.provider;
    const model = config?.model || payload?.model;

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
      await asyncTaskService.updateTaskStatus(
        getSupabaseAdmin(),
        task.id,
        "in_progress",
        {
          progress,
          current_node: `正在生成 ${typeLabel}...`,
        },
      );
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
          node_title || "",
          truncatedContent,
          {
            type,
            count,
            provider: provider as AIProviderType | undefined,
            model,
          },
        );
        const cards = (aiResult.cards || []) as AIGeneratedCard[];

        // Insert cards into database
        if (cards.length > 0) {
          const cardsToInsert = cards.map((card) => ({
            user_id: task.user_id,
            knowledge_point_id: nodeId,
            graph_id,
            question: card.question,
            answer: card.answer,
            explanation: card.explanation,
            card_type: card.type ?? type,
            options: card.options ? JSON.stringify(card.options) : null,
            next_review: new Date().toISOString(),
            difficulty: 1,
            fsrs_state: "New",
            fsrs_stability: 0,
            fsrs_difficulty: 0,
            fsrs_elapsed_days: 0,
            fsrs_scheduled_days: 0,
            fsrs_retrievability: 0,
          }));

          const { error } = await getSupabaseAdmin()
            .from("study_cards")
            .insert(cardsToInsert);

          if (error) {
            logger.error(
              `[TaskProcessor] Failed to insert cards for type ${type}:`,
              error,
            );
            errors.push(`Failed to insert ${type}: ${error.message}`);
          } else {
            totalCount += cards.length;
          }
        } else {
          logger.warn(`[TaskProcessor] AI returned 0 cards for type ${type}`);
        }
      } catch (err: unknown) {
        logger.error(`Error generating type ${type}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to generate ${type}: ${errMsg}`);
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
    await asyncTaskService.updateTaskStatus(getSupabaseAdmin(), task.id, "in_progress", {
      progress: 100,
      current_node: "生成完成，正在收尾...",
    });

    if (totalCount === 0 && errors.length > 0) {
      throw new Error(`Failed to generate cards: ${errors.join("; ")}`);
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
    const payload = JSON.parse(task.context || "{}");
    const {
      graph_id,
      node_id,
      node_title,
      node_content,
      existing_nodes,
      child_nodes,
      provider,
      model,
    } = payload;

    const { data: allGraphNodes } = await getSupabaseAdmin()
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
        ?.map(
          (gn: {
            knowledge_points?: { title: string } | { title: string }[];
          }) => {
            const kp = Array.isArray(gn.knowledge_points)
              ? gn.knowledge_points[0]
              : gn.knowledge_points;
            return kp?.title;
          },
        )
        .filter((t): t is string => Boolean(t)) ||
      (Array.isArray(existing_nodes) ? (existing_nodes as string[]) : []) ||
      [];

    const { data: currentEdges } = await getSupabaseAdmin()
      .from("edges")
      .select("target_knowledge_point_id")
      .eq("source_knowledge_point_id", node_id)
      .is("deleted_at", null);

    let latestChildNodes: string[] = [];
    if (currentEdges && currentEdges.length > 0) {
      const targetIds = currentEdges.map(
        (e: { target_knowledge_point_id: string }) =>
          e.target_knowledge_point_id,
      );
      const { data: childGraphNodeData } = await getSupabaseAdmin()
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
          ?.map(
            (gn: {
              knowledge_points?: { title: string } | { title: string }[];
            }) => {
              const kp = Array.isArray(gn.knowledge_points)
                ? gn.knowledge_points[0]
                : gn.knowledge_points;
              return kp?.title;
            },
          )
          .filter((t): t is string => Boolean(t)) || [];
    } else {
      latestChildNodes = Array.isArray(child_nodes)
        ? (child_nodes as string[])
        : [];
    }

    const { data: currentGraphNode } = await getSupabaseAdmin()
      .from("graph_nodes")
      .select("id, x_position, y_position, level")
      .eq("knowledge_point_id", node_id)
      .is("deleted_at", null)
      .single();

    if (!currentGraphNode) throw new Error("Source node not found");

    const aiResult = await aiService.expandKnowledge(
      node_title || "",
      node_content as string | undefined,
      latestExistingNodes,
      latestChildNodes,
      {
        provider: provider as AIProviderType | undefined,
        model,
        contextLevel: currentGraphNode.level,
        userId: task.user_id,
        graphId: graph_id,
      },
    );
    const suggestions = aiResult.suggestions;

    const newNodes: NewNodeInfo[] = [];
    const newEdges: EdgeInfo[] = [];

    const newLevel = getNextLevel(currentGraphNode.level);

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      // 预构建本图全部节点标题索引，替代循环内逐 suggestion 查询标题匹配（N 次 → 1 次）
      const { data: allExistingNodes } = await getSupabaseAdmin()
        .from("graph_nodes")
        .select("id, knowledge_point_id, knowledge_points (id, title)")
        .eq("graph_id", graph_id)
        .is("deleted_at", null);

      const existingNodeByTitle = new Map<string, GraphNodeWithKnowledgePoint>();
      for (const gn of allExistingNodes ?? []) {
        const kpData = gn as GraphNodeWithKnowledgePoint;
        const title = Array.isArray(kpData.knowledge_points)
          ? kpData.knowledge_points[0]?.title
          : kpData.knowledge_points?.title;
        if (title) existingNodeByTitle.set(title, gn);
      }

      for (const item of suggestions) {
        const suggestion = item as { title: string; content?: string };
        const existingGraphNode = existingNodeByTitle.get(suggestion.title);

        if (existingGraphNode) {
          const kpData = existingGraphNode as GraphNodeWithKnowledgePoint;
          const existingKpId =
            (Array.isArray(kpData.knowledge_points) ? kpData.knowledge_points[0]?.id : kpData.knowledge_points?.id) ||
            existingGraphNode.knowledge_point_id;
          if (existingKpId && existingKpId !== node_id) {
            const { data: existingEdge } = await getSupabaseAdmin()
              .from("edges")
              .select("id")
              .or(
                `and(source_knowledge_point_id.eq.${node_id},target_knowledge_point_id.eq.${existingKpId}),and(source_knowledge_point_id.eq.${existingKpId},target_knowledge_point_id.eq.${node_id})`,
              )
              .is("deleted_at", null)
              .single();

            if (!existingEdge) {
              const { data: edge } = await getSupabaseAdmin()
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
            getSupabaseAdmin(),
            task.user_id,
            {
              graph_id: graph_id || "",
              title: suggestion.title,
              content: suggestion.content || "",
              x_position: x,
              y_position: y,
              level: newLevel,
            },
          );

          if (newNodeResult) {
            newNodes.push({ id: newNodeResult.id, title: suggestion.title });

            const { data: edge, error: edgeError } = await getSupabaseAdmin()
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
