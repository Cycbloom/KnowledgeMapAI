import { useState } from 'react';
import { BranchSuggestion, ExplorationPathItem } from '../../types';

export interface ExplorationState {
  isExplorationMode: boolean;
  setIsExplorationMode: React.Dispatch<React.SetStateAction<boolean>>;
  branchSuggestions: BranchSuggestion[];
  setBranchSuggestions: React.Dispatch<React.SetStateAction<BranchSuggestion[]>>;
  explorationPath: ExplorationPathItem[];
  setExplorationPath: React.Dispatch<React.SetStateAction<ExplorationPathItem[]>>;
  currentPathIndex: number;
  setCurrentPathIndex: React.Dispatch<React.SetStateAction<number>>;
  isTimelineVisible: boolean;
  setIsTimelineVisible: React.Dispatch<React.SetStateAction<boolean>>;
  historicalAlternativeBranches: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[];
  setHistoricalAlternativeBranches: React.Dispatch<React.SetStateAction<{ nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[]>>;
}

export const useExplorationState = (): ExplorationState => {
  const [isExplorationMode, setIsExplorationMode] = useState(false);
  const [branchSuggestions, setBranchSuggestions] = useState<BranchSuggestion[]>([]);
  const [explorationPath, setExplorationPath] = useState<ExplorationPathItem[]>([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(-1);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const [historicalAlternativeBranches, setHistoricalAlternativeBranches] = useState<{ nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[]>([]);

  return {
    isExplorationMode,
    setIsExplorationMode,
    branchSuggestions,
    setBranchSuggestions,
    explorationPath,
    setExplorationPath,
    currentPathIndex,
    setCurrentPathIndex,
    isTimelineVisible,
    setIsTimelineVisible,
    historicalAlternativeBranches,
    setHistoricalAlternativeBranches,
  };
};
