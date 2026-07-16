import React from "react";
import { ArrowLeft, Sparkles, RefreshCw, Info, Route, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HighlightedReader } from "./HighlightedReader";
import { Skeleton } from "../common";
import type { Keyword } from "../../types";
import type { LinkedTask } from "../../hooks/useLinkedTask";
import type { StudyMode } from "@shared/types/scheduler";
import type { StudyModeIconType } from "../../hooks/useStudyModeLogic";
import { STUDY_MODE_PRESETS } from "@shared/constants/studyModePresets";

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
  readingMode: string;
  contentWidthMode: string;
  getStudyModeIcon: (mode: StudyMode) => StudyModeIconType;
  getStrategyHint: (
    mode: StudyMode,
    nodeStatus: { mastered: boolean; due?: boolean; review_count?: number } | undefined,
  ) => string | null;
  shouldShowArticle: () => boolean;
  shouldShowQuiz: () => boolean;
  onToggleHighlight: () => void;
  onRegenerateMaterial: () => void;
  onStartChallenge: () => void;
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
  readingMode,
  contentWidthMode,
  getStudyModeIcon,
  getStrategyHint,
  shouldShowArticle,
  shouldShowQuiz,
  onToggleHighlight,
  onRegenerateMaterial,
  onStartChallenge,
}: LearningArticleReaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
              {STUDY_MODE_PRESETS[studyMode]?.label ?? studyMode}
            </h3>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              {STUDY_MODE_PRESETS[studyMode]?.description ?? ""}
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

  return (
    <div
      className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900`}
    >
      {isGenerating ? (
        <div className="w-full">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
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
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
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
              <div>
                <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
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
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleHighlight}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
                <span className="hidden sm:inline">{t("learning.keywordHighlight")}</span>
              </button>
              <button
                onClick={onRegenerateMaterial}
                disabled={isGenerating || !isOnline}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isGenerating || !isOnline
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={isOnline ? t("learning.material.regenerate") : t("learning.cards.offlineUnavailable")}
              >
                <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{t("learning.material.regenerate")}</span>
              </button>
            </div>
          </div>
          {linkedTask && (
            <div className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Route size={16} />
              <span>学习图谱: {linkedTask.graphName}</span>
              <span className="text-xs opacity-75">
                ({linkedTask.completedNodes}/{linkedTask.totalNodes} 节点)
              </span>
              <span className="ml-auto">{linkedTask.progress}%</span>
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
                  className={`mb-4 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${
                    isDark
                      ? "bg-amber-900/20 text-amber-300 border border-amber-500/20"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <Info size={16} className="flex-shrink-0" />
                  <span>{hint}</span>
                </div>
              ) : null;
            })()}
          <div
            className={`${
              contentWidthMode === "full"
                ? "max-w-none"
                : contentWidthMode === "comfortable"
                  ? "max-w-4xl mx-auto"
                  : "max-w-3xl mx-auto"
            } ${
              readingMode === "default"
                ? isDark
                  ? "bg-slate-900 text-slate-50"
                  : "bg-white text-gray-900"
                : readingMode === "eye-care"
                  ? "bg-amber-50 text-gray-800"
                  : "bg-slate-900 text-slate-50"
            }`}
            style={{ fontSize: `${fontSize}px` }}
          >
            <HighlightedReader
              content={articleContent}
              isDark={isDark || readingMode === "dark"}
              isMobile={isMobile}
              keywords={keywords}
            />
          </div>
        </div>
      )}
    </div>
  );
};
