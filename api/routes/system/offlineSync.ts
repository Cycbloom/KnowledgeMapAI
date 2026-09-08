import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { offlineSyncService, type OfflineSyncOperation } from "../../services/sync/offlineSyncService";

const router = Router();

function parseOperations(value: unknown): OfflineSyncOperation[] {
  if (!Array.isArray(value)) return [];
  const ops: OfflineSyncOperation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const op = item as Record<string, unknown>;
    if (
      typeof op.clientOpId !== "string" ||
      typeof op.recordId !== "string" ||
      typeof op.table !== "string" ||
      (op.action !== "create" && op.action !== "update")
    ) {
      continue;
    }
    ops.push({
      clientOpId: op.clientOpId,
      table: op.table,
      action: op.action,
      recordId: op.recordId,
      data: op.data && typeof op.data === "object" ? (op.data as Record<string, unknown>) : {},
      timestamp: typeof op.timestamp === "string" ? op.timestamp : new Date().toISOString(),
    });
  }
  return ops;
}

// POST /api/v1/offline-sync — 接收移动端离线学习记录（FSRS 进度 + 答题会话）
router.post("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const operations = parseOperations((req.body as { operations?: unknown })?.operations);
  if (operations.length === 0) {
    res.json({ success: true, results: [] });
    return;
  }

  const results = await offlineSyncService.applyOfflineOps(
    req.supabase,
    req.user.id,
    operations,
  );
  res.json({ success: true, results });
});

export default router;
