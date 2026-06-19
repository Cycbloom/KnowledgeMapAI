import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface CreateRelationshipData {
  source_character_id: string;
  target_character_id: string;
  relationship_type: string;
  strength?: number;
  status?: string;
  notes?: string;
}

class RelationshipService {
  async list(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      const { data: relationships, error } = await supabase
        .from("story_character_relationships")
        .select(
          `
          *,
          source_character:story_characters!source_character_id (id, name, role_type),
          target_character:story_characters!target_character_id (id, name, role_type)
        `,
        )
        .eq("graph_id", graphId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return relationships || [];
    } catch (error: unknown) {
      logger.error("Get relationships error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("获取角色关系失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async create(
    supabase: SupabaseClient,
    graphId: string,
    data: CreateRelationshipData,
  ): Promise<Record<string, unknown>> {
    try {
      const insertData = {
        graph_id: graphId,
        source_character_id: data.source_character_id,
        target_character_id: data.target_character_id,
        relationship_type: data.relationship_type,
        strength: data.strength ?? 5,
        status: data.status ?? "active",
        notes: data.notes || null,
      };

      const { data: relationship, error } = await supabase
        .from("story_character_relationships")
        .insert(insertData)
        .select(
          `
          *,
          source_character:story_characters!source_character_id (id, name, role_type),
          target_character:story_characters!target_character_id (id, name, role_type)
        `,
        )
        .single();

      if (error) throw error;

      return relationship as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error("Create relationship error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("创建角色关系失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async delete(
    supabase: SupabaseClient,
    graphId: string,
    id: string,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("story_character_relationships")
        .delete()
        .eq("id", id)
        .eq("graph_id", graphId);

      if (error) throw error;
    } catch (error: unknown) {
      logger.error("Delete relationship error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("删除角色关系失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const relationshipService = new RelationshipService();
