import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Route, FileText, GitMerge, X, Loader2, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { RAGChatPanel } from "../RAGChat";
import { LearningPathPanel } from "./LearningPathPanel";
import { LiteratureExtractPanel } from "../LiteratureExtract/LiteratureExtractPanel";
import { message } from "../../utils/messageHelper";

const ConceptAggregationPanel = lazy(() =>
  import("../ConceptAggregation/ConceptAggregationPanel").then(
    (module) => ({ default: module.ConceptAggregationPanel }),
  ),
);

type RightPanelMode = "chat" | "learning-path" | "literature-extract" | "concept-aggregation";

interface LearningModeRightPanelProps {
  isDark: boolean;
  isMobile: boolean;
  isChatOpen: boolean;
  graphId: string | null;
  nodeId: string | null;
  nodeTitle: string;
  rightPanelMode: RightPanelMode;
  selectedLearningPathId: string | null;
  onClose: () => void;
  onSetRightPanelMode: (mode: RightPanelMode) => void;
  onSelectLearningPath: (pathId: string | null) => void;
  onNavigateToNode: (nodeId: string) => void;
}

export const LearningModeRightPanel = ({
  isDark,
  isMobile,
  isChatOpen,
  graphId,
  nodeId,
  nodeTitle,
  rightPanelMode,
  selectedLearningPathId,
  onClose,
  onSetRightPanelMode,
  onSelectLearningPath,
  onNavigateToNode,
}: LearningModeRightPanelProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <AnimatePresence>
      {isChatOpen && (
        <>
          {/* Mobile Backdrop */}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            />
          )}
          <motion.div
            initial={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 384, opacity: 1 }}
            exit={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 200,
            }}
            className={`
              ${isMobile ? "fixed inset-y-0 right-0 z-50 w-[85%] max-w-sm shadow-2xl" : "relative h-full border-l"} 
              flex flex-col dark:border-slate-800 ${isDark ? "bg-slate-900" : "bg-white"}
            `}
          >
            {/* Panel Header */}
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
                  {rightPanelMode === "concept-aggregation" ? (
                    <GitMerge size={18} />
                  ) : rightPanelMode === "chat" ? (
                    <Bot size={18} />
                  ) : rightPanelMode === "learning-path" ? (
                    <Route size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {rightPanelMode === "concept-aggregation"
                      ? t('learning.modeRightPanel.conceptAggregation')
                      : rightPanelMode === "chat"
                        ? t("learning.chat.aiTutor")
                        : rightPanelMode === "learning-path"
                          ? t("learning.path.title")
                          : t("literatureExtract.title")}
                  </h3>
                  <div className="flex items-center text-[10px] text-green-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                    {rightPanelMode === "concept-aggregation"
                      ? t('learning.modeRightPanel.smartMergeConcepts')
                      : rightPanelMode === "chat"
                        ? t("learning.chat.online")
                        : rightPanelMode === "learning-path"
                          ? t("learning.path.aiDriven")
                          : t("literatureExtract.subtitle")}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <div className="flex gap-1 mr-2">
                  <button
                    onClick={() => onSetRightPanelMode("chat")}
                    className={`p-1.5 rounded-md transition-colors ${
                      rightPanelMode === "chat"
                        ? "bg-primary-500 text-white"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                    }`}
                    title={t("learning.chat.aiTutor")}
                    aria-label={t("learning.chat.aiTutor")}
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    onClick={() => onSetRightPanelMode("learning-path")}
                    className={`p-1.5 rounded-md transition-colors ${
                      rightPanelMode === "learning-path"
                        ? "bg-primary-500 text-white"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                    }`}
                    title={t("learning.path.title")}
                    aria-label={t("learning.path.title")}
                  >
                    <Route size={14} />
                  </button>
                  <button
                    onClick={() => onSetRightPanelMode("literature-extract")}
                    className={`p-1.5 rounded-md transition-colors ${
                      rightPanelMode === "literature-extract"
                        ? "bg-primary-500 text-white"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                    }`}
                    title={t("literatureExtract.title")}
                    aria-label={t("literatureExtract.title")}
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={() => onSetRightPanelMode("concept-aggregation")}
                    className={`p-1.5 rounded-md transition-colors ${
                      rightPanelMode === "concept-aggregation"
                        ? "bg-primary-500 text-white"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                    }`}
                    title={t("conceptAggregation.panel.title")}
                    aria-label={t("conceptAggregation.panel.title")}
                  >
                    <GitMerge size={14} />
                  </button>
                </div>
                <button
                  onClick={onClose}
                  aria-label={t('common.aria.close')}
                  className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {rightPanelMode === "concept-aggregation" ? (
                <Suspense
                  fallback={
                    <div
                      className="flex items-center justify-center h-full"
                      aria-live="polite"
                    >
                      <Loader2
                        size={24}
                        className="animate-spin text-primary-500"
                        aria-hidden="true"
                      />
                      <span className="sr-only">{t("common.aria.loading")}</span>
                    </div>
                  }
                >
                  <div className="h-full">
                    <ConceptAggregationPanel
                      graphId={nodeId || ""}
                      isOpen={true}
                      onClose={() => {}}
                      embedded={true}
                    />
                  </div>
                </Suspense>
              ) : rightPanelMode === "literature-extract" ? (
                <div className="h-full">
                  <LiteratureExtractPanel
                    graphId={graphId || ""}
                    onExtractComplete={(result) => {
                      if (result.concepts.length > 0) {
                        message.success(t(
                          "literatureExtract.success.extracted",
                          {
                            count: result.concepts.length,
                          },
                        ));
                      }
                    }}
                    onConceptsSaved={async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ["graphData", graphId],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["graphNodeStatus", graphId],
                      });
                    }}
                    className="h-full"
                  />
                </div>
              ) : rightPanelMode === "learning-path" ? (
                <div className="p-4">
                  <LearningPathPanel
                    graphId={graphId || ""}
                    onNodeSelect={(id) => onNavigateToNode(id)}
                    onPathSelect={onSelectLearningPath}
                    selectedPathId={selectedLearningPathId}
                  />
                </div>
              ) : (
                <RAGChatPanel
                  graphId={graphId || undefined}
                  currentNodeId={nodeId || undefined}
                  currentNodeTitle={nodeTitle || undefined}
                  isOpen={true}
                  selectedNodeIds={[]}
                  variant="embedded"
                  enableTermTooltip={true}
                  enableSTT={true}
                  onNavigateToNode={(targetNodeId) => {
                    onNavigateToNode(targetNodeId);
                  }}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
