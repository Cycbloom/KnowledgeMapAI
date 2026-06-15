import { useState, useCallback, useRef, useEffect } from 'react';

export type NarrativeStrategy = 'dfs' | 'learningPath';
export type PlaySpeed = 0.5 | 1 | 2;

export interface NarrativeState {
  isNarrativeMode: boolean;
  setIsNarrativeMode: React.Dispatch<React.SetStateAction<boolean>>;
  narrativeStrategy: NarrativeStrategy;
  setNarrativeStrategy: React.Dispatch<React.SetStateAction<NarrativeStrategy>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playSpeed: PlaySpeed;
  setPlaySpeed: React.Dispatch<React.SetStateAction<PlaySpeed>>;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  totalSteps: number;
  setTotalSteps: React.Dispatch<React.SetStateAction<number>>;
  revealedNodeIds: Set<string>;
  setRevealedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  narrativePath: string[];
  setNarrativePath: React.Dispatch<React.SetStateAction<string[]>>;
  savedTransform: { x: number; y: number; k: number } | null;
  setSavedTransform: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number } | null>>;
  isNarrativeComplete: boolean;
  startNarrative: (path: string[], strategy: NarrativeStrategy, currentTransform: { x: number; y: number; k: number }) => void;
  exitNarrative: () => void;
  playNext: () => void;
  playPrev: () => void;
  reset: () => void;
  togglePlay: () => void;
}

export const useNarrativeState = (): NarrativeState => {
  const [isNarrativeMode, setIsNarrativeMode] = useState(false);
  const [narrativeStrategy, setNarrativeStrategy] = useState<NarrativeStrategy>('learningPath');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [revealedNodeIds, setRevealedNodeIds] = useState<Set<string>>(new Set());
  const [narrativePath, setNarrativePath] = useState<string[]>([]);
  const [savedTransform, setSavedTransform] = useState<{ x: number; y: number; k: number } | null>(null);
  const [isNarrativeComplete, setIsNarrativeComplete] = useState(false);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync for use inside callbacks
  const totalStepsRef = useRef(totalSteps);
  const narrativePathRef = useRef(narrativePath);

  useEffect(() => {
    totalStepsRef.current = totalSteps;
  }, [totalSteps]);

  useEffect(() => {
    narrativePathRef.current = narrativePath;
  }, [narrativePath]);

  const startNarrative = useCallback((
    path: string[],
    strategy: NarrativeStrategy,
    currentTransform: { x: number; y: number; k: number }
  ) => {
    if (path.length === 0) return;

    setSavedTransform(currentTransform);
    setNarrativePath(path);
    setNarrativeStrategy(strategy);
    setTotalSteps(path.length);
    setCurrentStep(1);
    setRevealedNodeIds(new Set([path[0]]));
    setIsNarrativeMode(true);
    setIsPlaying(false);
    setIsNarrativeComplete(false);
  }, []);

  const exitNarrative = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsNarrativeMode(false);
    setIsPlaying(false);
    setCurrentStep(0);
    setRevealedNodeIds(new Set());
    setNarrativePath([]);
    setTotalSteps(0);
    setIsNarrativeComplete(false);
  }, []);

  const playNext = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next > totalStepsRef.current) {
        setIsPlaying(false);
        setIsNarrativeComplete(true);
        return prev;
      }
      setRevealedNodeIds(prevIds => {
        const newIds = new Set(prevIds);
        const nodeId = narrativePathRef.current[next - 1];
        if (nodeId) {
          newIds.add(nodeId);
        }
        return newIds;
      });
      return next;
    });
  }, []);

  const playPrev = useCallback(() => {
    setCurrentStep(prev => {
      if (prev <= 1) return 1;
      const newStep = prev - 1;
      setRevealedNodeIds(() => {
        const newIds = new Set<string>();
        for (let i = 0; i < newStep; i++) {
          const nodeId = narrativePathRef.current[i];
          if (nodeId) {
            newIds.add(nodeId);
          }
        }
        return newIds;
      });
      setIsNarrativeComplete(false);
      return newStep;
    });
  }, []);

  const reset = useCallback(() => {
    if (narrativePathRef.current.length === 0) return;
    setCurrentStep(1);
    setRevealedNodeIds(new Set([narrativePathRef.current[0]]));
    setIsNarrativeComplete(false);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying && isNarrativeMode && !isNarrativeComplete) {
      const intervalMs = 2000 / playSpeed;
      playIntervalRef.current = setInterval(() => {
        playNext();
      }, intervalMs);
      return () => {
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
        }
      };
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
  }, [isPlaying, isNarrativeMode, isNarrativeComplete, playSpeed, playNext]);

  return {
    isNarrativeMode,
    setIsNarrativeMode,
    narrativeStrategy,
    setNarrativeStrategy,
    isPlaying,
    setIsPlaying,
    playSpeed,
    setPlaySpeed,
    currentStep,
    setCurrentStep,
    totalSteps,
    setTotalSteps,
    revealedNodeIds,
    setRevealedNodeIds,
    narrativePath,
    setNarrativePath,
    savedTransform,
    setSavedTransform,
    isNarrativeComplete,
    startNarrative,
    exitNarrative,
    playNext,
    playPrev,
    reset,
    togglePlay,
  };
};
