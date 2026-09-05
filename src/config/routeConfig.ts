import type { ComponentType } from "react";

/**
 * 前端路由 + 侧边导航的统一静态配置。
 *
 * 原实现通过 Kernel/Plugin 生命周期对象注册路由与导航（见 git 历史中移除的
 * `src/services/kernel/`），但所有 plugin 都硬编码在同一文件、无动态加载与独立
 * 发布，本质只是一份「路由 + 导航」配置表。这里将其扁平化为纯数据，减少概念
 * 负载与首屏逻辑，行为与原实现完全一致（路由保持原注册顺序，导航按 order 升序）。
 */

export interface RouteOptions {
  index?: boolean;
  protected?: boolean;
}

export interface RouteRegistration {
  path: string;
  component: () => Promise<{ default: ComponentType }>;
  options?: RouteOptions;
  /** 所属布局壳层。"protected" 渲染在 Layout 内，"public" 独立整页渲染。 */
  layout?: "protected" | "public";
  /** 若设置，该路由重定向到指定路径而不是渲染组件。 */
  redirect?: string;
  /**
   * i18n key（如 "layout.breadcrumb.dashboard"），用于设置 document.title。
   * 由 useDocumentTitle hook 在路由激活时解析。可选。
   */
  title?: string;
}

/** 导航项 label 的 i18n key，需在 layout.json（zh-CN 与 en-US）中存在。 */
export type NavLabelKey =
  | "layout.home"
  | "layout.graphs"
  | "layout.myGraphs"
  | "layout.graphMap"
  | "layout.studyCenter"
  | "layout.notes"
  | "layout.learningPaths"
  | "layout.statistics"
  | "layout.calendar"
  | "layout.achievements"
  | "layout.templates"
  | "layout.tasks"
  | "layout.scheduler"
  | "layout.profile"
  | "layout.trash";

export interface NavItemRegistration {
  path: string;
  label: NavLabelKey;
  icon?: string;
  order: number;
  protected?: boolean;
  /** "main" 出现在移动端底部标签栏，"more" 进入溢出菜单。 */
  category?: "main" | "more";
}

