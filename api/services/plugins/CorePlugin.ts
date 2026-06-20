import type { Plugin, KernelAPI } from "../kernel/types";
import { cacheInvalidationSubscriber } from "../core/subscribers/cacheInvalidationSubscriber";
import { sseNotificationSubscriber } from "../core/subscribers/sseNotificationSubscriber";
import authRoutes from "../../routes/auth";
import healthRoutes from "../../routes/health";
import dataRoutes from "../../routes/data";
import dashboardRoutes from "../../routes/dashboard";
import alertsRoutes from "../../routes/alerts";
import systemMonitorRoutes from "../../routes/systemMonitor";
import backupRoutes from "../../routes/backup";
import pluginsRoutes from "../../routes/plugins";
import databaseRoutes from "../../routes/database";
import supabaseRoutes from "../../routes/supabase";
import syncRoutes from "../../routes/sync";

export const corePlugin: Plugin = {
  name: "core",
  version: "1.0.0",
  description: "Core services: authentication, settings, health, SSE, event bus",

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/auth", authRoutes, { rateLimiter: "auth" });
    kernel.registerRoutes("/api/health", healthRoutes);
    kernel.registerRoutes("/api/data", dataRoutes);
    kernel.registerRoutes("/api/dashboard", dashboardRoutes);
    kernel.registerRoutes("/api/alerts", alertsRoutes);
    kernel.registerRoutes("/api/system-monitor", systemMonitorRoutes);
    kernel.registerRoutes("/api/backup", backupRoutes);
    kernel.registerRoutes("/api/plugins", pluginsRoutes);
    kernel.registerRoutes("/api/database", databaseRoutes);
    kernel.registerRoutes("/api/supabase", supabaseRoutes);
    kernel.registerRoutes("/api/sync", syncRoutes);
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
