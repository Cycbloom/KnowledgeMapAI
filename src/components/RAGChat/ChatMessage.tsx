import React, { useRef, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  User,
  BookOpen,
  Loader2,
  Network,
  Quote,
  Copy,
  Check,
  RotateCcw,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { preprocessMarkdown } from "../../utils/markdownPreprocessor";
import { Message } from "./hooks/useChatState";
import { addQuote } from "./index";
import { TermTooltip } from "../common";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/utils/clipboard";

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children?: React.ReactNode;
}

interface ChatMessageProps {
  message: Message;
  isDark: boolean;
  isTutorMode: boolean;
  onNodeClick?: (nodeId: string) => void;
  voiceControl?: React.ReactNode;
  enableTermTooltip?: boolean;
  isLast?: boolean;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isDark,
  isTutorMode,
  onNodeClick,
  voiceControl,
  enableTermTooltip,
  isLast = false,
  isLoading = false,
  onRegenerate,
  onEditAndResend,
}) => {
  const { t } = useTranslation();
  const messageRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(
        editText.length,
        editText.length,
      );
    }
  }, [isEditing, editText.length]);

  const handleQuoteMessage = useCallback(() => {
    if (message.content && !message.isStreaming) {
      addQuote(message.content);
    }
  }, [message.content, message.isStreaming]);

  const handleCopyMessage = useCallback(async () => {
    if (!message.content) return;
    const success = await copyToClipboard(message.content, t("toast.common.copied"));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content, t]);

  const startEditing = useCallback(() => {
    if (isLoading) return;
    setEditText(message.content);
    setIsEditing(true);
  }, [isLoading, message.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditText(message.content);
  }, [message.content]);

  const saveEditing = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed || !onEditAndResend) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onEditAndResend(message.id, trimmed);
  }, [editText, onEditAndResend, message.id]);

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  const renderCodeBlock = ({
    className,
    children,
    ...props
  }: CodeBlockProps) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className={`px-1.5 py-0.5 rounded text-xs ${
            isDark
              ? "bg-slate-700 text-primary-300"
              : "bg-gray-200 text-primary-600"
          }`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={`block p-2 rounded-lg text-xs overflow-x-auto ${
          isDark ? "bg-slate-900 text-slate-100" : "bg-gray-200"
        }`}
        {...props}
      >
        {children}
      </code>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          message.role === "user"
            ? isTutorMode
              ? isDark
                ? "bg-amber-600"
                : "bg-amber-500"
              : isDark
                ? "bg-primary-600"
                : "bg-primary-500"
            : isDark
              ? "bg-slate-700"
              : "bg-gray-200"
        }`}
      >
        {message.role === "user" ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot
            size={16}
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
        )}
      </div>

      <div
        className={`flex-1 max-w-[85%] ${message.role === "user" ? "flex justify-end" : ""}`}
      >
        <div
          ref={messageRef}
          className={`inline-block p-3 rounded-2xl text-sm relative ${
            message.role === "user"
              ? isTutorMode
                ? "bg-amber-500 text-white rounded-tr-sm"
                : "bg-primary-600 text-white rounded-tr-sm"
              : isDark
                ? "bg-slate-700 text-white rounded-tl-sm"
                : "bg-gray-100 text-gray-800 rounded-tl-sm"
          }`}
        >
          {message.role === "assistant" ? (
            <div
              aria-live="polite"
              aria-atomic="false"
              {...(message.isStreaming ? { "aria-busy": "true" } : {})}
              className={`prose prose-sm max-w-none ${isDark ? "prose-invert prose-slate" : ""}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => (
                    <p
                      className={`mb-2 last:mb-0 ${isDark ? "text-white" : ""}`}
                    >
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul
                      className={`list-disc pl-4 mb-2 ${isDark ? "text-white" : ""}`}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol
                      className={`list-decimal pl-4 mb-2 ${isDark ? "text-white" : ""}`}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className={`mb-1 ${isDark ? "text-white" : ""}`}>
                      {children}
                    </li>
                  ),
                  code: renderCodeBlock,
                  ...(enableTermTooltip
                    ? {
                        a: ({ href, children }) => {
                          if (href?.startsWith("term:")) {
                            const term = String(children);
                            const explanation = decodeURIComponent(href.replace("term:", ""));
                            return (
                              <TermTooltip term={term} explanation={explanation} />
                            );
                          }
                          return (
                            <a
                              href={href}
                              className="text-primary-500 underline"
                            >
                              {children}
                            </a>
                          );
                        },
                      }
                    : {}),
                }}
              >
                {preprocessMarkdown(message.content)}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle opacity-50" />
              )}
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                ref={editTextareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                className="w-full bg-transparent resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm leading-relaxed text-white"
                style={{ minHeight: "40px", maxHeight: "160px" }}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={cancelEditing}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    isDark
                      ? "bg-slate-600/60 text-slate-200 hover:bg-slate-600"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  {t("aiChat.cancelEdit")}
                </button>
                <button
                  onClick={saveEditing}
                  disabled={!editText.trim()}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    editText.trim()
                      ? isDark
                        ? "bg-primary-600 text-white hover:bg-primary-500"
                        : "bg-white text-primary-600 hover:bg-primary-50"
                      : "bg-slate-500/40 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {t("aiChat.saveEdit")}
                </button>
              </div>
            </div>
          ) : (
            <span className="text-white whitespace-pre-wrap">{message.content}</span>
          )}

        </div>

        {message.role === "assistant" && (
          <div className="flex items-center gap-2 mt-1">
            {!message.isStreaming && message.content && (
              <>
                <button
                  onClick={handleQuoteMessage}
                  className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isDark
                      ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                      : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  }`}
                  aria-label={t("aiChat.quoteThisMessage")}
                  title={t("aiChat.quoteThisMessage")}
                >
                  <Quote size={14} aria-hidden="true" />
                </button>
                <button
                  onClick={handleCopyMessage}
                  className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isDark
                      ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                      : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  }`}
                  aria-label={copied ? t("aiChat.copiedMessage") : t("aiChat.copyMessage")}
                  title={copied ? t("aiChat.copiedMessage") : t("aiChat.copyMessage")}
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                </button>
                {isLast && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    disabled={isLoading}
                    className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                      isLoading
                        ? isDark
                          ? "text-slate-600 cursor-not-allowed"
                          : "text-gray-300 cursor-not-allowed"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                          : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    }`}
                    aria-label={t("aiChat.regenerateResponse")}
                    title={t("aiChat.regenerateResponse")}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                )}
              </>
            )}

            {message.sources && message.sources.length > 0 && (
              <div
                className={`text-xs ${isDark ? "text-slate-300" : "text-gray-400"}`}
              >
                <div className="flex flex-wrap gap-1">
                  {message.sources.slice(0, 3).map((source) => (
                    <button
                      key={source.id}
                      onClick={() => onNodeClick && onNodeClick(source.id)}
                      className={`inline-flex flex-col items-start gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                        isDark
                          ? "bg-slate-700 hover:bg-slate-600 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <BookOpen size={10} />
                        {source.hopDistance && source.hopDistance > 0 && (
                          <span className="text-[10px] text-amber-500 font-medium">
                            {t('ragChat.chatMessage.hopDistance', { count: source.hopDistance })}
                          </span>
                        )}
                        <span className="truncate max-w-[80px]">
                          {source.title}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {Math.round(source.similarity * 100)}%
                        </span>
                      </div>
                      {source.relationshipPath && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                          <Network size={10} />
                          {source.relationshipPath}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {voiceControl}
          </div>
        )}

        {message.role === "user" && !isEditing && onEditAndResend && (
          <div className="flex items-center gap-2 mt-1 justify-end">
            <button
              onClick={startEditing}
              disabled={isLoading}
              className={`p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isLoading
                  ? isDark
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-gray-300 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              aria-label={t("aiChat.editMessage")}
              title={t("aiChat.editMessage")}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface LoadingMessageProps {
  isDark: boolean;
  isTutorMode: boolean;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({
  isDark,
  isTutorMode,
}) => {
  const { t } = useTranslation();
  return (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex gap-3"
    aria-live="polite"
  >
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isDark ? "bg-slate-700" : "bg-gray-200"
      }`}
      aria-hidden="true"
    >
      <Loader2
        size={16}
        className={`animate-spin ${
          isTutorMode
            ? isDark
              ? "text-amber-400"
              : "text-amber-600"
            : isDark
              ? "text-primary-400"
              : "text-primary-600"
        }`}
      />
    </div>
    <div
      className={`p-3 rounded-2xl rounded-tl-sm ${
        isDark ? "bg-slate-700 text-slate-50" : "bg-gray-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex gap-1">
        <span
          className="w-2 h-2 bg-current rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 bg-current rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 bg-current rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
    <span className="sr-only">{t("common.aria.loading")}</span>
  </motion.div>
  );
};

export default ChatMessage;
