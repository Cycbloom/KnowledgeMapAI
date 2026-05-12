import fs from "fs";
import path from "path";
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
import { validateManifest } from "./manifest";
import { logger } from "../../utils/logger";

/**
 * 插件系统核心内核
 *
 * Kernel 是整个插件系统的核心，负责管理插件的生命周期、服务注册、
 * 事件系统、扩展点和配置管理。它实现了 KernelAPI 接口，为插件提供
 * 统一的 API 入口。
 *
 * ## 架构概述
 *
 * - **插件管理**：注册、激活、停用、卸载插件
 * - **服务容器**：提供依赖注入机制，插件可注册和获取服务
 * - **事件系统**：发布-订阅模式，支持事件类型校验
 * - **扩展点**：允许插件扩展系统功能
 * - **路由注册**：插件可注册 Express 路由
 * - **配置管理**：支持插件配置的 Schema 验证
 *
 * @example
 * ```typescript
 * const kernel = new Kernel();
 *
 * // 注册插件
 * kernel.registerPlugin(myPlugin);
 *
 * // 激活插件
 * await kernel.activatePlugin('my-plugin');
 *
 * // 注册服务
 * kernel.registerService('logger', loggerService);
 *
 * // 发布事件
 * await kernel.publish('user.created', { userId: '123' }, 'system');
 * ```
 */
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

  /**
   * 注册插件到内核
   *
   * 将插件添加到注册表并调用其 onInstall 生命周期钩子。
   * 如果插件已注册，则跳过并记录警告。
   *
   * @param plugin - 要注册的插件对象
   *
   * @example
   * ```typescript
   * kernel.registerPlugin({
   *   name: 'my-plugin',
   *   version: '1.0.0',
   *   onInstall: (api) => {
   *     api.registerService('myService', myService);
   *   }
   * });
   * ```
   */
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

  /**
   * 激活指定插件
   *
   * 激活插件前会自动激活其依赖项。激活顺序按依赖关系拓扑排序。
   * 调用插件的 onActivate 生命周期钩子。
   *
   * @param name - 插件名称
   * @throws 如果插件未注册或依赖项未注册
   *
   * @example
   * ```typescript
   * await kernel.activatePlugin('my-plugin');
   * ```
   */
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

  /**
   * 停用指定插件
   *
   * 停用前会先停用所有依赖此插件的其他插件。
   * 调用插件的 onDeactivate 生命周期钩子并清理注册的资源。
   *
   * @param name - 插件名称
   * @throws 如果插件未注册
   *
   * @example
   * ```typescript
   * await kernel.deactivatePlugin('my-plugin');
   * ```
   */
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

  /**
   * 激活所有已注册的插件
   *
   * 按依赖关系的拓扑顺序激活所有插件。
   * 确保依赖项先于依赖它们的插件被激活。
   *
   * @example
   * ```typescript
   * await kernel.activateAll();
   * ```
   */
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

  /**
   * 停用所有已激活的插件
   *
   * 按依赖关系的逆拓扑顺序停用所有插件。
   * 确保依赖项在依赖它们的插件之后被停用。
   *
   * @example
   * ```typescript
   * await kernel.deactivateAll();
   * ```
   */
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

  /**
   * 注册服务到服务容器
   *
   * 将服务实例注册到内核的服务容器中，供其他插件使用。
   * 如果在插件上下文中调用，会自动关联到当前插件。
   *
   * @template T - 服务类型
   * @param name - 服务名称
   * @param service - 服务实例
   *
   * @example
   * ```typescript
   * kernel.registerService('logger', new LoggerService());
   * ```
   */
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

  /**
   * 从服务容器获取服务
   *
   * 根据名称获取已注册的服务实例。
   *
   * @template T - 服务类型
   * @param name - 服务名称
   * @returns 服务实例，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const logger = kernel.getService<LoggerService>('logger');
   * logger?.info('Hello');
   * ```
   */
  getService<T>(name: string): T | undefined {
    const service = this.serviceContainer.get(name);
    return service as T | undefined;
  }

  /**
   * 注册路由
   *
   * 注册 Express 路由到内核。如果在插件上下文中调用，
   * 会自动关联到当前插件，便于后续清理。
   *
   * @param prefix - 路由前缀（如 '/api/my-plugin'）
   * @param router - Express Router 实例
   * @param options - 路由选项（如中间件配置）
   *
   * @example
   * ```typescript
   * const router = express.Router();
   * router.get('/data', (req, res) => res.json({ data: 'hello' }));
   * kernel.registerRoutes('/api/my-plugin', router);
   * ```
   */
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

  /**
   * 获取所有已注册的路由
   *
   * @returns 路由注册表的副本
   */
  getRegisteredRoutes(): Map<string, { prefix: string; router: Router; options?: RouteOptions }> {
    return new Map(this.routeRegistry);
  }

  /**
   * 注册扩展
   *
   * 向指定扩展点注册扩展实现。扩展点允许插件扩展系统功能。
   *
   * @param pointName - 扩展点名称
   * @param extension - 扩展实现
   *
   * @example
   * ```typescript
   * kernel.registerExtension('menu-items', {
   *   label: '我的菜单',
   *   action: () => console.log('clicked')
   * });
   * ```
   */
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

  /**
   * 获取扩展点的所有扩展
   *
   * @param pointName - 扩展点名称
   * @returns 该扩展点的所有扩展实现数组
   *
   * @example
   * ```typescript
   * const menuItems = kernel.getExtensions('menu-items');
   * menuItems.forEach(item => console.log(item.label));
   * ```
   */
  getExtensions(pointName: string): unknown[] {
    return this.extensionPoint.getExtensions(pointName);
  }

  /**
   * 注册事件类型
   *
   * 注册一个事件类型，可选地关联 Zod Schema 用于事件负载验证。
   *
   * @param eventType - 事件类型名称
   * @param schema - 可选的 Zod Schema，用于验证事件负载
   *
   * @example
   * ```typescript
   * kernel.registerEventType('user.created', z.object({
   *   userId: z.string(),
   *   email: z.string()
   * }));
   * ```
   */
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

  /**
   * 订阅事件
   *
   * 订阅指定类型的事件，当事件发布时调用处理函数。
   *
   * @param eventType - 事件类型名称
   * @param handler - 事件处理函数
   *
   * @example
   * ```typescript
   * kernel.subscribe('user.created', async (event) => {
   *   console.log('User created:', event.payload.userId);
   * });
   * ```
   */
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

  /**
   * 取消订阅事件
   *
   * 移除指定事件类型的处理函数。
   *
   * @param eventType - 事件类型名称
   * @param handler - 要移除的事件处理函数
   */
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

  /**
   * 发布事件
   *
   * 发布事件到所有订阅者。如果事件类型注册了 Schema，
   * 会先验证事件负载。事件会异步分发给所有处理函数。
   *
   * @template T - 事件负载类型
   * @param eventType - 事件类型名称
   * @param payload - 事件负载数据
   * @param userId - 用户 ID
   * @param source - 可选的事件来源标识
   * @throws 如果事件负载验证失败
   *
   * @example
   * ```typescript
   * await kernel.publish('user.created', {
   *   userId: '123',
   *   email: 'user@example.com'
   * }, 'system');
   * ```
   */
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

  /**
   * 注册插件配置 Schema
   *
   * 注册 Zod Schema 用于验证插件配置。
   *
   * @param pluginName - 插件名称
   * @param schema - Zod Schema
   *
   * @example
   * ```typescript
   * kernel.registerConfigSchema('my-plugin', z.object({
   *   apiKey: z.string(),
   *   timeout: z.number().optional()
   * }));
   * ```
   */
  registerConfigSchema(pluginName: string, schema: ZodSchema): void {
    this.configSchemas.set(pluginName, schema);

    if (!this.configValues.has(pluginName)) {
      this.configValues.set(pluginName, {});
    }

    logger.info(`[Kernel] Config schema registered for plugin "${pluginName}"`);
  }

  /**
   * 获取插件配置
   *
   * @param pluginName - 插件名称
   * @returns 插件配置对象，如果不存在则返回空对象
   */
  getPluginConfig(pluginName: string): Record<string, unknown> {
    return this.configValues.get(pluginName) ?? {};
  }

  /**
   * 设置插件配置
   *
   * 设置插件配置，如果注册了 Schema 会先验证配置。
   *
   * @param pluginName - 插件名称
   * @param config - 配置对象
   * @throws 如果配置验证失败
   */
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

  /**
   * 获取插件条目
   *
   * @param name - 插件名称
   * @returns 插件条目，如果不存在则返回 undefined
   */
  getPlugin(name: string): PluginEntry | undefined {
    return this.pluginRegistry.get(name);
  }

  /**
   * 获取所有插件名称
   *
   * @returns 所有已注册插件的名称数组
   */
  getPluginNames(): string[] {
    return [...this.pluginRegistry.keys()];
  }

  /**
   * 获取所有已激活插件名称
   *
   * @returns 所有已激活插件的名称数组
   */
  getActivePluginNames(): string[] {
    return [...this.pluginRegistry.entries()]
      .filter(([, entry]) => entry.state === "active")
      .map(([name]) => name);
  }

  /**
   * 卸载插件
   *
   * 完全移除插件，包括停用、清理所有注册的资源、
   * 调用 onUninstall 生命周期钩子。
   *
   * @param name - 插件名称
   */
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

    for (const serviceName of entry.registeredServices) {
      this.serviceContainer.delete(serviceName);
    }

    for (const routePrefix of entry.registeredRoutes) {
      this.routeRegistry.delete(routePrefix);
    }

    this.extensionPoint.removeByPlugin(name);

    for (const eventType of entry.registeredEventTypes) {
      const typeEntry = this.eventTypeRegistry.get(eventType);
      if (typeEntry?.pluginName === name) {
        this.eventTypeRegistry.delete(eventType);
      }
    }

    for (const sub of entry.registeredSubscriptions) {
      const handlers = this.eventHandlers.get(sub.eventType);
      if (handlers) {
        handlers.delete(sub.handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(sub.eventType);
        }
      }
    }

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

  /**
   * 从清单文件加载插件
   *
   * 读取并验证插件清单文件，加载插件模块并注册到内核。
   *
   * @param manifestPath - 清单文件路径（manifest.json）
   * @returns 加载结果，包含成功状态和可选的错误信息
   *
   * @example
   * ```typescript
   * const result = await kernel.loadPluginFromManifest('/path/to/plugin/manifest.json');
   * if (!result.success) {
   *   console.error('Failed to load plugin:', result.error);
   * }
   * ```
   */
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

    const validation = validateManifest(manifestData);
    if (!validation.success) {
      return { success: false, error: `Invalid manifest: ${validation.errors?.join(", ")}` };
    }

    const manifest = validation.data;
    if (!manifest) {
      return { success: false, error: "Manifest validation succeeded but no data returned" };
    }
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

  /**
   * 获取插件状态
   *
   * @param name - 插件名称
   * @returns 插件状态信息，如果插件不存在则返回 undefined
   */
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
