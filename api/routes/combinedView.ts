import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { graphService } from "../services/graph/index";
import { z } from "zod";

const router = Router();

const combinedViewSchema = z.object({
  body: z.object({
    graph_ids: z.array(z.string().uuid()).min(2),
  }),
});

router.post(
  "/combined-view",
  requireAuth,
  validate(combinedViewSchema),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids } = req.body;

    try {
      const result = await graphService.getCombinedView(
        req.supabase!,
        req.user.id,
        graph_ids,
      );
      res.json(result);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("not found or unauthorized")) {
        throw new AppError(
          "Some graphs not found or unauthorized",
          403,
          ErrorCodes.FORBIDDEN,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;