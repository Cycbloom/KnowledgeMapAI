import { Loader2, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";

interface VoiceDictationButtonProps {
  isDark: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * 语音听写按钮
 * 点击开始录音，再次点击结束并将转写文本填入关联输入框。
 */
export function VoiceDictationButton({
  isDark,
  isListening,
  isTranscribing,
  disabled = false,
  onToggle,
}: VoiceDictationButtonProps) {
  const { t } = useTranslation();

  const label = isTranscribing
    ? t("study.quiz.voiceTranscribing")
    : isListening
      ? t("study.quiz.voiceStop")
      : t("study.quiz.voiceStart");

  const stateClass = isListening
    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse shadow-md shadow-red-500/25"
    : isTranscribing
      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
      : isDark
        ? "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
        : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isTranscribing}
      className={`flex-shrink-0 self-end p-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-50 ${stateClass}`}
      aria-label={label}
      title={label}
    >
      {isTranscribing ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : isListening ? (
        <MicOff size={16} aria-hidden="true" />
      ) : (
        <Mic size={16} aria-hidden="true" />
      )}
    </button>
  );
}
