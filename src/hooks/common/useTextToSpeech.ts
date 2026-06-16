import { useState, useEffect, useCallback, useRef } from 'react';
import { TTSEngine } from '../../types';
import { api } from '../../services/api';

interface TextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

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

    const cleanText = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

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
      console.error('Speech synthesis error:', event);
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const browserTTS = useBrowserTTS();

  const switchEngine = useCallback((newEngine: TTSEngine) => {
    if (currentEngine !== newEngine) {
      if (currentEngine === 'browser') {
        window.speechSynthesis?.cancel();
      } else {
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

      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        setError('没有可朗读的文本');
        return;
      }

      setIsLoading(true);
      setIsSpeaking(true);
      setError(null);
      try {
        const blob = await api.tts.synthesize({
          text: cleanText,
          voice: typeof selectedVoice === 'string' && selectedVoice !== 'default' ? selectedVoice : 'Vivian',
          speed: options?.rate || 1.0,
          output_format: 'mp3'
        });

        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const audio = new Audio(url);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          setAudioUrl(null);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setError('音频播放失败');
          URL.revokeObjectURL(url);
          setAudioUrl(null);
        };

        await audio.play();
      } catch (err: unknown) {
        console.error('Qwen TTS error:', err);
        setIsSpeaking(false);
        setError(err instanceof Error ? err.message : '语音合成失败');
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentEngine, browserTTS, selectedVoice]);

  const pause = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.pause();
    }
  }, [currentEngine, browserTTS]);

  const resume = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.resume();
    }
  }, [currentEngine, browserTTS]);

  const cancel = useCallback(() => {
    if (currentEngine === 'browser') {
      browserTTS.cancel();
    } else {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
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
        const data = await api.tts.voices() as { voices: string[] };
        setVoices(data.voices || []);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '获取语音列表失败');
      }
    }
  }, [currentEngine, browserTTS]);

  useEffect(() => {
    if (currentEngine === 'browser') {
      setVoices(browserTTS.voices);
      setSelectedVoice(browserTTS.selectedVoice);
    }
  }, [currentEngine, browserTTS]);

  return {
    isSpeaking,
    isPaused,
    isLoading,
    error,
    voices,
    selectedVoice,
    audioUrl,
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
