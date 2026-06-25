import { useState, useEffect, useCallback, useRef } from 'react';
import type { STTEngine, STTResult } from '@shared/types';
import { api } from '../../services/api';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const checkSpeechRecognitionSupport = (): boolean => {
  if (typeof window !== 'undefined') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  }
  return false;
};

export const useSpeechRecognition = (engine: STTEngine = 'browser', lang: string = 'zh-CN') => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasRecognitionSupport = checkSpeechRecognitionSupport();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognitionRef.current = recognition;
      }
    }
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening || isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      setTranscript('');
      setError(null);

      const recognition = recognitionRef.current;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart;
          } else {
            interimTranscript += transcriptPart;
          }
        }

        setTranscript(prev => prev + finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        let message = event.error;
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            message = '请允许麦克风权限以使用语音识别';
            break;
          case 'no-speech':
            message = '未检测到语音输入';
            break;
          case 'network':
            message = '网络错误，请检查网络连接';
            break;
          case 'aborted':
            message = '语音识别已中止';
            break;
        }
        setError(message);
        setIsListening(false);
        isStartingRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        isStartingRef.current = false;
      };

      recognition.onstart = () => {
        setIsListening(true);
        isStartingRef.current = false;
      };

      recognition.start();
    } catch (_e) {
      setError('启动语音识别失败');
      isStartingRef.current = false;
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  const transcribeFile = useCallback(async (file: File, options?: { language?: string }): Promise<STTResult> => {
    try {
      const result = await api.stt.transcribe(file, { language: options?.language || lang });
      setTranscript(result.text);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '语音转文字失败';
      setError(message);
      throw err;
    }
  }, [lang]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
    transcribeFile,
    lang,
    engine,
  };
};
