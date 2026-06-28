/**
 * 插件系统共享类型定义
 *
 * 前后端 Kernel 共用，使用泛型让各端可指定自己的 Kernel API 类型。
 */

/** 插件生命周期状态 */
export type PluginState = "installed" | "active" | "inactive" | "uninstalled";

/** 插件元数据 */
export interface PluginMeta {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
}

/** 插件生命周期钩子（onInstall 为同步，与现有契约一致） */
export interface PluginLifecycleHooks<TAPI> {
  onInstall?(kernel: TAPI): void;
  onActivate?(): Promise<void> | void;
  onDeactivate?(): Promise<void> | void;
  onUninstall?(): void;
}

/** 插件基础结构，泛型 TAPI 表示各端 Kernel API 类型 */
export type PluginBase<TAPI> = PluginMeta & PluginLifecycleHooks<TAPI>;

/** 插件注册条目基础结构，state 为 string 以兼容各端可能扩展的状态字面量 */
export interface PluginEntryBase<TPlugin> {
  plugin: TPlugin;
  state: string;
}
