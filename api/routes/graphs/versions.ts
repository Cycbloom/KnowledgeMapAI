import { Router } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema, createSnapshotSchema, rollbackSchema, createBranchSchema, mergeSchema, diffQuerySchema, eventsQuerySchema, snapshotsQuerySchema } from "../../schemas/index";
import { graphVersionService } from "../../services/graph";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { VersionGraphEventType } from "../../../shared/types/graphVersion";

const router = Router();

router.get("/:id/snapshots", requireAuth, validate({ params: uuidParamsSchema, query: snapshotsQuerySchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await graphVersionService.listSnapshots(supabase, graphId, { page, pageSize });
  res.json(result);
});

router.post("/:id/snapshots", requireAuth, validate({ params: uuidParamsSchema, body: createSnapshotSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const userId = req.user?.id;
  const { description } = req.body;
  const snapshot = await graphVersionService.createSnapshot(supabase, graphId, description ?? null, 'manual', userId ?? null);
  res.status(201).json(snapshot);
});

router.get("/:id/snapshots/:snapshotId", requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { snapshotId } = req.params;
  const snapshot = await graphVersionService.getSnapshot(supabase, snapshotId);
  if (!snapshot) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
  res.json(snapshot);
});

router.get("/:id/diff", requireAuth, validate({ params: uuidParamsSchema, query: diffQuerySchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const { sourceSnapshotId, targetSnapshotId } = req.query as { sourceSnapshotId?: string; targetSnapshotId?: string };

  let result;
  if (sourceSnapshotId && targetSnapshotId) {
    result = await graphVersionService.diffSnapshots(supabase, sourceSnapshotId, targetSnapshotId);
  } else if (sourceSnapshotId) {
    result = await graphVersionService.diffWithCurrent(supabase, graphId, sourceSnapshotId);
  } else {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }
  res.json(result);
});

router.post("/:id/rollback", requireAuth, validate({ params: uuidParamsSchema, body: rollbackSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const userId = req.user?.id;
  const { snapshotId } = req.body;
  const preRollbackSnapshotId = await graphVersionService.rollbackToSnapshot(supabase, graphId, snapshotId, userId ?? null);
  res.json({ success: true, preRollbackSnapshotId });
});

router.post("/:id/branches", requireAuth, validate({ params: uuidParamsSchema, body: createBranchSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const userId = req.user?.id;
  const { branchName } = req.body;
  const result = await graphVersionService.createBranch(supabase, graphId, branchName, userId ?? null);
  res.status(201).json(result);
});

router.get("/:id/branches", requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const branches = await graphVersionService.listBranches(supabase, graphId);
  res.json(branches);
});

router.post("/:id/merge", requireAuth, validate({ params: uuidParamsSchema, body: mergeSchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const userId = req.user?.id;
  const { branchGraphId, selectedChanges, conflictResolutions } = req.body;
  const result = await graphVersionService.applyMerge(supabase, graphId, branchGraphId, selectedChanges, conflictResolutions, userId ?? null);
  res.json(result);
});

router.get("/:id/events", requireAuth, validate({ params: uuidParamsSchema, query: eventsQuerySchema }), async (req: AuthRequest, res) => {
  const supabase = req.supabase;
  if (!supabase) throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED);
  const { id: graphId } = req.params;
  const { page, pageSize, batchId, eventType } = req.query as unknown as { page: number; pageSize: number; batchId?: string; eventType?: string };
  const result = await graphVersionService.listEvents(supabase, graphId, { page, pageSize, batchId, eventType: eventType as VersionGraphEventType | undefined });
  res.json(result);
});

export default router;
