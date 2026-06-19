import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getSupabaseAdmin } from "../supabase";
import { syncService } from "../services/sync";

const router = Router();

// POST /api/sync/pull
router.post("/pull", requireAuth, async (req: AuthRequest, res: Response) => {
  const { tables } = req.body as { tables: Record<string, string> };
  const result = await syncService.pull(getSupabaseAdmin(), req.user.id, tables);
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
  const results = await syncService.push(getSupabaseAdmin(), req.user.id, operations);
  res.json({ results });
});

// GET /api/sync/status
router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  const result = await syncService.getStatus(getSupabaseAdmin(), req.user.id);
  res.json({ data: result });
});

export default router;
