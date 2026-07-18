import { useState, useEffect, useCallback, useRef } from 'react';
import { TTSEngine } from '../../types';
import { api } from '../../services/api';
import { cleanTextForSpeech } from '../../utils/textCleaning';
import type { TTSVoice } from '@shared/types';

interface TextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

const djb2Hash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return hash.toString(16);
};

interface CacheEntry {
  url: string;
  timestamp: number;
}

const sambertAudioCache = new Map<string, CacheEntry>();
const SAMBERT_CACHE_LIMIT = 10;

const getSambertCacheKey = (text: string, voice: string, speed: number): string => {
  return djb2Hash(`${text}|${voice}|${speed}`);
};

const getCachedSambertUrl = (key: string): string | null => {
  const entry = sambertAudioCache.get(key);
  if (entry) {
    entry.timestamp = Date.now();
    sambertAudioCache.delete(key);
    sambertAudioCache.set(key, entry);
    return entry.url;
  }
  return null;
};

const setCachedSambertUrl = (key: string, url: string): void => {
  if (sambertAudioCache.size >= SAMBERT_CACHE_LIMIT) {
    const oldestKey = sambertAudioCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = sambertAudioCache.get(oldestKey);
      if (oldest) {
        URL.revokeObjectURL(oldest.url);
      }
      sambertAudioCache.delete(oldestKey);
    }
  }
  sambertAudioCache.set(key, { url, timestamp: Date.now() });
};

const useBrowserTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        const chineseVoice = availableVoices.find(voice => 
          voice.lang.includes('zh') || voice.lang.includes('CN')
        );
        setSelectedVoice(chineseVoice || availableVoices[0] || null);
      };

      loadVoices();

      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const speak = useCallback((text: string, options: TextToSpeechOptions = {}) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('您的浏览器不支持语音合成功能');
      return;
    }

    if (!text || text.trim() === '') {
      setError('没有可朗读的文本');
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = cleanTextForSpeech(text);

    if (!cleanText) {
      setError('没有可朗读的文本');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;
    utterance.voice = options.voice ?? selectedVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setError(null);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.warn('Speech synthesis error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
      
      switch (event.error) {
        case 'not-allowed':
          setError('请允许语音权限以使用语音功能');
          break;
        case 'canceled':
          setError('语音播放已取消');
          break;
        case 'interrupted':
          setError('语音播放被中断');
          break;
        default:
          setError(`语音合成出错: ${event.error}`);
      }
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [selectedVoice]);

  const pause = useCallback(() => {
    if (window.speechSynthesis && isSpeaking) {
      window.speechSynthesis.pause();
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (window.speechSynthesis && isPaused) {
      window.speechSynthesis.resume();
    }
  }, [isPaused]);

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
  }, []);

  return {
    isSpeaking,
    isPaused,
    isLoading: false,
    error,
    voices,
    selectedVoice,
    speak,
    pause,
    resume,
    cancel,
    setVoice,
    hasSupport: typeof window !== 'undefined' && 'speechSynthesis' in window
  };
};

export const useTextToSpeech = (engine: TTSEngine = 'browser') => {
  const [currentEngine, setCurrentEngine] = useState<TTSEngine>(engine);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | TTSVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const browserTTS = useBrowserTTS();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const switchEngine = useCallback((newEngine: TTSEngine) => {
    if (currentEngine !== newEngine) {
      if (currentEngine === 'browser') {
        window.speechSynthesis?.cancel();
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
        }
      }
      setCurrentEngine(newEngine);
    }
  }, [currentEngine, audioUrl]);

  const speak = useCallback(async (text: string, options?: TextToSpeechOptions) => {
    if (currentEngine === 'browser') {
      browserTTS.speak(text, options);
    } else {
      if (!text || text.trim() === '') {
        setError('没有可朗读的文本');
        return;
      }

      const cleanText = cleanTextForSpeech(text);

      if (!cleanText) {
        setError('没有可朗读的文本');
        return;
      }

      setIsLoading(true);
      setIsSpeaking(true);
      setError(null);
      setProgress(0);

      const voiceName = typeof selectedVoice === 'string' && selectedVoice !== 'default' ? selectedVoice : 'sambert-zhide-v1';
      const speed = options?.rate || 1.0;
      const cacheKey = getSambertCacheKey(cleanText, voiceName, speed);

      try {
        const cachedUrl = getCachedSambertUrl(cacheKey);
        let url: string;
        if (cachedUrl) {
          url = cachedUrl;
        } else {
          const blob = await api.tts.synthesize({
            text: cleanText,
            voice: voiceName,
            speed,
            output_format: 'mp3'
          });
          url = URL.createObjectURL(blob);
          setCachedSambertUrl(cacheKey, url);
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }

        setAudioUrl(url);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setProgress(0);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setProgress(0);
          setError('音频播放失败');
          audioRef.current = null;
        };
        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            setProgress(Math.min(1, audio.currentTime / audio.duration));
          }
        };

        try {
          await audio.play();
        } catch (playErr) {
          if (playErr instanceof Error && playErr.name === 'AbortError') {
            // 预期行为：音频被快速替换/暂停时触发，忽略
            return;
          }
          throw playErr;
        }
      } catch (err: unknown) {
        console.warn('Sambert TTS error:', err);
        setIsSpeaking(false);
        setIsPaused(false);
        setProgress(0);
        setError(err instanceof Error ? err.message : '语音合成失败');
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentEngine, browserTTS, selectedVoice, audioUrl]);

  const pause = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.pause();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [currentEngine, browserTTS]);

  const resume = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.resume();
    } else {
      if (audioRef.current) {
        void audioRef.current.play();
        setIsPaused(false);
      }
    }
  }, [currentEngine, browserTTS]);

  const cancel = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.cancel();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
    setProgress(0);
  }, [currentEngine, browserTTS, audioUrl]);

  const setVoice = useCallback((voice: SpeechSynthesisVoice | string) => {
    if (currentEngine === 'browser') {
      browserTTS.setVoice(voice as SpeechSynthesisVoice);
    } else {
      setSelectedVoice(voice as string);
    }
  }, [currentEngine, browserTTS]);

  const loadVoices = useCallback(async () => {
    if (currentEngine === 'browser') {
      setVoices(browserTTS.voices);
    } else {
      try {
        const data = await api.tts.voices();
        setVoices(data);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '获取语音列表失败');
      }
    }
  }, [currentEngine, browserTTS]);

  // 浏览器引擎：音色异步加载后同步
  useEffect(() => {
    if (currentEngine === 'browser') {
      setVoices(browserTTS.voices);
      setSelectedVoice(browserTTS.selectedVoice);
    }
  }, [currentEngine, browserTTS.voices, browserTTS.selectedVoice]);

  // Sambert 引擎：切换时从 API 获取音色列表（只执行一次）
  useEffect(() => {
    if (currentEngine !== 'sambert') return;
    let cancelled = false;
    api.tts.voices().then((data) => {
      if (!cancelled) {
        setVoices(data);
        setSelectedVoice('sambert-zhide-v1');
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : '获取语音列表失败');
      }
    });
    return () => { cancelled = true; };
  }, [currentEngine]);

  // 仅在 audioUrl 变化时清理旧 URL（不暂停音频，避免新音频被误杀）
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // 组件卸载时清理音频和语音合成
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    isPaused,
    isLoading,
    error,
    voices,
    selectedVoice,
    audioUrl,
    progress,
    speak,
    pause,
    resume,
    cancel,
    setVoice,
    loadVoices,
    currentEngine,
    switchEngine,
    hasSupport: true
  };
};
