import { SupabaseClient } from "@supabase/supabase-js";
import { promptService } from "../ai/promptService";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers";
import { logger } from "../../utils/logger";
import { getNextLevel } from "../../utils/levelUtils";
import { performanceMonitor, enrichMetadata } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";
import { notDeleted } from '../common/softDeleteHelper';
import type { AIProvider } from "@shared/types";

interface KPTitleRef {
  knowledge_points?: { title?: string } | { title?: string }[] | null;
}

export async function getAutoGraphPrompt(
  supabase: SupabaseClient,
  userId: string,
  graphId: string,
  type: "init" | "expand",
  data: Record<string, unknown>,
): Promise<string> {
  const templateCode =
    type === "init" ? "auto_graph_init" : "auto_graph_expand";
  return promptService.getRenderedPrompt(
    supabase,
    templateCode,
    data,
    userId,
    graphId,
  );
}

export async function generateNodesForGraph(
  supabase: SupabaseClient,
  graphId: string,
  topic: string,
  description: string | undefined,
  depth: number,
  provider: AIProvider,
  userId?: string,
  sessionId?: string,
): Promise<number> {
  try {
    let totalNodes = 0;
    const effectiveSessionId = sessionId || crypto.randomUUID();

    const { data: existingNodes } = await notDeleted(supabase
      .from("graph_nodes")
      .select("knowledge_points(title)")
      .eq("graph_id", graphId)
      );

    const existingNodeTitles = new Set<string>();
    existingNodes?.forEach((gn: KPTitleRef) => {
      const kp = Array.isArray(gn.knowledge_points)
        ? gn.knowledge_points[0]
        : gn.knowledge_points;
      if (kp?.title) existingNodeTitles.add(kp.title);
    });

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "auto_graph_init",
      {
        topic,
        isCustom: false,
        isAcademic: true,
        isPractical: false,
        isBeginner: false,
        hasSources: false,
        sources: "",
      },
      userId,
    );

    const enrichedMetadata = userId
      ? await enrichMetadata(supabase, {
          graphId,
          userId,
          topic,
          depth,
        })
      : undefined;

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `请为「${topic}」生成知识点。${description ? `\n\n领域描述：${description}` : ""}`,
        },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage && enrichedMetadata) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0,
      );
      await performanceMonitor.recordLog({
        operation: "generate_nodes_for_graph",
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
        sessionId: effectiveSessionId,
      });
    }

    const parsed = JSON.parse(
      completion.choices[0].message.content || '{"root":null,"coreNodes":[]}',
    );

    if (parsed.root) {
      const rootNodeResult = await createKnowledgePointWithGraphNode(
        supabase,
        userId || "",
        {
          graph_id: graphId,
          title: parsed.root.title || topic,
          content: parsed.root.content || "",
          level: "root",
          x_position: 400,
          y_position: 300,
        },
      );

      if (rootNodeResult) {
        totalNodes++;

        const coreNodes = parsed.coreNodes || [];
        const coreNodeIds: string[] = [];

        for (let i = 0; i < coreNodes.length; i++) {
          const coreNode = coreNodes[i];

          if (existingNodeTitles.has(coreNode.title)) {
            logger.warn(
              `[GraphTaskService] Skipping duplicate node: ${coreNode.title}`,
            );
            continue;
          }

          const angle = (2 * Math.PI * i) / coreNodes.length;
          const radius = 200;

          const childNodeResult = await createKnowledgePointWithGraphNode(
            supabase,
            userId || "",
            {
              graph_id: graphId,
              title: coreNode.title,
              content: coreNode.content || "",
              level: "core",
              x_position: 400 + radius * Math.cos(angle),
              y_position: 300 + radius * Math.sin(angle),
            },
          );

          if (childNodeResult) {
            totalNodes++;
            coreNodeIds.push(childNodeResult.id);
            existingNodeTitles.add(coreNode.title);

            await supabase.from("edges").insert({
              graph_id: graphId,
              source_knowledge_point_id: rootNodeResult.id,
              target_knowledge_point_id: childNodeResult.id,
              relationship_type: "contains",
            });
          }
        }

        if (depth > 1 && coreNodeIds.length > 0) {
          for (let i = 0; i < coreNodes.length; i++) {
            const coreNode = coreNodes[i];
            const coreNodeId = coreNodeIds[i];

            if (coreNodeId) {
              const expandCount = await expandNodeForGraph(
                supabase,
                graphId,
                coreNodeId,
                coreNode.title,
                coreNode.content,
                "core",
                depth - 1,
                provider,
                userId,
                effectiveSessionId,
              );
              totalNodes += expandCount;
            }
          }
        }
      }
    }

    return totalNodes;
  } catch (error) {
    logger.warn(`Failed to generate nodes for ${topic}:`, error);
    return 0;
  }
}

