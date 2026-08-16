import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import type { TTSVoice } from "@shared/types";
import {
  Volume2,
  Mic,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  Play,
  Upload,
  FileAudio,
} from "lucide-react";

export const VoiceServiceSettings = React.memo(function VoiceServiceSettings() {
  const { t } = useTranslation();

  const [ttsHealth, setTtsHealth] = useState<'idle' | 'checking' | 'healthy' | 'unhealthy'>('idle');
  const [ttsVoices, setTtsVoices] = useState<TTSVoice[]>([]);
  const [ttsTestText, setTtsTestText] = useState("你好，这是一个语音合成测试。");
  const [ttsTestVoice, setTtsTestVoice] = useState("Cherry");
  const [ttsTesting, setTtsTesting] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [sttHealth, setSttHealth] = useState<'idle' | 'checking' | 'healthy' | 'unhealthy'>('idle');
  const [sttTestFile, setSttTestFile] = useState<File | null>(null);
  const [sttTesting, setSttTesting] = useState(false);
  const [sttTestResult, setSttTestResult] = useState<{ success: boolean; text?: string; message: string } | null>(null);

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // 挂载后自动检测一次，用真实结果初始化健康状态
    void checkTtsHealth();
    void checkSttHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkTtsHealth = async () => {
    if (!mountedRef.current) return;
    setTtsHealth('checking');
    try {
      const result = await api.tts.health() as { status: string; model_loaded: boolean };
      if (!mountedRef.current) return;
      setTtsHealth(result.status === 'healthy' ? 'healthy' : 'unhealthy');
      if (result.status === 'healthy') {
        const voices = await api.tts.voices();
        if (!mountedRef.current) return;
        setTtsVoices(voices);
      }
    } catch {
      if (!mountedRef.current) return;
      setTtsHealth('unhealthy');
    }
  };

  const handleTestTts = async () => {
    setTtsTesting(true);
    setTtsTestResult(null);
    try {
      const blob = await api.tts.synthesize({
        text: ttsTestText,
        voice: ttsTestVoice,
        speed: 1.0,
        output_format: 'mp3',
      });
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      setTtsTestResult({ success: true, message: t("settings.ttsTestSuccess") });
    } catch (error: unknown) {
      const err = error as Error;
      setTtsTestResult({ success: false, message: err.message || t("settings.ttsTestFailed") });
    } finally {
      setTtsTesting(false);
    }
  };

  const checkSttHealth = async () => {
    if (!mountedRef.current) return;
    setSttHealth('checking');
    try {
      const result = await api.stt.health() as { status: string; model_loaded: boolean };
      if (!mountedRef.current) return;
      setSttHealth(result.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch {
      if (!mountedRef.current) return;
      setSttHealth('unhealthy');
    }
  };

  const handleTestStt = async () => {
    if (!sttTestFile) return;
    setSttTesting(true);
    setSttTestResult(null);
    try {
      const result = await api.stt.transcribe(sttTestFile, { language: 'zh' });
      setSttTestResult({ success: true, text: result.text, message: t("settings.sttTestSuccess") });
    } catch (error: unknown) {
      const err = error as Error;
      setSttTestResult({ success: false, message: err.message || t("settings.sttTestFailed") });
    } finally {
      setSttTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t("settings.voiceServiceTest")}
        </h2>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {t("settings.voiceServiceTestDesc")}
      </p>

      <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        {t("settings.voiceServiceHint")}
      </div>

      {/* TTS 测试区 */}
      <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {t("settings.ttsTest")}
            </h3>
          </div>
          <div className="flex items-center gap-2" aria-live="polite">
            {ttsHealth === 'healthy' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("settings.ttsHealthy")}
              </span>
            )}
            {ttsHealth === 'unhealthy' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <XCircle className="w-3.5 h-3.5" />
                {t("settings.ttsUnhealthy")}
              </span>
            )}
            {ttsHealth === 'checking' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("settings.checkHealth")}
              </span>
            )}
            {ttsHealth === 'idle' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                <Info className="w-3.5 h-3.5" />
                {t("settings.ttsIdle")}
              </span>
            )}
            <button
              onClick={checkTtsHealth}
              disabled={ttsHealth === 'checking'}
              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              {ttsHealth === 'checking' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t("settings.checkHealth")}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t("settings.selectVoice")}
            </label>
            <select
              value={ttsTestVoice}
              onChange={(e) => setTtsTestVoice(e.target.value)}
              disabled={ttsHealth !== 'healthy'}
              className="w-full rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:opacity-50"
            >
              {ttsVoices.length > 0 ? (
                ttsVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  {t("settings.noVoiceLoaded")}
                </option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t("settings.ttsTestText")}
            </label>
            <textarea
              value={ttsTestText}
              onChange={(e) => setTtsTestText(e.target.value)}
              disabled={ttsHealth !== 'healthy'}
              rows={3}
              className="w-full rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:opacity-50 resize-none"
              placeholder={t("settings.ttsTestTextPlaceholder")}
            />
          </div>

          <button
            onClick={handleTestTts}
            disabled={ttsTesting || !ttsTestText.trim() || ttsHealth !== 'healthy' || !ttsTestVoice}
            className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors min-h-[44px]"
          >
            {ttsTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("settings.synthesizing")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {t("settings.synthesize")}
              </>
            )}
          </button>

          {ttsTestResult && (
            <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
              ttsTestResult.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`} aria-live="polite">
              {ttsTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span className="break-all">{ttsTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* STT 测试区 */}
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {t("settings.sttTest")}
            </h3>
          </div>
          <div className="flex items-center gap-2" aria-live="polite">
            {sttHealth === 'healthy' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("settings.sttHealthy")}
              </span>
            )}
            {sttHealth === 'unhealthy' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <XCircle className="w-3.5 h-3.5" />
                {t("settings.sttUnhealthy")}
              </span>
            )}
            {sttHealth === 'checking' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("settings.checkHealth")}
              </span>
            )}
            {sttHealth === 'idle' && (
              <span role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                <Info className="w-3.5 h-3.5" />
                {t("settings.sttIdle")}
              </span>
            )}
            <button
              onClick={checkSttHealth}
              disabled={sttHealth === 'checking'}
              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              {sttHealth === 'checking' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t("settings.checkHealth")}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t("settings.selectAudioFile")}
            </label>
            <div className="flex items-center gap-3">
              <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors min-h-[44px] ${
                sttHealth !== 'healthy'
                  ? 'border-gray-200 dark:border-slate-500 opacity-50 cursor-not-allowed'
                  : 'border-gray-300 dark:border-slate-500 hover:border-primary-400 dark:hover:border-primary-500'
              }`}>
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {sttTestFile ? sttTestFile.name : t("settings.supportedFormats")}
                </span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,audio/webm,audio/mp4,audio/x-m4a,audio/m4a,audio/ogg"
                  className="hidden"
                  disabled={sttHealth !== 'healthy'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSttTestFile(file);
                  }}
                />
              </label>
              {sttTestFile && (
                <button
                  onClick={() => setSttTestFile(null)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleTestStt}
            disabled={sttTesting || !sttTestFile || sttHealth !== 'healthy'}
            className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors min-h-[44px]"
          >
            {sttTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("settings.transcribing")}
              </>
            ) : (
              <>
                <FileAudio className="w-4 h-4" />
                {t("settings.transcribe")}
              </>
            )}
          </button>

          {sttTestResult && (
            <div className={`p-3 rounded-lg text-sm ${
              sttTestResult.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`} aria-live="polite">
              <div className="flex items-start gap-2">
                {sttTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium mb-1">{sttTestResult.message}</p>
                  {sttTestResult.success && sttTestResult.text && (
                    <div className="mt-2">
                      <p className="text-xs opacity-80 mb-1">{t("settings.transcriptionResult")}:</p>
                      <p className="bg-white dark:bg-slate-800 p-2 rounded text-sm border border-gray-200 dark:border-slate-500 break-all">
                        {sttTestResult.text}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
