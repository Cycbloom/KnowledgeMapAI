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
import { CodeBlock } from "../../common";
import { useTextToSpeech } from "../../../hooks/useTextToSpeech";
import { useTheme } from "../../../hooks/useTheme";
import { api } from "../../../services/api";
import { useMessageStore } from "../../../store/useMessageStore";
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

  const {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    voices: _voices,
    selectedVoice: _selectedVoice,
    setVoice: _setVoice,
    currentEngine,
    switchEngine,
  } = useTextToSpeech("qwen3");

  const { addMessage } = useMessageStore();
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
    } catch (error: any) {
      addMessage({ type: "error", content: `脚本生成失败: ${error.message}` });
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-slate-800 dark:to-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Volume2
                  className="text-purple-600 dark:text-purple-400"
                  size={24}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  AI 知识播客
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  为您深度解读 "{graphTitle}"
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="text-slate-600 dark:text-slate-300 animate-pulse">
                  正在为您撰写播客脚本...
                </p>
                <div className="text-xs text-slate-400 max-w-md text-center">
                  AI 正在分析图谱结构，提取核心概念，并生成一段生动的语音讲解。
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
                    <p>暂无脚本内容</p>
                    <button
                      onClick={generateScript}
                      className="mt-4 text-purple-600 hover:underline"
                    >
                      点击生成
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Audio Visualization (Fake/Simple for now) */}
            {isSpeaking && !isPaused && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-100 dark:bg-slate-700 overflow-hidden">
                <motion.div
                  className="h-full bg-purple-500"
                  animate={{
                    width: ["0%", "100%"],
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "linear",
                  }}
                />
              </div>
            )}
          </div>

          {/* Controls Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Engine Switcher */}
              <div className="flex bg-slate-200 dark:bg-slate-800 rounded p-1 text-xs">
                <button
                  onClick={() => switchEngine("browser")}
                  className={`px-2 py-1 rounded transition-colors ${currentEngine === "browser" ? "bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
                >
                  浏览器
                </button>
                <button
                  onClick={() => switchEngine("qwen3")}
                  className={`px-2 py-1 rounded transition-colors ${currentEngine === "qwen3" ? "bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
                >
                  AI 语音
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={generateScript}
                disabled={isGenerating || isSpeaking}
                className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
                title="重新生成脚本"
              >
                <RefreshCw size={20} />
              </button>

              {isSpeaking && !isPaused ? (
                <button
                  onClick={pause}
                  className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-transform active:scale-95"
                >
                  <Pause size={24} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  disabled={!script || isGenerating}
                  className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-transform active:scale-95 disabled:bg-slate-400"
                >
                  <Play size={24} fill="currentColor" className="ml-1" />
                </button>
              )}

              {isSpeaking && (
                <button
                  onClick={cancel}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                  title="停止播放"
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
