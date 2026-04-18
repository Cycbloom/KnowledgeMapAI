import type { Router } from "express";
import type { ZodSchema } from "zod";
import type {
  Plugin,
  PluginEntry,
  KernelAPI,
  RouteOptions,
  AppEvent,
  AppEventHandler,
  EventTypeEntry,
} from "./types";
import { DependencyResolver } from "./DependencyResolver";
import { ExtensionPoint } from "./ExtensionPoint";
import { logger } from "../../utils/logger";

export class Kernel implements KernelAPI {
  private serviceContainer = new Map<string, unknown>();
  private pluginRegistry = new Map<string, PluginEntry>();
  private eventHandlers = new Map<string, Set<AppEventHandler>>();
  private eventTypeRegistry = new Map<string, EventTypeEntry>();
  private configSchemas = new Map<string, ZodSchema>();
  private configValues = new Map<string, Record<string, unknown>>();
  private routeRegistry = new Map<string, { prefix: string; router: Router; options?: RouteOptions }>();
  private extensionPoint = new ExtensionPoint();
  private dependencyResolver = new DependencyResolver();
  private currentPluginName: string | null = null;

  registerPlugin(plugin: Plugin): void {
    if (this.pluginRegistry.has(plugin.name)) {
      logger.warn(`[Kernel] Plugin "${plugin.name}" is already registered, skipping`);
      return;
    }

    const entry: PluginEntry = {
      plugin,
      state: "installed",
      registeredServices: [],
      registeredRoutes: [],
      registeredExtensions: new Map(),
      registeredEventTypes: [],
      registeredSubscriptions: [],
    };

    this.pluginRegistry.set(plugin.name, entry);
    logger.info(`[Kernel] Plugin "${plugin.name}" v${plugin.version} registered`);

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
      await this.runInPluginContextAsync(name, async () => {
        await entry.plugin.onActivate?.();
      });
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
      await this.runInPluginContextAsync(name, async () => {
        await entry.plugin.onDeactivate?.();
      });
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

  registerService<T>(name: string, service: T): void {
    if (this.serviceContainer.has(name)) {
      logger.warn(`[Kernel] Service "${name}" is already registered, overwriting`);
    }

    this.serviceContainer.set(name, service);

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredServices.includes(name)) {
        entry.registeredServices.push(name);
      }
    }

