import { Router } from "express";
import { kernel } from "../app";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { PluginRegistry } from "../services/kernel/registry/PluginRegistry";
import { PluginStoreService } from "../services/kernel/PluginStoreService";

const router = Router();
const pluginRegistry = new PluginRegistry();

router.get("/registry", requireAuth, (req, res) => {
  const { category, q } = req.query;
  const plugins = pluginRegistry.list({
    category: category as string | undefined,
    keyword: q as string | undefined,
  });
  res.json({ success: true, data: plugins });
});

router.get("/registry/:name", requireAuth, (req, res) => {
  const plugin = pluginRegistry.get(req.params.name);
  if (!plugin) {
    res.status(404).json({ success: false, error: "Plugin not found in registry" });
    return;
  }
  res.json({ success: true, data: plugin });
});

router.post("/registry/:name/install", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const registryEntry = pluginRegistry.get(name);
  if (!registryEntry) {
    res.status(404).json({ success: false, error: "Plugin not found in registry" });
    return;
  }

  const storeService = new PluginStoreService(kernel);
  const result = await storeService.install(name, userId, registryEntry);
  res.json({ success: result.success, error: result.error });
});

router.post("/registry/:name/uninstall", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const storeService = new PluginStoreService(kernel);
  const result = await storeService.uninstall(name, userId);
  res.json({ success: result.success, error: result.error });
});

router.post("/registry/:name/update", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const registryEntry = pluginRegistry.get(name);
  if (!registryEntry) {
    res.status(404).json({ success: false, error: "Plugin not found in registry" });
    return;
  }

  const storeService = new PluginStoreService(kernel);
  const result = await storeService.update(name, userId, registryEntry);
  res.json({ success: result.success, error: result.error });
});

router.post("/registry/:name/rate", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.params;
  const { rating, review } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
    return;
  }

  const storeService = new PluginStoreService(kernel);
  const result = await storeService.ratePlugin(name, userId, rating, review);
  res.json({ success: result.success, error: result.error });
});

router.get("/updates", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const storeService = new PluginStoreService(kernel);
  const installed = await storeService.getInstalledPlugins(userId);
  const updates = installed.filter((p) => {
    const registryEntry = pluginRegistry.get(p.plugin_name);
    return registryEntry && registryEntry.version !== p.version;
  }).map((p) => ({
    name: p.plugin_name,
    currentVersion: p.version,
    latestVersion: pluginRegistry.get(p.plugin_name)?.version,
  }));

  res.json({ success: true, data: updates });
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
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
          author: entry.plugin.author ?? { name: "KnowledgeMap Team" },
          main: "",
          dependencies: entry.plugin.dependencies ?? [],
          permissions: entry.plugin.permissions ?? [],
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
