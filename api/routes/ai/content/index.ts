import { Router } from "express";
import statusRoutes from "./status";
import annotateRoutes from "./annotate";
import podcastRoutes from "./podcast";
import generateRoutes from "./generate";
import stylesRoutes from "./styles";
import translateRoutes from "./translate";

const router = Router();

router.use("/", statusRoutes);
router.use("/", annotateRoutes);
router.use("/", podcastRoutes);
router.use("/", generateRoutes);
router.use("/", stylesRoutes);
router.use("/", translateRoutes);

export default router;
