import type { ComponentType } from "react";

export type PluginState = "installed" | "active" | "inactive" | "uninstalled";

export interface PluginMeta {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
}

export interface Plugin extends PluginMeta {
  onInstall(kernel: FrontendKernelAPI): void;
  onActivate?(): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUninstall?(): void;
}

export interface RouteRegistration {
  path: string;
  component: () => Promise<{ default: ComponentType }>;
  options?: RouteOptions;
  /** Which layout shell this route belongs to. "protected" renders inside Layout, "public" renders standalone. */
  layout?: "protected" | "public";
  /** If set, this route redirects to the given path instead of rendering a component. */
  redirect?: string;
}

export interface RouteOptions {
  index?: boolean;
  protected?: boolean;
}

export interface NavItemRegistration {
  path: string;
  label: string;
  icon?: string;
  order: number;
  protected?: boolean;
  group?: string;
  /** Which navigation category this item belongs to. "main" appears in mobile bottom tabs, "more" in the overflow menu. */
  category?: "main" | "more";
}

export interface FrontendKernelAPI {
  registerRoute(registration: RouteRegistration): void;
  registerNavItem(item: NavItemRegistration): void;
  registerApiModule(name: string, apiModule: Record<string, unknown>): void;
  getApiModule(name: string): Record<string, unknown> | undefined;
  registerExtension(pointName: string, extension: unknown): void;
  getExtensions(pointName: string): unknown[];
  getPlugin(name: string): PluginEntry | undefined;
}

export interface PluginEntry {
  plugin: Plugin;
  state: PluginState;
  registeredRoutes: string[];
  registeredNavItems: string[];
  registeredApiModules: string[];
  registeredExtensions: Map<string, string[]>;
}
