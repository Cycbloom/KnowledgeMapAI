import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useRealtimeSTT } from './useRealtimeSTT';

export type VoiceEngine = 'file' | 'realtime';

export interface UseVoiceDictationResult {
  /** 当前引擎 */
  engine: VoiceEngine;
  setEngine: (engine: VoiceEngine) => void;
  /** 正在录音（任一引擎） */
  isListening: boolean;
  /** 文件引擎：转写中 */
  isTranscribing: boolean;
  /** 实时引擎：连接中 */
  isConnecting: boolean;
  error: string | null;
  toggleListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  hasSupport: boolean;
}

/**
 * 语音听写 Hook（支持文件转写 / 实时识别双引擎）。
 * 将识别结果增量拼接到受控文本值，供测验作答等任意文本输入场景复用。
 *
 * @param value 当前输入框文本（受控值）
 * @param onValueChange 拼接结果的写回回调
 * @param lang 识别语言
 */
export const useVoiceDictation = (
  value: string,
  onValueChange: (next: string) => void,
  lang: string = 'zh',
): UseVoiceDictationResult => {
  const fileSTT = useSpeechRecognition(lang);
  const realtimeSTT = useRealtimeSTT();
  const [engine, setEngineState] = useState<VoiceEngine>('file');

  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  // ---- 文件引擎：识别完成后把新增片段拼接到文本 ----
  const prevTranscriptRef = useRef('');
  useEffect(() => {
    const transcript = fileSTT.transcript;
    if (!transcript || transcript === prevTranscriptRef.current) return;
    const newPart = transcript.slice(prevTranscriptRef.current.length);
    if (newPart.trim()) {
      const separator = valueRef.current.trim() ? ' ' : '';
      onValueChangeRef.current(valueRef.current + separator + newPart.trim());
    }
    prevTranscriptRef.current = transcript;
    fileSTT.resetTranscript();
  }, [fileSTT.transcript, fileSTT.resetTranscript]);

  useEffect(() => {
    if (!fileSTT.isListening) {
      prevTranscriptRef.current = '';
    }
  }, [fileSTT.isListening]);

  // ---- 实时引擎：base + final + interim 实时拼接到文本 ----
  const realtimeBaseRef = useRef('');
  const isRealtimeTrackingRef = useRef(false);
  useEffect(() => {
    if (!isRealtimeTrackingRef.current) return;
    const transcriptText = (
      realtimeSTT.finalTranscript +
      (realtimeSTT.interimTranscript ? ` ${realtimeSTT.interimTranscript}` : '')
    ).trim();
    const separator = realtimeBaseRef.current.trim() ? ' ' : '';
    onValueChangeRef.current(
      transcriptText
        ? realtimeBaseRef.current + separator + transcriptText
        : realtimeBaseRef.current,
    );
  }, [realtimeSTT.finalTranscript, realtimeSTT.interimTranscript]);

  const setEngine = useCallback(
    (next: VoiceEngine) => {
      if (next === engine) return;
      if (engine === 'realtime' && (realtimeSTT.isListening || realtimeSTT.isConnecting)) {
        isRealtimeTrackingRef.current = false;
        realtimeSTT.stopListening();
      }
      if (engine === 'file' && fileSTT.isListening) {
        void fileSTT.stopListening();
      }
      setEngineState(next);
    },
    [engine, realtimeSTT, fileSTT],
  );

  const toggleListening = useCallback(async () => {
    if (engine === 'realtime') {
      if (realtimeSTT.isListening) {
        isRealtimeTrackingRef.current = false;
        realtimeSTT.stopListening();
      } else if (!realtimeSTT.isConnecting) {
        realtimeBaseRef.current = valueRef.current;
        isRealtimeTrackingRef.current = true;
        await realtimeSTT.startListening(lang);
      }
    } else {
      if (fileSTT.isListening) {
        await fileSTT.stopListening();
      } else if (!fileSTT.isTranscribing) {
        await fileSTT.startListening();
      }
    }
  }, [engine, realtimeSTT, fileSTT, lang]);

  const stopListening = useCallback(async () => {
    if (engine === 'realtime') {
      isRealtimeTrackingRef.current = false;
      realtimeSTT.stopListening();
    } else {
      await fileSTT.stopListening();
    }
  }, [engine, realtimeSTT, fileSTT]);

  return {
    engine,
    setEngine,
    isListening:
      engine === 'realtime'
        ? realtimeSTT.isListening || realtimeSTT.isConnecting
        : fileSTT.isListening,
    isTranscribing: engine === 'file' ? fileSTT.isTranscribing : false,
    isConnecting: engine === 'realtime' ? realtimeSTT.isConnecting : false,
    error: engine === 'realtime' ? realtimeSTT.error : fileSTT.error,
    toggleListening,
    stopListening,
    hasSupport: fileSTT.hasRecognitionSupport,
  };
};
