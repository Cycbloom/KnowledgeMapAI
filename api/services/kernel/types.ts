import type { Router, RequestHandler } from "express";

export type PluginState = "installed" | "active" | "inactive" | "uninstalled";

export interface Plugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  onInstall(kernel: KernelAPI): void;
  onActivate?(): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUninstall?(): void;
}

export interface KernelAPI {
  registerRoutes(prefix: string, router: Router, options?: RouteOptions): void;
  getPlugin(name: string): PluginEntry | undefined;
}

export interface RouteOptions {
  middleware?: RequestHandler[];
  rateLimiter?: string;
}

export interface RouteEntry {
  prefix: string;
  router: Router;
  options?: RouteOptions;
}

export interface PluginEntry {
  plugin: Plugin;
  state: PluginState | "error";
  errorMessage?: string;
  registeredRoutes: RouteEntry[];
}
