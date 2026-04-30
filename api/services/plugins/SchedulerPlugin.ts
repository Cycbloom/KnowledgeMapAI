import type { Plugin, KernelAPI } from "../kernel/types";
import {
  taskService,
  executionService,
  focusService,
  achievementService,
  statsService,
  settingsService as schedulerSettingsService,
  periodicTaskService,
  taskAnalyticsService,
  taskRecommendationService,
  progressSyncService,
  efficiencyService,
  reviewTaskService,
  pathTaskService,
  smartSchedulerService,
} from "../scheduler/";
import { schedulerCronService } from "../scheduler/core/cronService";
import { schedulerSubscribers } from "../scheduler/core/subscribers";
import schedulerRouter from "../../routes/scheduler/index";
import tasksRouter from "../../routes/tasks";
import focusRouter from "../../routes/focus";
import achievementsRouter from "../../routes/achievements";
import periodicTasksRouter from "../../routes/periodicTasks";
import calendarRouter from "../../routes/calendar";
import notificationsRouter from "../../routes/notifications";
import { achievementSubscriber } from "../core/subscribers/achievementSubscriber";
import { learningProgressSubscriber } from "../core/subscribers/learningProgressSubscriber";
import { reviewSchedulerSubscriber } from "../core/subscribers/reviewSchedulerSubscriber";
import { getSupabaseAdmin } from "../../supabase";

export const SchedulerPlugin: Plugin = {
  name: "scheduler",
  version: "1.0.0",
  description: "Scheduler plugin wrapping task services, routes, and event subscribers",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("taskService", taskService);
    kernel.registerService("executionService", executionService);
    kernel.registerService("focusService", focusService);
    kernel.registerService("achievementService", achievementService);
    kernel.registerService("statsService", statsService);
    kernel.registerService("schedulerSettingsService", schedulerSettingsService);
    kernel.registerService("periodicTaskService", periodicTaskService);
    kernel.registerService("taskAnalyticsService", taskAnalyticsService);
    kernel.registerService("taskRecommendationService", taskRecommendationService);
    kernel.registerService("progressSyncService", progressSyncService);
    kernel.registerService("efficiencyService", efficiencyService);
    kernel.registerService("reviewTaskService", reviewTaskService);
    kernel.registerService("pathTaskService", pathTaskService);
    kernel.registerService("smartSchedulerService", smartSchedulerService);

    kernel.registerRoutes("/api/scheduler", schedulerRouter);
    kernel.registerRoutes("/api/tasks", tasksRouter);
    kernel.registerRoutes("/api/focus", focusRouter);
    kernel.registerRoutes("/api/achievements", achievementsRouter);
    kernel.registerRoutes("/api/periodic-tasks", periodicTasksRouter);
    kernel.registerRoutes("/api/calendar", calendarRouter);
    kernel.registerRoutes("/api/notifications", notificationsRouter);

    kernel.registerExtension("subscriber", {
      name: "achievement",
      subscriber: achievementSubscriber,
    });
    kernel.registerExtension("subscriber", {
      name: "learningProgress",
      subscriber: learningProgressSubscriber,
    });
    kernel.registerExtension("subscriber", {
      name: "reviewScheduler",
      subscriber: reviewSchedulerSubscriber,
    });
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
