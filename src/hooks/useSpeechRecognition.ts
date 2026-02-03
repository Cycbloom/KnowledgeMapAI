import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening || isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
      // Note: isListening will be set in onstart
    } catch (e: any) {
      console.error("Speech recognition start error:", e);
      if (e.name === 'InvalidStateError') {
        // Already started, just sync the state
        setIsListening(true);
      } else {
        setError('无法启动语音识别');
      }
      isStartingRef.current = false;
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && (isListening || isStartingRef.current)) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Speech recognition stop error:", e);
      }
      setIsListening(false);
      isStartingRef.current = false;
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    const handleStart = () => {
      setIsListening(true);
      isStartingRef.current = false;
    };

    const handleResult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    const handleEnd = () => {
      setIsListening(false);
      isStartingRef.current = false;
    };

    const handleError = (event: any) => {
      console.error('Speech recognition error:', event.error);
      isStartingRef.current = false;
      setIsListening(false);
      
      switch (event.error) {
        case 'not-allowed':
          setError('请允许麦克风权限以使用语音功能');
          break;
        case 'network':
          setError('网络连接错误：浏览器无法连接到语音识别服务。这通常是因为无法访问语音引擎的云端服务器（如 Google 服务）。请检查网络环境（如 VPN 或代理设置）后重试。');
          break;
        case 'no-speech':
          // Often triggered if no sound is detected, we can just ignore or reset
          break;
        case 'aborted':
          break;
        default:
          setError(`语音识别出错: ${event.error}`);
      }
    };

    recognition.onstart = handleStart;
    recognition.onresult = handleResult;
    recognition.onend = handleEnd;
    recognition.onerror = handleError;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport: !!recognitionRef.current
  };
};