    logger.info(
      `[Kernel] Service "${name}" registered${this.currentPluginName ? ` by plugin "${this.currentPluginName}"` : ""}`,
    );
  }

  getService<T>(name: string): T | undefined {
    const service = this.serviceContainer.get(name);
    return service as T | undefined;
  }

  registerRoutes(prefix: string, router: Router, options?: RouteOptions): void {
    this.routeRegistry.set(prefix, { prefix, router, options });

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredRoutes.includes(prefix)) {
        entry.registeredRoutes.push(prefix);
      }
    }

    logger.info(
      `[Kernel] Routes "${prefix}" registered${this.currentPluginName ? ` by plugin "${this.currentPluginName}"` : ""}`,
    );
  }

  getRegisteredRoutes(): Map<string, { prefix: string; router: Router; options?: RouteOptions }> {
    return new Map(this.routeRegistry);
  }

  registerExtension(pointName: string, extension: unknown): void {
    const pluginName = this.currentPluginName ?? "unknown";
    this.extensionPoint.register(pointName, pluginName, extension);

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
    return this.extensionPoint.getExtensions(pointName);
  }

  registerEventType(eventType: string, schema?: ZodSchema): void {
    if (this.eventTypeRegistry.has(eventType)) {
      logger.warn(
        `[Kernel] Event type "${eventType}" is already registered, overwriting`,
      );
    }

    this.eventTypeRegistry.set(eventType, {
      schema,
      pluginName: this.currentPluginName ?? undefined,
    });

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry && !entry.registeredEventTypes.includes(eventType)) {
        entry.registeredEventTypes.push(eventType);
      }
    }

    logger.info(
      `[Kernel] Event type "${eventType}" registered${this.currentPluginName ? ` by plugin "${this.currentPluginName}"` : ""}`,
    );
  }

  subscribe(eventType: string, handler: AppEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)?.add(handler);

    if (this.currentPluginName) {
      const entry = this.pluginRegistry.get(this.currentPluginName);
      if (entry) {
        entry.registeredSubscriptions.push({ eventType, handler });
      }
    }

    logger.info(
      `[Kernel] Subscribed to "${eventType}"${this.currentPluginName ? ` by plugin "${this.currentPluginName}"` : ""}`,
    );
  }

  unsubscribe(eventType: string, handler: AppEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }

    for (const [, entry] of this.pluginRegistry) {
      const idx = entry.registeredSubscriptions.findIndex(
        (sub) => sub.eventType === eventType && sub.handler === handler,
      );
      if (idx !== -1) {
        entry.registeredSubscriptions.splice(idx, 1);
        break;
      }
    }
  }

  async publish<T>(
    eventType: string,
    payload: T,
    userId: string,
    source?: string,
  ): Promise<void> {
    const typeEntry = this.eventTypeRegistry.get(eventType);
    if (typeEntry?.schema) {
      const result = typeEntry.schema.safeParse(payload);
      if (!result.success) {
        logger.error(
          `[Kernel] Event "${eventType}" payload validation failed: ${result.error.message}`,
        );
        throw new Error(
          `Event "${eventType}" payload validation failed: ${result.error.message}`,
        );
      }
    }

    const event: AppEvent<T> = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      userId,
      timestamp: new Date().toISOString(),
      source,
    };

    const handlers = this.eventHandlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      logger.debug(`[Kernel] No subscribers for event "${eventType}"`);
      return;
    }

    logger.debug(
      `[Kernel] Publishing "${eventType}" to ${handlers.size} subscriber(s)`,
    );

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event as AppEvent);
      } catch (error) {
        logger.error(
          `[Kernel] Handler failed for event "${eventType}":`,
          error,
        );
      }
    });

    await Promise.allSettled(promises);
  }

  registerConfigSchema(pluginName: string, schema: ZodSchema): void {
    this.configSchemas.set(pluginName, schema);

    if (!this.configValues.has(pluginName)) {
      this.configValues.set(pluginName, {});
    }

    logger.info(`[Kernel] Config schema registered for plugin "${pluginName}"`);
  }

  getPluginConfig(pluginName: string): Record<string, unknown> {
    return this.configValues.get(pluginName) ?? {};
  }

  setPluginConfig(
    pluginName: string,
    config: Record<string, unknown>,
  ): void {
    const schema = this.configSchemas.get(pluginName);
    if (schema) {
      const result = schema.safeParse(config);
      if (!result.success) {
        throw new Error(
          `Config validation failed for plugin "${pluginName}": ${result.error.message}`,
        );
      }
    }
    this.configValues.set(pluginName, config);
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

    for (const serviceName of entry.registeredServices) {
      this.serviceContainer.delete(serviceName);
    }
    entry.registeredServices = [];

    for (const routePrefix of entry.registeredRoutes) {
      this.routeRegistry.delete(routePrefix);
    }
    entry.registeredRoutes = [];

    this.extensionPoint.removeByPlugin(pluginName);
    entry.registeredExtensions.clear();

    for (const eventType of entry.registeredEventTypes) {
      const typeEntry = this.eventTypeRegistry.get(eventType);
      if (typeEntry?.pluginName === pluginName) {
        this.eventTypeRegistry.delete(eventType);
      }
    }
    entry.registeredEventTypes = [];

    for (const sub of entry.registeredSubscriptions) {
      this.unsubscribe(sub.eventType, sub.handler);
    }
    entry.registeredSubscriptions = [];

    logger.info(
      `[Kernel] Cleaned up all registrations for plugin "${pluginName}"`,
    );
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
