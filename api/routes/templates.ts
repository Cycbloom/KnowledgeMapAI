import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  uuidParamsSchema,
  createGraphFromTemplateSchema,
} from "../schemas/index";
import { graphTemplateService, graphService } from "../services/graph/index";
import { cacheService } from "../services/common/cacheService";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { z } from "zod";
import { logger } from "../utils/logger";

const createTemplateSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  description: z.string().max(500).optional(),
  category: z
    .enum(["learning", "story", "project", "analysis", "custom"])
    .optional(),
  nodes: z.array(z.record(z.unknown())).min(1, "至少需要一个节点"),
  edges: z.array(z.record(z.unknown())).optional(),
  layout: z.record(z.unknown()).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  nodes: z.array(z.record(z.unknown())).optional(),
});

const router = Router();

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  const { category } = req.query;
  const data = await graphTemplateService.getTemplates(
    req.supabase!,
    category as string,
  );
  res.json(data);
});

router.get(
  "/:id",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await graphTemplateService.getTemplate(req.supabase!, id);
    if (!data) {
      throw new AppError("未找到该模板", 404, ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }
    res.json(data);
  },
);

router.post(
  "/",
  requireAuth,
  validate({ body: createTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const data = await graphTemplateService.createTemplate(
      req.supabase!,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await graphTemplateService.updateTemplate(
      req.supabase!,
      id,
      req.user.id,
      req.body,
    );
    res.json(data);
  },
);

router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await graphTemplateService.deleteTemplate(req.supabase!, id, req.user.id);

    await cacheService.delByPrefix("templates_");

    res.json({ message: "模板已删除" });
  },
);

router.post(
  "/from-template",
  requireAuth,
  validate({ body: createGraphFromTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const { template_id, title, description } = req.body;

    const template = await graphTemplateService.getTemplate(
      req.supabase!,
      template_id,
    );
    if (!template) {
      throw new AppError("模板不存在", 404, ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }

    const graph = await graphService.createGraph(
      req.supabase!,
      req.user.id,
      title || template.name,
      description || template.description,
    );

    if (template.nodes && template.nodes.length > 0) {
      interface TemplateNode {
        title: string;
        level?: string;
        x_position?: number;
        y_position?: number;
        aiPrompt?: string;
        color?: string;
        backboneModule?: string;
        needsRefinement?: boolean;
        suggestedContent?: string;
      }

      interface TemplateEdge {
        source: string;
        target: string;
        relationship_type?: string;
      }

      const templateNodes = template.nodes as TemplateNode[];
      const templateEdges = template.edges as TemplateEdge[] | undefined;

      const { data: knowledgePoints, error: kpError } = await req
        .supabase!.from("knowledge_points")
        .insert(
          templateNodes.map((node) => ({
            user_id: req.user.id,
            title: node.title,
            level: node.level || "core",
            properties: {
              ...(node.aiPrompt && { aiPrompt: node.aiPrompt }),
              ...(node.color && { color: node.color }),
              ...(node.backboneModule && { backboneModule: node.backboneModule }),
              ...(node.needsRefinement !== undefined && { needsRefinement: node.needsRefinement }),
              ...(node.suggestedContent && { suggestedContent: node.suggestedContent }),
            },
          })),
        )
        .select("id, title");

      if (kpError) {
        logger.error(
          "Failed to create knowledge points from template:",
          kpError,
        );
      } else if (knowledgePoints && knowledgePoints.length > 0) {
        const nodeTitleToId = new Map(
          knowledgePoints.map((kp) => [kp.title, kp.id]),
        );

        const graphNodesData = templateNodes
          .map((node) => {
            const kpId = nodeTitleToId.get(node.title);
            return {
              graph_id: graph.id,
              knowledge_point_id: kpId,
              x: node.x_position || Math.random() * 400 - 200,
              y: node.y_position || Math.random() * 400 - 200,
            };
          })
          .filter((gn) => gn.knowledge_point_id);

        if (graphNodesData.length > 0) {
          const { data: insertedNodes, error: gnError } = await req
            .supabase!.from("graph_nodes")
            .insert(graphNodesData)
            .select("id, knowledge_point_id");

          if (gnError) {
            logger.error(
              "Failed to create graph nodes from template:",
              gnError,
            );
          } else if (
            insertedNodes &&
            insertedNodes.length > 0 &&
            templateEdges &&
            templateEdges.length > 0
          ) {
            const kpIdToNodeId = new Map(
              insertedNodes.map((gn) => [gn.knowledge_point_id, gn.id]),
            );

            const edgesData: Array<{
              graph_id: string;
              source_node_id: string;
              target_node_id: string;
              relationship_type: string;
            }> = [];
            for (const edge of templateEdges) {
              const sourceNode = templateNodes.find(
                (n) => n.title === edge.source,
              );
              const targetNode = templateNodes.find(
                (n) => n.title === edge.target,
              );

              if (sourceNode && targetNode) {
                const sourceKpId = nodeTitleToId.get(sourceNode.title);
                const targetKpId = nodeTitleToId.get(targetNode.title);
                const sourceNodeId = kpIdToNodeId.get(sourceKpId);
                const targetNodeId = kpIdToNodeId.get(targetKpId);

                if (sourceNodeId && targetNodeId) {
                  edgesData.push({
                    graph_id: graph.id,
                    source_node_id: sourceNodeId,
                    target_node_id: targetNodeId,
                    relationship_type: edge.relationship_type || "contains",
                  });
                }
              }
            }

            if (edgesData.length > 0) {
              const { error: edgeError } = await req
                .supabase!.from("edges")
                .insert(edgesData);

              if (edgeError) {
                logger.error(
                  "Failed to create edges from template:",
                  edgeError,
                );
              }
            }
          }
        }
      }
    }

    await cacheService.invalidateUserGraphsCache(req.user.id);

    res.status(201).json(graph);
  },
);

export default router;
