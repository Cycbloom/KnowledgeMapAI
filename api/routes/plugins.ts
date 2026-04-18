import { Router } from "express";
import { kernel } from "../app";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  const pluginNames = kernel.getPluginNames();
  const plugins = pluginNames.map((name) => {
    const entry = kernel.getPlugin(name);
    if (!entry) return null;
    return {
      name: entry.plugin.name,
      version: entry.plugin.version,
      description: entry.plugin.description,
      dependencies: entry.plugin.dependencies ?? [],
      state: entry.state,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  res.json({ success: true, data: plugins });
});

router.post("/:name/activate", requireAuth, async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    res.status(404).json({ success: false, error: `Plugin "${name}" not found` });
    return;
  }

  if (entry.state === "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Already active" } });
    return;
  }

  try {
    await kernel.activatePlugin(name);
    res.json({ success: true, data: { name, state: "active" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Plugins] Failed to activate "${name}": ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/:name/deactivate", requireAuth, async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    res.status(404).json({ success: false, error: `Plugin "${name}" not found` });
    return;
  }

  if (entry.state !== "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Not active" } });
    return;
  }

  try {
    await kernel.deactivatePlugin(name);
    res.json({ success: true, data: { name, state: "inactive" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Plugins] Failed to deactivate "${name}": ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/:name/config", requireAuth, (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    res.status(404).json({ success: false, error: `Plugin "${name}" not found` });
    return;
  }

  const config = kernel.getPluginConfig(name);
  res.json({ success: true, data: config });
});

router.patch("/:name/config", requireAuth, (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    res.status(404).json({ success: false, error: `Plugin "${name}" not found` });
    return;
  }

  try {
    kernel.setPluginConfig(name, req.body);
    const config = kernel.getPluginConfig(name);
    res.json({ success: true, data: config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
