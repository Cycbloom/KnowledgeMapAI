import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import i18next from "i18next";

interface CreateAppearanceData {
  character_id: string;
  scene_detail_id: string;
  role_in_scene?: "protagonist" | "antagonist" | "supporting" | "minor" | "mentioned";
  notes?: string;
}

class AppearanceService {
  async create(
    supabase: SupabaseClient,
    graphId: string,
    data: CreateAppearanceData,
  ) {
    try {
      const insertData = {
        graph_id: graphId,
        character_id: data.character_id,
        scene_detail_id: data.scene_detail_id,
        role_in_scene: data.role_in_scene || "supporting",
        notes: data.notes || null,
      };

      const { data: appearance, error } = await supabase
        .from("story_appearances")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return appearance;
    } catch (error: unknown) {
      logger.error("Create appearance error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(i18next.t("storyEditor.api.errors.appearance.addFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async delete(
    supabase: SupabaseClient,
    graphId: string,
    id: string,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("story_appearances")
        .delete()
        .eq("id", id)
        .eq("graph_id", graphId);

      if (error) throw error;
    } catch (error: unknown) {
      logger.error("Delete appearance error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(i18next.t("storyEditor.api.errors.appearance.deleteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async getStats(
    supabase: SupabaseClient,
    graphId: string,
    characterId: string,
  ) {
    try {
      const [{ data: appearances }, { data: relationships }] =
        await Promise.all([
          supabase
            .from("story_appearances")
            .select(
              `
            id,
            scene_detail_id,
            role_in_scene,
            notes,
            story_scene_details!scene_detail_id (
              id,
              structure_id,
              location_name,
              writing_status
            )
          `,
            )
            .eq("graph_id", graphId)
            .eq("character_id", characterId),
          supabase
            .from("story_character_relationships")
            .select(
              `
            id,
            relationship_type,
            strength,
            status,
            notes,
            target_character_id,
            story_characters!target_character_id (
              id,
              name,
              role_type
            )
          `,
            )
            .eq("graph_id", graphId)
            .or(
              `source_character_id.eq.${characterId},target_character_id.eq.${characterId}`,
            ),
        ]);

      const roleStats = {
        protagonist: 0,
        antagonist: 0,
        supporting: 0,
        minor: 0,
        mentioned: 0,
      };

      (appearances || []).forEach((app) => {
        const role = app.role_in_scene as keyof typeof roleStats;
        if (role in roleStats) {
          roleStats[role]++;
        }
      });

      return {
        characterId,
        stats: {
          totalAppearances: appearances?.length || 0,
          totalRelationships: relationships?.length || 0,
          roleBreakdown: roleStats,
        },
        appearances: appearances || [],
        relationships: relationships || [],
      };
    } catch (error: unknown) {
      logger.error("Get appearance stats error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(i18next.t("storyEditor.api.errors.appearance.fetchStatsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const appearanceService = new AppearanceService();
