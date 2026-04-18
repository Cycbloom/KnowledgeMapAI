import { Kernel } from "./Kernel";
import type { Plugin } from "./types";

const corePlugin: Plugin = {
  name: "core",
  version: "1.0.0",
  description: "Core pages: Login, Register, Dashboard, Profile, Settings",
  dependencies: [],

  onInstall(kernel): void {
    kernel.registerRoute({
      path: "/login",
      component: () => import("../../pages/Login").then((m) => ({ default: m.Login })),
    });

    kernel.registerRoute({
      path: "/register",
      component: () => import("../../pages/Register").then((m) => ({ default: m.Register })),
    });

    kernel.registerRoute({
      path: "/",
      component: () => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
      options: { index: true, protected: true },
    });

    kernel.registerRoute({
      path: "/profile",
      component: () => import("../../pages/Profile").then((m) => ({ default: m.Profile })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/settings",
      component: () => import("../../pages/Settings").then((m) => ({ default: m.Settings })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/trash",
      component: () => import("../../pages/RecycleBin").then((m) => ({ default: m.RecycleBin })),
      options: { protected: true },
    });

    kernel.registerNavItem({
      path: "/",
      label: "layout.myGraphs",
      icon: "BookOpen",
      order: 1,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/profile",
      label: "layout.profile",
      icon: "User",
      order: 90,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/trash",
      label: "layout.trash",
      icon: "Trash2",
      order: 95,
      protected: true,
    });
  },
};

const graphPlugin: Plugin = {
  name: "graph",
  version: "1.0.0",
  description: "Graph pages: GraphEditor, GraphMap, CombinedView",
  dependencies: ["core"],

  onInstall(kernel): void {
    kernel.registerRoute({
      path: "/graph/:id",
      component: () => import("../../pages/GraphEditor").then((m) => ({ default: m.GraphEditor })),
    });

    kernel.registerRoute({
      path: "/graph-map",
      component: () => import("../../pages/GraphMap").then((m) => ({ default: m.GraphMap })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/combined-graphs/:id1/:id2",
      component: () => import("../../pages/CombinedGraphView").then((m) => ({ default: m.CombinedGraphView })),
      options: { protected: true },
    });

    kernel.registerNavItem({
      path: "/graph-map",
      label: "layout.graphMap",
      icon: "Network",
      order: 2,
      protected: true,
    });
  },
};

const studyPlugin: Plugin = {
  name: "study",
  version: "1.0.0",
  description: "Study pages: Study, LearningMode, Quiz, LearningPaths",
  dependencies: ["core", "graph"],

  onInstall(kernel): void {
    kernel.registerRoute({
      path: "/study",
      component: () => import("../../pages/Study").then((m) => ({ default: m.Study })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/learning",
      component: () => import("../../pages/LearningMode").then((m) => ({ default: m.LearningMode })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/learning-paths",
      component: () => import("../../pages/LearningPaths").then((m) => ({ default: m.LearningPaths })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/learning-paths/:id",
      component: () => import("../../pages/LearningPathDetail").then((m) => ({ default: m.default })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/quiz/:quizSetId",
      component: () => import("../../pages/QuizPreview").then((m) => ({ default: m.QuizPreview })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/quiz/:quizSetId/practice",
      component: () => import("../../pages/QuizPractice").then((m) => ({ default: m.QuizPractice })),
      options: { protected: true },
    });

    kernel.registerNavItem({
      path: "/study",
      label: "layout.studyCenter",
      icon: "GraduationCap",
      order: 10,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/learning-paths",
      label: "layout.learningPaths",
      icon: "Route",
      order: 11,
      protected: true,
    });
  },
};

const schedulerPlugin: Plugin = {
  name: "scheduler",
  version: "1.0.0",
  description: "Scheduler pages: Scheduler, Tasks, Calendar, Achievements, Statistics",
  dependencies: ["core"],

  onInstall(kernel): void {
    kernel.registerRoute({
      path: "/scheduler",
      component: () => import("../../pages/Scheduler").then((m) => ({ default: m.Scheduler })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/scheduler/current",
      component: () => import("../../pages/CurrentTask").then((m) => ({ default: m.CurrentTask })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/scheduler/stats",
      component: () => import("../../pages/SchedulerStats").then((m) => ({ default: m.SchedulerStats })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/scheduler/task/:taskId",
      component: () => import("../../pages/TaskDetailPage").then((m) => ({ default: m.default })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/tasks",
      component: () => import("../../pages/Tasks").then((m) => ({ default: m.Tasks })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/calendar",
      component: () => import("../../pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/achievements",
      component: () => import("../../pages/Achievements").then((m) => ({ default: m.Achievements })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/statistics",
      component: () => import("../../pages/StatisticsCenter").then((m) => ({ default: m.StatisticsCenter })),
      options: { protected: true },
    });

    kernel.registerRoute({
      path: "/templates",
      component: () => import("../../pages/Templates").then((m) => ({ default: m.Templates })),
      options: { protected: true },
    });

    kernel.registerNavItem({
      path: "/statistics",
      label: "layout.statistics",
      icon: "BarChart3",
      order: 20,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/calendar",
      label: "layout.calendar",
      icon: "Calendar",
      order: 21,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/achievements",
      label: "layout.achievements",
      icon: "Trophy",
      order: 22,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/templates",
      label: "layout.templates",
      icon: "Sparkles",
      order: 23,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/tasks",
      label: "layout.tasks",
      icon: "ListChecks",
      order: 30,
      protected: true,
    });

    kernel.registerNavItem({
      path: "/scheduler",
      label: "layout.scheduler",
      icon: "Zap",
      order: 31,
      protected: true,
    });
  },
};

export function initializeFrontendPlugins(): Kernel {
  const kernel = new Kernel();

  kernel.registerPlugin(corePlugin);
  kernel.registerPlugin(graphPlugin);
  kernel.registerPlugin(studyPlugin);
  kernel.registerPlugin(schedulerPlugin);

  return kernel;
}
