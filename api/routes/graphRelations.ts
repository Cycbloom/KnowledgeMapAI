import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { graphRelationService } from "../services/graph/index";
import { asyncTaskService } from "../services/asyncTaskService";
import { logger } from "../utils/logger";
import { checkDuplicateGraphTopic } from "../utils/similaritySearch";
import { z } from "zod";

const router = Router();

const createPrerequisiteSchema = z.object({
  topic: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  auto_generate: z.boolean().default(true),
});

const batchCreateSchema = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string().min(2).max(200),
        description: z.string().max(500).optional(),
        mastery_level: z.string(),
      }),
    )
    .min(1)
    .max(5),
  depth: z.number().min(1).max(3).default(2),
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

const createRelationSchema = z.object({
  source_graph_id: z.string().uuid(),
  target_graph_id: z.string().uuid(),
  relation_type: z.enum(["prerequisite", "extension", "related"]),
  context: z.string().max(500).optional(),
});

router.get(
  "/:graphId/relations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const { data: graph } = await supabase
        .from("knowledge_graphs")
        .select("id, user_id")
        .eq("id", graphId)
        .single();

      if (!graph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const relations = await graphRelationService.getRelations(
        supabase,
        graphId,
      );

      const allGraphIds = [
        ...relations.outgoing.map((r) => r.target_graph_id),
        ...relations.incoming.map((r) => r.source_graph_id),
      ].filter(Boolean);

      const { data: relatedGraphs } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .in("id", allGraphIds);

      const { data: nodeCounts } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", allGraphIds)
        .is("deleted_at", null);

      const nodeCountMap = new Map<string, number>();
      (nodeCounts || []).forEach((n: { graph_id: string }) => {
        nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
      });

      const graphMap = new Map(relatedGraphs?.map((g) => [g.id, g]) || []);

      const prerequisites: any[] = [];
      const extensions: any[] = [];
      const related: any[] = [];

      relations.outgoing.forEach((r) => {
        const targetGraph = graphMap.get(r.target_graph_id);
        const relation = {
          id: r.id,
          sourceGraphId: r.source_graph_id,
          targetGraphId: r.target_graph_id,
          relationType: r.relation_type,
          context: r.context,
          metadata: r.metadata || {},
          createdAt: r.created_at,
          targetGraph: targetGraph
            ? {
                id: targetGraph.id,
                title: targetGraph.title,
                description: targetGraph.description,
                nodeCount: nodeCountMap.get(targetGraph.id) || 0,
              }
            : undefined,
        };

        if (r.relation_type === "prerequisite") prerequisites.push(relation);
        else if (r.relation_type === "extension") extensions.push(relation);
        else related.push(relation);
      });

      relations.incoming.forEach((r) => {
        const sourceGraph = graphMap.get(r.source_graph_id);
        const relation = {
          id: r.id,
          sourceGraphId: r.source_graph_id,
          targetGraphId: r.target_graph_id,
          relationType: r.relation_type,
          context: r.context,
          metadata: r.metadata || {},
          createdAt: r.created_at,
          targetGraph: sourceGraph
            ? {
                id: sourceGraph.id,
                title: sourceGraph.title,
                description: sourceGraph.description,
                nodeCount: nodeCountMap.get(sourceGraph.id) || 0,
              }
            : undefined,
        };

        if (r.relation_type === "extension") {
          prerequisites.push({
            ...relation,
            relationType: "prerequisite",
            context:
              relation.context ||
              `${sourceGraph?.title || "其他图谱"} 是当前图谱的前置知识`,
          });
        }
      });

      res.json({ prerequisites, extensions, related });
    } catch (error: any) {
      logger.error("Get Graph Relations Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "获取关联图谱失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/:graphId/prerequisite-graph",
  requireAuth,
  validate(createPrerequisiteSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { topic, description, auto_generate } = req.body;
    const supabase = req.supabase!;

    try {
      const { data: sourceGraph } = await supabase
        .from("knowledge_graphs")
        .select("id, title, user_id")
        .eq("id", graphId)
        .single();

      if (!sourceGraph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const duplicateCheck = await checkDuplicateGraphTopic(
        supabase,
        req.user.id,
        topic,
        { threshold: 0.85 },
      );

      let targetGraphId: string;
      let targetGraph: any;
      let isNew = false;

      if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
        targetGraphId = duplicateCheck.similarGraphs[0].id;
        targetGraph = duplicateCheck.similarGraphs[0];
        logger.info(
          `Reusing existing graph "${targetGraph.title}" (similarity: ${(duplicateCheck.similarGraphs[0].similarity * 100).toFixed(1)}%) for topic "${topic}"`,
        );
      } else {
        const { data: newGraph, error: createError } = await supabase
          .from("knowledge_graphs")
          .insert({
            user_id: req.user.id,
            title: topic,
            description: description || "",
            parent_graph_id: graphId,
            embedding: duplicateCheck.embedding,
          })
          .select()
          .single();

        if (createError || !newGraph) {
          throw new AppError("创建图谱失败", 500, ErrorCodes.INTERNAL_ERROR);
        }

        targetGraphId = newGraph.id;
        targetGraph = newGraph;
        isNew = true;

        if (auto_generate) {
          await asyncTaskService.createTask(
            req.user.id,
            "recursive_graph_generation",
            {
              graph_id: targetGraphId,
              topic,
              depth: 2,
              style: "academic",
            },
            `生成知识图谱：${topic}`,
          );
        }
      }

      const exists = await graphRelationService.checkRelationExists(
        supabase,
        graphId,
        targetGraphId,
        "prerequisite",
      );

      let relation;
      if (!exists) {
        relation = await graphRelationService.createRelation(supabase, {
          source_graph_id: graphId,
          target_graph_id: targetGraphId,
          relation_type: "prerequisite",
          context: `学习「${sourceGraph.title}」前建议先掌握「${topic}」`,
        });
      }

      res.json({
        graphId: targetGraphId,
        graph: targetGraph,
        relation,
        isNew,
      });
    } catch (error: any) {
      logger.error("Create Prerequisite Graph Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "创建前置图谱失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/:graphId/prerequisite-graphs/batch",
  requireAuth,
  validate(batchCreateSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { topics, depth, style } = req.body;
    const supabase = req.supabase!;

    try {
      const { data: sourceGraph } = await supabase
        .from("knowledge_graphs")
        .select("id, title")
        .eq("id", graphId)
        .single();

      if (!sourceGraph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const results: Array<{
        topic: string;
        graphId: string;
        graph: any;
        isNew: boolean;
        taskId?: string;
        similarity?: number;
        matchedTitle?: string;
      }> = [];

      for (const item of topics) {
        const duplicateCheck = await checkDuplicateGraphTopic(
          supabase,
          req.user.id,
          item.topic,
          { threshold: 0.85 },
        );

        if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
          const existingGraph = duplicateCheck.similarGraphs[0];
          const similarity = existingGraph.similarity;

          logger.info(
            `Reusing existing graph "${existingGraph.title}" (similarity: ${(similarity * 100).toFixed(1)}%) for prerequisite topic "${item.topic}"`,
          );

          const exists = await graphRelationService.checkRelationExists(
            supabase,
            graphId,
            existingGraph.id,
            "prerequisite",
          );
          if (!exists) {
            await graphRelationService.createRelation(supabase, {
              source_graph_id: graphId,
              target_graph_id: existingGraph.id,
              relation_type: "prerequisite",
              context: `学习「${sourceGraph.title}」前建议先掌握「${existingGraph.title}」`,
            });
          }

          results.push({
            topic: item.topic,
            graphId: existingGraph.id,
            graph: {
              id: existingGraph.id,
              title: existingGraph.title,
            },
            isNew: false,
            similarity,
            matchedTitle: existingGraph.title,
          });
        } else {
          const { data: newGraph } = await supabase
            .from("knowledge_graphs")
            .insert({
              user_id: req.user.id,
              title: item.topic,
              description: item.description || "",
              parent_graph_id: graphId,
              embedding: duplicateCheck.embedding,
            })
            .select()
            .single();

          if (newGraph) {
            await graphRelationService.createRelation(supabase, {
              source_graph_id: graphId,
              target_graph_id: newGraph.id,
              relation_type: "prerequisite",
              context: `学习「${sourceGraph.title}」前建议先掌握「${item.topic}」`,
            });

            const task = await asyncTaskService.createTask(
              req.user.id,
              "recursive_graph_generation",
              {
                graph_id: newGraph.id,
                topic: item.topic,
                depth: depth || 2,
                style: style || "academic",
              },
              `生成知识图谱：${item.topic}`,
            );

            results.push({
              topic: item.topic,
              graphId: newGraph.id,
              graph: newGraph,
              isNew: true,
              taskId: task.id,
            });
          }
        }
      }

      res.json({ created: results });
    } catch (error: any) {
      logger.error("Batch Create Prerequisite Graphs Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "批量创建前置图谱失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete(
  "/:graphId/relations/:relationId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { relationId } = req.params;
    const supabase = req.supabase!;

    try {
      await graphRelationService.deleteRelation(supabase, relationId);
      res.json({ success: true });
    } catch (error: any) {
      logger.error("Delete Graph Relation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "删除关联失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/relations",
  requireAuth,
  validate(createRelationSchema),
  async (req: AuthRequest, res: Response) => {
    const { source_graph_id, target_graph_id, relation_type, context } =
      req.body;
    const supabase = req.supabase!;

    try {
      if (source_graph_id === target_graph_id) {
        throw new AppError(
          "不能创建自引用关系",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: sourceGraph } = await supabase
        .from("knowledge_graphs")
        .select("id, user_id, title")
        .eq("id", source_graph_id)
        .single();

      const { data: targetGraph } = await supabase
        .from("knowledge_graphs")
        .select("id, user_id, title")
        .eq("id", target_graph_id)
        .single();

      if (!sourceGraph || !targetGraph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      if (sourceGraph.user_id !== req.user.id) {
        throw new AppError("无权操作此图谱", 403, ErrorCodes.FORBIDDEN);
      }

      const exists = await graphRelationService.checkRelationExists(
        supabase,
        source_graph_id,
        target_graph_id,
        relation_type,
      );
      if (exists) {
        throw new AppError("该关系已存在", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const newRelation = await graphRelationService.createRelation(supabase, {
        source_graph_id,
        target_graph_id,
        relation_type,
        context: context || `${sourceGraph.title} → ${targetGraph.title}`,
      });

      res.status(201).json(newRelation);
    } catch (error: any) {
      logger.error("Create Graph Relation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "创建关系失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete(
  "/relations/:relationId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { relationId } = req.params;
    const supabase = req.supabase!;

    try {
      const { data: relation } = await supabase
        .from("graph_relations")
        .select("id, source_graph_id")
        .eq("id", relationId)
        .single();

      if (!relation) {
        throw new AppError("关系不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const { data: sourceGraph } = await supabase
        .from("knowledge_graphs")
        .select("user_id")
        .eq("id", relation.source_graph_id)
        .single();

      if (!sourceGraph || sourceGraph.user_id !== req.user.id) {
        throw new AppError("无权删除此关系", 403, ErrorCodes.FORBIDDEN);
      }

      await graphRelationService.deleteRelation(supabase, relationId);
      res.json({ success: true });
    } catch (error: any) {
      logger.error("Delete Graph Relation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "删除关系失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

const infiniteExpansionSchema = z.object({
  max_depth: z.number().min(1).max(5).optional().default(2),
  max_graphs_per_level: z.number().min(1).max(5).optional().default(3),
  relation_types: z
    .array(z.enum(["prerequisite", "extension", "related"]))
    .optional()
    .default(["prerequisite", "extension", "related"]),
  auto_generate_nodes: z.boolean().optional().default(true),
  node_depth: z.number().min(1).max(3).optional().default(2),
});

router.post(
  "/:graphId/infinite-expand",
  requireAuth,
  validate(infiniteExpansionSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const {
      max_depth = 2,
      max_graphs_per_level = 3,
      relation_types = ["prerequisite", "extension", "related"],
      auto_generate_nodes = true,
      node_depth = 2,
    } = req.body;
    const supabase = req.supabase!;

    try {
      const { data: sourceGraph } = await supabase
        .from("knowledge_graphs")
        .select("id, user_id, title, description")
        .eq("id", graphId)
        .single();

      if (!sourceGraph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      if (sourceGraph.user_id !== req.user.id) {
        throw new AppError("无权操作此图谱", 403, ErrorCodes.FORBIDDEN);
      }

      const task = await asyncTaskService.createTask(
        req.user.id,
        "infinite_graph_expansion",
        {
          source_graph_id: graphId,
          source_graph_title: sourceGraph.title,
          source_graph_description: sourceGraph.description,
          max_depth,
          max_graphs_per_level,
          relation_types,
          auto_generate_nodes,
          node_depth,
        },
      );

      res.json({
        task_id: task.id,
        status: "pending",
        message: "无限扩展任务已创建",
      });
    } catch (error: any) {
      logger.error("Infinite Expansion Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "创建无限扩展任务失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
