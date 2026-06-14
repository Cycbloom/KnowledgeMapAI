import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getSupabaseAdmin } from "../supabase";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { logger } from "../utils/logger";

const router = Router();

// Supported sync tables configuration
interface SyncTableConfig {
  userColumn?: string;
  hasDeletedAt: boolean;
  updatedAtColumn: string;
  graphBased?: boolean;
}

const SYNC_TABLES: Record<string, SyncTableConfig> = {
  knowledge_graphs: {
    userColumn: "user_id",
    hasDeletedAt: true,
    updatedAtColumn: "updated_at",
  },
  knowledge_points: {
    userColumn: "owner_id",
    hasDeletedAt: false,
    updatedAtColumn: "updated_at",
  },
  graph_nodes: {
    hasDeletedAt: true,
    updatedAtColumn: "updated_at",
    graphBased: true,
  },
  edges: {
    hasDeletedAt: true,
    updatedAtColumn: "updated_at",
    graphBased: true,
  },
  study_cards: {
    userColumn: "user_id",
    hasDeletedAt: false,
    updatedAtColumn: "created_at",
  },
  user_tasks: {
    userColumn: "user_id",
    hasDeletedAt: true,
    updatedAtColumn: "updated_at",
  },
  focus_sessions: {
    userColumn: "user_id",
    hasDeletedAt: false,
    updatedAtColumn: "created_at",
  },
  notifications: {
    userColumn: "user_id",
    hasDeletedAt: false,
    updatedAtColumn: "created_at",
  },
  achievements: {
    hasDeletedAt: false,
    updatedAtColumn: "created_at",
  },
  learning_paths: {
    userColumn: "user_id",
    hasDeletedAt: false,
    updatedAtColumn: "updated_at",
  },
};

/**
 * Get user's graph IDs (including graphs where user is a collaborator)
 */
async function getUserGraphIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<string[]> {
  const [ownedResult, collabResult] = await Promise.all([
    supabase.from("knowledge_graphs").select("id").eq("user_id", userId),
    supabase
      .from("graph_collaborators")
      .select("graph_id")
      .eq("user_id", userId)
      .not("accepted_at", "is", null),
  ]);

  const ownedIds = (ownedResult.data || []).map((g) => g.id);
  const collabIds = (collabResult.data || []).map((c) => c.graph_id);
  return [...new Set([...ownedIds, ...collabIds])];
}

/**
 * Check if user has access to a record
 */
async function checkAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  recordId: string,
  userId: string,
  config: SyncTableConfig,
): Promise<boolean> {
  // achievements is a global table, allow read-only access
  if (table === "achievements") return true;

  if (config.userColumn) {
    const { data } = await supabase
      .from(table)
      .select(config.userColumn)
      .eq("id", recordId)
      .maybeSingle();

    if (!data) return false;
    if (data[config.userColumn as keyof typeof data] === userId) return true;

    // For knowledge_points, also check if user is a collaborator on the graph
    if (table === "knowledge_points") {
      return checkKnowledgePointAccess(supabase, recordId, userId);
    }

    return false;
  }

  if (config.graphBased) {
    const { data } = await supabase
      .from(table)
      .select("graph_id")
      .eq("id", recordId)
      .maybeSingle();

    if (!data?.graph_id) return false;

    // Check if user owns the graph or is a collaborator
    return checkGraphAccess(supabase, data.graph_id, userId);
  }

  return false;
}

/**
 * Check if user has access to a graph (owner or collaborator)
 */
async function checkGraphAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  graphId: string,
  userId: string,
): Promise<boolean> {
  const { data: graph } = await supabase
    .from("knowledge_graphs")
    .select("user_id")
    .eq("id", graphId)
    .maybeSingle();

  if (graph?.user_id === userId) return true;

  // Check collaborator
  const { data: collab } = await supabase
    .from("graph_collaborators")
    .select("role")
    .eq("graph_id", graphId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  return !!collab;
}

/**
 * Check if user has access to a knowledge point
 */
async function checkKnowledgePointAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  knowledgePointId: string,
  userId: string,
): Promise<boolean> {
  // Check if the knowledge point is in a graph the user has access to
  const { data: graphNode } = await supabase
    .from("graph_nodes")
    .select("graph_id")
    .eq("knowledge_point_id", knowledgePointId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!graphNode?.graph_id) return false;

  return checkGraphAccess(supabase, graphNode.graph_id, userId);
}

