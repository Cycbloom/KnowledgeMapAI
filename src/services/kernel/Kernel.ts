import type {
  Plugin,
  PluginEntry,
  RouteRegistration,
  NavItemRegistration,
  FrontendKernelAPI,
} from "./types";
import { DependencyResolver } from "./DependencyResolver";

export class Kernel implements FrontendKernelAPI {
  private routeRegistry = new Map<string, RouteRegistration>();
  private navRegistry: NavItemRegistration[] = [];
  private apiRegistry = new Map<string, Record<string, unknown>>();
  private extensionPoint = new Map<string, Array<{ pluginName: string; extension: unknown }>>();
  private pluginRegistry = new Map<string, PluginEntry>();
  private dependencyResolver = new DependencyResolver();
  private currentPluginName: string | null = null;

  registerPlugin(plugin: Plugin): void {
    if (this.pluginRegistry.has(plugin.name)) {
      console.warn(`[Kernel] Plugin "${plugin.name}" is already registered, skipping`);
      return;
    }

    const entry: PluginEntry = {
      plugin,
      state: "installed",
      registeredRoutes: [],
      registeredNavItems: [],
      registeredApiModules: [],
      registeredExtensions: new Map(),
    };

    this.pluginRegistry.set(plugin.name, entry);

    this.runInPluginContext(plugin.name, () => {
      plugin.onInstall(this);
    });

    entry.state = "inactive";
  }

  async activatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state === "active") {
      console.warn(`[Kernel] Plugin "${name}" is already active, skipping`);
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
        await this.activatePlugin(dep);
      }
    }

    if (entry.plugin.onActivate) {
      await this.runInPluginContextAsync(name, async () => {
        await entry.plugin.onActivate?.();
      });
    }

    entry.state = "active";
  }

  async deactivatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state !== "active") {
      console.warn(`[Kernel] Plugin "${name}" is not active, skipping deactivation`);
      return;
    }

    const dependents = this.getDependents(name);
    for (const dependent of dependents) {
      const depEntry = this.pluginRegistry.get(dependent);
      if (depEntry?.state === "active") {
        await this.deactivatePlugin(dependent);
      }
    }

    if (entry.plugin.onDeactivate) {
      await this.runInPluginContextAsync(name, async () => {
        await entry.plugin.onDeactivate?.();
      });
    }

    this.cleanupPluginRegistrations(name);
    entry.state = "inactive";
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
  }

  registerRoute(registration: RouteRegistration): void {
    if (this.routeRegistry.has(registration.path)) {
      console.warn(`[Kernel] Route "${registration.path}" is already registered, overwriting`);
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
      console.warn(`[Kernel] API module "${name}" is already registered, overwriting`);
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

    for (const routePath of entry.registeredRoutes) {
      this.routeRegistry.delete(routePath);
    }
    entry.registeredRoutes = [];

    this.navRegistry = this.navRegistry.filter(
      (item) => !entry.registeredNavItems.includes(item.path),
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

  private runInPluginContext<T>(pluginName: string, fn: () => T): T {
    const prev = this.currentPluginName;
    this.currentPluginName = pluginName;
    try {
      return fn();
    } finally {
      this.currentPluginName = prev;
    }
  }

  private async runInPluginContextAsync<T>(
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
}
