import { Router, type Response } from "express";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth";
import { collaboratorService } from "../services/graph";
import { logger } from "../utils/logger";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

router.get("/:invitationToken/info", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationToken } = req.params;
    const result = await collaboratorService.getInvitationInfo(req.supabase!, invitationToken);

    if (!result.success) {
      throw new AppError(result.error ?? "邀请信息不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json(result.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("获取邀请信息失败:", error);
    throw new AppError("获取邀请信息失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post("/graphs/:graphId/share", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("未授权", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { graphId } = req.params;
    const { role = "viewer" } = req.body;

    const result = await collaboratorService.generateShareLink(req.supabase!, graphId, userId, role);

    if (!result.success) {
      throw new AppError(result.error ?? "生成分享链接失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json(result.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("生成分享链接失败:", error);
    throw new AppError("生成分享链接失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post("/:invitationToken/join", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("未授权", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { invitationToken } = req.params;
    const result = await collaboratorService.joinByShareLink(req.supabase!, invitationToken, userId);

    if (!result.success) {
      throw new AppError(result.error ?? "加入协作失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json(result.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("加入协作失败:", error);
    throw new AppError("加入协作失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