// POST /api/sync/pull
router.post("/pull", requireAuth, async (req: AuthRequest, res: Response) => {
  const { tables } = req.body as { tables: Record<string, string> };

  if (!tables || typeof tables !== "object") {
    throw new AppError("Invalid request: tables is required", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const userId = req.user.id;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const result: Record<string, { records: unknown[]; timestamp: string }> = {};

  // Get user's graph IDs for graph-based tables
  let userGraphIds: string[] | null = null;
  const needsGraphIds = Object.keys(tables).some(
    (table) => SYNC_TABLES[table]?.graphBased,
  );

  if (needsGraphIds) {
    userGraphIds = await getUserGraphIds(supabase, userId);
  }

  for (const [table, lastSyncTimestamp] of Object.entries(tables)) {
    const config = SYNC_TABLES[table];
    if (!config) {
      // Skip unsupported tables silently
      continue;
    }

    try {
      let query = supabase.from(table).select("*");

      // Filter by timestamp
      if (lastSyncTimestamp) {
        query = query.gt(config.updatedAtColumn, lastSyncTimestamp);
      }

      // Filter by user
      if (config.userColumn) {
        query = query.eq(config.userColumn, userId);
      } else if (config.graphBased && userGraphIds) {
        if (userGraphIds.length === 0) {
          result[table] = { records: [], timestamp: now };
          continue;
        }
        query = query.in("graph_id", userGraphIds);
      }

      // For tables with deleted_at, include soft-deleted records
      // by NOT filtering on deleted_at, both active and deleted records are returned

      const { data, error } = await query;

      if (error) {
        logger.error(`Sync pull error for table ${table}:`, error);
        result[table] = { records: [], timestamp: now };
        continue;
      }

      result[table] = { records: data || [], timestamp: now };
    } catch (err) {
      logger.error(`Sync pull error for table ${table}:`, err);
      result[table] = { records: [], timestamp: now };
    }
  }

  res.json({ data: result });
});

// POST /api/sync/push
router.post("/push", requireAuth, async (req: AuthRequest, res: Response) => {
  const { operations } = req.body as {
    operations: Array<{
      table: string;
      action: "create" | "update" | "delete";
      id: string;
      data?: Record<string, unknown>;
      clientUpdatedAt: string;
    }>;
  };

  if (!Array.isArray(operations)) {
    throw new AppError(
      "Invalid request: operations array is required",
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const userId = req.user.id;
  const supabase = getSupabaseAdmin();

  const results: Array<{
    id: string;
    success: boolean;
    conflict?: boolean;
    serverData?: unknown;
    error?: string;
  }> = [];

  for (const op of operations) {
    const config = SYNC_TABLES[op.table];
    if (!config) {
      results.push({
        id: op.id,
        success: false,
        error: `Unsupported table: ${op.table}`,
      });
      continue;
    }

    try {
      if (op.action === "create") {
        // Inject user column if applicable
        const record = { ...op.data };
        if (config.userColumn) {
          record[config.userColumn] = userId;
        }

        const { data, error } = await supabase
          .from(op.table)
          .insert(record)
          .select()
          .single();

        if (error) {
          results.push({ id: op.id, success: false, error: error.message });
          continue;
        }

        results.push({ id: op.id, success: true, serverData: data });
      } else if (op.action === "update") {
        // Check access
        const hasAccess = await checkAccess(
          supabase,
          op.table,
          op.id,
          userId,
          config,
        );
        if (!hasAccess) {
          results.push({
            id: op.id,
            success: false,
            error: "Access denied",
          });
          continue;
        }

        // Check for conflicts (only for tables with a proper updated_at column)
        if (config.updatedAtColumn === "updated_at") {
          const { data: existing } = await supabase
            .from(op.table)
            .select("updated_at")
            .eq("id", op.id)
            .maybeSingle();

          if (existing?.updated_at) {
            const serverUpdatedAt = new Date(existing.updated_at);
            const clientUpdatedAt = new Date(op.clientUpdatedAt);

            if (serverUpdatedAt > clientUpdatedAt) {
              // Conflict - server has newer data
              const { data: serverData } = await supabase
                .from(op.table)
                .select("*")
                .eq("id", op.id)
                .maybeSingle();

              results.push({
                id: op.id,
                success: false,
                conflict: true,
                serverData,
              });
              continue;
            }
          }
        }

        const { data, error } = await supabase
          .from(op.table)
          .update(op.data || {})
          .eq("id", op.id)
          .select()
          .single();

        if (error) {
          results.push({ id: op.id, success: false, error: error.message });
          continue;
        }

        results.push({ id: op.id, success: true, serverData: data });
      } else if (op.action === "delete") {
        // Check access
        const hasAccess = await checkAccess(
          supabase,
          op.table,
          op.id,
          userId,
          config,
        );
        if (!hasAccess) {
          results.push({
            id: op.id,
            success: false,
            error: "Access denied",
          });
          continue;
        }

        if (config.hasDeletedAt) {
          // Soft delete
          const { error } = await supabase
            .from(op.table)
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", op.id);

          if (error) {
            results.push({ id: op.id, success: false, error: error.message });
            continue;
          }
        } else {
          // Hard delete
          const { error } = await supabase
            .from(op.table)
            .delete()
            .eq("id", op.id);

          if (error) {
            results.push({ id: op.id, success: false, error: error.message });
            continue;
          }
        }

        results.push({ id: op.id, success: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ id: op.id, success: false, error: message });
    }
  }

  res.json({ results });
});

// GET /api/sync/status
router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const supabase = getSupabaseAdmin();

  const result: Record<string, string> = {};

  // Get user's graph IDs for graph-based tables
  const userGraphIds = await getUserGraphIds(supabase, userId);

  for (const [table, config] of Object.entries(SYNC_TABLES)) {
    try {
      let query = supabase
        .from(table)
        .select(config.updatedAtColumn);

      if (config.userColumn) {
        query = query.eq(config.userColumn, userId);
      } else if (config.graphBased) {
        if (userGraphIds.length === 0) {
          result[table] = new Date(0).toISOString();
          continue;
        }
        query = query.in("graph_id", userGraphIds);
      }

      // For tables with deleted_at, include soft-deleted records

      const { data } = await query
        .order(config.updatedAtColumn, { ascending: false })
        .limit(1);

      const timestampValue = data && data.length > 0
        ? data[0][config.updatedAtColumn as keyof typeof data[0]]
        : null;

      result[table] =
        typeof timestampValue === "string"
          ? timestampValue
          : new Date(0).toISOString();
    } catch (err) {
      logger.error(`Sync status error for table ${table}:`, err);
      result[table] = new Date(0).toISOString();
    }
  }

  res.json({ data: result });
});

export default router;
