import { Router } from "express";
import { kernel } from "../app";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { PluginStoreService } from "../services/kernel";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Marketplace (registry) routes
// Static routes MUST come before /:name to avoid parameter routing hijacking
// 当前无远程插件市场源，统一返回空列表以稳定前端展示，避免 404 报错。
// 后续接入真实市场时，把空数组替换为对插件市场服务的 fetch 即可。
// ─────────────────────────────────────────────────────────────────────────────

router.get("/registry", requireAuth, async (req: AuthRequest, res) => {
  const { category, q } = req.query as { category?: string; q?: string };
  // 过滤参数忽略，当前市场无插件
  void category;
  void q;
  res.json({ success: true, data: [] });
});

router.get("/registry/:name", requireAuth, async (req: AuthRequest, _res) => {
  const { name } = req.params;
  throw new AppError(`Registry plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
});

router.post("/registry/:name/install", requireAuth, async (req: AuthRequest, _res) => {
  const { name } = req.params;
  throw new AppError(`Registry plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
});

router.post("/registry/:name/uninstall", requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.params;
  // 兼容前端清理忽略列表等操作：未安装插件视为卸载成功
  res.json({ success: true, data: { name, state: "uninstalled" } });
});

router.post("/registry/:name/update", requireAuth, async (req: AuthRequest, _res) => {
  const { name } = req.params;
  throw new AppError(`Registry plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
});

router.post("/registry/:name/rate", requireAuth, async (req: AuthRequest, _res) => {
  const { name } = req.params;
  throw new AppError(`Registry plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
});

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

router.post("/:name/activate", requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    throw new AppError(`Plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  if (entry.state === "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Already active" } });
    return;
  }

  await kernel.activatePlugin(name);
  res.json({ success: true, data: { name, state: "active" } });
}));

router.post("/:name/deactivate", requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  const entry = kernel.getPlugin(name);

  if (!entry) {
    throw new AppError(`Plugin "${name}" not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  if (entry.state !== "active") {
    res.json({ success: true, data: { name, state: entry.state, message: "Not active" } });
    return;
  }

  await kernel.deactivatePlugin(name);
  res.json({ success: true, data: { name, state: "inactive" } });
}));

export default router;
