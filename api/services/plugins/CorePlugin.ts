import type { Plugin, KernelAPI } from "../kernel/types";
import { authService } from "../core/authService";
import { settingsService } from "../core/settingsService";
import { healthService } from "../core/healthService";
import { sseService } from "../core/sseService";
import { appEventBus } from "../core/eventBus";
import { cacheInvalidationSubscriber } from "../core/subscribers/cacheInvalidationSubscriber";
import { sseNotificationSubscriber } from "../core/subscribers/sseNotificationSubscriber";
import authRoutes from "../../routes/auth";
import healthRoutes from "../../routes/health";

export const corePlugin: Plugin = {
  name: "core",
  version: "1.0.0",
  description: "Core services: authentication, settings, health, SSE, event bus",

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("authService", authService);
    kernel.registerService("settingsService", settingsService);
    kernel.registerService("healthService", healthService);
    kernel.registerService("sseService", sseService);
    kernel.registerService("eventBus", appEventBus);

    kernel.registerRoutes("/api/auth", authRoutes, { rateLimiter: "auth" });
    kernel.registerRoutes("/api/health", healthRoutes);

    kernel.registerExtension("subscriber", {
      name: "cacheInvalidation",
      subscriber: cacheInvalidationSubscriber,
    });
    kernel.registerExtension("subscriber", {
      name: "sseNotification",
      subscriber: sseNotificationSubscriber,
    });
  },

  async onActivate(): Promise<void> {
    cacheInvalidationSubscriber.initialize();
    sseNotificationSubscriber.initialize();
  },

  async onDeactivate(): Promise<void> {
    cacheInvalidationSubscriber.destroy();
    sseNotificationSubscriber.destroy();
  },
};
