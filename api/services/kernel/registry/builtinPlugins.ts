import type { PluginManifest } from "../types";

export interface RegistryPluginEntry extends PluginManifest {
  installCount: number;
  avgRating: number;
  ratingCount: number;
}

export const builtinPlugins: RegistryPluginEntry[] = [];
