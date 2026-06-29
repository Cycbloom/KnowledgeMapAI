import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { getAIProviderForTask } from "../../../services/ai";

const router = Router();

router.get("/status", requireAuth, async (_req: AuthRequest, res: Response) => {
  const provider = await getAIProviderForTask("text");
  res.json({
    enabled: provider.hasKey,
    provider: provider.providerType,
    model: provider.model,
  });
});

export default router;
