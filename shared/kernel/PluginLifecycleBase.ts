import type { PluginBase, PluginEntryBase, PluginState } from "./types";

/**
 * 插件生命周期抽象基类
 *
 * 抽取前后端 Kernel 共有的核心生命周期逻辑：
 * registerPlugin / activatePlugin / deactivatePlugin /
 * activateAll / deactivateAll / getDependents / cleanupPluginRegistrations。
 *
 * 通过泛型与受保护钩子适配前后端差异：
 * - TPlugin: 各端 Plugin 类型
 * - TAPI: 各端 Kernel API 类型
 * - TEntry: 各端 PluginEntry 类型（须包含 plugin 与 state）
 *
 * 子类须实现：createEntry / getPluginAPI / logWarn / logInfo /
 * resolveActivationOrder / cleanupPluginRegistrations。
 * 子类可重写：withPluginContextSync / withPluginContextAsync /
 * onAllActivated / onAllDeactivated。
 */
export abstract class PluginLifecycleBase<
  TPlugin extends PluginBase<unknown>,
  TAPI,
  TEntry extends PluginEntryBase<TPlugin>,
> {
  protected pluginRegistry = new Map<string, TEntry>();

  // ---- 子类必须实现的抽象成员 ----

  /** 创建插件注册条目（含各端特有字段） */
  protected abstract createEntry(plugin: TPlugin): TEntry;

  /** 返回传给 onInstall 的 Kernel API（各端通常返回 this） */
  protected abstract getPluginAPI(): TAPI;

  /** 警告日志（前端用 console.warn，后端用 logger.warn） */
  protected abstract logWarn(message: string): void;

  /** 信息日志（前端可为空实现，后端用 logger.info） */
  protected abstract logInfo(message: string): void;

  /** 返回按依赖拓扑序排列的插件列表（子类用各自的 DependencyResolver） */
  protected abstract resolveActivationOrder(): TPlugin[];

  /** 清理由插件注册的资源（路由/导航/API 模块/扩展点等） */
  protected abstract cleanupPluginRegistrations(pluginName: string): void;

  // ---- 子类可重写的钩子（默认空实现） ----

  /** 同步执行上下文包裹（前端用于设置 currentPluginName，后端用于设置 currentInstallingPlugin） */
  protected withPluginContextSync<T>(_pluginName: string, fn: () => T): T {
    return fn();
  }

  /** 异步执行上下文包裹（前端用于设置 currentPluginName，后端默认不包裹） */
  protected async withPluginContextAsync<T>(
    _pluginName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }

  /** activateAll 完成后的钩子（后端重写以记录日志） */
  protected onAllActivated(_plugins: TPlugin[]): void {
    // 默认无操作
  }

  /** deactivateAll 完成后的钩子（后端重写以记录日志） */
  protected onAllDeactivated(): void {
    // 默认无操作
  }

  // ---- 核心生命周期方法 ----

  registerPlugin(plugin: TPlugin): void {
    if (this.pluginRegistry.has(plugin.name)) {
      this.logWarn(`[Kernel] Plugin "${plugin.name}" is already registered, skipping`);
      return;
    }

    const entry = this.createEntry(plugin);
    this.pluginRegistry.set(plugin.name, entry);
    this.logInfo(`[Kernel] Plugin "${plugin.name}" v${plugin.version} registered`);

    this.withPluginContextSync(plugin.name, () => {
      plugin.onInstall?.(this.getPluginAPI());
    });

    this.setEntryState(entry, "inactive");
  }

  async activatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state === "active") {
      this.logWarn(`[Kernel] Plugin "${name}" is already active, skipping`);
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
        this.logInfo(
          `[Kernel] Auto-activating dependency "${dep}" for plugin "${name}"`,
        );
        await this.activatePlugin(dep);
      }
    }

    if (entry.plugin.onActivate) {
      await this.withPluginContextAsync(name, async () => {
        await entry.plugin.onActivate?.();
      });
    }

    this.setEntryState(entry, "active");
    this.logInfo(`[Kernel] Plugin "${name}" activated`);
  }

  async deactivatePlugin(name: string): Promise<void> {
    const entry = this.pluginRegistry.get(name);
    if (!entry) {
      throw new Error(`[Kernel] Plugin "${name}" is not registered`);
    }

    if (entry.state !== "active") {
      this.logWarn(`[Kernel] Plugin "${name}" is not active, skipping deactivation`);
      return;
    }

    const dependents = this.getDependents(name);
    for (const dependent of dependents) {
      const depEntry = this.pluginRegistry.get(dependent);
      if (depEntry?.state === "active") {
        this.logInfo(
          `[Kernel] Deactivating dependent plugin "${dependent}" before "${name}"`,
        );
        await this.deactivatePlugin(dependent);
      }
    }

    if (entry.plugin.onDeactivate) {
      await this.withPluginContextAsync(name, async () => {
        await entry.plugin.onDeactivate?.();
      });
    }

    this.cleanupPluginRegistrations(name);
    this.setEntryState(entry, "inactive");
  }

  async activateAll(): Promise<void> {
    const sorted = this.resolveActivationOrder();
    for (const plugin of sorted) {
      const entry = this.pluginRegistry.get(plugin.name);
      if (entry && entry.state !== "active") {
        await this.activatePlugin(plugin.name);
      }
    }
    this.onAllActivated(sorted);
  }

  async deactivateAll(): Promise<void> {
    const sorted = this.resolveActivationOrder();
    const reverseOrder = [...sorted].reverse();
    for (const plugin of reverseOrder) {
      const entry = this.pluginRegistry.get(plugin.name);
      if (entry?.state === "active") {
        await this.deactivatePlugin(plugin.name);
      }
    }
    this.onAllDeactivated();
  }

  // ---- 受保护工具方法 ----

  /**
   * 写入条目状态。通过向上转型到 PluginEntryBase<TPlugin> 避免对泛型
   * TEntry["state"] 直接赋值时的类型推断问题。
   */
  protected setEntryState(entry: TEntry, state: PluginState): void {
    const base: PluginEntryBase<TPlugin> = entry;
    base.state = state;
  }

  /** 返回依赖给定插件的其它插件名 */
  protected getDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    for (const [name, entry] of this.pluginRegistry) {
      const deps = entry.plugin.dependencies ?? [];
      if (deps.includes(pluginName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }
}
