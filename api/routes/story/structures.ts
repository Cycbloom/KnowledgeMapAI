import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";

interface StoryStructure {
  id: string;
  graph_id: string;
  structure_level: "story" | "act" | "sequence" | "chapter" | "scene";
  parent_structure_id: string | null;
  title: string;
  synopsis: string | null;
  display_order: number;
  template_beat_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  children?: StoryStructure[];
}

interface StoryTemplateBeat {
  id: string;
  name: string;
  name_zh: string;
  order: number;
  level: "story" | "act" | "sequence" | "chapter" | "scene";
  parent_act?: string;
  description?: string;
}

const createStoryStructureSchema = z.object({
  structure_level: z.enum(["story", "act", "sequence", "chapter", "scene"]),
  parent_structure_id: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  synopsis: z.string().max(2000).optional(),
  display_order: z.number().int().min(0),
  template_beat_id: z.string().max(100).optional(),
});

const updateStoryStructureSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  synopsis: z.string().max(2000).optional(),
  display_order: z.number().int().min(0).optional(),
  template_beat_id: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const initializeTemplateSchema = z.object({
  templateCode: z.string().min(1).max(100),
});

const router = Router();

function buildTree(structures: StoryStructure[]): StoryStructure[] {
  const map = new Map<string, StoryStructure>();
  const roots: StoryStructure[] = [];

  structures.forEach((structure) => {
    map.set(structure.id, { ...structure, children: [] });
  });

  structures.forEach((structure) => {
    const node = map.get(structure.id)!;
    if (structure.parent_structure_id && map.has(structure.parent_structure_id)) {
      const parent = map.get(structure.parent_structure_id)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const { data: structures, error } = await supabase
        .from("story_structures")
        .select("*")
        .eq("graph_id", graphId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const tree = buildTree(structures || []);

      res.json({ structures: tree });
    } catch (error: unknown) {
      logger.error("Get story structures error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "获取故事结构失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/",
  requireAuth,
  validate(createStoryStructureSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const {
        structure_level,
        parent_structure_id,
        title,
        synopsis,
        display_order,
        template_beat_id,
      } = req.body;

      const insertData = {
        graph_id: graphId,
        structure_level,
        parent_structure_id: parent_structure_id || null,
        title,
        synopsis: synopsis || null,
        display_order,
        template_beat_id: template_beat_id || null,
      };

      const { data: structure, error } = await supabase
        .from("story_structures")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(structure);
    } catch (error: unknown) {
      logger.error("Create story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "创建故事结构失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateStoryStructureSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    try {
      const updateData = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      const { data: structure, error } = await supabase
        .from("story_structures")
        .update(updateData)
        .eq("id", id)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!structure) {
        throw new AppError("故事结构不存在", 404, ErrorCodes.NOT_FOUND);
      }

      res.json(structure);
    } catch (error: unknown) {
      logger.error("Update story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "更新故事结构失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    try {
      const { error } = await supabase
        .from("story_structures")
        .delete()
        .eq("id", id)
        .eq("graph_id", graphId);

      if (error) throw error;

      res.json({ message: "故事结构已删除" });
    } catch (error: unknown) {
      logger.error("Delete story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "删除故事结构失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/initialize-template",
  requireAuth,
  validate(initializeTemplateSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { templateCode } = req.body;
    const supabase = req.supabase!;

    try {
      const { data: template, error: templateError } = await supabase
        .from("story_templates")
        .select("*")
        .eq("template_code", templateCode)
        .single();

      if (templateError || !template) {
        throw new AppError("模板不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const beats = template.beats as StoryTemplateBeat[];

      if (!beats || beats.length === 0) {
        throw new AppError("模板没有定义节拍", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const sortedBeats = [...beats].sort((a, b) => a.order - b.order);

      // Step 1: Insert all structures with parent_structure_id = null first
      const structuresToInsert = sortedBeats.map((beat) => ({
        graph_id: graphId,
        structure_level: beat.level,
        parent_structure_id: null as string | null,
        title: beat.name_zh || beat.name,
        synopsis: beat.description || null,
        display_order: beat.order - 1,
        template_beat_id: beat.id,
      }));

      const { data: createdStructures, error: insertError } = await supabase
        .from("story_structures")
        .insert(structuresToInsert)
        .select("*")
        .order("display_order", { ascending: true });

      if (insertError) throw insertError;

      // Step 2: Build actMap from created structures (matching by template_beat_id)
      const actMap = new Map<string, string>();
      (createdStructures || []).forEach((structure: StoryStructure) => {
        const matchingBeat = sortedBeats.find(
          (beat) => beat.id === structure.template_beat_id,
        );
        if (matchingBeat?.level === "act") {
          actMap.set(matchingBeat.id, structure.id);
        }
      });

      // Step 3: Update parent_structure_id for sequence-level structures
      const updatePromises = (createdStructures || [])
        .filter((structure: StoryStructure) => {
          const matchingBeat = sortedBeats.find(
            (beat) => beat.id === structure.template_beat_id,
          );
          return matchingBeat?.level === "sequence" && matchingBeat.parent_act;
        })
        .map((structure: StoryStructure) => {
          const matchingBeat = sortedBeats.find(
            (beat) => beat.id === structure.template_beat_id,
          );
          const parentId = actMap.get(matchingBeat?.parent_act ?? "");
          if (!parentId) return null;
          return supabase
            .from("story_structures")
            .update({ parent_structure_id: parentId, updated_at: new Date().toISOString() })
            .eq("id", structure.id)
            .eq("graph_id", graphId);
        })
        .filter(Boolean);

      if (updatePromises.length > 0) {
        const updateResults = await Promise.all(updatePromises);
        const updateError = updateResults.find((r) => r?.error);
        if (updateError?.error) throw updateError.error;
      }

      // Step 4: Re-fetch all structures to get the updated tree
      const { data: finalStructures, error: refetchError } = await supabase
        .from("story_structures")
        .select("*")
        .eq("graph_id", graphId)
        .order("display_order", { ascending: true });

      if (refetchError) throw refetchError;

      const tree = buildTree(finalStructures || []);

      res.status(201).json({
        message: `已根据「${template.name_zh}」模板初始化故事骨架`,
        templateName: template.name_zh,
        templateCode: template.template_code,
        structures: tree,
        count: createdStructures?.length || 0,
      });
    } catch (error: unknown) {
      logger.error("Initialize template error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "初始化模板失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