/** 静态路由配置表（保持原注册顺序，React Router 同 rank 按声明顺序匹配）。 */
export const routeRegistrations: RouteRegistration[] = [
  // ---- core ----
  {
    path: "/login",
    component: () => import("../pages/Login").then((m) => ({ default: m.Login })),
    layout: "public",
  },
  {
    path: "/register",
    component: () => import("../pages/Register").then((m) => ({ default: m.Register })),
    layout: "public",
  },
  {
    path: "/setup",
    component: () => import("../pages/SetupWizard").then((m) => ({ default: m.SetupWizard })),
    layout: "public",
  },
  {
    path: "/",
    component: () => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
    options: { index: true, protected: true },
    layout: "protected",
    title: "layout.breadcrumb.home",
  },
  {
    path: "/profile",
    component: () => import("../pages/Profile").then((m) => ({ default: m.Profile })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.profile",
  },
  {
    path: "/settings",
    component: () => import("../pages/Settings").then((m) => ({ default: m.Settings })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.settings",
  },
  {
    path: "/trash",
    component: () => import("../pages/RecycleBin").then((m) => ({ default: m.RecycleBin })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.trash",
  },
  {
    path: "/dashboard",
    component: () => import("../pages/GraphsPage").then((m) => ({ default: m.GraphsPage })),
    redirect: "/graphs",
    layout: "protected",
  },
  {
    path: "/graphs",
    component: () => import("../pages/GraphsPage").then((m) => ({ default: m.GraphsPage })),
    layout: "protected",
    title: "layout.breadcrumb.graphs",
  },

  // ---- graph ----
  {
    path: "/graph/:id",
    component: () => import("../pages/GraphEditor").then((m) => ({ default: m.GraphEditor })),
    layout: "public",
    title: "layout.breadcrumb.graphEditor",
  },
  {
    path: "/graph-map",
    component: () => import("../pages/GraphMap").then((m) => ({ default: m.GraphMap })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.graphMap",
  },
  {
    path: "/combined-graphs/:id1/:id2",
    component: () => import("../pages/CombinedGraphView").then((m) => ({ default: m.CombinedGraphView })),
    options: { protected: true },
    layout: "protected",
  },

  // ---- study ----
  {
    path: "/study",
    component: () => import("../pages/Study").then((m) => ({ default: m.Study })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.studyCenter",
  },
  {
    path: "/learning",
    component: () => import("../pages/LearningMode").then((m) => ({ default: m.LearningMode })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.learningMode",
  },
  {
    path: "/learning-paths",
    component: () => import("../pages/LearningPaths").then((m) => ({ default: m.LearningPaths })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.learningPaths",
  },
  {
    path: "/learning-paths/:id",
    component: () => import("../pages/LearningPathDetail").then((m) => ({ default: m.default })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.learningPaths",
  },
  {
    path: "/quiz/:quizSetId",
    component: () => import("../pages/QuizPreview").then((m) => ({ default: m.QuizPreview })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.quizPreview",
  },
  {
    path: "/quiz/:quizSetId/practice",
    component: () => import("../pages/QuizPractice").then((m) => ({ default: m.QuizPractice })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.quizPractice",
  },

  // ---- notes ----
  // 注意：/notes/templates 必须先于 /notes/:noteId 注册，否则 React Router
  // 会把 "templates" 当作 noteId 参数匹配。
  {
    path: "/notes",
    component: () => import("../pages/Notes/NotesListPage").then((m) => ({ default: m.NotesListPage })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.notes",
  },
  {
    path: "/notes/templates",
    component: () => import("../pages/Notes/TemplatesPage").then((m) => ({ default: m.default })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.templates",
  },
  {
    path: "/notes/:noteId",
    component: () => import("../pages/Notes/NoteEditorPage").then((m) => ({ default: m.default })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.notes",
  },

  // ---- scheduler ----
  {
    path: "/scheduler",
    component: () => import("../pages/Scheduler").then((m) => ({ default: m.Scheduler })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.scheduler",
  },
  {
    path: "/scheduler/current",
    component: () => import("../pages/CurrentTask").then((m) => ({ default: m.CurrentTask })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.currentTask",
  },
  {
    path: "/scheduler/stats",
    component: () => import("../pages/SchedulerStats").then((m) => ({ default: m.SchedulerStats })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.schedulerStats",
  },
  {
    path: "/scheduler/task/:taskId",
    component: () => import("../pages/TaskDetailPage").then((m) => ({ default: m.default })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.tasks",
  },
  {
    path: "/tasks",
    component: () => import("../pages/Tasks").then((m) => ({ default: m.Tasks })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.tasks",
  },
  {
    path: "/calendar",
    component: () => import("../pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.calendar",
  },
  {
    path: "/achievements",
    component: () => import("../pages/Achievements").then((m) => ({ default: m.Achievements })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.achievements",
  },
  {
    path: "/statistics",
    component: () => import("../pages/StatisticsCenter").then((m) => ({ default: m.StatisticsCenter })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.statistics",
  },
  {
    path: "/templates",
    component: () => import("../pages/Templates").then((m) => ({ default: m.Templates })),
    options: { protected: true },
    layout: "protected",
    title: "layout.breadcrumb.templates",
  },
];

/** 静态侧边/底部导航配置，按 order 升序（与原 getNavItems() 排序结果一致）。 */
export const navItems: NavItemRegistration[] = [
  { path: "/", label: "layout.home", icon: "Home", order: 1, category: "main" },
  { path: "/graphs", label: "layout.graphs", icon: "BookOpen", order: 2, category: "more" },
  { path: "/graph-map", label: "layout.graphMap", icon: "Network", order: 3, category: "more" },
  { path: "/notes", label: "layout.notes", icon: "NotebookPen", order: 5, category: "more" },
  { path: "/study", label: "layout.studyCenter", icon: "GraduationCap", order: 10, category: "main" },
  { path: "/learning-paths", label: "layout.learningPaths", icon: "Route", order: 11, category: "more" },
  { path: "/calendar", label: "layout.calendar", icon: "Calendar", order: 20, category: "main" },
  { path: "/statistics", label: "layout.statistics", icon: "BarChart3", order: 21, category: "main" },
  { path: "/achievements", label: "layout.achievements", icon: "Trophy", order: 22, category: "more" },
  { path: "/templates", label: "layout.templates", icon: "Sparkles", order: 23, category: "more" },
  { path: "/tasks", label: "layout.tasks", icon: "ListChecks", order: 30, category: "more" },
  { path: "/scheduler", label: "layout.scheduler", icon: "Zap", order: 31, category: "more" },
  { path: "/profile", label: "layout.profile", icon: "User", order: 90, category: "more" },
  { path: "/trash", label: "layout.trash", icon: "Trash2", order: 95, category: "more" },
];