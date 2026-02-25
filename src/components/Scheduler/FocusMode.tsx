import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Volume2, 
  VolumeX, 
  CloudRain, 
  Coffee, 
  Trees, 
  Waves, 
  Flame,
  Shield,
  Minimize2,
  Maximize2
} from 'lucide-react';

type WhiteNoiseType = 'rain' | 'cafe' | 'forest' | 'ocean' | 'fire' | 'none';

interface WhiteNoiseOption {
  id: WhiteNoiseType;
  label: string;
  icon: React.ReactNode;
  frequency?: number;
  noiseType?: OscillatorType;
}

const WHITE_NOISE_OPTIONS: WhiteNoiseOption[] = [
  { id: 'none', label: '关闭', icon: <VolumeX size={18} /> },
  { id: 'rain', label: '雨声', icon: <CloudRain size={18} />, frequency: 200, noiseType: 'sawtooth' },
  { id: 'cafe', label: '咖啡厅', icon: <Coffee size={18} />, frequency: 150, noiseType: 'triangle' },
  { id: 'forest', label: '森林', icon: <Trees size={18} />, frequency: 300, noiseType: 'sine' },
  { id: 'ocean', label: '海浪', icon: <Waves size={18} />, frequency: 100, noiseType: 'sine' },
  { id: 'fire', label: '篝火', icon: <Flame size={18} />, frequency: 80, noiseType: 'sawtooth' },
];

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  onFocusComplete?: () => void;
  children?: React.ReactNode;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  isOpen,
  onClose,
  taskTitle,
  onFocusComplete: _onFocusComplete,
  children,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNoise, setSelectedNoise] = useState<WhiteNoiseType>('none');
  const [volume, setVolume] = useState(0.5);
  const [showControls, setShowControls] = useState(true);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const createWhiteNoise = useCallback((context: AudioContext): AudioBufferSourceNode => {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }, []);

  const stopAudio = useCallback(() => {
    oscillatorsRef.current.forEach(osc => {
      try {
        osc.stop();
      } catch {
        // ignore errors on stop
      }
    });
    oscillatorsRef.current = [];
    
    if (noiseSourceRef.current) {
      try {
        noiseSourceRef.current.stop();
      } catch {
        // ignore errors on stop
      }
      noiseSourceRef.current = null;
    }
  }, []);

  const startAudio = useCallback((noiseType: WhiteNoiseType) => {
    if (noiseType === 'none') {
      stopAudio();
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    
    stopAudio();

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume * 0.3;
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    const option = WHITE_NOISE_OPTIONS.find(o => o.id === noiseType);
    if (!option) return;

    if (noiseType === 'rain' || noiseType === 'cafe' || noiseType === 'fire') {
      const noiseSource = createWhiteNoise(ctx);
      const filter = ctx.createBiquadFilter();
      
      if (noiseType === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
      } else if (noiseType === 'cafe') {
        filter.type = 'bandpass';
        filter.frequency.value = 500;
        filter.Q.value = 0.5;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 400;
      }
      
      noiseSource.connect(filter);
      filter.connect(gainNode);
      noiseSource.start();
      noiseSourceRef.current = noiseSource;
    } else if (noiseType === 'forest' || noiseType === 'ocean') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      
      osc1.type = option.noiseType || 'sine';
      osc1.frequency.value = option.frequency || 200;
      
      osc2.type = option.noiseType || 'sine';
      osc2.frequency.value = (option.frequency || 200) * 1.5;
      
      osc3.type = option.noiseType || 'sine';
      osc3.frequency.value = (option.frequency || 200) * 0.75;
      
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1;
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 10;
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      osc3.connect(gainNode);
      lfo.start();
      
      osc1.start();
      osc2.start();
      osc3.start();
      
      oscillatorsRef.current = [osc1, osc2, osc3, lfo];
    }
  }, [volume, createWhiteNoise, stopAudio]);

  useEffect(() => {
    if (isOpen && selectedNoise !== 'none') {
      startAudio(selectedNoise);
    }
    return () => {
      stopAudio();
    };
  }, [isOpen, selectedNoise, startAudio, stopAudio]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume * 0.3;
    }
  }, [volume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleNoiseSelect = (noise: WhiteNoiseType) => {
    setSelectedNoise(noise);
    if (noise !== 'none') {
      startAudio(noise);
    } else {
      stopAudio();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          onMouseMove={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <motion.div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.3) 0%, transparent 50%)`,
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                    <Shield size={16} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">专注模式已开启</span>
                  </div>
                  {taskTitle && (
                    <span className="text-slate-400 text-sm">| {taskTitle}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </motion.button>
                  <motion.button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={18} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 flex items-center justify-center">
            {children}
          </div>

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent"
              >
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-xs text-slate-400">白噪音</span>
                    <div className="flex items-center gap-1">
                      {WHITE_NOISE_OPTIONS.map((option) => (
                        <motion.button
                          key={option.id}
                          onClick={() => handleNoiseSelect(option.id)}
                          className={`p-2 rounded-lg transition-all ${
                            selectedNoise === option.id
                              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                              : 'bg-white/10 text-slate-400 hover:bg-white/20 border border-transparent'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          title={option.label}
                        >
                          {option.icon}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {selectedNoise !== 'none' && (
                    <div className="flex items-center justify-center gap-3">
                      <VolumeX size={16} className="text-slate-400" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-32 accent-cyan-500"
                      />
                      <Volume2 size={16} className="text-slate-400" />
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Shield size={12} />
                      <span>干扰屏蔽中</span>
                    </div>
                    <span>|</span>
                    <span>按 ESC 退出专注模式</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="absolute inset-0 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-4 rounded-full border border-cyan-500/5" />
            <div className="absolute inset-8 rounded-full border border-cyan-500/10" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
