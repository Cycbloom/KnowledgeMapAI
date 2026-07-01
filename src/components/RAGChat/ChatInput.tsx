import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Lightbulb,
  Sparkles,
  MessageSquareQuote,
  X,
  Network,
  Trash2,
  Info,
  Pencil,
  Mic,
  MicOff,
  Cloud,
  Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useSpeechRecognition } from "../../hooks";
import { useRealtimeSTT } from "../../hooks/common/useRealtimeSTT";

export interface QuoteReference {
  id: string;
  text: string;
}

interface ChatInputProps {
  input: string;
  isDark: boolean;
  isTutorMode: boolean;
  isLoading: boolean;
  selectedNodeCount: number;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onExtractConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  hasAssistantMessages: boolean;
  quotes?: QuoteReference[];
  onRemoveQuote?: (id: string) => void;
  onClearQuotes?: () => void;
  onEditQuote?: (id: string, newText: string) => void;
  useGraphContext?: boolean;
  onToggleGraphContext?: () => void;
  searchMode?: "semantic" | "keyword" | "hybrid";
  onSearchModeChange?: (mode: "semantic" | "keyword" | "hybrid") => void;
  onClearChat?: () => void;
  showQuoteTip?: boolean;
  onDismissQuoteTip?: () => void;
  enableSTT?: boolean;
  onStopGeneration?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  isDark,
  isTutorMode,
  isLoading,
  selectedNodeCount,
  onInputChange,
  onKeyDown,
  onSend,
  onExtractConcepts,
  onSuggestNextTopics,
  hasAssistantMessages,
  quotes = [],
  onRemoveQuote,
  onClearQuotes,
  onEditQuote,
  useGraphContext = false,
  onToggleGraphContext,
  searchMode = "hybrid",
  onSearchModeChange,
  onClearChat,
  showQuoteTip = false,
  onDismissQuoteTip,
  enableSTT = false,
  onStopGeneration,
}) => {
  const { t } = useTranslation();
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isListening,
    isTranscribing,
    transcript,
    error: sttError,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
  } = useSpeechRecognition();

  const realtimeSTT = useRealtimeSTT();
  const [useRealtimeEngine, setUseRealtimeEngine] = useState(false);

  const prevTranscriptRef = useRef("");
  const handleTranscript = useCallback(() => {
    if (enableSTT && transcript && transcript !== prevTranscriptRef.current) {
      const newPart = transcript.slice(prevTranscriptRef.current.length);
      if (newPart) {
        const separator = input.trim() ? " " : "";
        onInputChange(input + separator + newPart.trim());
      }
      prevTranscriptRef.current = transcript;
      resetTranscript();
    }
  }, [enableSTT, transcript, input, onInputChange, resetTranscript]);

  useEffect(() => {
    handleTranscript();
  }, [handleTranscript]);

  useEffect(() => {
    if (!isListening) {
      prevTranscriptRef.current = "";
    }
  }, [isListening]);

  const baseInputRef = useRef("");
  const isRealtimeTrackingRef = useRef(false);

  useEffect(() => {
    if (!isRealtimeTrackingRef.current) return;
    const transcriptText = (
      realtimeSTT.finalTranscript +
      (realtimeSTT.interimTranscript ? " " + realtimeSTT.interimTranscript : "")
    ).trim();
    const separator = baseInputRef.current.trim() ? " " : "";
    onInputChange(
      transcriptText
        ? baseInputRef.current + separator + transcriptText
        : baseInputRef.current,
    );
  }, [
    realtimeSTT.finalTranscript,
    realtimeSTT.interimTranscript,
    onInputChange,
  ]);

  const isRealtimeActive = realtimeSTT.isListening || realtimeSTT.isConnecting;
  const isFileTranscribing = !useRealtimeEngine && isTranscribing;
  const isMicActive = useRealtimeEngine ? isRealtimeActive : isListening;

  const handleMicClick = useCallback(() => {
    if (useRealtimeEngine) {
      if (realtimeSTT.isListening) {
        realtimeSTT.stopListening();
        isRealtimeTrackingRef.current = false;
        realtimeSTT.resetTranscript();
      } else {
        baseInputRef.current = input;
        isRealtimeTrackingRef.current = true;
        void realtimeSTT.startListening("zh");
      }
    } else {
      if (isListening) {
        void stopListening();
      } else if (!isTranscribing) {
        void startListening();
      }
    }
  }, [
    useRealtimeEngine,
    realtimeSTT,
    input,
    isListening,
    isTranscribing,
    stopListening,
    startListening,
  ]);

  const startEditing = (quote: QuoteReference) => {
    setEditingQuoteId(quote.id);
    setEditingText(quote.text);
  };

  const saveEdit = () => {
    if (editingQuoteId && editingText.trim()) {
      onEditQuote?.(editingQuoteId, editingText.trim());
    }
    setEditingQuoteId(null);
    setEditingText("");
  };

  const cancelEdit = () => {
    setEditingQuoteId(null);
    setEditingText("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  useEffect(() => {
    if (editingQuoteId && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.select();
    }
  }, [editingQuoteId]);

  return (
    <div
      className={`p-4 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
    >
      <AnimatePresence>
        {showQuoteTip && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              isDark
                ? "bg-blue-900/30 text-blue-300"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            <Info size={14} className="flex-shrink-0" />
            <span className="flex-1">{t("aiChat.quoteTip")}</span>
            {onDismissQuoteTip && (
              <button
                onClick={onDismissQuoteTip}
                className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                  isDark
                    ? "hover:bg-blue-800/50 text-blue-400 hover:text-blue-200"
                    : "hover:bg-blue-100 text-blue-400 hover:text-blue-600"
                }`}
              >
                <X size={12} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {selectedNodeCount > 0 && (
        <div
          className={`mb-2 text-xs px-2 py-1 rounded inline-block ${
            isTutorMode
              ? isDark
                ? "bg-amber-900/30 text-amber-300"
                : "bg-amber-50 text-amber-600"
              : isDark
                ? "bg-primary-900/30 text-primary-300"
                : "bg-primary-50 text-primary-600"
          }`}
        >
          {t("aiChat.selectedNodesContext", { count: selectedNodeCount })}
        </div>
      )}
      {quotes.length > 0 && (
        <div className="mb-2 max-h-48 overflow-y-auto">
          {quotes.length > 1 && onClearQuotes && (
            <div className="flex justify-end mb-1">
              <button
                onClick={onClearQuotes}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                  isDark
                    ? "text-slate-400 hover:text-red-400 hover:bg-red-900/20"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                }`}
              >
                <Trash2 size={11} />
                {t("aiChat.clearAllQuotes")}
              </button>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {quotes.map((quote) => (
              <motion.div
                key={quote.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onDoubleClick={() => startEditing(quote)}
                className={`flex items-start gap-2 px-3 py-2 mb-1.5 rounded-lg border ${
                  editingQuoteId === quote.id
                    ? isDark
                      ? "border-primary-500/60 bg-primary-900/25 ring-1 ring-primary-500/30"
                      : "border-primary-400 bg-primary-50/90 ring-1 ring-primary-300/50"
                    : isTutorMode
                      ? isDark
                        ? "border-amber-700/40 bg-amber-900/15"
                        : "border-amber-200 bg-amber-50/80"
                      : isDark
                        ? "border-primary-700/40 bg-primary-900/15"
                        : "border-primary-200 bg-primary-50/80"
                } ${editingQuoteId === quote.id ? "" : "cursor-default"}`}
              >
                <MessageSquareQuote
                  size={14}
                  className={`flex-shrink-0 mt-0.5 ${
                    isTutorMode
                      ? isDark
                        ? "text-amber-400"
                        : "text-amber-500"
                      : isDark
                        ? "text-primary-400"
                        : "text-primary-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  {editingQuoteId === quote.id ? (
                    <textarea
                      ref={editTextareaRef}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={saveEdit}
                      rows={2}
                      className={`w-full bg-transparent resize-none outline-none text-xs leading-relaxed break-all ${
                        isDark ? "text-primary-200" : "text-primary-800"
                      }`}
                      style={{ maxHeight: "120px" }}
                    />
                  ) : (
                    <>
                      <span
                        className={`block text-xs leading-relaxed line-clamp-2 break-all ${
                          isTutorMode
                            ? isDark
                              ? "text-amber-200"
                              : "text-amber-800"
                            : isDark
                              ? "text-primary-200"
                              : "text-primary-800"
                        }`}
                      >
                        {quote.text}
                      </span>
                      <span
                        className={`block mt-0.5 text-[10px] ${
                          isDark ? "text-slate-500" : "text-gray-400"
                        }`}
                      >
                        {t("aiChat.charCount", { count: quote.text.length })}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-0.5">
                  {onEditQuote && editingQuoteId !== quote.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(quote);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isDark
                          ? "hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                          : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                      }`}
                      title={t("aiChat.editQuote")}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {onRemoveQuote && (
                    <button
                      onClick={() => onRemoveQuote(quote.id)}
                      className={`p-1 rounded transition-colors ${
                        isDark
                          ? "hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                          : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                      }`}
                      title={t("aiChat.removeQuote")}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {(onToggleGraphContext || onSearchModeChange || onClearChat) && (
        <div className="mb-3 flex items-center gap-2">
          {onSearchModeChange && (
            <div
              className={`flex items-center gap-0.5 rounded-xl p-1 ${isDark ? "bg-slate-800/80" : "bg-gray-100"}`}
            >
              {[
                {
                  value: "semantic" as const,
                  label: t("aiChat.searchModeSemantic"),
                },
                {
                  value: "keyword" as const,
                  label: t("aiChat.searchModeKeyword"),
                },
                {
                  value: "hybrid" as const,
                  label: t("aiChat.searchModeHybrid"),
                },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSearchModeChange(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    searchMode === option.value
                      ? isDark
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-primary-500 text-white shadow-sm"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                  }`}
                  title={option.label}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {onToggleGraphContext && (
              <button
                onClick={onToggleGraphContext}
                className={`p-2 rounded-lg transition-all ${
                  useGraphContext
                    ? isDark
                      ? "bg-primary-900/40 text-primary-300 ring-1 ring-primary-700/50"
                      : "bg-primary-50 text-primary-600 ring-1 ring-primary-200"
                    : isDark
                      ? "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600"
                }`}
                title={t("aiChat.graphContext")}
              >
                <Network size={16} />
              </button>
            )}
            {onClearChat && (
              <button
                onClick={onClearChat}
                className={`p-2 rounded-lg transition-all ${
                  isDark
                    ? "bg-slate-800/80 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                    : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500"
                }`}
                title={t("aiChat.clearConversation")}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      <div
        className={`flex flex-col rounded-2xl border transition-all duration-200 ${
          isDark
            ? "bg-slate-800/80 border-slate-700 focus-within:border-primary-500/60 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.2)]"
            : "bg-white border-gray-200 focus-within:border-primary-400/60 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] shadow-sm"
        }`}
      >
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isTutorMode
              ? t("aiChat.tutorInputPlaceholder")
              : t("aiChat.inputPlaceholder")
          }
          rows={3}
          className={`w-full bg-transparent resize-none outline-none focus-visible:outline-none text-sm px-4 pt-3 pb-2 ${
            isDark
              ? "text-slate-200 placeholder-slate-500"
              : "text-gray-800 placeholder-gray-400"
          }`}
          style={{ maxHeight: "160px", minHeight: "80px" }}
          disabled={isLoading}
        />
        <div className="flex items-center justify-end gap-1.5 px-3 pb-3">
          {enableSTT && hasRecognitionSupport && (
            <>
              <button
                onClick={() => setUseRealtimeEngine((prev) => !prev)}
                className={`p-2 rounded-lg transition-all ${
                  useRealtimeEngine
                    ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/25"
                    : isDark
                      ? "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
                title={t("aiChat.realtimeStt")}
              >
                <Cloud size={16} />
              </button>
              <button
                onClick={handleMicClick}
                disabled={isFileTranscribing}
                className={`p-2 rounded-lg transition-all ${
                  isMicActive
                    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse shadow-md shadow-red-500/25"
                    : isFileTranscribing
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
                      : useRealtimeEngine
                        ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/25"
                        : isDark
                          ? "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
                title={
                  isFileTranscribing
                    ? t("aiChat.sttTranscribing")
                    : isMicActive
                      ? t("aiChat.stopRecording")
                      : t("aiChat.startRecording")
                }
              >
                {isFileTranscribing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isMicActive ? (
                  <MicOff size={16} />
                ) : (
                  <Mic size={16} />
                )}
              </button>
            </>
          )}
          {isLoading && onStopGeneration ? (
            <button
              onClick={onStopGeneration}
              className={`p-2 rounded-lg transition-all bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/25`}
              title={t("aiChat.stopGeneration")}
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!input.trim() || isLoading}
              className={`p-2 rounded-lg transition-all ${
                input.trim() && !isLoading
                  ? isTutorMode
                    ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/25"
                    : "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/25"
                  : isDark
                    ? "bg-slate-700/60 text-slate-500 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>

      {useRealtimeEngine &&
        (realtimeSTT.isListening ||
          realtimeSTT.isConnecting ||
          realtimeSTT.error) && (
          <div className="mt-1.5 px-2 text-xs">
            {realtimeSTT.error ? (
              <span className="text-red-500">{realtimeSTT.error}</span>
            ) : realtimeSTT.isConnecting ? (
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                {t("aiChat.sttConnecting")}
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {t("aiChat.sttListening")}
              </span>
            )}
          </div>
        )}

      {!useRealtimeEngine && (isFileTranscribing || sttError) && (
        <div className="mt-1.5 px-2 text-xs">
          {sttError ? (
            <span className="text-red-500">{sttError}</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {t("aiChat.sttTranscribing")}
            </span>
          )}
        </div>
      )}

      {isTutorMode && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onExtractConcepts}
            disabled={!hasAssistantMessages}
            className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? "bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50"
                : "bg-yellow-500 text-white hover:bg-yellow-600"
            }`}
          >
            <Lightbulb size={14} />
            {t("aiChat.extractConcepts")}
          </button>
          {onSuggestNextTopics && (
            <button
              onClick={onSuggestNextTopics}
              className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                isDark
                  ? "bg-primary-900/30 text-primary-300 hover:bg-primary-900/50"
                  : "bg-primary-500 text-white hover:bg-primary-600"
              }`}
            >
              <Sparkles size={14} />
              {t("aiChat.learningSuggestion")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInput;
