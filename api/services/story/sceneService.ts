import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface CreateSceneData {
  structure_id: string;
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status?: "draft" | "revising" | "complete";
  word_count?: number;
}

interface UpdateSceneData {
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status?: "draft" | "revising" | "complete";
  word_count?: number;
}

class SceneService {
  async get(
    supabase: SupabaseClient,
    graphId: string,
    structureId: string,
  ) {
    try {
      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .select(
          `
          *,
          story_characters!pov_character_id (
            id,
            name,
            role_type
          )
        `,
        )
        .eq("graph_id", graphId)
        .eq("structure_id", structureId)
        .maybeSingle();

      if (error) throw error;

      if (!scene) {
        return { scene: null };
      }

      const { data: appearances } = await supabase
        .from("story_appearances")
        .select(
          `
          id,
          character_id,
          role_in_scene,
          notes,
          story_characters!character_id (
            id,
            name,
            role_type
          )
        `,
        )
        .eq("scene_detail_id", scene.id);

      return {
        scene: {
          ...scene,
          appearances: appearances || [],
        },
      };
    } catch (error: unknown) {
      logger.error("Get scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("获取场景详情失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  async create(
    supabase: SupabaseClient,
    graphId: string,
    data: CreateSceneData,
  ) {
    try {
      const insertData = {
        graph_id: graphId,
        structure_id: data.structure_id,
        pov_character_id: data.pov_character_id || null,
        synopsis: data.synopsis || null,
        content: data.content || null,
        location_name: data.location_name || null,
        time_setting: data.time_setting || null,
        writing_status: data.writing_status || "draft",
        word_count: data.word_count || 0,
      };

      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return scene;
    } catch (error: unknown) {
      logger.error("Create scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("创建场景详情失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  async update(
    supabase: SupabaseClient,
    graphId: string,
    id: string,
    data: UpdateSceneData,
  ) {
    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .update(updateData)
        .eq("id", id)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!scene) {
        throw new AppError("场景详情不存在", 404, ErrorCodes.NOT_FOUND);
      }

      return scene;
    } catch (error: unknown) {
      logger.error("Update scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("更新场景详情失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
}

export const sceneService = new SceneService();
