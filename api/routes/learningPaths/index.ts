// 学习路径路由聚合入口

import { Router } from "express";
import crudRoutes from "./crud";
import nodesRoutes from "./nodes";
import progressRoutes from "./progress";
import plansRoutes from "./plans";
import generationRoutes from "./generation";
import goalDialogRoutes from "./goalDialog";

const router = Router();

router.use("/", crudRoutes);
router.use("/", nodesRoutes);
router.use("/", progressRoutes);
router.use("/", plansRoutes);
router.use("/", generationRoutes);
router.use("/", goalDialogRoutes);

export default router;
