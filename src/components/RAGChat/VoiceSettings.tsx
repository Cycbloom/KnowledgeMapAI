import React, { useState } from 'react';
import { Volume2, VolumeX, Loader2, X, Globe, Cpu, Play, Pause } from 'lucide-react';
import { useTextToSpeech } from "../../hooks";
import { TTSEngine } from '../../types';

interface VoiceSettingsProps {
  isDark: boolean;
  onClose: () => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ isDark, onClose }) => {
  const [ttsEngine, setTTSEngine] = useState<TTSEngine>('browser');
  const { 
    isSpeaking: _isSpeaking, 
    isPaused: _isPaused, 
    isLoading: _ttsLoading,
    error: ttsError, 
    voices, 
    selectedVoice, 
    speak: _speak, 
    pause: _pause, 
    resume: _resume, 
    cancel: _cancel, 
    setVoice,
    switchEngine,
    hasSupport 
  } = useTextToSpeech(ttsEngine);

  const handleVoiceChange = (voice: SpeechSynthesisVoice) => {
    if (ttsEngine === 'browser') {
      setVoice(voice);
    }
  };

  if (!hasSupport) return null;

  return (
    <div className={`px-4 py-3 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-primary-50 border-primary-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>语音设置</span>
        <button
          onClick={onClose}
          className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <X size={14} />
        </button>
      </div>
      
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>语音引擎：</span>
          <div className="flex gap-1">
            <button
              onClick={() => {
                switchEngine('browser');
                setTTSEngine('browser');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                ttsEngine === 'browser'
                  ? 'bg-primary-600 text-white'
                  : isDark 
                    ? 'bg-slate-700 text-primary-300 hover:bg-slate-600' 
                    : 'bg-white text-primary-600 hover:bg-primary-100'
              }`}
            >
              <Globe size={12} />
              <span>浏览器</span>
            </button>
            <button
              onClick={() => {
                switchEngine('qwen3');
                setTTSEngine('qwen3');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                ttsEngine === 'qwen3'
                  ? 'bg-primary-600 text-white'
                  : isDark 
                    ? 'bg-slate-700 text-primary-300 hover:bg-slate-600' 
                    : 'bg-white text-primary-600 hover:bg-primary-100'
              }`}
            >
              <Cpu size={12} />
              <span>Qwen3-TTS</span>
            </button>
          </div>
        </div>
      </div>
      
      {ttsEngine === 'browser' && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {(voices as SpeechSynthesisVoice[]).map((voice: SpeechSynthesisVoice, index: number) => (
            <button
              key={index}
              onClick={() => handleVoiceChange(voice)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-all ${
                typeof selectedVoice === 'object' && selectedVoice?.name === voice.name
                  ? 'bg-primary-600 text-white'
                  : isDark 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                    : 'bg-white text-primary-600 hover:bg-primary-100'
              }`}
            >
              <div className="font-medium">{voice.name}</div>
              <div className="opacity-75">{voice.lang}</div>
            </button>
          ))}
        </div>
      )}
      
      {ttsError && (
        <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
          {ttsError}
        </div>
      )}
    </div>
  );
};

interface VoiceControlProps {
  messageId: string;
  content: string;
  isDark: boolean;
  isStreaming?: boolean;
  currentSpeakingMessageId: string | null;
  isSpeaking: boolean;
  isPaused: boolean;
  ttsLoading: boolean;
  onPlay: (messageId: string, content: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  messageId,
  content,
  isDark,
  isStreaming: _isStreaming,
  currentSpeakingMessageId,
  isSpeaking,
  isPaused,
  ttsLoading,
  onPlay,
  onPause,
  onResume,
  onStop
}) => {
  const isCurrentMessage = currentSpeakingMessageId === messageId;
  
  const handlePlay = () => {
    if (isCurrentMessage && isSpeaking) {
      if (isPaused) {
        onResume();
      } else {
        onPause();
      }
    } else {
      onPlay(messageId, content);
    }
  };

  return (
    <div className="flex gap-1">
      <button
        onClick={handlePlay}
        disabled={ttsLoading}
        className={`p-1.5 rounded-lg transition-colors ${
          isCurrentMessage && isSpeaking
            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
            : isDark 
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } disabled:opacity-50`}
        title={isCurrentMessage && isSpeaking ? (isPaused ? '继续' : '暂停') : '朗读'}
      >
        {ttsLoading && isCurrentMessage ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isCurrentMessage && isSpeaking ? (
          isPaused ? <Play size={12} /> : <Pause size={12} />
        ) : (
          <Volume2 size={12} />
        )}
      </button>
      {isCurrentMessage && isSpeaking && (
        <button
          onClick={onStop}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark 
              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
          title="停止"
        >
          <VolumeX size={12} />
        </button>
      )}
    </div>
  );
};

export default VoiceSettings;
