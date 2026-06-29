import { Router } from "express";
import statusRoutes from "./status";
import annotateRoutes from "./annotate";
import podcastRoutes from "./podcast";
import generateRoutes from "./generate";

const router = Router();

router.use("/", statusRoutes);
router.use("/", annotateRoutes);
router.use("/", podcastRoutes);
router.use("/", generateRoutes);

export default router;
