import { Router, type Response } from "express";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth.js";
import { collaboratorService } from "../services/graph/collaboratorService.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get("/:invitationToken/info", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationToken } = req.params;
    const result = await collaboratorService.getInvitationInfo(req.supabase!, invitationToken);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    logger.error("获取邀请信息失败:", error);
    res.status(500).json({ error: "获取邀请信息失败" });
  }
});

router.post("/graphs/:graphId/share", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "未授权" });
    }

    const { graphId } = req.params;
    const { role = "viewer" } = req.body;

    const result = await collaboratorService.generateShareLink(req.supabase!, graphId, userId, role);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    logger.error("生成分享链接失败:", error);
    res.status(500).json({ error: "生成分享链接失败" });
  }
});

router.post("/:invitationToken/join", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "未授权" });
    }

    const { invitationToken } = req.params;
    const result = await collaboratorService.joinByShareLink(req.supabase!, invitationToken, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    logger.error("加入协作失败:", error);
    res.status(500).json({ error: "加入协作失败" });
  }
});

export default router;
