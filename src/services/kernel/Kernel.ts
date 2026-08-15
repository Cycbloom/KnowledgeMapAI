import type {
  Plugin,
  PluginEntry,
  RouteRegistration,
  NavItemRegistration,
  FrontendKernelAPI,
} from "./types";
import { DependencyResolver } from "./DependencyResolver";
import { PluginLifecycleBase } from "@shared/kernel";
import { logger } from "@/utils/logger";

export class Kernel
  extends PluginLifecycleBase<Plugin, FrontendKernelAPI, PluginEntry>
  implements FrontendKernelAPI
{
  private routeRegistry = new Map<string, RouteRegistration>();
  private navRegistry: NavItemRegistration[] = [];
  private apiRegistry = new Map<string, Record<string, unknown>>();
  private extensionPoint = new Map<string, Array<{ pluginName: string; extension: unknown }>>();
  private dependencyResolver = new DependencyResolver();
  private currentPluginName: string | null = null;

  // ---- 基类抽象成员实现 ----

  protected override createEntry(plugin: Plugin): PluginEntry {
    return {
      plugin,
      state: "installed",
      registeredRoutes: [],
      registeredNavItems: [],
      registeredApiModules: [],
      registeredExtensions: new Map(),
    };
  }

  protected override getPluginAPI(): FrontendKernelAPI {
    return this;
  }

  protected override logWarn(message: string): void {
    logger.warn(message);
  }

  protected override logInfo(_message: string): void {
    // 前端禁止 console.info，按现有行为不输出信息日志
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

    for (const routePath of entry.registeredRoutes) {
      this.routeRegistry.delete(routePath);
    }
    entry.registeredRoutes = [];

    // 预构建 Set 消除 filter 内部的 includes 线性扫描（O(n×m) → O(n+m)）
    const navPaths = new Set(entry.registeredNavItems);
    this.navRegistry = this.navRegistry.filter(
      (item) => !navPaths.has(item.path),
    );
    entry.registeredNavItems = [];

    for (const moduleName of entry.registeredApiModules) {
      this.apiRegistry.delete(moduleName);
    }
    entry.registeredApiModules = [];

    for (const [pointName] of entry.registeredExtensions) {
      const extensions = this.extensionPoint.get(pointName);
      if (extensions) {
        const filtered = extensions.filter(
          (ext) => ext.pluginName !== pluginName,
        );
        if (filtered.length === 0) {
          this.extensionPoint.delete(pointName);
        } else {
          this.extensionPoint.set(pointName, filtered);
        }
      }
    }
    entry.registeredExtensions.clear();
  }

  // ---- 上下文包裹（保留原 runInPluginContext 语义） ----

  protected override withPluginContextSync<T>(
    pluginName: string,
    fn: () => T,
  ): T {
    const prev = this.currentPluginName;
    this.currentPluginName = pluginName;
    try {
      return fn();
    } finally {
      this.currentPluginName = prev;
    }
  }

  protected override async withPluginContextAsync<T>(
    pluginName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prev = this.currentPluginName;
    this.currentPluginName = pluginName;
    try {
      return await fn();
    } finally {
      this.currentPluginName = prev;
    }
  }

  // ---- 前端独有方法 ----

  registerRoute(registration: RouteRegistration): void {
    if (this.routeRegistry.has(registration.path)) {
      logger.warn(`[Kernel] Route "${registration.path}" is already registered, overwriting`);
    }

    this.routeRegistry.set(registration.path, registration);

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredRoutes.includes(registration.path)) {
        entry.registeredRoutes.push(registration.path);
      }
    }
  }

  registerNavItem(item: NavItemRegistration): void {
    this.navRegistry.push(item);

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredNavItems.includes(item.path)) {
        entry.registeredNavItems.push(item.path);
      }
    }
  }

  registerApiModule(name: string, apiModule: Record<string, unknown>): void {
    if (this.apiRegistry.has(name)) {
      logger.warn(`[Kernel] API module "${name}" is already registered, overwriting`);
    }

    this.apiRegistry.set(name, apiModule);

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredApiModules.includes(name)) {
        entry.registeredApiModules.push(name);
      }
    }
  }

  getApiModule(name: string): Record<string, unknown> | undefined {
    return this.apiRegistry.get(name);
  }

  registerExtension(pointName: string, extension: unknown): void {
    const pluginName = this.currentPluginName ?? "unknown";

    if (!this.extensionPoint.has(pointName)) {
      this.extensionPoint.set(pointName, []);
    }

    this.extensionPoint.get(pointName)?.push({ pluginName, extension });

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry) {
        const existing = entry.registeredExtensions.get(pointName) ?? [];
        if (!existing.includes(pluginName)) {
          existing.push(pluginName);
        }
        entry.registeredExtensions.set(pointName, existing);
      }
    }
  }

  getExtensions(pointName: string): unknown[] {
    const entries = this.extensionPoint.get(pointName);
    if (!entries) {
      return [];
    }
    return entries.map((entry) => entry.extension);
  }

  getPlugin(name: string): PluginEntry | undefined {
    return this.pluginRegistry.get(name);
  }

  getRoutes(): RouteRegistration[] {
    return Array.from(this.routeRegistry.values());
  }

  getNavItems(): NavItemRegistration[] {
    return [...this.navRegistry].sort((a, b) => a.order - b.order);
  }

  getApiModules(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [name, module] of this.apiRegistry) {
      result[name] = module;
    }
    return result;
  }
}
