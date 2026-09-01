import type { Plugin, KernelAPI } from "../kernel/types";
import { schedulerCronService } from "../scheduler/core/cronService";
import { schedulerSubscribers } from "../scheduler/core/subscribers";
import { getSupabaseAdmin } from "../../supabase";
import schedulerRouter from "../../routes/scheduler/index";
import tasksRouter from "../../routes/tasks";
import achievementsRouter from "../../routes/learning/achievements";
import periodicTasksRouter from "../../routes/periodicTasks";
import calendarRouter from "../../routes/calendar";
import notificationsRouter from "../../routes/notifications";
import statisticsRoutes from "../../routes/learning/statistics";
import templateRoutes from "../../routes/templates";
import analyticsRoutes from "../../routes/analytics";

export const SchedulerPlugin: Plugin = {
  name: "scheduler",
  version: "1.0.0",
  description: "Scheduler plugin wrapping task services, routes, and event subscribers",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/scheduler", schedulerRouter);
    kernel.registerRoutes("/api/v1/tasks", tasksRouter);
    kernel.registerRoutes("/api/v1/achievements", achievementsRouter);
    kernel.registerRoutes("/api/v1/periodic-tasks", periodicTasksRouter);
    kernel.registerRoutes("/api/v1/calendar", calendarRouter);
    kernel.registerRoutes("/api/v1/notifications", notificationsRouter);
    kernel.registerRoutes("/api/v1/statistics", statisticsRoutes);
    kernel.registerRoutes("/api/v1/templates", templateRoutes);
    kernel.registerRoutes("/api/v1/analytics", analyticsRoutes);
  },

  async onActivate(): Promise<void> {
    // schedulerSubscribers.initialize 一并注册效率统计及成就/学习进度/复习调度订阅器，
    // 避免此处重复 initialize 导致同一事件被处理两次。
    schedulerSubscribers.initialize(getSupabaseAdmin());
    schedulerCronService.start();
  },

  async onDeactivate(): Promise<void> {
    schedulerSubscribers.destroy();
    schedulerCronService.stop();
  },
};
