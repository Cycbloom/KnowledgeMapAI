import type { CardType } from "@shared/types/quiz";
import {
  CircleDot,
  CheckSquare,
  ShieldCheck,
  Type,
  MessageSquareText,
  PenLine,
  ClipboardList,
  ListFilter,
  Columns2,
  Shuffle,
  type LucideIcon,
} from "lucide-react";

/** 徽章配色主题联合类型 */
export type BadgeTone = "blue" | "rose" | "emerald" | "violet" | "amber" | "slate" | "cyan" | "teal" | "indigo" | "orange";

/** 题型徽章元信息 */
export interface CardTypeBadgeMeta {
  /** lucide-react 图标组件 */
  Icon: LucideIcon;
  /** i18n 键名，对应 study.cardType.* */
  labelKey: string;
  /** 配色主题 */
  tone: BadgeTone;
}

/** 题型 → 徽章元信息映射表 */
const CARD_TYPE_BADGE_MAP: Readonly<Record<CardType, CardTypeBadgeMeta>> = {
  choice: {
    Icon: CircleDot,
    labelKey: "study.cardType.choice",
    tone: "blue",
  },
  multi_choice: {
    Icon: CheckSquare,
    labelKey: "study.cardType.multiChoice",
    tone: "rose",
  },
  true_false: {
    Icon: ShieldCheck,
    labelKey: "study.cardType.trueFalse",
    tone: "emerald",
  },
  fill_in_the_blank: {
    Icon: Type,
    labelKey: "study.cardType.fillBlank",
    tone: "violet",
  },
  qa: {
    Icon: MessageSquareText,
    labelKey: "study.cardType.qa",
    tone: "amber",
  },
  essay: {
    Icon: PenLine,
    labelKey: "study.cardType.essay",
    tone: "slate",
  },
  cloze: {
    Icon: ClipboardList,
    labelKey: "study.cardType.cloze",
    tone: "cyan",
  },
  select_from_options: {
    Icon: ListFilter,
    labelKey: "study.cardType.selectFromOptions",
    tone: "teal",
  },
  matching: {
    Icon: Columns2,
    labelKey: "study.cardType.matching",
    tone: "indigo",
  },
  ordering: {
    Icon: Shuffle,
    labelKey: "study.cardType.ordering",
    tone: "orange",
  },
};

/**
 * 根据题型获取徽章元信息（图标、i18n 键、配色主题）。
 * 未知题型回退到 essay / slate。
 */
export function getCardTypeBadgeMeta(cardType: CardType | string): CardTypeBadgeMeta {
  const fallback = CARD_TYPE_BADGE_MAP.essay;
  const key = cardType as CardType;
  return CARD_TYPE_BADGE_MAP[key] ?? fallback;
}

/** 徽章胶囊样式模式：
 * - 'capsule' 圆角胶囊（默认，现有样式：rounded-full + border）
 * - 'ring'    方角小 pill（新样式：rounded-md + ring-1，和掌握度区状态 pill 同风）
 */
export type BadgeStyle = "capsule" | "ring";

/**
 * 根据 tone 与是否暗色模式返回 Tailwind 胶囊样式 classes。
 * 包含：背景色、文字色、边框色（pill 形圆角 + 内边距）。
 */
export function badgeToneClasses(tone: BadgeTone, isDark: boolean, style: BadgeStyle = "capsule"): string {
  if (style === "ring") {
    const ringLightMap: Readonly<Record<BadgeTone, string>> = {
      blue: "bg-blue-50 text-blue-700 ring-blue-200",
      rose: "bg-rose-50 text-rose-700 ring-rose-200",
      emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      violet: "bg-violet-50 text-violet-700 ring-violet-200",
      amber: "bg-amber-50 text-amber-700 ring-amber-200",
      slate: "bg-slate-50 text-slate-700 ring-slate-200",
      cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
      teal: "bg-teal-50 text-teal-700 ring-teal-200",
      indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
      orange: "bg-orange-50 text-orange-700 ring-orange-200",
    };
    const ringDarkMap: Readonly<Record<BadgeTone, string>> = {
      blue: "bg-blue-950/40 text-blue-300 ring-blue-800/60",
      rose: "bg-rose-950/40 text-rose-300 ring-rose-800/60",
      emerald: "bg-emerald-950/40 text-emerald-300 ring-emerald-800/60",
      violet: "bg-violet-950/40 text-violet-300 ring-violet-800/60",
      amber: "bg-amber-950/40 text-amber-300 ring-amber-800/60",
      slate: "bg-slate-800/60 text-slate-300 ring-slate-700/60",
      cyan: "bg-cyan-950/40 text-cyan-300 ring-cyan-800/60",
      teal: "bg-teal-950/40 text-teal-300 ring-teal-800/60",
      indigo: "bg-indigo-950/40 text-indigo-300 ring-indigo-800/60",
      orange: "bg-orange-950/40 text-orange-300 ring-orange-800/60",
    };
    const palette = isDark ? ringDarkMap : ringLightMap;
    return `${palette[tone]} inline-flex items-center gap-1.5 rounded-md ring-1 px-2.5 py-0.5 text-xs font-medium`;
  }
  const lightMap: Readonly<Record<BadgeTone, string>> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  const darkMap: Readonly<Record<BadgeTone, string>> = {
    blue: "bg-blue-950/40 text-blue-300 border-blue-800",
    rose: "bg-rose-950/40 text-rose-300 border-rose-800",
    emerald: "bg-emerald-950/40 text-emerald-300 border-emerald-800",
    violet: "bg-violet-950/40 text-violet-300 border-violet-800",
    amber: "bg-amber-950/40 text-amber-300 border-amber-800",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    cyan: "bg-cyan-950/40 text-cyan-300 border-cyan-800",
    teal: "bg-teal-950/40 text-teal-300 border-teal-800",
    indigo: "bg-indigo-950/40 text-indigo-300 border-indigo-800",
    orange: "bg-orange-950/40 text-orange-300 border-orange-800",
  };
  const palette = isDark ? darkMap : lightMap;
  return `${palette[tone]} inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium`;
}