export async function expandNodeForGraph(
  supabase: SupabaseClient,
  graphId: string,
  parentNodeId: string,
  parentNodeTitle: string,
  parentNodeContent: string | undefined,
  parentLevel: string,
  remainingDepth: number,
  provider: AIProvider,
  userId?: string,
  sessionId?: string,
): Promise<number> {
  try {
    let totalNodes = 0;
    const effectiveSessionId = sessionId || crypto.randomUUID();

    const { data: existingChildEdges } = await notDeleted(supabase
      .from("edges")
      .select(
        "target_knowledge_point_id, knowledge_points!edges_target_knowledge_point_id_fkey(title)",
      )
      .eq("source_knowledge_point_id", parentNodeId)
      );

    const existingChildTitles = new Set<string>();
    existingChildEdges?.forEach((edge: KPTitleRef) => {
      const kp = Array.isArray(edge.knowledge_points)
        ? edge.knowledge_points[0]
        : edge.knowledge_points;
      if (kp?.title) existingChildTitles.add(kp.title);
    });

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "auto_graph_expand",
      {
        nodeTitle: parentNodeTitle,
        nodeContent: parentNodeContent || "",
        nodeLevel: parentLevel,
        isCustom: false,
        isAcademic: true,
        isPractical: false,
        isBeginner: false,
        existingChildren: Array.from(existingChildTitles),
      },
      userId,
    );

    const enrichedMetadata = userId
      ? await enrichMetadata(supabase, {
          graphId,
          userId,
          nodeTitle: parentNodeTitle,
          nodeId: parentNodeId,
          nodeLevel: parentLevel,
          depth: remainingDepth,
        })
      : undefined;

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请为「${parentNodeTitle}」生成子知识点。` },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage && enrichedMetadata) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0,
      );
      await performanceMonitor.recordLog({
        operation: "expand_node_for_graph",
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
        sessionId: effectiveSessionId,
      });
    }

    const parsed = JSON.parse(
      completion.choices[0].message.content || '{"children":[]}',
    );
    const children = parsed.children || [];

    if (children.length > 0) {
      const childNodeIds: string[] = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (existingChildTitles.has(child.title)) {
          logger.warn(
            `[GraphTaskService] Skipping duplicate child node: ${child.title}, parent: ${parentNodeTitle}`,
          );
          continue;
        }

        const angle = (2 * Math.PI * i) / children.length;
        const radius = 150;

        const childNodeResult = await createKnowledgePointWithGraphNode(
          supabase,
          userId || "",
          {
            graph_id: graphId,
            title: child.title,
            content: child.content || "",
            level: getNextLevel(parentLevel),
            x_position: 400 + radius * Math.cos(angle),
            y_position: 300 + radius * Math.sin(angle),
          },
        );

        if (childNodeResult) {
          totalNodes++;
          childNodeIds.push(childNodeResult.id);
          existingChildTitles.add(child.title);

          await supabase.from("edges").insert({
            graph_id: graphId,
            source_knowledge_point_id: parentNodeId,
            target_knowledge_point_id: childNodeResult.id,
            relationship_type: "contains",
          });
        }
      }

      if (remainingDepth > 1) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childNodeId = childNodeIds[i];

          if (childNodeId) {
            const expandCount = await expandNodeForGraph(
              supabase,
              graphId,
              childNodeId,
              child.title,
              child.content,
              getNextLevel(parentLevel),
              remainingDepth - 1,
              provider,
              userId,
              effectiveSessionId,
            );
            totalNodes += expandCount;
          }
        }
      }
    }

    return totalNodes;
  } catch (error) {
    logger.warn(`Failed to expand node ${parentNodeTitle}:`, error);
    return 0;
  }
}
