import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";

interface CustomRegion {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface CreateRegionData {
  name: string;
  color: string;
  nodeIds: string[];
}

interface UpdateRegionData {
  name?: string;
  color?: string;
  nodeIds?: string[];
}

class RegionService {
  async list(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<CustomRegion[]> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState = settings.quadrantViewState as {
      customRegions?: CustomRegion[];
    } | undefined;

    const customRegions = quadrantViewState?.customRegions || [];

    return customRegions;
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    data: CreateRegionData,
  ): Promise<CustomRegion> {
    const { name, color, nodeIds } = data;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState =
      (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions =
      (quadrantViewState.customRegions as CustomRegion[]) || [];

    const newRegion: CustomRegion = {
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      nodeIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRegions = [...customRegions, newRegion];

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("创建区域失败", { graphId, error: updateError.message });
      throw new AppError("创建区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域创建成功", { graphId, regionId: newRegion.id, userId });

    return newRegion;
  }

  async update(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    regionId: string,
    updates: UpdateRegionData,
  ): Promise<CustomRegion> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState =
      (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions =
      (quadrantViewState.customRegions as CustomRegion[]) || [];

    const regionIndex = customRegions.findIndex((r) => r.id === regionId);

    if (regionIndex === -1) {
      throw new AppError("区域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updatedRegion: CustomRegion = {
      ...customRegions[regionIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedRegions = [...customRegions];
    updatedRegions[regionIndex] = updatedRegion;

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("更新区域失败", {
        graphId,
        regionId,
        error: updateError.message,
      });
      throw new AppError("更新区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域更新成功", { graphId, regionId, userId });

    return updatedRegion;
  }

  async delete(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    regionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState =
      (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions =
      (quadrantViewState.customRegions as CustomRegion[]) || [];

    const regionIndex = customRegions.findIndex((r) => r.id === regionId);

    if (regionIndex === -1) {
      throw new AppError("区域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updatedRegions = customRegions.filter((r) => r.id !== regionId);

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("删除区域失败", {
        graphId,
        regionId,
        error: updateError.message,
      });
      throw new AppError("删除区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域删除成功", { graphId, regionId, userId });

    return { success: true, message: "区域已删除" };
  }
}

export const regionService = new RegionService();

export type { CustomRegion, CreateRegionData, UpdateRegionData };
