import { useCallback, useEffect, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';

export interface UseVoiceDictationResult {
  isListening: boolean;
  isTranscribing: boolean;
  error: string | null;
  toggleListening: () => void;
  stopListening: () => Promise<void>;
  hasSupport: boolean;
}

/**
 * 语音听写 Hook。
 * 基于文件转写引擎（useSpeechRecognition），将识别结果增量拼接到受控文本值，
 * 供测验作答等任意文本输入场景复用。
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
  const {
    isListening,
    isTranscribing,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
  } = useSpeechRecognition(lang);

  const prevTranscriptRef = useRef('');

  // 转写结果到达时，将新增部分拼接到目标文本
  useEffect(() => {
    if (!transcript || transcript === prevTranscriptRef.current) return;
    const newPart = transcript.slice(prevTranscriptRef.current.length);
    if (newPart.trim()) {
      const separator = value.trim() ? ' ' : '';
      onValueChange(value + separator + newPart.trim());
    }
    prevTranscriptRef.current = transcript;
    resetTranscript();
  }, [transcript, value, onValueChange, resetTranscript]);

  // 每轮录音结束后重置增量基线
  useEffect(() => {
    if (!isListening) {
      prevTranscriptRef.current = '';
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      void stopListening();
    } else if (!isTranscribing) {
      void startListening();
    }
  }, [isListening, isTranscribing, stopListening, startListening]);

  return {
    isListening,
    isTranscribing,
    error,
    toggleListening,
    stopListening,
    hasSupport: hasRecognitionSupport,
  };
};
