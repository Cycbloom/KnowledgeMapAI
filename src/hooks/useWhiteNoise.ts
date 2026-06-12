import { useCallback, useEffect, useRef, useState } from 'react';
import { useNoiseStore, WhiteNoiseType, MixedNoise, NoisePreset } from '../store/useNoiseStore';
import { NoiseMixer, BUILT_IN_PRESETS, NoisePreset as AudioNoisePreset } from '../utils/audioSynthesis';

interface UseWhiteNoiseReturn {
  isPlaying: boolean;
  mixedNoises: MixedNoise[];
  activePresetId: string | null;
  customPresets: NoisePreset[];
  allPresets: NoisePreset[];
  analyserData: Uint8Array | null;

  startMixer: () => void;
  stopMixer: () => void;
  addNoise: (type: WhiteNoiseType, volume?: number) => void;
  removeNoise: (type: WhiteNoiseType) => void;
  setNoiseVolume: (type: WhiteNoiseType, volume: number) => void;
  clearAllNoises: () => void;
  loadPreset: (preset: NoisePreset) => void;
  saveCurrentAsPreset: (name: string) => void;
  deletePreset: (id: string) => void;
}

function convertPreset(preset: AudioNoisePreset): NoisePreset {
  return {
    id: preset.id,
    name: preset.name,
    noises: preset.noises.map(n => ({
      type: n.type as WhiteNoiseType,
      volume: n.volume,
    })),
    isBuiltIn: preset.isBuiltIn,
  };
}

export function useWhiteNoise(): UseWhiteNoiseReturn {
  const {
    mixedNoises,
    customPresets,
    activePresetId,
    addMixedNoise,
    removeMixedNoise,
    updateMixedNoiseVolume,
    clearMixedNoises,
    saveCustomPreset,
    deleteCustomPreset,
    loadPreset: storeLoadPreset,
  } = useNoiseStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mixerRef = useRef<NoiseMixer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const updateAnalyserDataRef = useRef<() => void>();

  const allPresets = [...BUILT_IN_PRESETS.map(convertPreset), ...customPresets];

  const getAudioContext = useCallback((): AudioContext | null => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
      return audioContextRef.current;
    } catch (e) {
      console.error('Failed to create AudioContext:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    updateAnalyserDataRef.current = () => {
      if (!mixerRef.current) return;

      const analyser = mixerRef.current.getAnalyser();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      setAnalyserData(dataArray);

      animationFrameRef.current = requestAnimationFrame(() => updateAnalyserDataRef.current?.());
    };
  }, []);

  const startAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    updateAnalyserDataRef.current?.();
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAnalyserData(null);
  }, []);

  const startMixer = useCallback(() => {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
      context.resume();
    }

    if (!mixerRef.current) {
      mixerRef.current = new NoiseMixer(context);
    }

    const currentMixedNoises = useNoiseStore.getState().mixedNoises;
    currentMixedNoises.forEach((noise) => {
      if (noise.type !== 'none') {
        mixerRef.current?.addTrack(noise.type, noise.volume);
      }
    });

    setIsPlaying(true);
    startAnalyser();
  }, [getAudioContext, startAnalyser]);

  const stopMixer = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAll();
    }
    setIsPlaying(false);
    stopAnalyser();
  }, [stopAnalyser]);

  const addNoise = useCallback((type: WhiteNoiseType, volume: number = 0.5) => {
    if (type === 'none') return;

    addMixedNoise({ type, volume });

    if (isPlaying && mixerRef.current) {
      mixerRef.current.addTrack(type, volume);
    }
  }, [addMixedNoise, isPlaying]);

  const removeNoise = useCallback((type: WhiteNoiseType) => {
    if (type === 'none') return;

    removeMixedNoise(type);

    if (mixerRef.current) {
      mixerRef.current.removeTrack(type);
    }
  }, [removeMixedNoise]);

  const setNoiseVolume = useCallback((type: WhiteNoiseType, volume: number) => {
    if (type === 'none') return;

    updateMixedNoiseVolume(type, volume);

    if (mixerRef.current) {
      mixerRef.current.setTrackVolume(type, volume);
    }
  }, [updateMixedNoiseVolume]);

  const clearAllNoises = useCallback(() => {
    clearMixedNoises();

    if (mixerRef.current) {
      mixerRef.current.stopAll();
    }
  }, [clearMixedNoises]);

  const loadPreset = useCallback((preset: NoisePreset) => {
    if (mixerRef.current) {
      mixerRef.current.stopAll();
    }

    storeLoadPreset(preset);

    if (isPlaying && mixerRef.current) {
      preset.noises.forEach((noise) => {
        if (noise.type !== 'none') {
          mixerRef.current?.addTrack(noise.type, noise.volume);
        }
      });
    }
  }, [storeLoadPreset, isPlaying]);

  const saveCurrentAsPreset = useCallback((name: string) => {
    saveCustomPreset(name);
  }, [saveCustomPreset]);

  const deletePreset = useCallback((id: string) => {
    deleteCustomPreset(id);
  }, [deleteCustomPreset]);

  useEffect(() => {
    return () => {
      stopAnalyser();

      if (mixerRef.current) {
        mixerRef.current.stopAll();
        mixerRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopAnalyser]);

  useEffect(() => {
    if (!isPlaying || !mixerRef.current) return;

    const currentTracks = mixerRef.current.getActiveTracks();
    const storeNoises = mixedNoises.filter(n => n.type !== 'none');

    currentTracks.forEach((trackType) => {
      const existsInStore = storeNoises.some(n => n.type === trackType);
      if (!existsInStore) {
        mixerRef.current?.removeTrack(trackType);
      }
    });
  }, [mixedNoises, isPlaying]);

  return {
    isPlaying,
    mixedNoises,
    activePresetId,
    customPresets,
    allPresets,
    analyserData,

    startMixer,
    stopMixer,
    addNoise,
    removeNoise,
    setNoiseVolume,
    clearAllNoises,
    loadPreset,
    saveCurrentAsPreset,
    deletePreset,
  };
}
