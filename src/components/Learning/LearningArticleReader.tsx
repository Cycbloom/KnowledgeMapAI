import React, { useState } from "react";
import { ArrowLeft, Sparkles, RefreshCw, Info, Route, GraduationCap, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HighlightedReader } from "./HighlightedReader";
import { NodeLanguageSwitcher } from "../GraphEditor/NodeLanguageSwitcher";
import { PaginatedReader } from "./PaginatedReader";
import { Skeleton } from "../common";
import type { Keyword } from "../../types";
import type { LinkedTask } from "../../hooks/scheduler/useLinkedTask";
import type { StudyMode } from "@shared/types/scheduler";
import type { StudyModeIconType } from "../../hooks/study/useStudyModeLogic";
import { STUDY_MODE_PRESETS } from "@shared/constants/studyModePresets";
import type {
  UserSettingsReadingMode,
  UserSettingsContentWidthMode,
  UserSettingsPaginationMode,
  UserSettingsFontFamily,
  UserSettingsLineHeight,
} from "@shared/types";

interface LearningArticleReaderProps {
  isDark: boolean;
  isMobile: boolean;
  nodeId: string | null;
  graphId: string | null;
  nodeTitle: string;
  articleContent: string;
  keywords: Keyword[];
  isGenerating: boolean;
  isOnline: boolean;
  isGeneratingCards: boolean;
  studyMode: StudyMode;
  highlightEnabled: boolean;
  linkedTask: LinkedTask | null;
  nodeStatus: Record<string, unknown> | undefined;
  fontSize: number;
  fontFamily: UserSettingsFontFamily;
  lineHeight: UserSettingsLineHeight;
  readingMode: UserSettingsReadingMode;
  contentWidthMode: UserSettingsContentWidthMode;
  getStudyModeIcon: (mode: StudyMode) => StudyModeIconType;
  getStrategyHint: (
    mode: StudyMode,
    nodeStatus: { mastered: boolean; due?: boolean; review_count?: number } | undefined,
  ) => string | null;
  shouldShowArticle: () => boolean;
  shouldShowQuiz: () => boolean;
  paginationMode: UserSettingsPaginationMode;
  onToggleHighlight: () => void;
  onRegenerateMaterial: () => void;
  onStartChallenge: () => void;
  onOpenSettings: () => void;
}

