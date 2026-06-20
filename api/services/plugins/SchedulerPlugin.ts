import type { Plugin, KernelAPI } from "../kernel/types";
import { schedulerCronService } from "../scheduler/core/cronService";
import { schedulerSubscribers } from "../scheduler/core/subscribers";
import { achievementSubscriber } from "../core/subscribers/achievementSubscriber";
import { learningProgressSubscriber } from "../core/subscribers/learningProgressSubscriber";
import { reviewSchedulerSubscriber } from "../core/subscribers/reviewSchedulerSubscriber";
import { getSupabaseAdmin } from "../../supabase";
import schedulerRouter from "../../routes/scheduler/index";
import tasksRouter from "../../routes/tasks";
import achievementsRouter from "../../routes/achievements";
import periodicTasksRouter from "../../routes/periodicTasks";
import calendarRouter from "../../routes/calendar";
import notificationsRouter from "../../routes/notifications";
import statisticsRoutes from "../../routes/statistics";
import templateRoutes from "../../routes/templates";
import analyticsRoutes from "../../routes/analytics";

export const SchedulerPlugin: Plugin = {
  name: "scheduler",
  version: "1.0.0",
  description: "Scheduler plugin wrapping task services, routes, and event subscribers",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/scheduler", schedulerRouter);
    kernel.registerRoutes("/api/tasks", tasksRouter);
    kernel.registerRoutes("/api/achievements", achievementsRouter);
    kernel.registerRoutes("/api/periodic-tasks", periodicTasksRouter);
    kernel.registerRoutes("/api/calendar", calendarRouter);
    kernel.registerRoutes("/api/notifications", notificationsRouter);
    kernel.registerRoutes("/api/statistics", statisticsRoutes);
    kernel.registerRoutes("/api/templates", templateRoutes);
    kernel.registerRoutes("/api/analytics", analyticsRoutes);
  },

  async onActivate(): Promise<void> {
    schedulerSubscribers.initialize(getSupabaseAdmin());
    achievementSubscriber.initialize();
    learningProgressSubscriber.initialize();
    reviewSchedulerSubscriber.initialize();
    schedulerCronService.start();
  },

  async onDeactivate(): Promise<void> {
    achievementSubscriber.destroy();
    learningProgressSubscriber.destroy();
    reviewSchedulerSubscriber.destroy();
    schedulerCronService.stop();
  },
};
