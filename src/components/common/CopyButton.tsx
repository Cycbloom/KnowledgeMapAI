import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/messageHelper";
import { useMicrofeedback } from "@/hooks/common/useMicrofeedback";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { t } = useTranslation();
  const { isSuccess, run } = useMicrofeedback({ resetMs: 2000 });

  const handleCopy = async () => {
    try {
      await run(navigator.clipboard.writeText(text));
      message.success(t("toast.common.copied"));
    } catch {
      console.error("Failed to copy");
      message.error(t("toast.common.copyFailed"));
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      title={t("common.copyError")}
      aria-label={t("common.copyError")}
    >
      {isSuccess ? (
        <Check aria-hidden="true" className="w-4 h-4 text-green-600 dark:text-green-400" />
      ) : (
        <Copy aria-hidden="true" className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      )}
    </button>
  );
}
