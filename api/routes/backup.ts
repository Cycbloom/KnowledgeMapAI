import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { cacheService, CacheKeys } from "../services/common/cacheService";
import { logger } from "../utils/logger";
import {
  createBackup,
  readBackupFile,
  backupService,
} from "../services/common/backupService";
import { createKnowledgePointWithGraphNode } from "../utils/nodeHelpers";
import { edgeService } from "../services/graph/index";
import { studyService } from "../services/study/studyService";
import fs from "fs/promises";

const router = Router();

router.get("/export", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const result = await createBackup(req.supabase!, userId, "manual");

    await backupService.createSnapshotRecord(req.supabase!, userId, {
      type: "manual",
      file_path: result.filePath,
      file_size: result.fileSize,
      graphs_count: result.graphsCount,
      nodes_count: result.nodesCount,
    });

    const content = await fs.readFile(result.filePath, "utf-8");

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="knowledgemap-backup-${new Date().toISOString().split("T")[0]}.json"`,
    );
    res.send(content);
  } catch (error: any) {
    logger.error("Export backup error:", error);
    res.status(500).json({ error: error.message || "导出备份失败" });
  }
});

router.get(
  "/snapshots",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;

    try {
      const snapshots = await backupService.getSnapshots(req.supabase!, userId);
      res.json({ snapshots });
    } catch (error: any) {
      logger.error("Get snapshots error:", error);
      res.status(500).json({ error: error.message || "获取快照列表失败" });
    }
  },
);

router.post(
  "/snapshots",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { type = "manual" } = req.body;

    try {
      const result = await createBackup(req.supabase!, userId, type);

      await backupService.createSnapshotRecord(req.supabase!, userId, {
        type,
        file_path: result.filePath,
        file_size: result.fileSize,
        graphs_count: result.graphsCount,
        nodes_count: result.nodesCount,
      });

      res.json({
        success: true,
        message: "快照创建成功",
        snapshot: {
          file_size: result.fileSize,
          graphs_count: result.graphsCount,
          nodes_count: result.nodesCount,
        },
      });
    } catch (error: any) {
      logger.error("Create snapshot error:", error);
      res.status(500).json({ error: error.message || "创建快照失败" });
    }
  },
);

router.delete(
  "/snapshots/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      await backupService.deleteSnapshot(req.supabase!, id, userId);
      res.json({ success: true, message: "快照已删除" });
    } catch (error: any) {
      logger.error("Delete snapshot error:", error);
      if (error.message === "Snapshot not found") {
        return res.status(404).json({ error: "快照不存在" });
      }
      res.status(500).json({ error: error.message || "删除快照失败" });
    }
  },
);

router.post(
  "/restore/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const snapshot = await backupService.getSnapshot(
        req.supabase!,
        id,
        userId,
      );
      if (!snapshot) {
        return res.status(404).json({ error: "快照不存在" });
      }

      const backupData = await readBackupFile(snapshot.file_path);
      const { data } = backupData;

      const existingGraphs = await req
        .supabase!.from("knowledge_graphs")
        .select("id")
        .eq("user_id", userId);

      if (existingGraphs.data && existingGraphs.data.length > 0) {
        const graphIds = existingGraphs.data.map((g: any) => g.id);

        await req.supabase!.from("study_cards").delete().eq("user_id", userId);
        await req
          .supabase!.from("study_progress")
          .delete()
          .eq("user_id", userId);
        await req.supabase!.from("edges").delete().in("graph_id", graphIds);
        await req
          .supabase!.from("graph_nodes")
          .delete()
          .in("graph_id", graphIds);
        await req
          .supabase!.from("knowledge_graphs")
          .delete()
          .eq("user_id", userId);
      }

      const stats = await restoreBackupData(req.supabase!, userId, data);

      await cacheService.del(CacheKeys.USER_GRAPHS(userId));

      res.json({
        success: true,
        message: "快照恢复成功",
        stats,
      });
    } catch (error: any) {
      logger.error("Restore snapshot error:", error);
      res.status(500).json({ error: error.message || "恢复快照失败" });
    }
  },
);

router.post("/import", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const backupData = req.body;
  const mode = req.query.mode || "merge";

  if (!backupData || !backupData.data) {
    return res.status(400).json({ error: "无效的备份数据格式" });
  }

  const { data } = backupData;

  try {
    if (mode === "replace") {
      const existingGraphs = await req
        .supabase!.from("knowledge_graphs")
        .select("id")
        .eq("user_id", userId);

      if (existingGraphs.data && existingGraphs.data.length > 0) {
        const graphIds = existingGraphs.data.map((g: any) => g.id);

        await req.supabase!.from("study_cards").delete().eq("user_id", userId);
        await req
          .supabase!.from("study_progress")
          .delete()
          .eq("user_id", userId);
        await req.supabase!.from("edges").delete().in("graph_id", graphIds);
        await req
          .supabase!.from("graph_nodes")
          .delete()
          .in("graph_id", graphIds);
        await req
          .supabase!.from("knowledge_graphs")
          .delete()
          .eq("user_id", userId);
      }
    }

    const stats = await restoreBackupData(req.supabase!, userId, data);

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));

    res.json({
      success: true,
      message: mode === "replace" ? "快照恢复成功" : "备份导入成功",
      stats,
      mode,
    });
  } catch (error: any) {
    logger.error("Import backup error:", error);
    res.status(500).json({ error: error.message || "导入备份失败" });
  }
});

async function restoreBackupData(
  supabase: any,
  userId: string,
  data: any,
): Promise<{
  graphs: number;
  nodes: number;
  edges: number;
  study_cards: number;
}> {
  const stats = {
    graphs: 0,
    nodes: 0,
    edges: 0,
    study_cards: 0,
  };

  const oldToNewGraphIds = new Map<string, string>();
  const oldToNewKnowledgePointIds = new Map<string, string>();

  if (data.graphs && data.graphs.length > 0) {
    const graphsToInsert = data.graphs.map((g: any) => ({
      user_id: userId,
      title: g.title,
      description: g.description,
      settings: g.settings || {},
      is_public: g.is_public || false,
    }));

    const { data: insertedGraphs, error: graphsError } = await supabase
      .from("knowledge_graphs")
      .insert(graphsToInsert)
      .select();

    if (graphsError) throw new Error(`导入图谱失败: ${graphsError.message}`);

    insertedGraphs?.forEach((g: any, i: number) => {
      oldToNewGraphIds.set(data.graphs[i].id, g.id);
    });
    stats.graphs = insertedGraphs?.length || 0;
  }

  if (data.nodes && data.nodes.length > 0) {
    for (const n of data.nodes) {
      const graphId = oldToNewGraphIds.get(n.graph_id);
      if (!graphId) continue;

      const result = await createKnowledgePointWithGraphNode(supabase, userId, {
        graph_id: graphId,
        title: n.title,
        content: n.content || "",
        properties: n.properties || {},
        x_position: n.x_position || 0,
        y_position: n.y_position || 0,
        level: n.level || "normal",
      });

      if (result) {
        oldToNewKnowledgePointIds.set(
          n.id,
          result.knowledge_point_id || result.id,
        );
        stats.nodes++;
      }
    }
  }

  if (data.edges && data.edges.length > 0) {
    for (const e of data.edges) {
      const graphId = oldToNewGraphIds.get(e.graph_id);
      const sourceKPId = oldToNewKnowledgePointIds.get(
        e.source_knowledge_point_id,
      );
      const targetKPId = oldToNewKnowledgePointIds.get(
        e.target_knowledge_point_id,
      );

      if (graphId && sourceKPId && targetKPId) {
        try {
          await edgeService.create(supabase, {
            graph_id: graphId,
            source_knowledge_point_id: sourceKPId,
            target_knowledge_point_id: targetKPId,
            relationship_type: e.relationship_type || "contains",
          });
          stats.edges++;
        } catch (err) {
          logger.warn("Failed to restore edge:", err);
        }
      }
    }
  }

  if (data.study_cards && data.study_cards.length > 0) {
    for (const c of data.study_cards) {
      const graphId = oldToNewGraphIds.get(c.graph_id);
      const kpId = oldToNewKnowledgePointIds.get(c.knowledge_point_id);

      if (graphId && kpId) {
        try {
          await studyService.createCard(supabase, {
            userId,
            knowledgePointId: kpId,
            sourceGraphId: graphId,
            question: c.question,
            answer: c.answer,
            explanation: c.explanation,
            cardType: c.card_type || "qa",
            options: c.options,
          });
          stats.study_cards++;
        } catch (err) {
          logger.warn("Failed to restore study card:", err);
        }
      }
    }
  }

  return stats;
}

export default router;
