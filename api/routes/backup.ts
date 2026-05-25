import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { cacheService, CacheKeys } from "../services/common/cacheService";
import { logger } from "../utils/logger";
import {
  createBackup,
  readBackupFile,
  backupService,
} from "../services/common/backupService";
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
  } catch (error) {
    logger.error("Export backup error:", error);
    res.status(500).json({ error: (error as Error).message || "导出备份失败" });
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
    } catch (error) {
      logger.error("Get snapshots error:", error);
      res.status(500).json({ error: (error as Error).message || "获取快照列表失败" });
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
    } catch (error) {
      logger.error("Create snapshot error:", error);
      res.status(500).json({ error: (error as Error).message || "创建快照失败" });
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
    } catch (error) {
      logger.error("Delete snapshot error:", error);
      if ((error as Error).message === "Snapshot not found") {
        return res.status(404).json({ error: "快照不存在" });
      }
      res.status(500).json({ error: (error as Error).message || "删除快照失败" });
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
        const graphIds = existingGraphs.data.map((g: { id: string }) => g.id);

        await req.supabase!.from("graph_backbone_modules").delete().in("graph_id", graphIds);
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
    } catch (error) {
      logger.error("Restore snapshot error:", error);
      res.status(500).json({ error: (error as Error).message || "恢复快照失败" });
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
        const graphIds = existingGraphs.data.map((g: { id: string }) => g.id);

        await req.supabase!.from("graph_backbone_modules").delete().in("graph_id", graphIds);
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
  } catch (error) {
    logger.error("Import backup error:", error);
    res.status(500).json({ error: (error as Error).message || "导入备份失败" });
  }
});

