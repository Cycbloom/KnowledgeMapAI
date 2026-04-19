import type { Router, RequestHandler } from "express";
import type { ZodSchema } from "zod";

export type PluginState = "installed" | "active" | "inactive" | "uninstalled";

export interface PluginAuthor {
  name: string;
  email?: string;
}

export interface PluginMeta {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  author?: PluginAuthor;
  icon?: string;
  screenshots?: string[];
  homepage?: string;
  repository?: string;
  keywords?: string[];
  category?: string;
  permissions?: string[];
}

export interface Plugin extends PluginMeta {
  onInstall(kernel: KernelAPI): void;
  onActivate?(): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUninstall?(): void;
}

export interface KernelAPI {
  registerService<T>(name: string, service: T): void;
  getService<T>(name: string): T | undefined;

  registerRoutes(prefix: string, router: Router, options?: RouteOptions): void;

  registerExtension(pointName: string, extension: unknown): void;
  getExtensions(pointName: string): unknown[];

  registerEventType(eventType: string, schema?: ZodSchema): void;
  subscribe(eventType: string, handler: AppEventHandler): void;
  unsubscribe(eventType: string, handler: AppEventHandler): void;
  publish<T>(eventType: string, payload: T, userId: string, source?: string): Promise<void>;

  registerConfigSchema(pluginName: string, schema: ZodSchema): void;
  getPluginConfig(pluginName: string): Record<string, unknown>;

  getPlugin(name: string): PluginEntry | undefined;
}

export interface RouteOptions {
  middleware?: RequestHandler[];
  rateLimiter?: string;
}

export interface PluginEntry {
  plugin: Plugin;
  state: PluginState | "error";
  errorMessage?: string;
  registeredServices: string[];
  registeredRoutes: string[];
  registeredExtensions: Map<string, string[]>;
  registeredEventTypes: string[];
  registeredSubscriptions: Array<{ eventType: string; handler: AppEventHandler }>;
}

export interface AppEvent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  userId: string;
  timestamp: string;
  source?: string;
}

export type AppEventHandler = (event: AppEvent) => Promise<void> | void;

export interface EventTypeEntry {
  schema?: ZodSchema;
  pluginName?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: PluginAuthor;
  main: string;
  dependencies?: string[];
  permissions?: string[];
  icon?: string;
  screenshots?: string[];
  homepage?: string;
  repository?: string;
  keywords?: string[];
  category?: string;
}
