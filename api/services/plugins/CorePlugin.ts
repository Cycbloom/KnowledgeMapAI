import type { Plugin, KernelAPI } from "../kernel/types";
import { cacheInvalidationSubscriber } from "../core/subscribers/cacheInvalidationSubscriber";
import { sseNotificationSubscriber } from "../core/subscribers/sseNotificationSubscriber";
import authRoutes from "../../routes/system/auth";
import healthRoutes from "../../routes/system/health";
import dataRoutes from "../../routes/data";
import dashboardRoutes from "../../routes/dashboard";
import alertsRoutes from "../../routes/alerts";
import systemMonitorRoutes from "../../routes/system/systemMonitor";
import backupRoutes from "../../routes/system/backup";
import pluginsRoutes from "../../routes/plugins";
import databaseRoutes from "../../routes/system/database";
import supabaseRoutes from "../../routes/system/supabase";
import syncRoutes from "../../routes/system/sync";
import tagsRoutes from "../../routes/tags";

export const corePlugin: Plugin = {
  name: "core",
  version: "1.0.0",
  description: "Core services: authentication, settings, health, SSE, event bus",

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/auth", authRoutes, { rateLimiter: "auth" });
    kernel.registerRoutes("/api/v1/health", healthRoutes);
    kernel.registerRoutes("/api/v1/data", dataRoutes);
    kernel.registerRoutes("/api/v1/dashboard", dashboardRoutes);
    kernel.registerRoutes("/api/v1/alerts", alertsRoutes);
    kernel.registerRoutes("/api/v1/system-monitor", systemMonitorRoutes);
    kernel.registerRoutes("/api/v1/backup", backupRoutes);
    kernel.registerRoutes("/api/v1/plugins", pluginsRoutes);
    kernel.registerRoutes("/api/v1/database", databaseRoutes);
    kernel.registerRoutes("/api/v1/supabase", supabaseRoutes);
    kernel.registerRoutes("/api/v1/sync", syncRoutes);
    kernel.registerRoutes("/api/v1/tags", tagsRoutes);
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
