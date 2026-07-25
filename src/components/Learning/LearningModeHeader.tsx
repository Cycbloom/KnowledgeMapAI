import {
  ArrowLeft,
  BookOpen,
  Microscope,
  MessageSquare,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Brain,
  Settings,
  Network,
  Route,
  GraduationCap,
  BrainCircuit,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { StudyMode } from "@shared/types/scheduler";
import { StudyModeSelector } from "./StudyModeSelector";
import type { StudyModeIconType } from "../../hooks/useStudyModeLogic";

interface LearningModeHeaderProps {
  isDark: boolean;
  isMobile: boolean;
  nodeId: string | null;
  graphId: string | null;
  nodeTitle: string;
  graphData: { nodes: unknown[] } | null | undefined;
  graphMeta: { template_type?: string; id?: string } | null | undefined;
  isOutlineOpen: boolean;
  isChatOpen: boolean;
  articleContent: string;
  isOnline: boolean;
  isGeneratingCards: boolean;
  generateProgress: { current: number; total: number; isGenerating: boolean } | null;
  studyMode: StudyMode;
  isStudyModeDropdownOpen: boolean;
  shouldShowQuiz: () => boolean;
  rightPanelMode: string;
  getStudyModeIcon: (mode: StudyMode) => StudyModeIconType;
  toggleTheme: () => void;
  onToggleOutline: () => void;
  onToggleChat: () => void;
  onStudyModeChange: (mode: StudyMode) => void;
  onToggleStudyModeDropdown: () => void;
  onOpenSettings: () => void;
  onEnterFocusMode: () => void;
  onOpenLearningPath: () => void;
  onNavigateToGraph: () => void;
  onOpenGenModal: () => void;
  onStartChallenge: () => void;
  onCancelGenerate: () => void;
}

export const LearningModeHeader = ({
  isDark,
  isMobile,
  nodeId,
  graphId,
  nodeTitle,
  graphData,
  graphMeta,
  isOutlineOpen,
  isChatOpen,
  articleContent,
  isOnline,
  isGeneratingCards,
  generateProgress,
  studyMode,
  isStudyModeDropdownOpen,
  shouldShowQuiz,
  rightPanelMode,
  getStudyModeIcon,
  toggleTheme,
  onToggleOutline,
  onToggleChat,
  onStudyModeChange,
  onToggleStudyModeDropdown,
  onOpenSettings,
  onEnterFocusMode,
  onOpenLearningPath,
  onNavigateToGraph,
  onOpenGenModal,
  onStartChallenge,
  onCancelGenerate,
}: LearningModeHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header
      className={`${isMobile && nodeId ? "min-h-14 py-2" : isMobile ? "h-14" : "h-16"} border-b flex items-center justify-between px-3 lg:px-6 flex-shrink-0 ${
        isDark
          ? "bg-slate-900 border-slate-700"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <div className="flex items-center space-x-2 lg:space-x-4">
        <button
          onClick={() => {
            if (isMobile && nodeId) {
              navigate(`/learning?graph_id=${graphId}`);
            } else {
              window.history.back();
            }
          }}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
            isDark
              ? "hover:bg-slate-800 text-slate-400"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title={t("learning.header.back")}
        >
          <ArrowLeft size={isMobile ? 18 : 20} />
        </button>

        <button
          onClick={() => navigate("/")}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
            isDark
              ? "hover:bg-slate-800 text-slate-400"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title={t("learning.header.home")}
        >
          <Home size={isMobile ? 18 : 20} />
        </button>

        <button
          onClick={onToggleOutline}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg transition-colors hidden lg:block ${
            isDark
              ? "hover:bg-slate-800 text-slate-400"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title={
            isOutlineOpen
              ? t("learning.header.collapseOutline")
              : t("learning.header.expandOutline")
          }
        >
          {isOutlineOpen ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelLeftOpen size={20} />
          )}
        </button>

        <div className="flex items-center space-x-2">
          <div
            className={`p-1 rounded-lg ${
              graphMeta?.template_type === "topic_research"
                ? isDark
                  ? "bg-purple-900/30 text-purple-400"
                  : "bg-purple-100 text-purple-600"
                : isDark
                  ? "bg-primary-900/50 text-primary-400"
                  : "bg-primary-50 text-primary-600"
            }`}
          >
            {graphMeta?.template_type === "topic_research" ? (
              <Microscope size={isMobile ? 16 : 20} />
            ) : (
              <BookOpen size={isMobile ? 16 : 20} />
            )}
          </div>
          <div className={isMobile && nodeId ? "hidden sm:block" : "block"}>
            <h1 className="font-bold text-sm lg:text-lg whitespace-nowrap">
              {graphMeta?.template_type === "topic_research"
                ? "专题研究"
                : t("learning.header.title")}
            </h1>
            {!isMobile && (
              <p
                className={`text-[10px] lg:text-xs ${isDark ? "text-slate-500" : "text-gray-500"} truncate max-w-[150px]`}
              >
                {nodeTitle ||
                  (graphData
                    ? t("learning.header.selectChapter")
                    : t("learning.header.loading"))}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onToggleChat}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors xl:hidden ${
            isDark
              ? "hover:bg-slate-800 text-slate-400"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title={
            isChatOpen
              ? t("learning.header.hideAI")
              : t("learning.header.showAI")
          }
        >
          <MessageSquare
            size={isMobile ? 18 : 20}
            className={isChatOpen ? "text-primary-500" : ""}
          />
        </button>
      </div>

      <div
        className={`flex items-center ${isMobile && nodeId ? "gap-1" : "space-x-2 lg:space-x-3"}`}
      >
        <StudyModeSelector
          studyMode={studyMode}
          isStudyModeDropdownOpen={isStudyModeDropdownOpen}
          onToggleDropdown={onToggleStudyModeDropdown}
          onStudyModeChange={onStudyModeChange}
          getStudyModeIcon={getStudyModeIcon}
          isMobile={isMobile}
        />

        <button
          onClick={toggleTheme}
          className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
            isMobile
              ? "min-w-[36px] min-h-[36px]"
              : "min-w-[44px] min-h-[44px]"
          } ${
            isDark
              ? "hover:bg-slate-800 text-amber-400"
              : "hover:bg-gray-100 text-primary-600"
          }`}
          title={
            isDark
              ? t("learning.header.lightMode")
              : t("learning.header.darkMode")
          }
        >
          {isDark ? (
            <Sun size={isMobile ? 18 : 20} />
          ) : (
            <Moon size={isMobile ? 18 : 20} />
          )}
        </button>
        {!isMobile && (
          <button
            onClick={onOpenSettings}
            className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isMobile
                ? "min-w-[36px] min-h-[36px]"
                : "min-w-[44px] min-h-[44px]"
            } ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={t("learning.header.settings")}
          >
            <Settings size={isMobile ? 18 : 20} />
          </button>
        )}

        {!isMobile && (
          <>
            <button
              onClick={onEnterFocusMode}
              disabled={!nodeId || !articleContent}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                !nodeId || !articleContent
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                  : isDark
                    ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                    : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
              }`}
              title={
                !nodeId || !articleContent
                  ? t("learning.focus.selectContent")
                  : t("learning.focus.enter")
              }
            >
              <Brain size={18} />
              <span className="hidden sm:inline">
                {t("learning.focus.title")}
              </span>
            </button>
            <button
              onClick={onOpenLearningPath}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                rightPanelMode === "learning-path" && isChatOpen
                  ? "bg-primary-600 text-white"
                  : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={t("learning.path.title")}
            >
              <Route size={18} />
              <span className="hidden sm:inline">
                {t("learning.path.title")}
              </span>
            </button>
            <button
              onClick={onNavigateToGraph}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={t("learning.header.mindMap")}
            >
              <Network size={18} />
              <span className="hidden sm:inline">
                {t("learning.header.mindMap")}
              </span>
            </button>
          </>
        )}

        {nodeId && shouldShowQuiz() && (
          <div className="group relative">
            <button
              onClick={() => isOnline && onOpenGenModal()}
              disabled={!isOnline || generateProgress?.isGenerating}
              className={`flex items-center ${isMobile ? "px-2 py-1.5" : "space-x-2 px-3 lg:px-4 py-2"} rounded-full font-medium transition-all ${
                !isOnline || generateProgress?.isGenerating
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-500"
                  : isDark
                    ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                    : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
              }`}
              title={
                isOnline
                  ? t("learning.cards.configure")
                  : t("learning.cards.offlineUnavailable")
              }
            >
              <BrainCircuit size={isMobile ? 16 : 18} />
              <span className="hidden md:inline">
                {t("learning.cards.generate")}
              </span>
            </button>
            {!isOnline && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {t("learning.cards.offlineUnavailable")}
              </div>
            )}
          </div>
        )}

        {nodeId && shouldShowQuiz() && (
          <div className="flex flex-col items-end">
            {generateProgress?.isGenerating && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                  <Sparkles size={10} />{" "}
                  {t("learning.cards.generatingProgress", {
                    current: generateProgress.current,
                    total: generateProgress.total,
                  })}
                </span>
                <button
                  onClick={onCancelGenerate}
                  className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                  {t("learning.cards.cancel")}
                </button>
              </div>
            )}
            {isGeneratingCards &&
              !generateProgress?.isGenerating &&
              !isMobile && (
                <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                  <Sparkles size={10} />{" "}
                  {t("learning.cards.generatingChallenge")}
                </span>
              )}
            <button
              onClick={onStartChallenge}
              disabled={isGeneratingCards}
              className={`flex items-center justify-center ${isMobile ? "p-2" : "space-x-2 px-3 lg:px-6 py-2"} bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all ${isMobile ? "" : "hover:scale-105 active:scale-95"} ${
                isGeneratingCards ? "opacity-70 cursor-not-allowed" : ""
              }`}
              title={t("learning.challenge.start")}
            >
              <GraduationCap size={isMobile ? 18 : 18} />
              <span className="hidden sm:inline">
                {t("learning.challenge.complete")}
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
