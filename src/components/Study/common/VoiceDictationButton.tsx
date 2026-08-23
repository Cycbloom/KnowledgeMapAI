import { Loader2, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { VoiceEngine } from "@/hooks/common/useVoiceDictation";

interface VoiceDictationButtonProps {
  isDark: boolean;
  engine?: VoiceEngine;
  isListening: boolean;
  isTranscribing: boolean;
  isConnecting?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * 语音听写按钮（纯麦克风）。
 * 点击开始录音，再次点击结束。文件引擎结束后转写并填入文本，实时引擎边录边出字。
 */
export function VoiceDictationButton({
  isDark,
  engine = "file",
  isListening,
  isTranscribing,
  isConnecting = false,
  disabled = false,
  onToggle,
}: VoiceDictationButtonProps) {
  const { t } = useTranslation();
  const busy = isTranscribing || isConnecting;

  const label = busy
    ? isConnecting
      ? t("study.quiz.voiceConnecting")
      : t("study.quiz.voiceTranscribing")
    : isListening
      ? t("study.quiz.voiceStop")
      : t("study.quiz.voiceStart");

  const stateClass = isListening
    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse shadow-md shadow-red-500/25"
    : busy
      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
      : engine === "realtime"
        ? "bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 dark:bg-indigo-500/20 dark:text-indigo-300"
        : isDark
          ? "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || busy}
      className={`flex-shrink-0 self-end p-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-50 ${stateClass}`}
      aria-label={label}
      title={label}
    >
      {busy ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : isListening ? (
        <MicOff size={16} aria-hidden="true" />
      ) : (
        <Mic size={16} aria-hidden="true" />
      )}
    </button>
  );
}
