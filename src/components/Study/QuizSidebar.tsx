import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Zap,
  BookOpenCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { StudyCard } from "@shared/types";
import type { LayoutMode } from "../../hooks/quiz/useQuizLayoutPref";
import { useTheme } from "../../hooks";
import { getCardTypeBadgeMeta, type BadgeTone } from "../../utils/quizBadgeMeta";
import { getDifficultyBadgeMeta } from "../../utils/quizDifficultyMeta";
import { QuizLayoutSwitcher } from "./QuizLayoutSwitcher";
import { QuizSettingsPanel } from "./QuizSettingsPanel";
import { FocusTopicBadge } from "./common";

interface QuizSidebarProps {
  quizCards: StudyCard[];
  currentCardIndex: number;
  layoutMode: LayoutMode;
  onChangeLayout: (mode: LayoutMode) => void;
  isForcedFlash: boolean;
  onBackToDashboard: () => void;
  onSelectCard: (index: number) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * QuizSidebar
 * 答题模式专用左侧侧边栏，取代全局主侧边栏与答题顶栏：
 * - 展开态：标题 + 折叠开关、退出、进度(数字 pill + 细进度条)、布局切换器、可点击题目列表
 * - 折叠态：图标功能列 + 纵向进度条 + 编号索引列表
 * 颜色跟随全局主题：浅色主题用浅色面板，暗色主题用深色面板（dark: 变体）。
 */
export function QuizSidebar({
  quizCards,
  currentCardIndex,
  layoutMode,
  onChangeLayout,
  isForcedFlash,
  onBackToDashboard,
  onSelectCard,
  isCollapsed,
  onToggleCollapsed,
}: QuizSidebarProps) {
  const { t } = useTranslation();
  // isDark currently unused: badges rendered as solid color strips/dots,
  // tone palettes are theme-agnostic between light/dark (500/400/300 shades).
  // Kept import for potential future use, silence lint with destructuring placeholder.
  void useTheme();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const total = quizCards.length;
  const progressPercent =
    total > 0
      ? Math.min(100, Math.round(((currentCardIndex + 1) / total) * 100))
      : 0;
  const progressText = t("study.header.progressFmt", {
    current: currentCardIndex + 1,
    total,
  });

  const CurrentModeIcon: LucideIcon =
    layoutMode === "flash" ? Zap : BookOpenCheck;

  const cycleLayout = () => {
    if (isForcedFlash) {
      return;
    }
    onChangeLayout(layoutMode === "flash" ? "focus" : "flash");
  };

  /** 难度左侧色条（交通灯隐喻：绿=易 / 黄=中 / 红=难）
   *  未选中：饱和 500 色
   *  选中：升阶 300 亮色，保证在 primary 粉色背景上对比充足
   */
  const difficultyBarTone: Readonly<Record<BadgeTone, { idle: string; active: string }>> = {
    emerald: { idle: "bg-emerald-500", active: "bg-emerald-300" },
    amber: { idle: "bg-amber-500", active: "bg-amber-300" },
    rose: { idle: "bg-rose-500", active: "bg-rose-300" },
    // 兜底色（理论上难度只有三档）
    blue: { idle: "bg-slate-400", active: "bg-slate-300" },
    violet: { idle: "bg-slate-400", active: "bg-slate-300" },
    slate: { idle: "bg-slate-400", active: "bg-slate-300" },
    cyan: { idle: "bg-cyan-500", active: "bg-cyan-300" },
    indigo: { idle: "bg-indigo-500", active: "bg-indigo-300" },
    orange: { idle: "bg-orange-500", active: "bg-orange-300" },
    teal: { idle: "bg-teal-500", active: "bg-teal-300" },
  };

  /** 题型图标颜色：未选中 = 语义色 500，选中 = 白色 */
  const typeIconColor: Readonly<Record<BadgeTone, { idle: string; active: string }>> = {
    blue: { idle: "text-blue-500", active: "text-white" },
    rose: { idle: "text-rose-500", active: "text-white" },
    emerald: { idle: "text-emerald-500", active: "text-white" },
    violet: { idle: "text-violet-500", active: "text-white" },
    amber: { idle: "text-amber-500", active: "text-white" },
    slate: { idle: "text-slate-500", active: "text-white" },
    cyan: { idle: "text-cyan-500", active: "text-white" },
    indigo: { idle: "text-indigo-500", active: "text-white" },
    orange: { idle: "text-orange-500", active: "text-white" },
    teal: { idle: "text-teal-500", active: "text-white" },
  };

  return (
    <aside
      className={`flex-none h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col transition-all duration-300 border-r border-slate-200 dark:border-slate-700 ${
        isCollapsed ? "w-20" : "w-72"
      }`}
      aria-label={t("study.sidebar.label")}
      data-testid="quiz-sidebar"
    >
      {/* 顶部：标题 + 折叠开关 */}
      <div
        className={`flex-none flex items-center h-14 px-2 border-b border-slate-200 dark:border-slate-700 ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0 px-1">
            <ListOrdered
              size={16}
              className="shrink-0 text-primary-500 dark:text-primary-400"
              aria-hidden="true"
            />
            <span className="text-sm font-bold truncate">
              {t("study.header.titleQuiz")}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          aria-label={
            isCollapsed ? t("study.sidebar.expand") : t("study.sidebar.collapse")
          }
          aria-expanded={!isCollapsed}
          title={
            isCollapsed ? t("study.sidebar.expand") : t("study.sidebar.collapse")
          }
        >
          {isCollapsed ? (
            <ChevronRight size={20} aria-hidden="true" />
          ) : (
            <ChevronLeft size={20} aria-hidden="true" />
          )}
        </button>
      </div>

      {isCollapsed ? (
        /* 折叠态：图标功能列 */
        <div className="flex-none flex flex-col items-center gap-4 py-4 border-b border-slate-200/70 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onBackToDashboard}
            aria-label={t("study.header.exit")}
            title={t("study.header.exit")}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>

          <div
            className="flex flex-col items-center gap-1.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={progressText}
          >
            <div className="h-24 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="w-full bg-primary-500 transition-all duration-300"
                style={{ height: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {progressPercent}%
            </span>
          </div>

          <button
            type="button"
            onClick={cycleLayout}
            disabled={isForcedFlash}
            aria-label={t("study.quiz.layoutTooltip")}
            title={
              isForcedFlash
                ? t("study.quiz.layoutFlash")
                : t("study.quiz.layoutTooltip")
            }
            className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors ${
              isForcedFlash
                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CurrentModeIcon size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label={t("study.sidebar.settings")}
            title={t("study.sidebar.settingsTooltip")}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        /* 展开态：退出 + 进度 + 布局切换 */
        <div className="flex-none flex flex-col gap-3 px-3 py-4 border-b border-slate-200/70 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-3 min-h-[40px] rounded-lg border transition-colors text-sm font-medium bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{t("study.header.exit")}</span>
          </button>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t("study.sidebar.progress")}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-200">
                {progressText}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label={progressText}
              className="h-1 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700/60"
            >
              <div
                className="h-full rounded-full transition-all duration-300 bg-primary-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <QuizLayoutSwitcher
            layoutMode={layoutMode}
            onChange={onChangeLayout}
            disabled={isForcedFlash}
          />

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 min-h-[40px] rounded-lg border transition-colors text-sm font-medium bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            <Settings size={16} aria-hidden="true" />
            <span>{t("study.sidebar.settings")}</span>
          </button>
        </div>
      )}

      {/* 题目列表 */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-1"
        aria-label={t("study.sidebar.cardList")}
      >
        {quizCards.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-4">
            {t("study.noCards")}
          </p>
        )}
        {quizCards.map((card, index) => {
          const isActive = index === currentCardIndex;
          const typeMeta = getCardTypeBadgeMeta(card.card_type ?? "qa");
          const diffMeta = getDifficultyBadgeMeta(card.difficulty);
          const TypeIcon = typeMeta.Icon;
          // 无难度时色条退化为中性灰，避免视觉空洞
          const diffToneKey = diffMeta?.tone ?? "slate";
          const diffBarClass = isActive
            ? difficultyBarTone[diffToneKey].active
            : difficultyBarTone[diffToneKey].idle;
          const typeIconClass = isActive
            ? typeIconColor[typeMeta.tone].active
            : typeIconColor[typeMeta.tone].idle;

          if (isCollapsed) {
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelectCard(index)}
                className={`relative w-full flex items-center justify-center min-h-[36px] rounded-lg text-xs font-bold transition-colors overflow-hidden ${
                  isActive
                    ? "bg-primary-500 dark:bg-primary-600 text-white shadow"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
                aria-label={t("study.sidebar.cardItem", { index: index + 1 })}
                aria-current={isActive ? "step" : undefined}
                title={t("study.sidebar.cardItem", { index: index + 1 })}
              >
                {/* 左侧：难度色条（交通灯） */}
                <span
                  className={`absolute left-0 top-0 h-full w-[5px] rounded-l-lg ${diffBarClass}`}
                  aria-hidden="true"
                />
                {/* 数字：加 ml-[5px] 平衡左侧色条的视觉偏移 */}
                <span className="ml-[5px]">{index + 1}</span>
              </button>
            );
          }
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(index)}
              className={`w-full flex flex-col gap-1 px-2 py-1.5 rounded-lg text-left transition-colors min-h-[40px] ${
                isActive
                  ? "bg-primary-500 dark:bg-primary-600 text-white shadow"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {/* 编码徽章：左色条=难度 / 数字 + 分隔 + 题型图标 */}
              <span className="relative flex-none self-start">
                <span
                  className={`relative flex items-center h-6 rounded pl-[9px] pr-1.5 gap-1 overflow-hidden ${
                    isActive
                      ? "bg-black/15 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {/* 左侧色条：难度（交通灯） */}
                  <span
                    className={`absolute left-0 top-0 h-full w-[4px] rounded-l ${diffBarClass}`}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-bold leading-none relative z-[1]">
                    {index + 1}
                  </span>
                  {/* 细分隔线 */}
                  <span
                    className={`w-px h-3 ${
                      isActive ? "bg-white/30" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    aria-hidden="true"
                  />
                  {/* 题型图标 */}
                  <TypeIcon size={13} className={`${typeIconClass} shrink-0`} aria-hidden="true" />
                </span>
              </span>
              <FocusTopicBadge focusTopic={card.focus_topic ?? undefined} variant="text" />
              <span className="truncate text-sm flex-1 min-w-0 leading-tight">{card.question}</span>
            </button>
          );
        })}
      </nav>

      <QuizSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
}
