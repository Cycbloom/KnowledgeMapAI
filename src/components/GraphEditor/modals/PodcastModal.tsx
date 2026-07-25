import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  StopCircle,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { CodeBlock } from "../../common/CodeBlock";
import { useTextToSpeech, useTheme, useFocusTrap, useEscapeKey } from "../../../hooks";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { message } from "../../../utils/messageHelper";
import { Node } from "../../../types";

interface PodcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  graphTitle: string;
  graphId: string;
  initialScript?: string;
}

export const PodcastModal: React.FC<PodcastModalProps> = ({
  isOpen,
  onClose,
  nodes,
  graphTitle,
  graphId,
  initialScript,
}) => {
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [_activeSegmentIndex, _setActiveSegmentIndex] = useState(-1);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    progress,
    voices: _voices,
    selectedVoice: _selectedVoice,
    setVoice: _setVoice,
    currentEngine,
    switchEngine,
  } = useTextToSpeech("sambert");

  const scriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (!script && initialScript) {
        setScript(initialScript);
      } else if (!script && nodes.length > 0) {
        generateScript();
      }
    }
    return () => {
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialScript]);

  const generateScript = async () => {
    setIsGenerating(true);
    setScript("");

    try {
      // Prepare context from nodes (Prioritize Root -> Core -> Sub)
      // Limit to avoid token limits
      const priorityNodes = [...nodes].sort((a, b) => {
        const levels = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        return (
          (levels[a.level || "normal"] || 3) -
          (levels[b.level || "normal"] || 3)
        );
      });

      const contextNodes = priorityNodes.slice(0, 15); // Top 15 nodes
      const contextText = `Graph Title: ${graphTitle}\n\nNodes:\n${contextNodes
        .map((n) => `- ${n.title}: ${n.content || ""}`)
        .join("\n")}`;

      const response = await api.ai.generatePodcastScript(
        contextText,
        "zh",
        graphId,
      );
      // Clean up potential code blocks from AI response
      const cleanedScript = response.script
        .replace(/^```markdown\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
      setScript(cleanedScript);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      message.error(`脚本生成失败: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (isPaused) {
      resume();
    } else {
      speak(script);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-slate-800 dark:to-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                <Volume2
                  className="text-primary-600 dark:text-primary-400"
                  size={24}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {t("podcast.title")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("podcast.deepDive", { title: graphTitle })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                <p className="text-slate-600 dark:text-slate-300 animate-pulse">
                  {t("podcast.generating")}
                </p>
                <div className="text-xs text-slate-400 max-w-md text-center">
                  {t("podcast.generatingHint")}
                </div>
              </div>
            ) : (
              <div
                ref={scriptContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 prose dark:prose-invert max-w-none"
              >
                {script ? (
                  <ReactMarkdown
                    components={{
                      code: ({ className, children, node }) => (
                        <CodeBlock
                          className={className}
                          isDark={isDark}
                          node={node}
                        >
                          {children}
                        </CodeBlock>
                      ),
                    }}
                  >
                    {script}
                  </ReactMarkdown>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <FileText size={48} className="mb-4 opacity-50" />
                    <p>{t("podcast.noScript")}</p>
                    <button
                      onClick={generateScript}
                      className="mt-4 text-primary-600 underline"
                    >
                      {t("podcast.clickToGenerate")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Audio Progress Bar */}
            {isSpeaking && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Controls Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Engine Switcher */}
              <div className="flex bg-slate-200 dark:bg-slate-800 rounded p-1 text-xs">
                <button
                  onClick={() => switchEngine("browser")}
                  className={`px-2 py-1 rounded transition-colors ${currentEngine === "browser" ? "bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
                >
                  {t("aiChat.browserTts")}
                </button>
                <button
                  onClick={() => switchEngine("sambert")}
                  className={`px-2 py-1 rounded transition-colors ${currentEngine === "sambert" ? "bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
                >
                  {t("aiChat.sambertTts")}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={generateScript}
                aria-label={t("podcast.regenerate")}
                disabled={isGenerating || isSpeaking}
                className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
                title={t("podcast.regenerate")}
              >
                <RefreshCw size={20} />
              </button>

              {isSpeaking && !isPaused ? (
                <button
                  onClick={pause}
                  className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-transform active:scale-95"
                >
                  <Pause size={24} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  disabled={!script || isGenerating}
                  className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-transform active:scale-95 disabled:bg-slate-400"
                >
                  <Play size={24} fill="currentColor" className="ml-1" />
                </button>
              )}

              {isSpeaking && (
                <button
                  onClick={cancel}
                  aria-label={t("podcast.stopPlayback")}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                  title={t("podcast.stopPlayback")}
                >
                  <StopCircle size={20} />
                </button>
              )}
            </div>
            <div className="w-24"></div> {/* Spacer for center alignment */}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
