import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
  type OptionalAuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  uuidParamsSchema,
  createGraphFromTemplateSchema,
} from "../schemas/index";
import { graphTemplateService, graphService, templateRouteService } from "../services/graph";
import { cacheService } from "../services/common";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { z } from "zod";

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

router.get("/", optionalAuth, async (req: OptionalAuthRequest, res: Response) => {
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
  async (req: OptionalAuthRequest, res: Response) => {
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
  async (req: AuthedRequest, res: Response) => {
    const data = await graphTemplateService.createTemplate(
      req.supabase,
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
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await graphTemplateService.updateTemplate(
      req.supabase,
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
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await graphTemplateService.deleteTemplate(req.supabase, id, req.user.id);

    await cacheService.delByTags(["template:all"]);

    res.json({ message: "模板已删除" });
  },
);

router.post(
  "/from-template",
  requireAuth,
  validate({ body: createGraphFromTemplateSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { template_id, title, description } = req.body;

    const template = await graphTemplateService.getTemplate(
      req.supabase,
      template_id,
    );
    if (!template) {
      throw new AppError("模板不存在", 404, ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }

    const graph = await graphService.createGraph(
      req.supabase,
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

      await templateRouteService.createFromTemplate(
        req.supabase,
        req.user.id,
        templateNodes,
        templateEdges,
        graph.id,
      );
    }

    await cacheService.invalidateUserGraphsCache(req.user.id);

    res.status(201).json(graph);
  },
);

export default router;
