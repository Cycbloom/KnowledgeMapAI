import { Router } from "express";
import structureRoutes from "./structures";
import characterRoutes from "./characters";
import sceneRoutes from "./scenes";
import appearanceRoutes from "./appearances";
import relationshipRoutes from "./relationships";

const router = Router();

router.use("/structures", structureRoutes);
router.use("/characters", characterRoutes);
router.use("/scenes", sceneRoutes);
router.use("/appearances", appearanceRoutes);
router.use("/relationships", relationshipRoutes);

export { router as storyRoutes };
