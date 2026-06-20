import { Router } from "express";
import { kernel } from "../app";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { PluginStoreService } from "../services/kernel";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

router.get("/updates", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
  }

  const storeService = new PluginStoreService(kernel);
  const installed = await storeService.getInstalledPlugins(userId);
  const updates = installed.filter((p) => {
    const entry = kernel.getPlugin(p.plugin_name);
    return entry && entry.plugin.version !== p.version;
  }).map((p) => ({
    name: p.plugin_name,
    currentVersion: p.version,
    latestVersion: kernel.getPlugin(p.plugin_name)?.plugin.version,
  }));

  res.json({ success: true, data: updates });
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
  }

  const storeService = new PluginStoreService(kernel);
  const installedPlugins = await storeService.getInstalledPlugins(userId);

  const builtinNames = new Set(["core", "graph", "ai", "study", "scheduler", "agent"]);
  builtinNames.forEach((name) => {
    const entry = kernel.getPlugin(name);
    if (entry) {
      installedPlugins.push({
        plugin_name: name,
        version: entry.plugin.version,
        state: entry.state === "error" ? "error" : entry.state,
        manifest: {
          name: entry.plugin.name,
          version: entry.plugin.version,
          description: entry.plugin.description,
          main: "",
          dependencies: entry.plugin.dependencies ?? [],
        },
      });
    }
  });

  res.json({ success: true, data: installedPlugins });
});

router.post("/:name/activate", requireAuth, async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    throw new AppError(`Plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  if (entry.state === "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Already active" } });
    return;
  }

  try {
    await kernel.activatePlugin(name);
    res.json({ success: true, data: { name, state: "active" } });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Plugins] Failed to activate "${name}": ${message}`);
    throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post("/:name/deactivate", requireAuth, async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    throw new AppError(`Plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  if (entry.state !== "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Not active" } });
    return;
  }

  try {
    await kernel.deactivatePlugin(name);
    res.json({ success: true, data: { name, state: "inactive" } });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Plugins] Failed to deactivate "${name}": ${message}`);
    throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
