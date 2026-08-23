import { Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { VoiceEngine } from "@/hooks/common/useVoiceDictation";

interface VoiceEngineToggleProps {
  isDark: boolean;
  engine: VoiceEngine;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * 语音引擎切换按钮：文件转写（先录完再转写）⇄ 实时识别（边说边出字）。
 */
export function VoiceEngineToggle({
  isDark,
  engine,
  onToggle,
  disabled = false,
}: VoiceEngineToggleProps) {
  const { t } = useTranslation();
  const label = t("study.quiz.voiceRealtime");

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex-shrink-0 self-end p-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-50 ${
        engine === "realtime"
          ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/25"
          : isDark
            ? "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
      }`}
      aria-label={label}
      aria-pressed={engine === "realtime"}
      title={label}
    >
      <Cloud size={16} aria-hidden="true" />
    </button>
  );
}
