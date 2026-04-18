import { logger } from "../../utils/logger";

interface ExtensionEntry {
  pluginName: string;
  extension: unknown;
}

export class ExtensionPoint {
  private points = new Map<string, ExtensionEntry[]>();

  register(pointName: string, pluginName: string, extension: unknown): void {
    if (!this.points.has(pointName)) {
      this.points.set(pointName, []);
    }

    const entries = this.points.get(pointName);
    entries?.push({ pluginName, extension });

    logger.info(
      `[ExtensionPoint] Plugin "${pluginName}" registered extension for point "${pointName}"`,
    );
  }

  getExtensions(pointName: string): unknown[] {
    const entries = this.points.get(pointName);
    if (!entries) {
      return [];
    }
    return entries.map((entry) => entry.extension);
  }

  removeByPlugin(pluginName: string): void {
    for (const [pointName, entries] of this.points) {
      const filtered = entries.filter(
        (entry) => entry.pluginName !== pluginName,
      );
      if (filtered.length === 0) {
        this.points.delete(pointName);
      } else {
        this.points.set(pointName, filtered);
      }
    }

    logger.info(
      `[ExtensionPoint] Removed all extensions for plugin "${pluginName}"`,
    );
  }

  getPointNames(): string[] {
    return [...this.points.keys()];
  }

  getExtensionCount(pointName?: string): number {
    if (pointName) {
      return this.points.get(pointName)?.length ?? 0;
    }
    let total = 0;
    for (const entries of this.points.values()) {
      total += entries.length;
    }
    return total;
  }

  clear(): void {
    this.points.clear();
  }
}
