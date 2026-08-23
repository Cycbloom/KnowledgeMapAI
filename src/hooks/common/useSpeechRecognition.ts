import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

/**
 * 选择浏览器支持的音频 MIME 类型，优先使用压缩率与兼容性较好的格式。
 */
const getSupportedMimeType = (): string => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
};

const checkRecognitionSupport = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  return !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';
};

/**
 * 文件转写语音识别 Hook（qwen3-asr-flash）。
 *
 * 录音流程基于 MediaRecorder，停止录音后将音频文件上传至后端 `/api/ai/stt`
 * 进行文件转写，转写完成后通过 `transcript` 输出文本。
 */
export const useSpeechRecognition = (lang: string = 'zh') => {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasRecognitionSupport = checkRecognitionSupport();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const langRef = useRef(lang);
  const isStartingRef = useRef(false);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const cleanupMedia = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    if (isListening || isTranscribing || isStartingRef.current) return;
    if (!checkRecognitionSupport()) {
      setError(t('errors.speechRecognition.environmentNotSupported'));
      return;
    }

    isStartingRef.current = true;
    try {
      setError(null);
      setTranscript('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.speechRecognition.startFailed');
      setError(message);
      cleanupMedia();
    } finally {
      isStartingRef.current = false;
    }
  }, [isListening, isTranscribing, cleanupMedia, t]);

  const stopListening = useCallback(async (): Promise<void> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isListening) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setIsListening(false);
        cleanupMedia();

        const chunks = audioChunksRef.current;
        const mimeType = recorder.mimeType || 'audio/webm';
        audioChunksRef.current = [];

        if (chunks.length === 0) {
          resolve();
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size === 0) {
          resolve();
          return;
        }

        const ext = mimeType.includes('webm')
          ? 'webm'
          : mimeType.includes('ogg')
            ? 'ogg'
            : mimeType.includes('mp4')
              ? 'mp4'
              : 'wav';
        const file = new File(
          [audioBlob],
          `recording-${Date.now()}.${ext}`,
          { type: mimeType },
        );

        setIsTranscribing(true);
        try {
          const result = await api.stt.transcribe(file, {
            language: langRef.current,
          });
          setTranscript(result.text);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t('errors.speechRecognition.transcribeFailed');
          setError(message);
        } finally {
          setIsTranscribing(false);
          resolve();
        }
      };

      try {
        recorder.stop();
      } catch {
        setIsListening(false);
        cleanupMedia();
        resolve();
      }
    });
  }, [isListening, cleanupMedia, t]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    isListening,
    isTranscribing,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
  };
};
