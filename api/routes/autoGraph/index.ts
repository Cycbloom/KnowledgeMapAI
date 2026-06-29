import { Router } from "express";
import graphRoutes from "./graph";
import templateRoutes from "./templates";
import promptRoutes from "./prompt";
import embeddingRoutes from "./embeddings";

const router = Router();

router.use("/", graphRoutes);
router.use("/", templateRoutes);
router.use("/", promptRoutes);
router.use("/", embeddingRoutes);

export default router;
