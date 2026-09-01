import { Router, type Response } from "express";
import { requireAuth, optionalAuth, type AuthedRequest, type OptionalAuthRequest } from "../middleware/auth";
import { collaboratorService } from "../services/graph";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

router.get("/:invitationToken/info", optionalAuth, asyncHandler(async (req: OptionalAuthRequest, res: Response) => {
    const { invitationToken } = req.params;
    if (!req.supabase) {
      throw new AppError("Supabase client not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const result = await collaboratorService.getInvitationInfo(req.supabase, invitationToken);

    if (!result.success) {
      throw new AppError(result.error ?? "邀请信息不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json(result.data);
}));

router.post("/graphs/:graphId/share", requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("未授权", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { graphId } = req.params;
    const { role = "viewer" } = req.body;

    const result = await collaboratorService.generateShareLink(req.supabase, graphId, userId, role);

    if (!result.success) {
      throw new AppError(result.error ?? "生成分享链接失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json(result.data);
}));

router.post("/:invitationToken/join", requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("未授权", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { invitationToken } = req.params;
    const result = await collaboratorService.joinByShareLink(req.supabase, invitationToken, userId);

    if (!result.success) {
      throw new AppError(result.error ?? "加入协作失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json(result.data);
}));

export default router;
