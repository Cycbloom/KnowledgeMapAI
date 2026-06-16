import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { message as msgHelper } from "../../utils/messageHelper";

interface UseQuoteShortcutOptions {
  onAddQuote: (text: string) => void;
  isChatOpen: boolean;
  onOpenChat: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const useQuoteShortcut = ({
  onAddQuote,
  isChatOpen,
  onOpenChat,
  inputRef,
}: UseQuoteShortcutOptions): void => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          e.preventDefault();
          const text = selection.toString().trim();
          onAddQuote(text);

          if (!isChatOpen) {
            onOpenChat();
          }

          msgHelper.success(t("learning.quoteAdded"));
          navigator.clipboard.writeText(text).catch(() => {});

          setTimeout(() => {
            inputRef?.current?.focus();
          }, 100);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onAddQuote, isChatOpen, onOpenChat, inputRef, t]);
};
