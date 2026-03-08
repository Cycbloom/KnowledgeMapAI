import { Router } from "express";
import tasksRouter from "./tasks.js";
import executionsRouter from "./executions.js";
import focusRouter from "./focus.js";
import templatesRouter from "./templates.js";
import timeSlotsRouter from "./timeSlots.js";
import schedulesRouter from "./schedules.js";
import dependenciesRouter from "./dependencies.js";
import subtasksRouter from "./subtasks.js";
import linksRouter from "./links.js";
import knowledgePointsRouter from "./knowledgePoints.js";
import analyticsRouter from "./analytics.js";
import recommendationsRouter from "./recommendations.js";
import progressRouter from "./progress.js";
import settingsRouter from "./settings.js";

const router = Router();

router.use(tasksRouter);
router.use(executionsRouter);
router.use(focusRouter);
router.use(templatesRouter);
router.use(timeSlotsRouter);
router.use(schedulesRouter);
router.use(dependenciesRouter);
router.use(subtasksRouter);
router.use(linksRouter);
router.use(knowledgePointsRouter);
router.use(analyticsRouter);
router.use(recommendationsRouter);
router.use(progressRouter);
router.use(settingsRouter);

export default router;
