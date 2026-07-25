/**
 * 写作辅助浮层:展示 AI 生成的续写/改写/扩写建议,供用户采纳或放弃。
 *
 * 由父组件 BlockEditor 通过 `editor.view.coordsAtPos(selection.to)` 计算
 * anchorRect 并传入;浮层用 `position: fixed` + `top/left` 定位在选区下方。
 *
 * 浮层内部不监听 scroll/resize——由父组件 BlockEditor 监听并决定是否重算或关闭。
 *
 * 风格参考 WikiLinkPopover.tsx:fixed 定位、暗色模式、z-50、rounded-lg border shadow-lg。
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Check, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/common";

export interface WritingAssistPopoverProps {
  /** AI 生成的建议文本(loading 时可为空字符串)。 */
  suggestion: string;
  /** 采纳建议回调。 */
  onAccept: () => void;
  /** 放弃建议回调。 */
  onReject: () => void;
  /** 是否正在生成建议。 */
  isLoading: boolean;
  /** 生成失败时的错误信息(父组件传入;有值时显示错误区,隐藏建议文本与按钮)。 */
  error?: string;
  /** 锚点坐标(选区末尾位置),由 `editor.view.coordsAtPos(selection.to)` 计算得到。 */
  anchorRect: DOMRect;
}

export const WritingAssistPopover: React.FC<WritingAssistPopoverProps> = ({
  suggestion,
  onAccept,
  onReject,
  isLoading,
  error,
  anchorRect,
}) => {
  const { t } = useTranslation();
  // 组件由父组件挂载/卸载控制可见性:挂载时捕获触发元素,卸载时恢复焦点。
  // 默认 enabled=true, restoreFocus=true,与整屏模态行为一致。
  const popoverRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t("notes.writingAssist.popoverTitle")}
      className="fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      {/* 标题栏 */}
      <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-500 flex items-center gap-1.5">
        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
        <span>{t("notes.writingAssist.popoverTitle")}</span>
      </div>

      {/* 主体:加载中 / 错误 / 建议文本 */}
      <div className="px-3 py-2">
        {error ? (
          <div className="text-sm text-red-500 dark:text-red-400 py-2">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-slate-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{t("notes.writingAssist.loading")}</span>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-slate-200 max-h-[280px] overflow-y-auto font-sans">
            {suggestion}
          </pre>
        )}
      </div>

      {/* 底部按钮:仅在非 loading、无 error 时显示 */}
      {!isLoading && !error && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-100 dark:border-slate-500">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-600"
          >
            <X className="w-3 h-3" />
            <span>{t("notes.writingAssist.reject")}</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <Check className="w-3 h-3" />
            <span>{t("notes.writingAssist.accept")}</span>
          </button>
        </div>
      )}
    </div>
  );
};