export const LearningArticleReader = ({
  isDark,
  isMobile,
  nodeId,
  graphId,
  nodeTitle,
  articleContent,
  keywords,
  isGenerating,
  isOnline,
  isGeneratingCards,
  studyMode,
  highlightEnabled,
  linkedTask,
  nodeStatus,
  fontSize,
  fontFamily,
  lineHeight,
  readingMode,
  contentWidthMode,
  getStudyModeIcon,
  getStrategyHint,
  shouldShowArticle,
  shouldShowQuiz,
  paginationMode,
  onToggleHighlight,
  onRegenerateMaterial,
  onStartChallenge,
  onOpenSettings,
}: LearningArticleReaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 底部阅读工具条：默认展开，可点击收起为一个小悬浮胶囊，再点唤起
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  // 分页/翻页阅读模式：仅移动端生效；加载中暂回退到滚动布局的骨架屏
  const isPaginated = isMobile && paginationMode === "pagination" && !isGenerating;
  // 分页态下底部工具条：不预留高度，工具栏是 fixed 覆盖层，内容用满整个阅读区
  const bottomReserve = 0;

  // 底部阅读工具条：滚动分支与分页分支共用（固定定位，点正文切换显隐）
  const toolbarNav =
    isMobile && !toolbarCollapsed ? (
      <nav
        aria-label={t("learning.settings.readingSettings")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-3xl mx-auto flex items-stretch divide-x divide-gray-200 dark:divide-slate-700">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 active:bg-gray-100 dark:active:bg-slate-800 transition-colors"
          >
            <Settings size={18} className="text-primary-600 dark:text-primary-400" />
            {t("learning.header.settings")}
          </button>
          <button
            type="button"
            onClick={onToggleHighlight}
            aria-pressed={highlightEnabled}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              highlightEnabled
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-slate-600 dark:text-slate-300 active:bg-gray-100 dark:active:bg-slate-800"
            }`}
          >
            <Sparkles size={18} className={highlightEnabled ? "text-yellow-500" : ""} />
            {t("learning.keywordHighlight")}
          </button>
          <button
            type="button"
            onClick={onRegenerateMaterial}
            disabled={isGenerating || !isOnline}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              isGenerating || !isOnline
                ? "text-gray-300 dark:text-slate-600"
                : "text-slate-600 dark:text-slate-300 active:bg-gray-100 dark:active:bg-slate-800"
            }`}
          >
            <RefreshCw size={18} className={isGenerating ? "animate-spin" : ""} />
            {t("learning.material.regenerate")}
          </button>
        </div>
      </nav>
    ) : null;

  // Reading card container styles: background applies to the FULL card
  // (rounded, padded), while prose inside is constrained only for text width.
  const readingCardClasses = [
    "rounded-2xl border transition-colors duration-200",
    isMobile ? "px-4 py-6 sm:px-6 sm:py-8" : "px-8 py-10 lg:px-12 lg:py-12",
    readingMode === "eye-care"
      ? // 暗色主题下保持护眼绿身份，但改用深色背景，避免浅色纸质的亮底刺眼
        isDark
        ? "bg-[#0f1e16] border-[#24402f]"
        : "bg-amber-50 border-amber-200/70 shadow-[0_1px_3px_rgba(180,140,40,0.06)]"
      : readingMode === "sepia"
        ? // 暗色主题下保持羊皮纸褐身份，改用深褐背景
          isDark
          ? "bg-[#241c12] border-[#4a3826]"
          : "bg-[#f5ecd9] border-[#e3d5b5] shadow-[0_1px_3px_rgba(140,100,40,0.08)]"
        : isDark
          ? "bg-slate-900 border-slate-800"
          : "bg-white border-gray-200/70",
  ].join(" ");

  const renderArticleBody = () => (
    <HighlightedReader
      content={articleContent}
      isDark={isDark}
      isMobile={isMobile}
      keywords={keywords}
      fontSize={fontSize}
      readingMode={readingMode}
      contentWidthMode={contentWidthMode}
      fontFamily={fontFamily}
      lineHeight={lineHeight}
    />
  );

  // When article should not be shown (quiz-only mode)
  if (!shouldShowArticle()) {
    return (
      <div
        className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900 flex items-center justify-center`}
      >
        <div className="text-center space-y-6 max-w-md">
          <div
            className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center ${
              isDark ? "bg-primary-900/30" : "bg-primary-50"
            }`}
          >
            {(() => {
              const ModeIcon = getStudyModeIcon(studyMode);
              return React.createElement(ModeIcon, { size: 36, className: isDark ? "text-primary-400" : "text-primary-600" });
            })()}
          </div>
          <div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              {STUDY_MODE_PRESETS[studyMode]?.labelKey ? t(STUDY_MODE_PRESETS[studyMode].labelKey) : studyMode}
            </h3>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              {STUDY_MODE_PRESETS[studyMode]?.descriptionKey ? t(STUDY_MODE_PRESETS[studyMode].descriptionKey) : ""}
            </p>
          </div>
          {shouldShowQuiz() && (
            <button
              onClick={onStartChallenge}
              disabled={isGeneratingCards}
              className={`flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 ${
                isGeneratingCards ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <GraduationCap size={20} />
              <span>{t("learning.challenge.complete")}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isPaginated) {
    return (
      // 与滚动分支一致的"整区点击切换工具条"有意交互（移动端触屏）
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        onClick={() => {
          if (isMobile) setToolbarCollapsed((v) => !v);
        }}
        className={`flex flex-col flex-1 overflow-hidden border-r dark:border-slate-800 relative bg-white dark:bg-slate-900 px-4`}
      >
        {/* 分页态紧凑头部：返回 + 标题（省略辅助横幅，尽量给足页高） */}
        <div className="flex items-center gap-3 min-w-0 shrink-0 pt-4 pb-3 border-b border-gray-200 dark:border-slate-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/learning?graph_id=${graphId}`);
            }}
            className={`flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors ${
              isDark
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
            title={t("learning.overview.back")}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{t("learning.overview.title")}</span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className={`text-lg font-bold leading-snug break-words ${isDark ? "text-white" : "text-gray-900"}`}>
              {nodeTitle}
            </h2>
          </div>
        </div>
        {/* 分页阅读区：单份内容 translateY 切页，横滑/点两侧翻页 */}
        <PaginatedReader className="flex-1 min-h-0" bottomOffset={bottomReserve}>
          <div className={readingCardClasses}>{renderArticleBody()}</div>
        </PaginatedReader>
        {toolbarNav}
      </div>
    );
  }

  return (
    <>
    {/* 移动端阅读器：点击正文任意处唤出/隐藏底部工具条（小说阅读器交互）。
        这是有意的非语义"整区点击切换"交互，移动端靠触屏，桌面端无此行为。 */}
    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      onClick={() => {
        if (isMobile) setToolbarCollapsed((v) => !v);
      }}
      className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? (toolbarCollapsed ? "p-4 pb-8" : "p-4 pb-24") : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900`}
    >
      {isGenerating ? (
        <div className="w-full">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-500">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-64" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="h-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-slate-500 w-full min-w-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => navigate(`/learning?graph_id=${graphId}`)}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors ${
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
                title={t("learning.overview.back")}
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">{t("learning.overview.title")}</span>
              </button>
              <div className="min-w-0">
                <h2 className={`text-xl sm:text-2xl font-bold leading-snug break-words ${isDark ? "text-white" : "text-gray-900"}`}>
                  {nodeTitle}
                </h2>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {keywords.slice(0, 5).map((kw, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          isDark ? "bg-primary-900/30 text-primary-300" : "bg-primary-50 text-primary-600"
                        }`}
                      >
                        {kw.term}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0 flex-wrap min-w-0">
              <NodeLanguageSwitcher />
              <button
                onClick={onToggleHighlight}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                  highlightEnabled
                    ? isDark
                      ? "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 border border-yellow-500/30"
                      : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={t("learning.enableKeywordHighlight")}
              >
                <Sparkles size={16} className={highlightEnabled ? "text-yellow-500" : ""} />
                <span className="hidden sm:inline-block">{t("learning.keywordHighlight")}</span>
              </button>
              <button
                onClick={onRegenerateMaterial}
                disabled={isGenerating || !isOnline}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                  isGenerating || !isOnline
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={isOnline ? t("learning.material.regenerate") : t("learning.cards.offlineUnavailable")}
              >
                <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                <span className="hidden sm:inline-block">{t("learning.material.regenerate")}</span>
              </button>
            </div>
          </div>
          {linkedTask && (
            <div className="mb-4 px-3 py-3 rounded-lg text-sm bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/40">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 min-w-0">
                <Route size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {t("learning.articleReader.linkedGraph", { name: linkedTask.graphName })}
                </span>
                <span className="text-xs opacity-75 whitespace-nowrap">
                  {t("learning.articleReader.nodes", { completed: linkedTask.completedNodes, total: linkedTask.totalNodes })}
                </span>
                <span className="font-semibold whitespace-nowrap">{linkedTask.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-200/70 dark:bg-indigo-800/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, linkedTask.progress))}%` }}
                />
              </div>
            </div>
          )}
          {studyMode === "mixed" &&
            (() => {
              const currentNodeStatus = nodeStatus?.[nodeId ?? ""] as
                | { mastered: boolean; due?: boolean; review_count?: number }
                | undefined;
              const hint = getStrategyHint(studyMode, currentNodeStatus);
              return hint ? (
                <div
                  className={`mb-4 px-3 py-2.5 rounded-lg flex items-start gap-2 text-sm ${
                    isDark
                      ? "bg-amber-900/20 text-amber-300 border border-amber-500/20"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <Info size={16} className="flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{hint}</span>
                </div>
              ) : null;
            })()}
          <div className={readingCardClasses}>{renderArticleBody()}</div>
        </div>
      )}
    </div>
      {toolbarNav}
    </>
  );
};
