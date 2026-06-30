import { SupabaseClient } from "@supabase/supabase-js";
import { cacheService } from "../common/cacheService";
import { softDelete } from "../../utils/softDelete";
import { withThreeLevelFallback } from "../../utils/rpcFallback";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { appEventBus } from "../core/eventBus";
import type { GraphDeletedPayload, GraphUpdatedPayload } from "@shared/types/events";
import { notDeleted } from '../common/softDeleteHelper';

/**
 * 图谱批量操作子服务
 *
 * 负责图谱的删除、恢复操作，包括单个和批量操作。
 * 所有涉及软删除、永久删除和恢复的逻辑集中在此服务中。
 */
export class GraphBatchService {
  async deleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    await withThreeLevelFallback<void>({
      context: 'deleteGraph',
      rpcFn: async () => {
        const { error } = await supabase.rpc('soft_delete_graph_with_branches', {
          p_graph_id: graphId,
          p_user_id: userId,
        });
        if (error) throw error;

        // RPC succeeded — publish events and invalidate cache
        const { data: branches } = await supabase
          .from("knowledge_graphs")
          .select("id")
          .eq("parent_graph_id", graphId)
          .eq("is_branch", true)
          .not("deleted_at", "is", null);

        for (const branch of branches ?? []) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: branch.id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      },
      txFn: async (client) => {
        const branchIds = await (async () => {
          const { rows: branches } = await client.query(
            `SELECT id FROM knowledge_graphs WHERE parent_graph_id = $1 AND is_branch = true AND deleted_at IS NULL`,
            [graphId],
          );

          if (branches.length > 0) {
            const ids = branches.map((b: { id: string }) => b.id);
            await client.query(
              `UPDATE knowledge_graphs SET deleted_at = $1 WHERE id = ANY($2)`,
              [new Date().toISOString(), ids],
            );
            return ids;
          }
          return [];
        })();

        for (const branchId of branchIds) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: branchId, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        const result = await softDelete(supabase, "knowledge_graphs", graphId);
        if (!result.success) {
          throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
        }

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      },
      fallbackFn: async () => {
        const { data: branches } = await notDeleted(supabase
          .from("knowledge_graphs")
          .select("id")
          .eq("parent_graph_id", graphId)
          .eq("is_branch", true)
          );

        if (branches && branches.length > 0) {
          const branchIds = branches.map((b: { id: string }) => b.id);
          await supabase
            .from("knowledge_graphs")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", branchIds);

          for (const branch of branches) {
            appEventBus.publish(
              "graph_deleted",
              { graphId: branch.id, userId } as GraphDeletedPayload,
              userId,
              "graph_service",
            );
          }
        }

        const result = await softDelete(supabase, "knowledge_graphs", graphId);
        if (!result.success) {
          throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
        }

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      },
    });
  }

  async deleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    // Get branch IDs before RPC for event publishing
    const { data: allBranches } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id")
      .in("parent_graph_id", graphIds)
      .eq("is_branch", true)
      );

    return withThreeLevelFallback<{ count: number }>({
      context: 'deleteGraphs',
      rpcFn: async () => {
        const { data, error } = await supabase.rpc('batch_soft_delete_graphs', {
          p_graph_ids: graphIds,
          p_user_id: userId,
        });
        if (error) throw error;

        // RPC succeeded — publish events and invalidate cache
        for (const branch of allBranches ?? []) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: branch.id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        await cacheService.invalidateUserGraphsCache(userId);

        for (const id of graphIds) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        return { count: (data as { graph_count: number })?.graph_count ?? graphIds.length };
      },
      fallbackFn: async () => {
        const { data, error } = await supabase
          .from("knowledge_graphs")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", graphIds)
          .eq("user_id", userId)
          .select("id");

        if (error) throw error;

        if (allBranches && allBranches.length > 0) {
          const branchIds = allBranches.map((b: { id: string }) => b.id);
          await supabase
            .from("knowledge_graphs")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", branchIds);

          for (const branch of allBranches) {
            appEventBus.publish(
              "graph_deleted",
              { graphId: branch.id, userId } as GraphDeletedPayload,
              userId,
              "graph_service",
            );
          }
        }

        await cacheService.invalidateUserGraphsCache(userId);

        for (const id of data?.map((g: { id: string }) => g.id) || []) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        return { count: data?.length || 0 };
      },
    });
  }

  async restoreGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    const { error } = await supabase
      .from("knowledge_graphs")
      .update({ deleted_at: null })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (error) throw error;

    await cacheService.invalidateUserGraphsCache(userId);

    appEventBus.publish(
      "graph_updated",
      { graphId, userId } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );
  }

  async restoreGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .update({ deleted_at: null })
      .in("id", graphIds)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;

    await cacheService.invalidateUserGraphsCache(userId);

    for (const id of data?.map((g: { id: string }) => g.id) || []) {
      appEventBus.publish(
        "graph_updated",
        { graphId: id, userId } as GraphUpdatedPayload,
        userId,
        "graph_service",
      );
    }

    return { count: data?.length || 0 };
  }

  async permanentDeleteGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    // Get branch IDs before RPC since they will be hard-deleted
    const { data: branches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("parent_graph_id", graphId)
      .eq("is_branch", true);

    await withThreeLevelFallback<void>({
      context: 'permanentDeleteGraph',
      rpcFn: async () => {
        const { error } = await supabase.rpc('permanent_delete_graph', {
          p_graph_id: graphId,
          p_user_id: userId,
        });
        if (error) throw error;

        // RPC succeeded — publish events and invalidate cache
        for (const branch of branches ?? []) {
          await cacheService.invalidateAllGraphRelated(userId, branch.id);
          appEventBus.publish(
            "graph_deleted",
            { graphId: branch.id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      },
      fallbackFn: async () => {
        if (branches && branches.length > 0) {
          const branchIds = branches.map((b: { id: string }) => b.id);
          await supabase
            .from("knowledge_graphs")
            .delete()
            .in("id", branchIds);

          for (const branch of branches) {
            await cacheService.invalidateAllGraphRelated(userId, branch.id);
            appEventBus.publish(
              "graph_deleted",
              { graphId: branch.id, userId } as GraphDeletedPayload,
              userId,
              "graph_service",
            );
          }
        }

        const { error } = await supabase
          .from("knowledge_graphs")
          .delete()
          .eq("id", graphId)
          .eq("user_id", userId);

        if (error) throw error;

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      },
    });
  }

  async permanentDeleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    // Get branch IDs before RPC since they will be hard-deleted
    const { data: allBranches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .in("parent_graph_id", graphIds)
      .eq("is_branch", true);

    return withThreeLevelFallback<{ count: number }>({
      context: 'permanentDeleteGraphs',
      rpcFn: async () => {
        const { data, error } = await supabase.rpc('batch_permanent_delete_graphs', {
          p_graph_ids: graphIds,
          p_user_id: userId,
        });
        if (error) throw error;

        // RPC succeeded — publish events and invalidate cache
        for (const branch of allBranches ?? []) {
          await cacheService.invalidateAllGraphRelated(userId, branch.id);
          appEventBus.publish(
            "graph_deleted",
            { graphId: branch.id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        await cacheService.invalidateUserGraphsCache(userId);

        for (const id of graphIds) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        return { count: (data as { graph_count: number })?.graph_count ?? graphIds.length };
      },
      fallbackFn: async () => {
        const { data, error } = await supabase
          .from("knowledge_graphs")
          .delete()
          .in("id", graphIds)
          .eq("user_id", userId)
          .select("id");

        if (error) throw error;

        if (allBranches && allBranches.length > 0) {
          const branchIds = allBranches.map((b: { id: string }) => b.id);
          await supabase
            .from("knowledge_graphs")
            .delete()
            .in("id", branchIds);

          for (const branch of allBranches) {
            await cacheService.invalidateAllGraphRelated(userId, branch.id);
            appEventBus.publish(
              "graph_deleted",
              { graphId: branch.id, userId } as GraphDeletedPayload,
              userId,
              "graph_service",
            );
          }
        }

        await cacheService.invalidateUserGraphsCache(userId);

        for (const id of data?.map((g: { id: string }) => g.id) || []) {
          appEventBus.publish(
            "graph_deleted",
            { graphId: id, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        return { count: data?.length || 0 };
      },
    });
  }
}

export const graphBatchService = new GraphBatchService();