async function restoreBackupData(
  supabase: AuthRequest["supabase"],
  userId: string,
  data: {
    graphs?: Array<{
      id: string;
      title: string;
      description?: string | null;
      domain?: string | null;
      is_favorite?: boolean;
      template_type?: string | null;
      settings?: Record<string, unknown> | null;
      is_public?: boolean;
      reference_books?: Record<string, unknown>[] | null;
      external_links?: Record<string, unknown>[] | null;
      learning_guide?: string | null;
      parent_graph_id?: string | null;
      last_used_at?: string | null;
      task_id?: string | null;
      podcast_script?: string | null;
    }>;
    nodes?: Array<{
      id: string;
      graph_id: string;
      title: string;
      content?: string;
      learning_material?: string;
      keywords?: Record<string, unknown>[] | null;
      aliases?: string[] | null;
      properties?: Record<string, unknown>;
      mastery_level?: number | null;
      last_study_at?: string | null;
      total_study_duration?: number | null;
      x_position?: number;
      y_position?: number;
      level?: string;
      is_accepted?: boolean;
    }>;
    edges?: Array<{
      graph_id: string;
      source_knowledge_point_id: string;
      target_knowledge_point_id: string;
      relationship_type?: string;
      weight?: number;
      custom_label?: string | null;
      custom_color?: string | null;
      custom_line_style?: string | null;
      show_arrow?: boolean | null;
    }>;
    study_cards?: Array<{
      graph_id: string;
      knowledge_point_id: string;
      question: string;
      answer: string;
      explanation?: string | null;
      card_type?: string;
      options?: string[] | null;
      difficulty?: number;
      last_reviewed?: string | null;
      next_review?: string;
      review_count?: number;
      fsrs_state?: string;
      fsrs_stability?: number;
      fsrs_difficulty?: number;
      fsrs_elapsed_days?: number;
      fsrs_scheduled_days?: number;
      fsrs_retrievability?: number;
      fsrs_last_review?: string | null;
    }>;
    study_progress?: Array<{
      graph_id: string;
      total_nodes?: number;
      mastered_nodes?: number;
      progress_percentage?: number;
      study_streak?: number;
    }>;
    focus_sessions?: Array<{
      task_id?: string | null;
      started_at?: string;
      ended_at?: string | null;
      duration?: number | null;
      mode?: string | null;
      completed?: boolean | null;
      pomodoro_count?: number;
      white_noise_type?: string | null;
      is_break?: boolean;
    }>;
    user_achievements?: Array<{
      achievement_id: string;
      progress?: number;
      metadata?: Record<string, unknown>;
      unlocked_at?: string;
    }>;
    periodic_tasks?: Array<{
      period_type: string;
      period_start: string;
      period_end: string;
      task_type: string;
      target: number;
      progress?: number;
      status?: string;
      xp_reward?: number;
      pass_points?: number;
    }>;
    backbone_modules?: Array<{
      graph_id: string;
      module_type: string;
      title: string;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
      display_order?: number;
    }>;
  },
): Promise<{
  graphs: number;
  nodes: number;
  edges: number;
  study_cards: number;
  study_progress: number;
  focus_sessions: number;
  user_achievements: number;
  periodic_tasks: number;
  backbone_modules: number;
}> {
  const stats = {
    graphs: 0,
    nodes: 0,
    edges: 0,
    study_cards: 0,
    study_progress: 0,
    focus_sessions: 0,
    user_achievements: 0,
    periodic_tasks: 0,
    backbone_modules: 0,
  };

  const oldToNewGraphIds = new Map<string, string>();
  const oldToNewKnowledgePointIds = new Map<string, string>();

  if (data.graphs && data.graphs.length > 0) {
    const graphsToInsert = data.graphs.map((g) => ({
      user_id: userId,
      title: g.title,
      description: g.description,
      domain: g.domain || null,
      is_favorite: g.is_favorite || false,
      template_type: g.template_type || null,
      settings: g.settings || {},
      is_public: g.is_public || false,
      reference_books: g.reference_books || null,
      external_links: g.external_links || null,
      learning_guide: g.learning_guide || null,
      last_used_at: g.last_used_at || null,
      podcast_script: g.podcast_script || null,
    }));

    const { data: insertedGraphs, error: graphsError } = await supabase!
      .from("knowledge_graphs")
      .insert(graphsToInsert)
      .select();

    if (graphsError) throw new Error(`导入图谱失败: ${graphsError.message}`);

    insertedGraphs?.forEach((g, i) => {
      oldToNewGraphIds.set(data.graphs![i].id, g.id);
    });
    stats.graphs = insertedGraphs?.length || 0;
  }

  if (data.nodes && data.nodes.length > 0) {
    for (const n of data.nodes) {
      const graphId = oldToNewGraphIds.get(n.graph_id);
      if (!graphId) continue;

      const { data: kp, error: kpError } = await supabase!
        .from("knowledge_points")
        .insert({
          title: n.title,
          content: n.content || "",
          learning_material: n.learning_material || null,
          keywords: n.keywords || [],
          aliases: n.aliases || [],
          properties: n.properties || {},
          visibility: "private",
          owner_id: userId,
          mastery_level: n.mastery_level || 0,
          last_study_at: n.last_study_at || null,
          total_study_duration: n.total_study_duration || 0,
        })
        .select("id")
        .single();

      if (kpError) {
        logger.warn("Failed to restore knowledge point:", kpError);
        continue;
      }

      const { error: gnError } = await supabase!
        .from("graph_nodes")
        .insert({
          graph_id: graphId,
          knowledge_point_id: kp.id,
          x_position: n.x_position || 0,
          y_position: n.y_position || 0,
          level: n.level || "normal",
          is_accepted: n.is_accepted !== undefined ? n.is_accepted : true,
        });

      if (gnError) {
        logger.warn("Failed to restore graph node:", gnError);
        await supabase!.from("knowledge_points").delete().eq("id", kp.id);
        continue;
      }

      oldToNewKnowledgePointIds.set(n.id, kp.id);
      stats.nodes++;
    }
  }

  if (data.edges && data.edges.length > 0) {
    const edgesToInsert = data.edges
      .map((e) => {
        const graphId = oldToNewGraphIds.get(e.graph_id);
        const sourceKPId = oldToNewKnowledgePointIds.get(e.source_knowledge_point_id);
        const targetKPId = oldToNewKnowledgePointIds.get(e.target_knowledge_point_id);
        if (!graphId || !sourceKPId || !targetKPId) return null;
        return {
          graph_id: graphId,
          source_knowledge_point_id: sourceKPId,
          target_knowledge_point_id: targetKPId,
          relationship_type: e.relationship_type || "related",
          weight: e.weight || 1,
          custom_label: e.custom_label || null,
          custom_color: e.custom_color || null,
          custom_line_style: e.custom_line_style || null,
          show_arrow: e.show_arrow !== undefined ? e.show_arrow : null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (edgesToInsert.length > 0) {
      const { error: edgesError } = await supabase!
        .from("edges")
        .insert(edgesToInsert);

      if (edgesError) {
        logger.warn("Failed to restore edges:", edgesError);
      } else {
        stats.edges = edgesToInsert.length;
      }
    }
  }

  if (data.study_cards && data.study_cards.length > 0) {
    const cardsToInsert = data.study_cards
      .map((c) => {
        const graphId = oldToNewGraphIds.get(c.graph_id);
        const kpId = oldToNewKnowledgePointIds.get(c.knowledge_point_id);
        if (!graphId || !kpId) return null;
        return {
          user_id: userId,
          knowledge_point_id: kpId,
          graph_id: graphId,
          source_graph_id: graphId,
          question: c.question,
          answer: c.answer,
          explanation: c.explanation || null,
          card_type: c.card_type || "qa",
          options: c.options || null,
          difficulty: c.difficulty || 1,
          last_reviewed: c.last_reviewed || null,
          next_review: c.next_review || new Date().toISOString(),
          review_count: c.review_count || 0,
          fsrs_state: c.fsrs_state || "New",
          fsrs_stability: c.fsrs_stability || 0,
          fsrs_difficulty: c.fsrs_difficulty || 0,
          fsrs_elapsed_days: c.fsrs_elapsed_days || 0,
          fsrs_scheduled_days: c.fsrs_scheduled_days || 0,
          fsrs_retrievability: c.fsrs_retrievability || 0,
          fsrs_last_review: c.fsrs_last_review || null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (cardsToInsert.length > 0) {
      const { error: cardsError } = await supabase!
        .from("study_cards")
        .insert(cardsToInsert);

      if (cardsError) {
        logger.warn("Failed to restore study cards:", cardsError);
      } else {
        stats.study_cards = cardsToInsert.length;
      }
    }
  }

  if (data.study_progress && data.study_progress.length > 0) {
    const progressToInsert = data.study_progress
      .map((sp) => {
        const graphId = oldToNewGraphIds.get(sp.graph_id);
        if (!graphId) return null;
        return {
          user_id: userId,
          graph_id: graphId,
          total_nodes: sp.total_nodes || 0,
          mastered_nodes: sp.mastered_nodes || 0,
          progress_percentage: sp.progress_percentage || 0,
          study_streak: sp.study_streak || 0,
        };
      })
      .filter((sp): sp is NonNullable<typeof sp> => sp !== null);

    if (progressToInsert.length > 0) {
      const { error } = await supabase!
        .from("study_progress")
        .insert(progressToInsert);

      if (error) {
        logger.warn("Failed to restore study progress:", error);
      } else {
        stats.study_progress = progressToInsert.length;
      }
    }
  }

  if (data.focus_sessions && data.focus_sessions.length > 0) {
    const sessionsToInsert = data.focus_sessions.map((fs) => ({
      user_id: userId,
      task_id: fs.task_id || null,
      started_at: fs.started_at || new Date().toISOString(),
      ended_at: fs.ended_at || new Date().toISOString(),
      duration: fs.duration || 0,
      mode: fs.mode || "focus",
      completed: fs.completed !== undefined ? fs.completed : true,
      pomodoro_count: fs.pomodoro_count || 0,
      white_noise_type: fs.white_noise_type || null,
      is_break: fs.is_break || false,
    }));

    if (sessionsToInsert.length > 0) {
      const { error } = await supabase!
        .from("focus_sessions")
        .insert(sessionsToInsert);

      if (error) {
        logger.warn("Failed to restore focus sessions:", error);
      } else {
        stats.focus_sessions = sessionsToInsert.length;
      }
    }
  }

  if (data.user_achievements && data.user_achievements.length > 0) {
    const achievementsToInsert = data.user_achievements.map((ua) => ({
      user_id: userId,
      achievement_id: ua.achievement_id,
      progress: ua.progress || 0,
      metadata: ua.metadata || {},
      unlocked_at: ua.unlocked_at || new Date().toISOString(),
    }));

    if (achievementsToInsert.length > 0) {
      const { error } = await supabase!
        .from("user_achievements")
        .insert(achievementsToInsert);

      if (error) {
        logger.warn("Failed to restore user achievements:", error);
      } else {
        stats.user_achievements = achievementsToInsert.length;
      }
    }
  }

  if (data.periodic_tasks && data.periodic_tasks.length > 0) {
    const tasksToInsert = data.periodic_tasks.map((pt) => ({
      user_id: userId,
      period_type: pt.period_type,
      period_start: pt.period_start,
      period_end: pt.period_end,
      task_type: pt.task_type,
      target: pt.target,
      progress: pt.progress || 0,
      status: pt.status || "pending",
      xp_reward: pt.xp_reward || 0,
      pass_points: pt.pass_points || 10,
    }));

    if (tasksToInsert.length > 0) {
      const { error } = await supabase!
        .from("periodic_tasks")
        .insert(tasksToInsert);

      if (error) {
        logger.warn("Failed to restore periodic tasks:", error);
      } else {
        stats.periodic_tasks = tasksToInsert.length;
      }
    }
  }

  if (data.backbone_modules && data.backbone_modules.length > 0) {
    const modulesToInsert = data.backbone_modules
      .map((bm) => {
        const graphId = oldToNewGraphIds.get(bm.graph_id);
        if (!graphId) return null;
        return {
          graph_id: graphId,
          module_type: bm.module_type,
          title: bm.title,
          icon: bm.icon || null,
          color: bm.color || null,
          description: bm.description || null,
          display_order: bm.display_order || 0,
        };
      })
      .filter((bm): bm is NonNullable<typeof bm> => bm !== null);

    if (modulesToInsert.length > 0) {
      const { error } = await supabase!
        .from("graph_backbone_modules")
        .insert(modulesToInsert);

      if (error) {
        logger.warn("Failed to restore backbone modules:", error);
      } else {
        stats.backbone_modules = modulesToInsert.length;
      }
    }
  }

  return stats;
}

export default router;
