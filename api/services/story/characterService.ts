import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

class CharacterService {
  async list(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<{ characters: Record<string, unknown>[] }> {
    try {
      const { data: characters, error } = await supabase
        .from("story_characters")
        .select("*")
        .eq("graph_id", graphId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      let charactersWithStats = characters || [];

      if (charactersWithStats.length > 0) {
        const [{ data: relationships }, { data: appearances }] =
          await Promise.all([
            supabase
              .from("story_character_relationships")
              .select(
                "source_character_id, target_character_id, relationship_type",
              )
              .eq("graph_id", graphId),
            supabase
              .from("story_appearances")
              .select("character_id")
              .eq("graph_id", graphId),
          ]);

        const relationshipCountMap = new Map<string, number>();
        (relationships || []).forEach((rel) => {
          // Count both source and target directions
          relationshipCountMap.set(
            rel.source_character_id,
            (relationshipCountMap.get(rel.source_character_id) || 0) + 1,
          );
          relationshipCountMap.set(
            rel.target_character_id,
            (relationshipCountMap.get(rel.target_character_id) || 0) + 1,
          );
        });

        const appearanceCountMap = new Map<string, number>();
        (appearances || []).forEach((app) => {
          appearanceCountMap.set(
            app.character_id,
            (appearanceCountMap.get(app.character_id) || 0) + 1,
          );
        });

        charactersWithStats = charactersWithStats.map((character) => ({
          ...character,
          _count: {
            relationships: relationshipCountMap.get(character.id) || 0,
            appearances: appearanceCountMap.get(character.id) || 0,
          },
        }));
      }

      return { characters: charactersWithStats };
    } catch (error: unknown) {
      logger.error("Get story characters error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("获取角色列表失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async create(
    supabase: SupabaseClient,
    graphId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const insertData = {
        graph_id: graphId,
        ...data,
      };

      const { data: character, error } = await supabase
        .from("story_characters")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return character as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error("Create story character error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("创建角色失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async update(
    supabase: SupabaseClient,
    graphId: string,
    characterId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: character, error } = await supabase
        .from("story_characters")
        .update(updateData)
        .eq("id", characterId)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!character) {
        throw new AppError("角色不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      return character as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error("Update story character error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("更新角色失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async delete(
    supabase: SupabaseClient,
    graphId: string,
    characterId: string,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("story_characters")
        .delete()
        .eq("id", characterId)
        .eq("graph_id", graphId);

      if (error) throw error;
    } catch (error: unknown) {
      logger.error("Delete story character error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("删除角色失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const characterService = new CharacterService();
