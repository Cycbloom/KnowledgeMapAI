import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getSupabaseAdmin } from "../supabase";
import { syncService } from "../services/sync";
import { p2pSyncService } from "../services/sync/p2pSyncService";
import type { SyncOperation } from "../../shared/sync/types";

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

// POST /api/sync/devices — 注册设备
router.post("/devices", requireAuth, async (req: AuthRequest, res: Response) => {
  const { deviceId, deviceName } = req.body as { deviceId: string; deviceName: string };
  const ipAddress = req.ip;
  p2pSyncService.registerDevice(deviceId, deviceName, req.user.id, ipAddress);
  res.json({ success: true });
});

// GET /api/sync/devices — 查询在线设备
router.get("/devices", requireAuth, async (req: AuthRequest, res: Response) => {
  const devices = p2pSyncService.getOnlineDevices(req.user.id);
  res.json({ devices });
});

// POST /api/sync/receive — 接收远程操作
router.post("/receive", requireAuth, async (req: AuthRequest, res: Response) => {
  const { operations, deviceId } = req.body as { operations: SyncOperation[]; deviceId: string };
  // 将远程操作推送到本地数据库，进行冲突检测
  const pushOperations = operations.map((op) => ({
    table: op.table,
    action: op.action,
    id: op.recordId,
    data: op.data,
    clientUpdatedAt: op.timestamp,
  }));
  const results = await syncService.push(getSupabaseAdmin(), req.user.id, pushOperations);
  res.json({ results, deviceId });
});

// GET /api/sync/send — 发送本地操作
router.get("/send", requireAuth, async (req: AuthRequest, res: Response) => {
  const { tables } = req.query as { tables?: string };
  const tableMap: Record<string, string> = {};
  if (tables) {
    for (const table of tables.split(",")) {
      tableMap[table] = "";
    }
  }
  const result = await syncService.pull(getSupabaseAdmin(), req.user.id, tableMap);
  res.json({ data: result });
});

export default router;
