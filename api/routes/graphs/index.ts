import { Router } from "express";
import crudRoutes from "./crud";
import analysisRoutes from "./analysis";
import expansionRoutes from "./expansion";
import versionRoutes from "./versions";

const router = Router();

router.use("/", crudRoutes);
router.use("/", analysisRoutes);
router.use("/", expansionRoutes);
router.use("/", versionRoutes);

export default router;