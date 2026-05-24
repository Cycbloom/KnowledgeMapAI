import { Router } from "express";
import crudRoutes from "./crud";
import analysisRoutes from "./analysis";
import expansionRoutes from "./expansion";

const router = Router();

router.use("/", crudRoutes);
router.use("/", analysisRoutes);
router.use("/", expansionRoutes);

export default router;