import { Kernel } from "./Kernel";
import type { Plugin } from "./types";

const corePlugin: Plugin = {
  name: "core",
  version: "1.0.0",
  description: "Core pages: Login, Register, Dashboard, Profile, Settings",
  dependencies: [],

  onInstall(kernel): void {
    // Public routes (outside Layout)
    kernel.registerRoute({
      path: "/login",
      component: () => import("../../pages/Login").then((m) => ({ default: m.Login })),
      layout: "public",
    });

    kernel.registerRoute({
      path: "/register",
      component: () => import("../../pages/Register").then((m) => ({ default: m.Register })),
      layout: "public",
    });

    kernel.registerRoute({
      path: "/setup",
      component: () => import("../../pages/SetupWizard").then((m) => ({ default: m.SetupWizard })),
      layout: "public",
    });

    // Protected routes (inside Layout)
    kernel.registerRoute({
      path: "/",
      component: () => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
      options: { index: true, protected: true },
      layout: "protected",
      title: "layout.breadcrumb.dashboard",
    });

    kernel.registerRoute({
      path: "/profile",
      component: () => import("../../pages/Profile").then((m) => ({ default: m.Profile })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.profile",
    });

    kernel.registerRoute({
      path: "/settings",
      component: () => import("../../pages/Settings").then((m) => ({ default: m.Settings })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.settings",
    });

    kernel.registerRoute({
      path: "/trash",
      component: () => import("../../pages/RecycleBin").then((m) => ({ default: m.RecycleBin })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.trash",
    });

    // Redirect routes
    kernel.registerRoute({
      path: "/dashboard",
      component: () => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
      redirect: "/",
      layout: "protected",
    });

    kernel.registerRoute({
      path: "/graphs",
      component: () => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
      redirect: "/",
      layout: "protected",
    });

    // Nav items
    kernel.registerNavItem({
      path: "/",
      label: "layout.myGraphs",
      icon: "BookOpen",
      order: 1,
      protected: true,
      category: "main",
    });

    kernel.registerNavItem({
      path: "/profile",
      label: "layout.profile",
      icon: "User",
      order: 90,
      protected: true,
      category: "more",
    });

    kernel.registerNavItem({
      path: "/trash",
      label: "layout.trash",
      icon: "Trash2",
      order: 95,
      protected: true,
      category: "more",
    });
  },
};

const graphPlugin: Plugin = {
  name: "graph",
  version: "1.0.0",
  description: "Graph pages: GraphEditor, GraphMap, CombinedView",
  dependencies: ["core"],

  onInstall(kernel): void {
    // Public route (graph editor is full-screen, outside Layout)
    kernel.registerRoute({
      path: "/graph/:id",
      component: () => import("../../pages/GraphEditor").then((m) => ({ default: m.GraphEditor })),
      layout: "public",
      title: "layout.breadcrumb.graphEditor",
    });

    // Protected routes (inside Layout)
    kernel.registerRoute({
      path: "/graph-map",
      component: () => import("../../pages/GraphMap").then((m) => ({ default: m.GraphMap })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.graphMap",
    });

    kernel.registerRoute({
      path: "/combined-graphs/:id1/:id2",
      component: () => import("../../pages/CombinedGraphView").then((m) => ({ default: m.CombinedGraphView })),
      options: { protected: true },
      layout: "protected",
    });

    // Nav items
    kernel.registerNavItem({
      path: "/graph-map",
      label: "layout.graphMap",
      icon: "Network",
      order: 2,
      protected: true,
      category: "main",
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
      layout: "protected",
      title: "layout.breadcrumb.studyCenter",
    });

    kernel.registerRoute({
      path: "/learning",
      component: () => import("../../pages/LearningMode").then((m) => ({ default: m.LearningMode })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.learningMode",
    });

    kernel.registerRoute({
      path: "/learning-paths",
      component: () => import("../../pages/LearningPaths").then((m) => ({ default: m.LearningPaths })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.learningPaths",
    });

    kernel.registerRoute({
      path: "/learning-paths/:id",
      component: () => import("../../pages/LearningPathDetail").then((m) => ({ default: m.default })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.learningPaths",
    });

    kernel.registerRoute({
      path: "/quiz/:quizSetId",
      component: () => import("../../pages/QuizPreview").then((m) => ({ default: m.QuizPreview })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.quizPreview",
    });

    kernel.registerRoute({
      path: "/quiz/:quizSetId/practice",
      component: () => import("../../pages/QuizPractice").then((m) => ({ default: m.QuizPractice })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.quizPractice",
    });

    kernel.registerNavItem({
      path: "/study",
      label: "layout.studyCenter",
      icon: "GraduationCap",
      order: 10,
      protected: true,
      category: "main",
    });

    kernel.registerNavItem({
      path: "/learning-paths",
      label: "layout.learningPaths",
      icon: "Route",
      order: 11,
      protected: true,
      category: "more",
    });
  },
};

const notesPlugin: Plugin = {
  name: "notes",
  version: "1.0.0",
  description: "Notes pages: NotesListPage (/notes), TemplatesPage (/notes/templates) and NoteEditorPage (/notes/:noteId).",
  dependencies: ["core"],

  onInstall(kernel): void {
    // Protected route (inside Layout)
    kernel.registerRoute({
      path: "/notes",
      component: () => import("../../pages/Notes/NotesListPage").then((m) => ({ default: m.NotesListPage })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.notes",
    });

    // Templates page (Task 11) — 必须注册在 /notes/:noteId 之前,
    // 否则 React Router 会把 "templates" 当作 noteId 参数匹配。
    kernel.registerRoute({
      path: "/notes/templates",
      component: () => import("../../pages/Notes/TemplatesPage").then((m) => ({ default: m.default })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.templates",
    });

    // Note editor page (Task 8)
    kernel.registerRoute({
      path: "/notes/:noteId",
      component: () => import("../../pages/Notes/NoteEditorPage").then((m) => ({ default: m.default })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.notes",
    });

    // Nav item — placed between graph-map (order 2) and study (order 10)
    kernel.registerNavItem({
      path: "/notes",
      label: "layout.notes",
      icon: "NotebookPen",
      order: 5,
      protected: true,
      category: "main",
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
      layout: "protected",
      title: "layout.breadcrumb.scheduler",
    });

    kernel.registerRoute({
      path: "/scheduler/current",
      component: () => import("../../pages/CurrentTask").then((m) => ({ default: m.CurrentTask })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.currentTask",
    });

    kernel.registerRoute({
      path: "/scheduler/stats",
      component: () => import("../../pages/SchedulerStats").then((m) => ({ default: m.SchedulerStats })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.schedulerStats",
    });

    kernel.registerRoute({
      path: "/scheduler/task/:taskId",
      component: () => import("../../pages/TaskDetailPage").then((m) => ({ default: m.default })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.tasks",
    });

    kernel.registerRoute({
      path: "/tasks",
      component: () => import("../../pages/Tasks").then((m) => ({ default: m.Tasks })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.tasks",
    });

    kernel.registerRoute({
      path: "/calendar",
      component: () => import("../../pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.calendar",
    });

    kernel.registerRoute({
      path: "/achievements",
      component: () => import("../../pages/Achievements").then((m) => ({ default: m.Achievements })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.achievements",
    });

    kernel.registerRoute({
      path: "/statistics",
      component: () => import("../../pages/StatisticsCenter").then((m) => ({ default: m.StatisticsCenter })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.statistics",
    });

    kernel.registerRoute({
      path: "/templates",
      component: () => import("../../pages/Templates").then((m) => ({ default: m.Templates })),
      options: { protected: true },
      layout: "protected",
      title: "layout.breadcrumb.templates",
    });

    kernel.registerNavItem({
      path: "/statistics",
      label: "layout.statistics",
      icon: "BarChart3",
      order: 20,
      protected: true,
      category: "main",
    });

    kernel.registerNavItem({
      path: "/calendar",
      label: "layout.calendar",
      icon: "Calendar",
      order: 21,
      protected: true,
      category: "more",
    });

    kernel.registerNavItem({
      path: "/achievements",
      label: "layout.achievements",
      icon: "Trophy",
      order: 22,
      protected: true,
      category: "more",
    });

    kernel.registerNavItem({
      path: "/templates",
      label: "layout.templates",
      icon: "Sparkles",
      order: 23,
      protected: true,
      category: "more",
    });

    kernel.registerNavItem({
      path: "/tasks",
      label: "layout.tasks",
      icon: "ListChecks",
      order: 30,
      protected: true,
      category: "more",
    });

    kernel.registerNavItem({
      path: "/scheduler",
      label: "layout.scheduler",
      icon: "Zap",
      order: 31,
      protected: true,
      category: "more",
    });
  },
};

export function initializeFrontendPlugins(): Kernel {
  const kernel = new Kernel();

  kernel.registerPlugin(corePlugin);
  kernel.registerPlugin(graphPlugin);
  kernel.registerPlugin(studyPlugin);
  kernel.registerPlugin(notesPlugin);
  kernel.registerPlugin(schedulerPlugin);

  return kernel;
}
