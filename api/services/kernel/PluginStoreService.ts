import fs from "fs";
import path from "path";
import { logger } from "../../utils/logger";
import type { Kernel } from "./Kernel";
import type { PluginManifest } from "./types";
import { validateManifest } from "./manifest";
import { validatePermissions } from "./permissions";
import { getSupabaseAdmin } from "../../supabase";

const PLUGINS_DIR = path.join(process.cwd(), "plugins");

export class PluginStoreService {
  private kernel: Kernel;

  constructor(kernel: Kernel) {
    this.kernel = kernel;
    this.ensurePluginsDir();
  }

  private ensurePluginsDir(): void {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    }
  }

  getPluginsDir(): string {
    return PLUGINS_DIR;
  }

  async install(
    pluginName: string,
    userId: string,
    manifest: PluginManifest,
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validateManifest(manifest);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid manifest: ${validation.errors?.join(", ")}`,
      };
    }

    if (manifest.permissions) {
      const permCheck = validatePermissions(manifest.permissions);
      if (!permCheck.valid) {
        return {
          success: false,
          error: `Invalid permissions: ${permCheck.invalid.join(", ")}`,
        };
      }
    }

    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const manifestPath = path.join(pluginDir, "plugin.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );

    const { error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .upsert(
        {
          user_id: userId,
          plugin_name: pluginName,
          version: manifest.version,
          state: "inactive",
          manifest: manifest,
        },
        { onConflict: "user_id,plugin_name" },
      );

    if (error) {
      logger.error(
        `[PluginStore] Failed to save install record: ${error.message}`,
      );
      return { success: false, error: error.message };
    }

    logger.info(
      `[PluginStore] Plugin "${pluginName}" v${manifest.version} installed`,
    );
    return { success: true };
  }

  async uninstall(
    pluginName: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const dependents = this.getDependents(pluginName);
    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot uninstall: plugins [${dependents.join(", ")}] depend on it`,
      };
    }

    const entry = this.kernel.getPlugin(pluginName);
    if (entry?.state === "active") {
      await this.kernel.deactivatePlugin(pluginName);
    }

    if (entry) {
      this.kernel.unregisterPlugin(pluginName);
    }

    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }

    const { error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .delete()
      .eq("user_id", userId)
      .eq("plugin_name", pluginName);

    if (error) {
      logger.error(
        `[PluginStore] Failed to delete install record: ${error.message}`,
      );
      return { success: false, error: error.message };
    }

    logger.info(`[PluginStore] Plugin "${pluginName}" uninstalled`);
    return { success: true };
  }

  async update(
    pluginName: string,
    userId: string,
    newManifest: PluginManifest,
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validateManifest(newManifest);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid manifest: ${validation.errors?.join(", ")}`,
      };
    }

    const entry = this.kernel.getPlugin(pluginName);
    if (entry?.state === "active") {
      await this.kernel.deactivatePlugin(pluginName);
    }
    if (entry) {
      this.kernel.unregisterPlugin(pluginName);
    }

    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const manifestPath = path.join(pluginDir, "plugin.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(newManifest, null, 2),
      "utf-8",
    );

    const { error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .update({
        version: newManifest.version,
        manifest: newManifest,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("plugin_name", pluginName);

    if (error) {
      logger.error(
        `[PluginStore] Failed to update record: ${error.message}`,
      );
      return { success: false, error: error.message };
    }

    logger.info(
      `[PluginStore] Plugin "${pluginName}" updated to v${newManifest.version}`,
    );
    return { success: true };
  }

  async getInstalledPlugins(
    userId: string,
  ): Promise<
    Array<{
      plugin_name: string;
      version: string;
      state: string;
      manifest: PluginManifest;
    }>
  > {
    const { data, error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .select("plugin_name, version, state, manifest")
      .eq("user_id", userId);

    if (error) {
      logger.error(
        `[PluginStore] Failed to get installed plugins: ${error.message}`,
      );
      return [];
    }

    return data ?? [];
  }

  async setPluginState(
    pluginName: string,
    userId: string,
    state: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabaseAdmin()
      .from("installed_plugins")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("plugin_name", pluginName);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  private getDependents(pluginName: string): string[] {
    const names = this.kernel.getPluginNames();
    return names.filter((name) => {
      const entry = this.kernel.getPlugin(name);
      return entry?.plugin.dependencies?.includes(pluginName) ?? false;
    });
  }

  async getPluginRatings(
    pluginName: string,
  ): Promise<{ avgRating: number; count: number }> {
    const { data, error } = await getSupabaseAdmin()
      .from("plugin_ratings")
      .select("rating")
      .eq("plugin_name", pluginName);

    if (error || !data || data.length === 0) {
      return { avgRating: 0, count: 0 };
    }

    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    return {
      avgRating: Math.round((sum / data.length) * 10) / 10,
      count: data.length,
    };
  }

  async ratePlugin(
    pluginName: string,
    userId: string,
    rating: number,
    review?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabaseAdmin()
      .from("plugin_ratings")
      .upsert(
        {
          user_id: userId,
          plugin_name: pluginName,
          rating,
          review: review ?? null,
        },
        { onConflict: "user_id,plugin_name" },
      );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}
