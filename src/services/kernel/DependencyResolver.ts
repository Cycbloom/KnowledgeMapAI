import type { Plugin } from "./types";
import { logger } from "@/utils/logger";

export class DependencyResolver {
  resolve(plugins: Plugin[]): Plugin[] {
    const pluginMap = new Map<string, Plugin>();
    for (const plugin of plugins) {
      pluginMap.set(plugin.name, plugin);
    }

    const allNames = new Set(pluginMap.keys());

    for (const plugin of plugins) {
      const deps = plugin.dependencies ?? [];
      for (const dep of deps) {
        if (!allNames.has(dep)) {
          const error = new Error(
            `Missing dependency: "${plugin.name}" requires "${dep}" which is not registered`,
          );
          logger.error(`[DependencyResolver] ${error.message}`);
          throw error;
        }
      }
    }

    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, Set<string>>();

    for (const name of allNames) {
      inDegree.set(name, 0);
      adjacency.set(name, new Set());
    }

    for (const plugin of plugins) {
      const deps = plugin.dependencies ?? [];
      for (const dep of deps) {
        adjacency.get(dep)?.add(plugin.name);
        inDegree.set(plugin.name, (inDegree.get(plugin.name) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      sorted.push(current);

      const dependents = adjacency.get(current);
      if (dependents) {
        for (const dependent of dependents) {
          const newDegree = (inDegree.get(dependent) ?? 1) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    if (sorted.length !== allNames.size) {
      const remaining = [...allNames].filter((name) => !sorted.includes(name));
      const error = new Error(
        `Circular dependency detected among plugins: ${remaining.join(", ")}`,
      );
      logger.error(`[DependencyResolver] ${error.message}`);
      throw error;
    }

    return sorted.map((name) => pluginMap.get(name)).filter((p): p is Plugin => p !== undefined);
  }
}
