import fs from "fs";
import path from "path";
import { logger } from "../../utils/logger";
import type { Kernel } from "./Kernel";
import type { Plugin } from "./types";
import { getSupabaseAdmin } from "../../supabase";

export class PluginLoader {
  private kernel: Kernel;
  private pluginsDir: string;

  constructor(kernel: Kernel, pluginsDir: string) {
    this.kernel = kernel;
    this.pluginsDir = pluginsDir;
  }

  async loadInstalledPlugins(): Promise<{ loaded: number; failed: number }> {
    const { data, error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .select("plugin_name, state, manifest")
      .eq("state", "active");

    if (error) {
      logger.error(`[PluginLoader] Failed to query installed plugins: ${error.message}`);
      return { loaded: 0, failed: 0 };
    }

    if (!data || data.length === 0) {
      return { loaded: 0, failed: 0 };
    }

    let loaded = 0;
    let failed = 0;

    for (const record of data) {
      const result = await this.loadPluginFromDisk(record.plugin_name, record.manifest as Record<string, unknown>);
      if (result.success) {
        loaded++;
      } else {
        failed++;
        await this.markPluginError(record.plugin_name, result.error ?? "Unknown error");
      }
    }

    logger.info(`[PluginLoader] Loaded ${loaded} plugins, ${failed} failed`);
    return { loaded, failed };
  }

  async loadPluginFromDisk(pluginName: string, manifest: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (
      typeof manifest !== "object" ||
      manifest === null ||
      !("name" in manifest) ||
      !("version" in manifest) ||
      !("main" in manifest)
    ) {
      return { success: false, error: "Invalid manifest: missing required fields (name, version, main)" };
    }

    const pluginDir = path.join(this.pluginsDir, pluginName);
    if (!fs.existsSync(pluginDir)) {
      return { success: false, error: `Plugin directory not found: ${pluginDir}` };
    }

    const mainPath = path.resolve(pluginDir, manifest.main as string);
    if (!fs.existsSync(mainPath)) {
      return { success: false, error: `Entry file not found: ${mainPath}` };
    }

    try {
      const loaded = await import(mainPath);
      const pluginExport = loaded.default ?? loaded;

      if (!pluginExport || typeof pluginExport.onInstall !== "function") {
        return { success: false, error: "Entry file does not export a valid Plugin object" };
      }

      const plugin: Plugin = {
        name: manifest.name as string,
        version: manifest.version as string,
        description: (manifest.description as string) ?? "",
        dependencies: (manifest.dependencies as string[]) ?? undefined,
        onInstall: pluginExport.onInstall,
        onActivate: pluginExport.onActivate,
        onDeactivate: pluginExport.onDeactivate,
        onUninstall: pluginExport.onUninstall,
      };

      this.kernel.registerPlugin(plugin);
      await this.kernel.activatePlugin(pluginName);

      logger.info(`[PluginLoader] Plugin "${pluginName}" loaded and activated`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`[PluginLoader] Failed to load plugin "${pluginName}": ${message}`);
      return { success: false, error: message };
    }
  }

  private async markPluginError(pluginName: string, errorMessage: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .update({ state: "error" })
      .eq("plugin_name", pluginName);

    if (error) {
      logger.error(`[PluginLoader] Failed to mark plugin "${pluginName}" as error: ${error.message}`);
    }

    const entry = this.kernel.getPlugin(pluginName);
    if (entry) {
      (entry as { errorMessage?: string }).errorMessage = errorMessage;
    }
  }
}
