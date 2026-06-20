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

/**
 * 插件系统核心内核
 *
 * Kernel 负责管理插件的生命周期和路由注册。
 */
export class Kernel implements KernelAPI {
  private pluginRegistry = new Map<string, PluginEntry>();
  private routeRegistry: RouteEntry[] = [];
  private dependencyResolver = new DependencyResolver();
  private currentInstallingPlugin: string | null = null;

  registerPlugin(plugin: Plugin): void {
    if (this.pluginRegistry.has(plugin.name)) {
      logger.warn(`[Kernel] Plugin "${plugin.name}" is already registered, skipping`);
      return;
    }

    const entry: PluginEntry = {
      plugin,
      state: "installed",
      registeredRoutes: [],
    };

    this.pluginRegistry.set(plugin.name, entry);
    logger.info(`[Kernel] Plugin "${plugin.name}" v${plugin.version} registered`);

    this.currentInstallingPlugin = plugin.name;
    plugin.onInstall(this);
    this.currentInstallingPlugin = null;
    entry.state = "inactive";
  }

  async activatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state === "active") {
      logger.warn(`[Kernel] Plugin "${name}" is already active, skipping`);
      return;
    }

    const deps = entry.plugin.dependencies ?? [];
    for (const dep of deps) {
      const depEntry = this.pluginRegistry.get(dep);
      if (!depEntry) {
        throw new Error(
          `[Kernel] Cannot activate "${name}": dependency "${dep}" is not registered`,
        );
      }
      if (depEntry.state !== "active") {
        logger.info(
          `[Kernel] Auto-activating dependency "${dep}" for plugin "${name}"`,
        );
        await this.activatePlugin(dep);
      }
    }

    if (entry.plugin.onActivate) {
      await entry.plugin.onActivate();
    }

    entry.state = "active";
    logger.info(`[Kernel] Plugin "${name}" activated`);
  }

  async deactivatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state !== "active") {
      logger.warn(`[Kernel] Plugin "${name}" is not active, skipping deactivation`);
      return;
    }

    const dependents = this.getDependents(name);
    for (const dependent of dependents) {
      const depEntry = this.pluginRegistry.get(dependent);
      if (depEntry?.state === "active") {
        logger.info(
          `[Kernel] Deactivating dependent plugin "${dependent}" before "${name}"`,
        );
        await this.deactivatePlugin(dependent);
      }
    }

    if (entry.plugin.onDeactivate) {
      await entry.plugin.onDeactivate();
    }

    this.cleanupPluginRegistrations(name);
    entry.state = "inactive";
    logger.info(`[Kernel] Plugin "${name}" deactivated`);
  }

  async activateAll(): Promise<void> {
    const plugins = Array.from(this.pluginRegistry.values()).map(
      (entry) => entry.plugin,
    );

    const sorted = this.dependencyResolver.resolve(plugins);

    for (const plugin of sorted) {
      const entry = this.pluginRegistry.get(plugin.name);
      if (entry && entry.state !== "active") {
        await this.activatePlugin(plugin.name);
      }
    }

    logger.info(
      `[Kernel] All plugins activated (${sorted.map((p) => p.name).join(", ")})`,
    );
  }

  async deactivateAll(): Promise<void> {
    const plugins = Array.from(this.pluginRegistry.values()).map(
      (entry) => entry.plugin,
    );

    const sorted = this.dependencyResolver.resolve(plugins);
    const reverseOrder = [...sorted].reverse();

    for (const plugin of reverseOrder) {
      const entry = this.pluginRegistry.get(plugin.name);
      if (entry?.state === "active") {
        await this.deactivatePlugin(plugin.name);
      }
    }

    logger.info("[Kernel] All plugins deactivated");
  }

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

  private getDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    for (const [name, entry] of this.pluginRegistry) {
      const deps = entry.plugin.dependencies ?? [];
      if (deps.includes(pluginName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }

  private cleanupPluginRegistrations(pluginName: string): void {
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
}
