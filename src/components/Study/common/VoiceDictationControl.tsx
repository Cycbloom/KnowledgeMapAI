import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { VoiceEngine } from "@/hooks/common/useVoiceDictation";
import { VoiceDictationButton } from "./VoiceDictationButton";
import { VoiceEngineToggle } from "./VoiceEngineToggle";

interface VoiceDictationControlProps {
  isDark: boolean;
  engine: VoiceEngine;
  isListening: boolean;
  isTranscribing: boolean;
  isConnecting: boolean;
  error: string | null;
  hasSupport: boolean;
  onToggle: () => void;
  onToggleEngine: () => void;
  showEngineToggle?: boolean;
  className?: string;
}

/**
 * 语音听写控制组：引擎切换 + 麦克风按钮 + 状态/错误提示。
 * 供 QA/简答/填空等单输入场景复用。
 */
export function VoiceDictationControl({
  isDark,
  engine,
  isListening,
  isTranscribing,
  isConnecting,
  error,
  hasSupport,
  onToggle,
  onToggleEngine,
  showEngineToggle = true,
  className = "",
}: VoiceDictationControlProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-1.5">
        {showEngineToggle && (
          <VoiceEngineToggle isDark={isDark} engine={engine} onToggle={onToggleEngine} />
        )}
        <VoiceDictationButton
          isDark={isDark}
          engine={engine}
          isListening={isListening}
          isTranscribing={isTranscribing}
          isConnecting={isConnecting}
          onToggle={onToggle}
        />
      </div>
      {hasSupport && (isConnecting || isListening || isTranscribing || error) && (
        <div
          className={`mt-1.5 flex items-center gap-1.5 text-xs ${
            error ? (isDark ? "text-red-400" : "text-red-600") : isDark ? "text-slate-400" : "text-slate-500"
          }`}
          role={error ? "alert" : undefined}
          aria-live="polite"
          aria-atomic="true"
        >
          {error ? (
            <>
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </>
          ) : isConnecting ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {t("study.quiz.voiceConnecting")}
            </span>
          ) : isTranscribing ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {t("study.quiz.voiceTranscribing")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {t("study.quiz.voiceListening")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
