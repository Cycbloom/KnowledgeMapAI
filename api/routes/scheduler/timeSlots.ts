import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createTimeSlotSchema,
  updateTimeSlotSchema,
  timeSlotParamsSchema,
} from "../../schemas/index";
import { timeSlotService } from "../../services/scheduler";

const router = Router();

router.get(
  "/time-slots",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const data = await timeSlotService.list(req.supabase, req.user.id);
    res.json({ success: true, data });
  },
);

router.post(
  "/time-slots",
  requireAuth,
  validate({ body: createTimeSlotSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { day_of_week, start_time, end_time, is_available, label } =
      req.body;
    const data = await timeSlotService.create(req.supabase, req.user.id, {
      day_of_week,
      start_time,
      end_time,
      is_available,
      label,
    });
    res.status(201).json({ success: true, data });
  },
);

router.put(
  "/time-slots/:id",
  requireAuth,
  validate({ params: timeSlotParamsSchema, body: updateTimeSlotSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { start_time, end_time, is_available, label } = req.body;
    const data = await timeSlotService.update(req.supabase, req.user.id, id, {
      start_time,
      end_time,
      is_available,
      label,
    });
    res.json({ success: true, data });
  },
);

router.delete(
  "/time-slots/:id",
  requireAuth,
  validate({ params: timeSlotParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await timeSlotService.delete(req.supabase, req.user.id, id);
    res.json({ success: true });
  },
);

export default router;
