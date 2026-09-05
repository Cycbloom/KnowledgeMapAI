/**
 * @schedule decision - 知识点完成的全局同步（P4 完成闭环）。
 *
 * 背景：排期主体是知识点（learning_path_schedule 全局唯一键），知识点在
 * 任一路径中学习完成后，其他路径与日历必须同步收口，否则日历残留待学、
 * 工时重复计算。本服务在知识点完成后执行：
 *
 * 1) 排期行收口：该知识点所有 scheduled 行 → 今日及以前 completed、未来 skipped；
 * 2) 跨路径节点同步：其他路径中同知识点的 pending/in_progress 节点 → completed
 *    （知识已掌握，无需在别的路径重学），并写入对应 progress 行；
 * 3) 受影响路径重算整体完成状态（全部节点完成 → learning_paths.status = completed）。
 *
 * 只做原始表查询，不 import study 层（study 层会 import 本服务，避免环）。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

class ScheduleSyncService {
  async syncKnowledgePointCompleted(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    options?: { excludePathId?: string; now?: Date },
  ): Promise<void> {
    const now = options?.now ?? new Date();
    const today = toDateString(now);
    const nowIso = now.toISOString();

    // 1) 排期行收口：今天及以前 → completed；未来 → skipped
    const { error: completeError } = await supabase
      .from("learning_path_schedule")
      .update({ status: "completed" })
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .eq("status", "scheduled")
      .lte("scheduled_date", today);
    if (completeError) {
      logger.warn("[ScheduleSync] complete schedule rows failed", {
        userId,
        knowledgePointId,
        error: completeError.message,
      });
    }

    const { error: skipError } = await supabase
      .from("learning_path_schedule")
      .update({ status: "skipped" })
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .eq("status", "scheduled")
      .gt("scheduled_date", today);
    if (skipError) {
      logger.warn("[ScheduleSync] skip future schedule rows failed", {
        userId,
        knowledgePointId,
        error: skipError.message,
      });
    }

    // 2) 其他路径中同知识点的未完成节点 → completed
    const { data: pendingNodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, path_id")
      .eq("knowledge_point_id", knowledgePointId)
      .in("status", ["pending", "in_progress"]);
    if (nodesError) {
      logger.warn("[ScheduleSync] fetch pending nodes failed", {
        userId,
        knowledgePointId,
        error: nodesError.message,
      });
      return;
    }

    const excludePathId = options?.excludePathId;
    const candidates = (pendingNodes ?? []).filter(
      (n: { path_id: string }) =>
        n.path_id && n.path_id !== excludePathId,
    );
    if (candidates.length === 0) return;

    // 节点无 user_id，需按路径归属过滤出本用户的路径
    const candidatePathIds = Array.from(
      new Set(candidates.map((n: { path_id: string }) => n.path_id)),
    );
    const { data: ownedPaths, error: pathsError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .in("id", candidatePathIds);
    if (pathsError) {
      logger.warn("[ScheduleSync] fetch owned paths failed", {
        userId,
        error: pathsError.message,
      });
      return;
    }
    const ownedPathIds = new Set((ownedPaths ?? []).map((p) => p.id as string));
    const affectedNodes = candidates.filter((n: { path_id: string }) =>
      ownedPathIds.has(n.path_id),
    );
    if (affectedNodes.length === 0) return;

    const affectedPathIds = new Set<string>();
    for (const node of affectedNodes as Array<{ id: string; path_id: string }>) {
      affectedPathIds.add(node.path_id);
      const { error: nodeUpdateError } = await supabase
        .from("learning_path_nodes")
        .update({ status: "completed", completed_at: nowIso, updated_at: nowIso })
        .eq("id", node.id);
      if (nodeUpdateError) {
        logger.warn("[ScheduleSync] complete cross-path node failed", {
          nodeId: node.id,
          error: nodeUpdateError.message,
        });
        continue;
      }
      const { error: progressError } = await supabase
        .from("learning_path_progress")
        .upsert(
          {
            user_id: userId,
            path_id: node.path_id,
            node_id: node.id,
            status: "completed",
            progress_percentage: 100,
            completed_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id,path_id,node_id" },
        );
      if (progressError) {
        logger.warn("[ScheduleSync] upsert cross-path progress failed", {
          nodeId: node.id,
          error: progressError.message,
        });
      }
    }

    // 3) 受影响路径重算整体完成状态
    for (const pathId of affectedPathIds) {
      const { data: allNodes, error: allNodesError } = await supabase
        .from("learning_path_nodes")
        .select("status")
        .eq("path_id", pathId);
      if (allNodesError) {
        logger.warn("[ScheduleSync] recount path nodes failed", {
          pathId,
          error: allNodesError.message,
        });
        continue;
      }
      const nodes = allNodes ?? [];
      const allCompleted =
        nodes.length > 0 &&
        nodes.every((n: { status: string }) => n.status === "completed");
      if (!allCompleted) continue;
      const { error: pathUpdateError } = await supabase
        .from("learning_paths")
        .update({ status: "completed", updated_at: nowIso })
        .eq("id", pathId)
        .eq("user_id", userId);
      if (pathUpdateError) {
        logger.warn("[ScheduleSync] complete path failed", {
          pathId,
          error: pathUpdateError.message,
        });
      }
    }

    logger.info("[ScheduleSync] knowledge point completion synced", {
      userId,
      knowledgePointId,
      affectedPaths: affectedPathIds.size,
      affectedNodes: affectedNodes.length,
    });
  }
}

export const scheduleSyncService = new ScheduleSyncService();
export { ScheduleSyncService };
