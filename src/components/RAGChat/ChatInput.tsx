import React from "react";
import {
  Send,
  Loader2,
  Lightbulb,
  Sparkles,
  MessageSquareQuote,
  X,
  Network,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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
  useGraphContext?: boolean;
  onToggleGraphContext?: () => void;
  onClearChat?: () => void;
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
  useGraphContext = false,
  onToggleGraphContext,
  onClearChat,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`p-4 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
    >
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
        <div className="mb-2 max-h-32 overflow-y-auto space-y-1">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs border-l-[3px] ${
                isTutorMode
                  ? isDark
                    ? "border-amber-500 bg-amber-900/20 text-amber-200"
                    : "border-amber-500 bg-amber-50 text-amber-800"
                  : isDark
                    ? "border-primary-500 bg-primary-900/20 text-primary-200"
                    : "border-primary-500 bg-primary-50 text-primary-800"
              }`}
            >
              <MessageSquareQuote
                size={12}
                className="flex-shrink-0 mt-0.5 opacity-60"
              />
              <span className="flex-1 line-clamp-2 break-all">
                {quote.text.length > 100
                  ? quote.text.slice(0, 100) + "…"
                  : quote.text}
              </span>
              {onRemoveQuote && (
                <button
                  onClick={() => onRemoveQuote(quote.id)}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                    isDark
                      ? "hover:bg-slate-700 text-slate-400"
                      : "hover:bg-gray-200 text-gray-400"
                  }`}
                  title={t("aiChat.removeQuote")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(onToggleGraphContext || onClearChat) && (
        <div className="mb-2 flex items-center gap-2">
          {onToggleGraphContext && (
            <button
              onClick={onToggleGraphContext}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                useGraphContext
                  ? isDark
                    ? "bg-primary-900/40 text-primary-300 ring-1 ring-primary-700"
                    : "bg-primary-50 text-primary-600 ring-1 ring-primary-200"
                  : isDark
                    ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600"
              }`}
            >
              <Network size={13} />
              {t("aiChat.graphContext")}
            </button>
          )}
          {onClearChat && (
            <button
              onClick={onClearChat}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                  : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500"
              }`}
              title={t("aiChat.clearConversation")}
            >
              <Trash2 size={13} />
              {t("aiChat.clearConversation")}
            </button>
          )}
        </div>
      )}
      <div
        className={`flex items-end gap-2 p-2 rounded-2xl ${
          isDark ? "bg-slate-800" : "bg-gray-100"
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
          className={`flex-1 bg-transparent resize-none outline-none text-sm ${
            isDark
              ? "text-slate-200 placeholder-slate-500"
              : "text-gray-800 placeholder-gray-400"
          }`}
          style={{ maxHeight: "120px" }}
          disabled={isLoading}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          className={`p-2 rounded-xl transition-all ${
            input.trim() && !isLoading
              ? isTutorMode
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-primary-600 text-white hover:bg-primary-700"
              : isDark
                ? "bg-slate-700 text-slate-500"
                : "bg-gray-200 text-gray-400"
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

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
