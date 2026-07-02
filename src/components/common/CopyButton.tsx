import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/messageHelper";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      message.success(t("common.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
      message.error(t("common.copyFailed"));
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors"
      title={t("common.copyError")}
      aria-label={t("common.copyError")}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      )}
    </button>
  );
}
