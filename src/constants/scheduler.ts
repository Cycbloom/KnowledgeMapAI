/**
 * Scheduler unified constants
 *
 * QUEUE_COLORS  — queue-level (0/1/2) color scheme used across all scheduler UI
 * STATUS_CONFIG — task status label + color scheme
 */

// ---------------------------------------------------------------------------
// Queue-level color scheme (keys: 0 = urgent, 1 = important, 2 = todo)
// ---------------------------------------------------------------------------

export type QueueLevel = 0 | 1 | 2;

export interface QueueColorDef {
  /** Card / column border */
  border: string;
  /** Box-shadow glow (used while dragging) */
  glow: string;
  /** Light background fill */
  bg: string;
  /** Text / icon colour */
  text: string;
  /** Badge (combined bg + text for the "Q0" label) */
  badge: string;
  /** Small accent bar (1 px left strip, progress bar) */
  accent: string;
  /** Tailwind gradient classes (from-X to-Y) */
  gradient: string;
  /** Raw hex colour for charts / canvas */
  hex: string;
  /** RGBA glow for charts / canvas */
  hexGlow: string;
}

export const QUEUE_COLORS: Record<QueueLevel, QueueColorDef> = {
  0: {
    border: "border-primary-300 dark:border-primary-400",
    glow: "shadow-primary-500/30",
    bg: "bg-primary-100 dark:bg-primary-500/10",
    text: "text-primary-600 dark:text-primary-400",
    badge:
      "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
    accent: "bg-primary-500",
    gradient: "from-primary-500 to-primary-600",
    hex: "#06b6d4",
    hexGlow: "rgba(6, 182, 212, 0.3)",
  },
  1: {
    border: "border-secondary-300 dark:border-secondary-400",
    glow: "shadow-secondary-500/30",
    bg: "bg-secondary-100 dark:bg-secondary-500/10",
    text: "text-secondary-600 dark:text-secondary-400",
    badge:
      "bg-secondary-100 text-secondary-700 dark:bg-secondary-500/20 dark:text-secondary-300",
    accent: "bg-secondary-500",
    gradient: "from-secondary-500 to-secondary-600",
    hex: "#10b981",
    hexGlow: "rgba(16, 185, 129, 0.3)",
  },
  2: {
    border: "border-tertiary-300 dark:border-tertiary-400",
    glow: "shadow-tertiary-500/30",
    bg: "bg-tertiary-100 dark:bg-tertiary-500/10",
    text: "text-tertiary-600 dark:text-tertiary-400",
    badge:
      "bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-500/20 dark:text-tertiary-300",
    accent: "bg-tertiary-500",
    gradient: "from-tertiary-500 to-tertiary-600",
    hex: "#f59e0b",
    hexGlow: "rgba(245, 158, 11, 0.3)",
  },
};

// ---------------------------------------------------------------------------
// Task status configuration
// ---------------------------------------------------------------------------

export interface StatusConfigDef {
  /** i18n key for the status label */
  labelKey: string;
  /** Combined bg + text classes (most common usage) */
  color: string;
  /** Background only classes */
  bgColor: string;
  /** Text only classes */
  textColor: string;
  /** Border only classes */
  borderColor: string;
}

export const STATUS_CONFIG: Record<string, StatusConfigDef> = {
  pending: {
    labelKey: "scheduler.task.status.pending",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-500/20",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-500",
  },
  in_progress: {
    labelKey: "scheduler.task.status.inProgress",
    color: "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400",
    bgColor: "bg-primary-100 dark:bg-primary-500/20",
    textColor: "text-primary-600 dark:text-primary-400",
    borderColor: "border-primary-200 dark:border-primary-500/50",
  },
  paused: {
    labelKey: "scheduler.task.status.paused",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-500/20",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-500/50",
  },
  completed: {
    labelKey: "scheduler.task.status.completed",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-500/20",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-500/50",
  },
  cancelled: {
    labelKey: "scheduler.task.status.cancelled",
    color: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-500/20",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-500/50",
  },
};

// ---------------------------------------------------------------------------
// TaskDetail dark-theme status config
// (TaskDetail uses a dark-only color scheme, kept separate from the main
//  STATUS_CONFIG to avoid mixing light/dark class sets)
// ---------------------------------------------------------------------------

export const TASK_DETAIL_STATUS_CONFIG = {
  pending: { labelKey: "scheduler.task.status.pending", color: "text-slate-400", bg: "bg-slate-500/20" },
  in_progress: {
    labelKey: "scheduler.task.status.inProgress",
    color: "text-primary-400",
    bg: "bg-primary-500/20",
  },
  paused: { labelKey: "scheduler.task.status.paused", color: "text-amber-400", bg: "bg-amber-500/20" },
  completed: {
    labelKey: "scheduler.task.status.completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
  cancelled: { labelKey: "scheduler.task.status.cancelled", color: "text-red-400", bg: "bg-red-500/20" },
};

// ---------------------------------------------------------------------------
// TaskDetail queue config (includes per-queue labels)
// ---------------------------------------------------------------------------

export const TASK_DETAIL_QUEUE_CONFIG = {
  0: {
    labelKey: "scheduler.task.queue.urgent",
    color: "text-primary-400",
    bg: "bg-primary-500/20",
    border: "border-primary-500/30",
  },
  1: {
    labelKey: "scheduler.task.queue.important",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  2: {
    labelKey: "scheduler.task.queue.todo",
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
  },
};

// ---------------------------------------------------------------------------
// QueueSettings colour-name map
// (Keyed by colour name string rather than numeric queue level)
// ---------------------------------------------------------------------------

export type QueueColorName =
  | "cyan"
  | "blue"
  | "emerald"
  | "amber"
  | "orange"
  | "purple"
  | "pink"
  | "red";

export const QUEUE_NAME_COLORS: Record<
  QueueColorName,
  { bg: string; text: string; border: string; ring: string; gradient: string }
> = {
  cyan: {
    bg: "bg-primary-100 dark:bg-primary-500/20",
    text: "text-primary-700 dark:text-primary-300",
    border: "border-primary-300 dark:border-primary-500/50",
    ring: "ring-primary-500",
    gradient: "from-primary-500 to-primary-600",
  },
  blue: {
    bg: "bg-primary-100 dark:bg-primary-500/20",
    text: "text-primary-700 dark:text-primary-300",
    border: "border-primary-300 dark:border-primary-500/50",
    ring: "ring-primary-500",
    gradient: "from-primary-500 to-primary-600",
  },
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-500/50",
    ring: "ring-emerald-500",
    gradient: "from-emerald-500 to-emerald-600",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-500/50",
    ring: "ring-amber-500",
    gradient: "from-amber-500 to-amber-600",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-500/50",
    ring: "ring-orange-500",
    gradient: "from-orange-500 to-orange-600",
  },
  purple: {
    bg: "bg-primary-100 dark:bg-primary-500/20",
    text: "text-primary-700 dark:text-primary-300",
    border: "border-primary-300 dark:border-primary-500/50",
    ring: "ring-primary-500",
    gradient: "from-primary-500 to-primary-600",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-500/20",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-300 dark:border-pink-500/50",
    ring: "ring-pink-500",
    gradient: "from-pink-500 to-pink-600",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-500/50",
    ring: "ring-red-500",
    gradient: "from-red-500 to-red-600",
  },
};
