import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { X, Plus, Inbox } from "lucide-react";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import { queryKeys } from "@/hooks/queries";
import { Button } from "@/components/common";
import { message } from "@/utils/messageHelper";
import { api } from "@/services/api";
import { CAPTURE_INBOX_TAG } from "@shared/constants/capture";

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 全局快速捕获窗口：从任意页面通过快捷键/悬浮按钮唤起，
 * 记录一条碎片信息并落入收件箱（#inbox 笔记），供首页 AI 归档。
 */
export const QuickCaptureModal = ({ isOpen, onClose }: QuickCaptureModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [draft, setDraft] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  // 打开时自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setDraft("");
      const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notesPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.todaySummary });
  };

  const handleCapture = async () => {
    const text = draft.trim();
    if (!text) return;
    setIsCapturing(true);
    try {
      const firstLine = text.split(/\r?\n/, 1)[0]?.trim() || t("capture.untitled");
      await api.notes.create({
        title: firstLine.slice(0, 80),
        content: text,
        type: "note",
        tags: [CAPTURE_INBOX_TAG],
      });
      setDraft("");
      message.success(t("capture.captureCreated"));
      invalidate();
    } catch {
      message.error(t("capture.captureFailed"));
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  const titleId = "quick-capture-title";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-600"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary-500" aria-hidden="true" />
            <h3 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("capture.modalTitle")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            aria-label={t("common.aria.closeDialog")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <textarea
            ref={textareaRef}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleCapture();
              }
            }}
            placeholder={t("capture.modalPlaceholder")}
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t("capture.modalHint")}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/50 px-4 py-3 flex items-center gap-2 border-t dark:border-slate-600">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/");
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline px-2 py-2 min-h-[44px] sm:min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            {t("capture.openInbox")}
          </button>
          <div className="flex-1" />
          <Button
            onClick={handleCapture}
            disabled={!draft.trim()}
            loading={isCapturing}
            leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          >
            {t("capture.capture")}
          </Button>
        </div>
      </div>
    </div>
  );
};