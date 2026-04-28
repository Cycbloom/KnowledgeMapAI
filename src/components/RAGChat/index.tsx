import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Bot,
  Lightbulb,
  Settings2,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import { api } from "../../services/api";
import { useTheme } from "../../hooks";
import { useTextToSpeech } from "../../hooks";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { ExtractedConcept, TutorMode, TTSEngine } from "../../types";
import { useChatState, Message, Source } from "./hooks/useChatState";
import { ChatMessage, LoadingMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { VoiceSettings, VoiceControl } from "./VoiceSettings";
import { ConceptsPanel } from "./ConceptsPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { LearningPathPanel } from "../Learning/LearningPathPanel";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";

interface RAGChatPanelProps {
  graphId?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  onNodeClick?: (nodeId: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
  selectedNodeIds?: string[];
  aiEnabled?: boolean;
  isTutorMode?: boolean;
  tutorMode?: TutorMode;
  extractedConcepts?: ExtractedConcept[];
  onToggleTutorMode?: () => void;
  onSwitchTutorMode?: (mode: TutorMode) => void;
  onExtractConcepts?: (text: string) => void;
  onAddConceptToGraph?: (concept: ExtractedConcept) => void;
  onAddAllConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  suggestedNextTopics?: Array<{
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    estimatedDifficulty: number;
  }>;
  onTutorChat?: (
    message: string,
    history: any[],
    onChunk: (content: string) => void,
  ) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  selectedLearningPathId?: string | null;
  onPathSelect?: (pathId: string | null) => void;
  onLearningPathNodeClick?: (nodeId: string) => void;
}

export const RAGChatPanel: React.FC<RAGChatPanelProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  onClose,
  isOpen = true,
  selectedNodeIds = [],
  aiEnabled,
  isTutorMode = false,
  tutorMode = "free",
  extractedConcepts = [],
  onToggleTutorMode,
  onSwitchTutorMode,
  onExtractConcepts,
  onAddConceptToGraph,
  onAddAllConcepts,
  onSuggestNextTopics,
  suggestedNextTopics = [],
  onTutorChat,
  width = 420,
  onWidthChange,
  selectedLearningPathId,
  onPathSelect,
  onLearningPathNodeClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const chatState = useChatState();
  const [ttsEngine, _setTTSEngine] = useState<TTSEngine>("browser");
  const {
    isSpeaking,
    isPaused,
    isLoading: ttsLoading,
    speak,
    pause,
    resume,
    cancel,
    hasSupport,
  } = useTextToSpeech(ttsEngine);

  const [showConceptsPanel, setShowConceptsPanel] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      chatState.setIsResizing(true);
      e.preventDefault();
    },
    [chatState],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!chatState.isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        onWidthChange?.(newWidth);
      }
    },
    [chatState.isResizing, onWidthChange],
  );

  const handleMouseUp = useCallback(() => {
    chatState.setIsResizing(false);
  }, [chatState]);

  useEffect(() => {
    if (chatState.isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
    return undefined;
  }, [chatState.isResizing, handleMouseMove, handleMouseUp]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentNodeTitle && chatState.messages.length === 0) {
      chatState.setSuggestedQuestions(
        isTutorMode
          ? [
              `帮我理解${currentNodeTitle}的核心概念`,
              `${currentNodeTitle}有哪些应用场景？`,
              `学习${currentNodeTitle}需要哪些前置知识？`,
            ]
          : [
              `什么是${currentNodeTitle}？`,
              `${currentNodeTitle}的核心概念是什么？`,
              `${currentNodeTitle}有哪些应用场景？`,
            ],
      );
    }
  }, [currentNodeTitle, chatState.messages.length, isTutorMode, chatState]);

  const handlePlayMessage = (messageId: string, content: string) => {
    if (chatState.currentSpeakingMessageId === messageId && isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      chatState.setCurrentSpeakingMessageId(messageId);
      speak(content);
    }
  };

  const handleStopMessage = () => {
    cancel();
    chatState.setCurrentSpeakingMessageId(null);
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || chatState.input.trim();
    if (!text || chatState.isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    chatState.addMessage(userMessage);
    chatState.clearInput();
    chatState.setIsLoading(true);
    chatState.setSuggestedQuestions([]);

    const assistantMessageId = (Date.now() + 1).toString();

    try {
      const history = chatState.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let fullResponse = "";
      let sources: Source[] = [];

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };
      chatState.addMessage(assistantMessage);

      if (isTutorMode && onTutorChat) {
        await onTutorChat(text, history, (chunk) => {
          fullResponse += chunk;
          chatState.updateMessage(assistantMessageId, {
            content: fullResponse,
          });
        });
      } else {
        await api.rag.chatStream(
          {
            message: text,
            graph_id: graphId,
            current_node_id: currentNodeId,
            history,
          },
          (chunk) => {
            fullResponse += chunk;
            chatState.updateMessage(assistantMessageId, {
              content: fullResponse,
            });
          },
          (s) => {
            sources = s;
          },
        );
      }

      chatState.updateMessage(assistantMessageId, {
        sources,
        isStreaming: false,
      });

      if (currentNodeTitle) {
        chatState.setSuggestedQuestions(
          isTutorMode
            ? [
                `深入解释${currentNodeTitle}的原理`,
                `如何应用${currentNodeTitle}？`,
                `有哪些相关的知识点？`,
              ]
            : [
                `深入解释${currentNodeTitle}的原理`,
                `${currentNodeTitle}与其他概念有什么关联？`,
                `如何应用${currentNodeTitle}？`,
              ],
        );
      }
    } catch (error: any) {
      console.error("RAG Chat Error:", error);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("aiChat.sendFailed"),
      });
      chatState.updateMessage(assistantMessageId, {
        content: t("aiChat.errorOccurred"),
        isStreaming: false,
      });
    } finally {
      chatState.setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExtractConcepts = () => {
    const lastAssistantMessage = chatState.messages
      .filter((m) => m.role === "assistant")
      .pop();
    if (lastAssistantMessage && onExtractConcepts) {
      onExtractConcepts(lastAssistantMessage.content);
      setShowConceptsPanel(true);
    }
  };

  if (!isOpen) return null;

  const headerBgClass = isTutorMode
    ? "from-amber-600 to-orange-500"
    : "from-primary-600 to-primary-500";

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`flex flex-col h-full relative ${
        isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"
      } border-r`}
      style={{ width: `${width}px` }}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 z-50 flex items-center justify-center group transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div
          className={`h-8 w-1 rounded-full group-hover:bg-primary-500 transition-colors ${chatState.isResizing ? "bg-primary-500" : "bg-gray-300"}`}
        />
      </div>

      <div
        className={`flex items-center justify-between p-4 border-b ${
          isDark ? "border-slate-700" : "border-gray-200"
        } bg-gradient-to-r ${headerBgClass} text-white`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20">
            {isTutorMode ? <GraduationCap size={20} /> : <Sparkles size={20} />}
          </div>
          <div>
            <h3 className="font-bold">
              {isTutorMode ? t("aiChat.tutorTitle") : t("aiChat.title")}
            </h3>
            <p className="text-xs text-white/80">
              {isTutorMode ? t("aiChat.tutorSubtitle") : t("aiChat.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSupport && (
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showVoiceSettings ? "bg-white/20" : "hover:bg-white/10"
              }`}
              title={t("aiChat.voiceSettings")}
            >
              <Settings2 size={16} />
            </button>
          )}
          {onToggleTutorMode && (
            <button
              onClick={onToggleTutorMode}
              className={`p-2 rounded-lg transition-colors ${
                isTutorMode ? "bg-white/20" : "hover:bg-white/10"
              }`}
              title={
                isTutorMode
                  ? t("aiChat.switchToNormal")
                  : t("aiChat.switchToTutor")
              }
            >
              {isTutorMode ? (
                <MessageCircle size={16} />
              ) : (
                <GraduationCap size={16} />
              )}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {showVoiceSettings && hasSupport && (
        <VoiceSettings
          isDark={isDark}
          onClose={() => setShowVoiceSettings(false)}
        />
      )}

      {isTutorMode && (
        <div
          className={`px-4 py-2 border-b ${isDark ? "bg-slate-800 border-slate-700" : "bg-amber-50 border-amber-100"}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${isDark ? "text-amber-300" : "text-amber-600"}`}
            >
              {t("aiChat.modeLabel")}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => onSwitchTutorMode?.("free")}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === "free"
                    ? "bg-amber-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-white text-amber-600 hover:bg-amber-100"
                }`}
              >
                {t("aiChat.modeFree")}
              </button>
              <button
                onClick={() => onSwitchTutorMode?.("guided")}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === "guided"
                    ? "bg-amber-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-white text-amber-600 hover:bg-amber-100"
                }`}
              >
                {t("aiChat.modeGuided")}
              </button>
              <button
                onClick={() => onSwitchTutorMode?.("learning-path")}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === "learning-path"
                    ? "bg-amber-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-white text-amber-600 hover:bg-amber-100"
                }`}
              >
                {t("aiChat.modeLearningPath")}
              </button>
            </div>
          </div>
        </div>
      )}

      {aiEnabled === false && (
        <div
          className={`px-4 py-2 text-xs border-b ${isDark ? "bg-amber-900/30 text-amber-300 border-amber-800" : "bg-amber-50 text-amber-800 border-amber-100"}`}
        >
          {t("aiChat.aiNotConfigured")}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isTutorMode && tutorMode === "learning-path" && graphId ? (
          <LearningPathPanel
            graphId={graphId}
            onNodeSelect={onLearningPathNodeClick || onNodeClick}
            onPathSelect={onPathSelect}
            selectedPathId={selectedLearningPathId}
          />
        ) : (
          <>
            {chatState.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div
                  className={`p-4 rounded-2xl mb-4 ${
                    isTutorMode
                      ? isDark
                        ? "bg-amber-900/30"
                        : "bg-amber-50"
                      : isDark
                        ? "bg-primary-900/30"
                        : "bg-primary-50"
                  }`}
                >
                  <Bot
                    size={40}
                    className={
                      isTutorMode
                        ? isDark
                          ? "text-amber-400"
                          : "text-amber-600"
                        : isDark
                          ? "text-primary-400"
                          : "text-primary-600"
                    }
                  />
                </div>
                <h4
                  className={`font-semibold mb-2 ${isDark ? "text-slate-200" : "text-gray-800"}`}
                >
                  {isTutorMode
                    ? t("aiChat.tutorGreeting")
                    : t("aiChat.greeting")}
                </h4>
                <p
                  className={`text-sm mb-6 max-w-[280px] ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {isTutorMode
                    ? t("aiChat.tutorDescription")
                    : t("aiChat.description")}
                </p>

                {chatState.suggestedQuestions.length > 0 && (
                  <div className="w-full space-y-2">
                    <p
                      className={`text-xs font-medium mb-2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {t("aiChat.tryThese")}
                    </p>
                    {chatState.suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                          isDark
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Lightbulb
                            size={14}
                            className={
                              isTutorMode
                                ? isDark
                                  ? "text-amber-400"
                                  : "text-amber-500"
                                : isDark
                                  ? "text-primary-400"
                                  : "text-primary-500"
                            }
                          />
                          <span>{q}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {chatState.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isDark={isDark}
                isTutorMode={isTutorMode}
                onNodeClick={onNodeClick}
                voiceControl={
                  hasSupport && !message.isStreaming && message.content ? (
                    <VoiceControl
                      messageId={message.id}
                      content={message.content}
                      isDark={isDark}
                      currentSpeakingMessageId={
                        chatState.currentSpeakingMessageId
                      }
                      isSpeaking={isSpeaking}
                      isPaused={isPaused}
                      ttsLoading={ttsLoading}
                      onPlay={handlePlayMessage}
                      onPause={pause}
                      onResume={resume}
                      onStop={handleStopMessage}
                    />
                  ) : undefined
                }
              />
            ))}

            {chatState.isLoading &&
              chatState.messages[chatState.messages.length - 1]?.role ===
                "user" && (
                <LoadingMessage isDark={isDark} isTutorMode={isTutorMode} />
              )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {showConceptsPanel && extractedConcepts.length > 0 && (
        <ConceptsPanel
          concepts={extractedConcepts}
          isDark={isDark}
          onAddConcept={onAddConceptToGraph || (() => {})}
          onAddAll={onAddAllConcepts}
          onClose={() => setShowConceptsPanel(false)}
        />
      )}

      {showSuggestionsPanel && suggestedNextTopics.length > 0 && (
        <SuggestionsPanel
          topics={suggestedNextTopics}
          isDark={isDark}
          onClose={() => setShowSuggestionsPanel(false)}
        />
      )}

      {chatState.suggestedQuestions.length > 0 &&
        chatState.messages.length > 0 &&
        !chatState.isLoading && (
          <div
            className={`px-4 py-2 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
          >
            <div className="flex gap-2 overflow-x-auto pb-2">
              {chatState.suggestedQuestions.slice(0, 2).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

      {!(isTutorMode && tutorMode === "learning-path") && (
        <ChatInput
          input={chatState.input}
          isDark={isDark}
          isTutorMode={isTutorMode}
          isLoading={chatState.isLoading}
          selectedNodeCount={selectedNodeIds.length}
          onInputChange={chatState.setInput}
          onKeyDown={handleKeyDown}
          onSend={() => handleSend()}
          onExtractConcepts={handleExtractConcepts}
          onSuggestNextTopics={
            onSuggestNextTopics
              ? () => {
                  onSuggestNextTopics();
                  setShowSuggestionsPanel(true);
                }
              : undefined
          }
          hasAssistantMessages={chatState.messages.some(
            (m) => m.role === "assistant",
          )}
        />
      )}
    </motion.div>
  );
};

interface RAGChatButtonWrapperProps extends RAGChatPanelProps {
  onOpenChange?: (open: boolean) => void;
  isMobilePreviewMode?: boolean;
}

const SimpleChatButton: React.FC<{
  isDark: boolean;
  isTutorMode: boolean;
  onClick: () => void;
  isMobilePreviewMode?: boolean;
  hasSelectedNode?: boolean;
}> = ({
  isDark,
  isTutorMode,
  onClick,
  isMobilePreviewMode,
  hasSelectedNode,
}) => {
  const { t } = useTranslation();
  const shouldMoveUp = isMobilePreviewMode && hasSelectedNode;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`fixed left-4 z-40 p-2.5 rounded-xl shadow-lg transition-all duration-300 ${
        shouldMoveUp ? "bottom-72" : "bottom-16"
      } ${
        isTutorMode
          ? isDark
            ? "bg-amber-600 hover:bg-amber-500 text-white"
            : "bg-amber-500 hover:bg-amber-600 text-white"
          : isDark
            ? "bg-primary-600 hover:bg-primary-500 text-white"
            : "bg-primary-500 hover:bg-primary-600 text-white"
      }`}
      title={isTutorMode ? t("aiChat.tutorTitle") : t("aiChat.title")}
    >
      {isTutorMode ? <GraduationCap size={18} /> : <MessageCircle size={18} />}
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
    </motion.button>
  );
};

export const RAGChatButtonWrapper: React.FC<RAGChatButtonWrapperProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  isOpen: externalIsOpen,
  onOpenChange,
  selectedNodeIds,
  aiEnabled,
  isTutorMode,
  tutorMode,
  extractedConcepts,
  onToggleTutorMode,
  onSwitchTutorMode,
  onExtractConcepts,
  onAddConceptToGraph,
  onAddAllConcepts,
  onSuggestNextTopics,
  suggestedNextTopics,
  onTutorChat,
  width = 420,
  onWidthChange,
  isMobilePreviewMode,
  selectedLearningPathId,
  onPathSelect,
}) => {
  const { isDark } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  return (
    <>
      <SimpleChatButton
        isDark={isDark}
        isTutorMode={isTutorMode || false}
        onClick={() => setIsOpen(true)}
        isMobilePreviewMode={isMobilePreviewMode}
        hasSelectedNode={!!currentNodeId}
      />

      <AnimatePresence>
        {isOpen && (
          <div className="fixed top-0 left-0 bottom-0 z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="h-full pointer-events-auto"
            >
              <RAGChatPanel
                graphId={graphId}
                currentNodeId={currentNodeId}
                currentNodeTitle={currentNodeTitle}
                onNodeClick={onNodeClick}
                onClose={() => setIsOpen(false)}
                isOpen={isOpen}
                selectedNodeIds={selectedNodeIds}
                aiEnabled={aiEnabled}
                isTutorMode={isTutorMode}
                tutorMode={tutorMode}
                extractedConcepts={extractedConcepts}
                onToggleTutorMode={onToggleTutorMode}
                onSwitchTutorMode={onSwitchTutorMode}
                onExtractConcepts={onExtractConcepts}
                onAddConceptToGraph={onAddConceptToGraph}
                onAddAllConcepts={onAddAllConcepts}
                onSuggestNextTopics={onSuggestNextTopics}
                suggestedNextTopics={suggestedNextTopics}
                onTutorChat={onTutorChat}
                width={width}
                onWidthChange={onWidthChange}
                selectedLearningPathId={selectedLearningPathId}
                onPathSelect={onPathSelect}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RAGChatPanel;
