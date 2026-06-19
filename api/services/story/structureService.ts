import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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

function buildTree(structures: StoryStructure[]): StoryStructure[] {
  const map = new Map<string, StoryStructure>();
  const roots: StoryStructure[] = [];

  structures.forEach((structure) => {
    map.set(structure.id, { ...structure, children: [] });
  });

  structures.forEach((structure) => {
    const node = map.get(structure.id)!;
    if (
      structure.parent_structure_id &&
      map.has(structure.parent_structure_id)
    ) {
      const parent = map.get(structure.parent_structure_id)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

class StructureService {
  async listStructures(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<StoryStructure[]> {
    try {
      const { data: structures, error } = await supabase
        .from("story_structures")
        .select("*")
        .eq("graph_id", graphId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const tree = buildTree(structures || []);

      return tree;
    } catch (error: unknown) {
      logger.error("Get story structures error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("获取故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async createStructure(
    supabase: SupabaseClient,
    graphId: string,
    data: {
      structure_level: string;
      parent_structure_id?: string;
      title: string;
      synopsis?: string;
      display_order: number;
      template_beat_id?: string;
    },
  ): Promise<Record<string, unknown>> {
    try {
      const {
        structure_level,
        parent_structure_id,
        title,
        synopsis,
        display_order,
        template_beat_id,
      } = data;

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

      return structure as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error("Create story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("创建故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async updateStructure(
    supabase: SupabaseClient,
    graphId: string,
    structureId: string,
    updateData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const dataToUpdate = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      const { data: structure, error } = await supabase
        .from("story_structures")
        .update(dataToUpdate)
        .eq("id", structureId)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!structure) {
        throw new AppError("故事结构不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      return structure as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error("Update story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("更新故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async deleteStructure(
    supabase: SupabaseClient,
    graphId: string,
    structureId: string,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("story_structures")
        .delete()
        .eq("id", structureId)
        .eq("graph_id", graphId);

      if (error) throw error;
    } catch (error: unknown) {
      logger.error("Delete story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("删除故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async initializeFromTemplate(
    supabase: SupabaseClient,
    graphId: string,
    templateCode: string,
  ): Promise<{
    message: string;
    templateName: string;
    templateCode: string;
    structures: StoryStructure[];
    count: number;
  }> {
    try {
      const { data: template, error: templateError } = await supabase
        .from("story_templates")
        .select("*")
        .eq("template_code", templateCode)
        .single();

      if (templateError || !template) {
        throw new AppError("模板不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const beats = template.beats as StoryTemplateBeat[];

      if (!beats || beats.length === 0) {
        throw new AppError(
          "模板没有定义节拍",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
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
            .update({
              parent_structure_id: parentId,
              updated_at: new Date().toISOString(),
            })
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

      return {
        message: `已根据「${template.name_zh}」模板初始化故事骨架`,
        templateName: template.name_zh,
        templateCode: template.template_code,
        structures: tree,
        count: createdStructures?.length || 0,
      };
    } catch (error: unknown) {
      logger.error("Initialize template error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("初始化模板失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const structureService = new StructureService();
