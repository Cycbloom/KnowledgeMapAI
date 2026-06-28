import fs from "fs";
import path from "path";
import type { Router } from "express";
import type {
  Plugin,
  PluginEntry,
  KernelAPI,
  RouteOptions,
  RouteEntry,
} from "./types";
import { DependencyResolver } from "./DependencyResolver";
import { logger } from "../../utils/logger";
import { PluginLifecycleBase } from "@shared/kernel";

/**
 * 插件系统核心内核
 *
 * Kernel 负责管理插件的生命周期和路由注册。
 * 核心生命周期逻辑继承自 PluginLifecycleBase，本类仅保留后端独有行为。
 */
export class Kernel
  extends PluginLifecycleBase<Plugin, KernelAPI, PluginEntry>
  implements KernelAPI
{
  private routeRegistry: RouteEntry[] = [];
  private dependencyResolver = new DependencyResolver();
  private currentInstallingPlugin: string | null = null;

  // ---- 基类抽象成员实现 ----

  protected override createEntry(plugin: Plugin): PluginEntry {
    return {
      plugin,
      state: "installed",
      registeredRoutes: [],
    };
  }

  protected override getPluginAPI(): KernelAPI {
    return this;
  }

  protected override logWarn(message: string): void {
    logger.warn(message);
  }

  protected override logInfo(message: string): void {
    logger.info(message);
  }

  protected override resolveActivationOrder(): Plugin[] {
    const plugins = Array.from(this.pluginRegistry.values()).map(
      (entry) => entry.plugin,
    );
    return this.dependencyResolver.resolve(plugins);
  }

  protected override cleanupPluginRegistrations(pluginName: string): void {
    const entry = this.pluginRegistry.get(pluginName);
    if (!entry) return;

    const routeRouters = new Set(entry.registeredRoutes.map((r) => r.router));
    this.routeRegistry = this.routeRegistry.filter(
      (r) => !routeRouters.has(r.router),
    );
    entry.registeredRoutes = [];

    logger.info(
      `[Kernel] Cleaned up all registrations for plugin "${pluginName}"`,
    );
  }

  // ---- 上下文包裹（保留原 currentInstallingPlugin 语义） ----

  protected override withPluginContextSync<T>(
    pluginName: string,
    fn: () => T,
  ): T {
    const prev = this.currentInstallingPlugin;
    this.currentInstallingPlugin = pluginName;
    try {
      return fn();
    } finally {
      this.currentInstallingPlugin = prev;
    }
  }

  // ---- activateAll / deactivateAll 完成钩子 ----

  protected override onAllActivated(plugins: Plugin[]): void {
    logger.info(
      `[Kernel] All plugins activated (${plugins.map((p) => p.name).join(", ")})`,
    );
  }

  protected override onAllDeactivated(): void {
    logger.info("[Kernel] All plugins deactivated");
  }

  // ---- 后端独有方法 ----

  registerRoutes(prefix: string, router: Router, options?: RouteOptions): void {
    const entry: RouteEntry = { prefix, router, options };
    this.routeRegistry.push(entry);

    if (this.currentInstallingPlugin) {
      const pluginEntry = this.pluginRegistry.get(this.currentInstallingPlugin);
      if (pluginEntry) {
        pluginEntry.registeredRoutes.push(entry);
      }
    }

    logger.info(`[Kernel] Routes "${prefix}" registered`);
  }

  getRegisteredRoutes(): RouteEntry[] {
    return [...this.routeRegistry];
  }

  getPlugin(name: string): PluginEntry | undefined {
    return this.pluginRegistry.get(name);
  }

  getPluginNames(): string[] {
    return [...this.pluginRegistry.keys()];
  }

  getActivePluginNames(): string[] {
    return [...this.pluginRegistry.entries()]
      .filter(([, entry]) => entry.state === "active")
      .map(([name]) => name);
  }

  unregisterPlugin(name: string): void {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      logger.warn(`[Kernel] Plugin "${name}" is not registered, skipping unregister`);
      return;
    }

    if (entry.state === "active") {
      this.deactivatePlugin(name).catch((err: unknown) => {
        logger.error(`[Kernel] Failed to deactivate plugin "${name}" during unregister:`, err);
      });
    }

    this.cleanupPluginRegistrations(name);
    this.pluginRegistry.delete(name);

    if (entry.plugin.onUninstall) {
      try {
        entry.plugin.onUninstall();
      } catch (err: unknown) {
        logger.error(`[Kernel] Error in onUninstall for plugin "${name}":`, err);
      }
    }

    logger.info(`[Kernel] Plugin "${name}" unregistered`);
  }

  async loadPluginFromManifest(manifestPath: string): Promise<{ success: boolean; error?: string }> {
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: `Manifest file not found: ${manifestPath}` };
    }

    let manifestData: unknown;
    try {
      const raw = fs.readFileSync(manifestPath, "utf-8");
      manifestData = JSON.parse(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse manifest JSON";
      return { success: false, error: `Failed to read manifest: ${message}` };
    }

    if (
      typeof manifestData !== "object" ||
      manifestData === null ||
      !("name" in manifestData) ||
      !("version" in manifestData) ||
      !("main" in manifestData)
    ) {
      return { success: false, error: "Invalid manifest: missing required fields (name, version, main)" };
    }

    const manifest = manifestData as { name: string; version: string; main: string };
    const manifestDir = path.dirname(manifestPath);
    const entryPath = path.resolve(manifestDir, manifest.main);

    if (!fs.existsSync(entryPath)) {
      return { success: false, error: `Plugin entry file not found: ${entryPath}` };
    }

    let loaded: unknown;
    try {
      loaded = await import(entryPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: `Failed to load plugin entry: ${message}` };
    }

    const moduleRecord = loaded as Record<string, unknown> | null | undefined;
    const plugin = moduleRecord?.default ?? loaded;

    if (
      typeof plugin !== "object" ||
      plugin === null ||
      !("name" in plugin) ||
      !("version" in plugin) ||
      !("onInstall" in plugin) ||
      typeof (plugin as Record<string, unknown>).onInstall !== "function"
    ) {
      return { success: false, error: "Plugin entry does not implement the Plugin interface (missing name, version, or onInstall)" };
    }

    this.registerPlugin(plugin as Plugin);

    return { success: true };
  }

  getPluginState(name: string): { state: string; errorMessage?: string } | undefined {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      return undefined;
    }
    return {
      state: entry.state,
      errorMessage: entry.errorMessage,
    };
  }
}
