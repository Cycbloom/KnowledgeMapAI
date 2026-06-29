import { Router } from "express";
import providersRoutes from "./providers";
import databaseRoutes from "./database";
import mainAiRoutes from "./main-ai";
import embeddingRoutes from "./embedding";

const router = Router();

router.use("/", providersRoutes);
router.use("/", databaseRoutes);
router.use("/", mainAiRoutes);
router.use("/", embeddingRoutes);

export default router;
