import type { RegistryPluginEntry } from "./builtinPlugins";
import { builtinPlugins } from "./builtinPlugins";

export class PluginRegistry {
  private plugins: Map<string, RegistryPluginEntry> = new Map();

  constructor() {
    for (const plugin of builtinPlugins) {
      this.plugins.set(plugin.name, plugin);
    }
  }

  list(options?: { category?: string; keyword?: string }): RegistryPluginEntry[] {
    let results = Array.from(this.plugins.values());

    if (options?.category) {
      results = results.filter(p => p.category === options.category);
    }

    if (options?.keyword) {
      const q = options.keyword.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.keywords?.some(k => k.toLowerCase().includes(q)) ?? false) ||
        p.author.name.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get(name: string): RegistryPluginEntry | undefined {
    return this.plugins.get(name);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const plugin of this.plugins.values()) {
      if (plugin.category) {
        categories.add(plugin.category);
      }
    }
    return Array.from(categories);
  }
}
