import { Router } from "express";
import structureRoutes from "./structures";
import characterRoutes from "./characters";
import sceneRoutes from "./scenes";
import appearanceRoutes from "./appearances";

const router = Router();

router.use("/structures", structureRoutes);
router.use("/characters", characterRoutes);
router.use("/scenes", sceneRoutes);
router.use("/appearances", appearanceRoutes);

export { router as storyRoutes };
