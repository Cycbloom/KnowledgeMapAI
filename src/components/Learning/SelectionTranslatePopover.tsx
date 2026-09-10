import React, { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Loader2, Languages } from "lucide-react";
import { api } from "../../services/api";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";
import type { ContentLanguage } from "../../utils/language";

interface SelectionTranslatePopoverProps {
  /** 阅读内容容器：仅处理该容器内的选区 */
  containerRef: RefObject<HTMLElement>;
  /** 文章内容：变化时关闭浮层 */
  content: string;
  /** 文章内容语言：中文内容不启用选词翻译 */
  contentLanguage: ContentLanguage;
  isDark: boolean;
}

interface SelectionInfo {
  text: string;
  status: "loading" | "success" | "error";
  translation?: string;
  top: number;
  left: number;
}

const MAX_SELECTION_LENGTH = 300;
const POPUP_WIDTH = 256;
const POPUP_ESTIMATED_HEIGHT = 96;

export const SelectionTranslatePopover: React.FC<SelectionTranslatePopoverProps> = ({
  containerRef,
  content,
  contentLanguage,
  isDark,
}) => {
  const { t } = useTranslation();
  const { transitionOverride } = useReducedMotionOrPreference();
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectionTextRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const enabled = contentLanguage !== "zh";

  const close = useCallback(() => {
    selectionTextRef.current = null;
    setSelection(null);
  }, []);

  useEffect(() => {
    close();
  }, [content, close]);

  const requestTranslation = useCallback(
    (text: string, context: string) => {
      const cacheKey = context
        ? `${text}\u0000${context.slice(0, 80)}`
        : text;
      const cached = cacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        return Promise.resolve({ translation: cached, usedDefault: false });
      }
      return api.ai.translateText({ text, context }).then((res) => {
        if (!res.usedDefault) {
          cacheRef.current.set(cacheKey, res.translation);
        }
        return res;
      });
    },
    [],
  );

  /** 提取选区所在段落文本作为翻译上下文，帮助 AI 消解一词多义 */
  const extractContext = useCallback((): string => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const blockEl = (
      container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement
    )?.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, div");
    const raw = blockEl?.textContent ?? "";
    return raw.replace(/\s+/g, " ").trim().slice(0, 300);
  }, []);

  const handleSelection = useCallback(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (!anchorNode || !focusNode) return;
    if (!(anchorNode instanceof Node && container.contains(anchorNode))) return;
    if (!(focusNode instanceof Node && container.contains(focusNode))) return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text || text.length > MAX_SELECTION_LENGTH) return;
    if (text === selectionTextRef.current) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centerX, POPUP_WIDTH / 2 + 8),
      window.innerWidth - POPUP_WIDTH / 2 - 8,
    );
    const top =
      rect.top < POPUP_ESTIMATED_HEIGHT + 16
        ? rect.bottom + 10
        : rect.top - 10;
    selectionTextRef.current = text;
    setSelection({ text, status: "loading", top, left });
    requestTranslation(text, extractContext())
      .then((res) => {
        setSelection((prev) =>
          prev && prev.text === text
            ? { ...prev, status: "success", translation: res.translation }
            : prev,
        );
      })
      .catch(() => {
        setSelection((prev) =>
          prev && prev.text === text ? { ...prev, status: "error" } : prev,
        );
      });
  }, [enabled, containerRef, requestTranslation, extractContext]);

  useEffect(() => {
    if (!enabled) return;
    let touchTimer: number | null = null;
    const onMouseUp = () => {
      window.setTimeout(handleSelection, 0);
    };
    const onTouchEnd = () => {
      if (touchTimer !== null) window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(handleSelection, 300);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) {
        return;
      }
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (touchTimer !== null) window.clearTimeout(touchTimer);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, handleSelection, close]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", close, { passive: true });
    return () => el.removeEventListener("scroll", close);
  }, [containerRef, close]);

  if (!enabled) return null;

  return createPortal(
    <AnimatePresence>
      {selection && (
        <motion.div
          ref={popupRef}
          role="tooltip"
          className="fixed z-tooltip"
          style={{ top: selection.top, left: selection.left }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionOverride ?? { duration: 0.15 }}
        >
          <div
            className={`w-64 p-3 rounded-xl shadow-xl border ${
              isDark
                ? "bg-slate-800 border-slate-600"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start gap-1.5 mb-1.5">
              <Languages
                size={14}
                className="text-primary-500 flex-shrink-0 mt-0.5"
              />
              <span
                className={`text-xs font-semibold break-all line-clamp-2 ${
                  isDark ? "text-slate-200" : "text-gray-800"
                }`}
              >
                {selection.text}
              </span>
            </div>
            <div
              className={`text-sm leading-relaxed ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {selection.status === "loading" && (
                <span className="flex items-center gap-2 text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  {t("learning.selectionTranslate.translating")}
                </span>
              )}
              {selection.status === "success" && (
                <span>{selection.translation}</span>
              )}
              {selection.status === "error" && (
                <span className="text-xs text-red-500">
                  {t("learning.selectionTranslate.error")}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
