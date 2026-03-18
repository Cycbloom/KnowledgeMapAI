import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  uuidParamsSchema,
  createGraphFromTemplateSchema,
} from "../schemas/index.js";
import { graphTemplateService, graphService } from "../services/graph/index.js";
import { cacheService } from "../services/common/cacheService.js";
import { AppError } from "../middleware/errorHandler.js";
import { achievementService } from "../services/achievementService.js";
import { ErrorCodes } from "../../shared/types/errorCodes.js";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  description: z.string().max(500).optional(),
  category: z
    .enum(["learning", "story", "project", "analysis", "custom"])
    .optional(),
  nodes: z.array(z.any()).min(1, "至少需要一个节点"),
  edges: z.array(z.any()).optional(),
  layout: z.any().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  nodes: z.array(z.any()).optional(),
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
      const { data: knowledgePoints, error: kpError } = await req
        .supabase!.from("knowledge_points")
        .insert(
          template.nodes.map((node: any) => ({
            user_id: req.user.id,
            title: node.title,
            level: node.level || "core",
            properties: {
              aiPrompt: node.aiPrompt,
              color: node.color,
            },
          })),
        )
        .select("id, title");

      if (kpError) {
        console.error(
          "Failed to create knowledge points from template:",
          kpError,
        );
      } else if (knowledgePoints && knowledgePoints.length > 0) {
        const nodeTitleToId = new Map(
          knowledgePoints.map((kp: any) => [kp.title, kp.id]),
        );

        const graphNodesData = template.nodes
          .map((node: any) => {
            const kpId = nodeTitleToId.get(node.title);
            return {
              graph_id: graph.id,
              knowledge_point_id: kpId,
              x: node.x_position || Math.random() * 400 - 200,
              y: node.y_position || Math.random() * 400 - 200,
            };
          })
          .filter((gn: any) => gn.knowledge_point_id);

        if (graphNodesData.length > 0) {
          const { data: insertedNodes, error: gnError } = await req
            .supabase!.from("graph_nodes")
            .insert(graphNodesData)
            .select("id, knowledge_point_id");

          if (gnError) {
            console.error(
              "Failed to create graph nodes from template:",
              gnError,
            );
          } else if (
            insertedNodes &&
            insertedNodes.length > 0 &&
            template.edges &&
            template.edges.length > 0
          ) {
            const kpIdToNodeId = new Map(
              insertedNodes.map((gn: any) => [gn.knowledge_point_id, gn.id]),
            );

            const edgesData: any[] = [];
            for (const edge of template.edges) {
              const sourceNode = template.nodes.find(
                (n: any) => n.id === edge.source,
              );
              const targetNode = template.nodes.find(
                (n: any) => n.id === edge.target,
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
                    relationship_type: edge.relationship_type || "related",
                  });
                }
              }
            }

            if (edgesData.length > 0) {
              const { error: edgeError } = await req
                .supabase!.from("edges")
                .insert(edgesData);

              if (edgeError) {
                console.error(
                  "Failed to create edges from template:",
                  edgeError,
                );
              }
            }
          }
        }
      }
    }

    achievementService.updateCreationStats(req.user.id).catch(console.error);

    await cacheService.invalidateUserGraphsCache(req.user.id);

    res.status(201).json(graph);
  },
);

export default router;
