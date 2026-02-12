import React, { useState, useRef, useMemo } from 'react';
import { Node, NodeLevel, BranchSuggestion, ExplorationPathItem, TutorMode, ExtractedConcept, GraphViewMode } from '../types';

export interface GraphEditorState {
  // Graph Ref
  graphRef: React.RefObject<any>;
  
  // Selection
  selectedNode: Node | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionBox: { left: number; top: number; width: number; height: number } | null;
  setSelectionBox: React.Dispatch<React.SetStateAction<{ left: number; top: number; width: number; height: number } | null>>;
  
  // Sidebar & UI
  sidebarMode: 'none' | 'create' | 'edit' | 'outline' | 'detail';
  setSidebarMode: React.Dispatch<React.SetStateAction<'none' | 'create' | 'edit' | 'outline' | 'detail'>>;
  prevSidebarMode: 'none' | 'create' | 'edit' | 'outline' | 'detail';
  setPrevSidebarMode: React.Dispatch<React.SetStateAction<'none' | 'create' | 'edit' | 'outline' | 'detail'>>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Layout & View
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  collapsedNodeIds: Set<string>;
  setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewMode: GraphViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<GraphViewMode>>;
  
  // Interaction
  isPathfindingMode: boolean;
  setIsPathfindingMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDeleteMode: boolean;
  setIsDeleteMode: React.Dispatch<React.SetStateAction<boolean>>;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Exploration Mode
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
  
  // Node Focus Mode
  focusedNodeId: string | null;
  setFocusedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  focusedNodeIds: Set<string>;
  setFocusedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  focusedLinkIds: Set<string>;
  setFocusedLinkIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceShowTextIds: Set<string>;
  setForceShowTextIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Pathfinding State
  pathStartNode: Node | null;
  setPathStartNode: React.Dispatch<React.SetStateAction<Node | null>>;
  pathEndNode: Node | null;
  setPathEndNode: React.Dispatch<React.SetStateAction<Node | null>>;
  highlightedPath: { nodes: Set<string>, links: Set<string> } | null;
  setHighlightedPath: React.Dispatch<React.SetStateAction<{ nodes: Set<string>, links: Set<string> } | null>>;
  
  // Forms & Inputs
  nodeForm: {
    title: string;
    content: string;
    color: string;
    parentNodeId: string;
    level: NodeLevel;
  };
  setNodeForm: React.Dispatch<React.SetStateAction<{
    title: string;
    content: string;
    color: string;
    parentNodeId: string;
    level: NodeLevel;
  }>>;
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  
  // Modals Visibility
  isTextToGraphOpen: boolean;
  setIsTextToGraphOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPodcastModalOpen: boolean;
  setIsPodcastModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportImageModalOpen: boolean;
  setIsExportImageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportPDFOpen: boolean;
  setIsExportPDFOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isShareModalOpen: boolean;
  setIsShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isHelpOpen: boolean;
  setIsHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Export Options
  exportImageOptions: {
    transparent: boolean;
    fitView: boolean;
    hideGrid: boolean;
  };
  setExportImageOptions: React.Dispatch<React.SetStateAction<{
    transparent: boolean;
    fitView: boolean;
    hideGrid: boolean;
  }>>;

  // Confirmation Modal
  confirmModal: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  };
  setConfirmModal: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>>;

  // Related Nodes & Recommendations
  relatedNodes: any[];
  setRelatedNodes: React.Dispatch<React.SetStateAction<any[]>>;
  isRelatedLoading: boolean;
  setIsRelatedLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showRelatedSection: boolean;
  setShowRelatedSection: React.Dispatch<React.SetStateAction<boolean>>;
  recommendations: any[];
  setRecommendations: React.Dispatch<React.SetStateAction<any[]>>;
  isRecommending: boolean;
  setIsRecommending: React.Dispatch<React.SetStateAction<boolean>>;
  
  // General Loading
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Graph Analysis
  isAnalysisPanelOpen: boolean;
  setIsAnalysisPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Tutor Mode
  tutorMode: TutorMode;
  setTutorMode: React.Dispatch<React.SetStateAction<TutorMode>>;
  extractedConcepts: ExtractedConcept[];
  setExtractedConcepts: React.Dispatch<React.SetStateAction<ExtractedConcept[]>>;
  isTutorMode: boolean;
  setIsTutorMode: React.Dispatch<React.SetStateAction<boolean>>;
  suggestedNextTopics: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>;
  setSuggestedNextTopics: React.Dispatch<React.SetStateAction<Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>>>;

  // Presentation Mode
  isPresentationMode: boolean;
  setIsPresentationMode: React.Dispatch<React.SetStateAction<boolean>>;
  presentationStep: number;
  setPresentationStep: React.Dispatch<React.SetStateAction<number>>;

  // Sidebar Dimensions
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
}

export const useGraphEditorState = (): GraphEditorState => {
  const graphRef = useRef<any>(null);
  
  // Selection
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Sidebar & UI
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline' | 'detail'>('none');
  const [prevSidebarMode, setPrevSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline' | 'detail'>('none');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(340);

  // Layout & View
  const [showGrid, setShowGrid] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<GraphViewMode>('mindmap');

  // Interaction
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Exploration Mode
  const [isExplorationMode, setIsExplorationMode] = useState(false);
  const [branchSuggestions, setBranchSuggestions] = useState<BranchSuggestion[]>([]);
  const [explorationPath, setExplorationPath] = useState<ExplorationPathItem[]>([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(-1);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const [historicalAlternativeBranches, setHistoricalAlternativeBranches] = useState<{ nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }[]>([]);

  // Node Focus Mode
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedNodeIds, setFocusedNodeIds] = useState<Set<string>>(new Set());
  const [focusedLinkIds, setFocusedLinkIds] = useState<Set<string>>(new Set());
  const [forceShowTextIds, setForceShowTextIds] = useState<Set<string>>(new Set());

  // Pathfinding
  const [pathStartNode, setPathStartNode] = useState<Node | null>(null);
  const [pathEndNode, setPathEndNode] = useState<Node | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: Set<string>, links: Set<string> } | null>(null);

  // Forms
  const [nodeForm, setNodeForm] = useState<{
    title: string;
    content: string;
    color: string;
    parentNodeId: string;
    level: NodeLevel;
  }>({
    title: '',
    content: '',
    color: '#3B82F6',
    parentNodeId: '',
    level: 'leaf'
  });
  const [aiPrompt, setAiPrompt] = useState('');

  // Modals
  const [isTextToGraphOpen, setIsTextToGraphOpen] = useState(false);
  const [isPodcastModalOpen, setIsPodcastModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);

  // Presentation Mode
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [presentationStep, setPresentationStep] = useState(0);

  const [isExportPDFOpen, setIsExportPDFOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Export
  const [exportImageOptions, setExportImageOptions] = useState({
    transparent: false,
    fitView: true,
    hideGrid: true
  });

  // Confirm
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Related & Recs
  const [relatedNodes, setRelatedNodes] = useState<any[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [showRelatedSection, setShowRelatedSection] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);

  // Loading
  const [loading, setLoading] = useState(false);
  
  // Graph Analysis
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);

  // Tutor Mode
  const [tutorMode, setTutorMode] = useState<TutorMode>('free');
  const [extractedConcepts, setExtractedConcepts] = useState<ExtractedConcept[]>([]);
  const [isTutorMode, setIsTutorMode] = useState(false);
  const [suggestedNextTopics, setSuggestedNextTopics] = useState<Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>>([]);

  return {
    graphRef,
    selectedNode, setSelectedNode,
    selectedNodeIds, setSelectedNodeIds,
    selectionBox, setSelectionBox,
    sidebarMode, setSidebarMode,
    prevSidebarMode, setPrevSidebarMode,
    isMobileMenuOpen, setIsMobileMenuOpen,
    sidebarWidth, setSidebarWidth,
    showGrid, setShowGrid,
    collapsedNodeIds, setCollapsedNodeIds,
    viewMode, setViewMode,
    isPathfindingMode, setIsPathfindingMode,
    isDeleteMode, setIsDeleteMode,
    isFocusMode, setIsFocusMode,
    focusedNodeId, setFocusedNodeId,
    focusedNodeIds, setFocusedNodeIds,
    focusedLinkIds, setFocusedLinkIds,
    forceShowTextIds, setForceShowTextIds,
    pathStartNode, setPathStartNode,
    pathEndNode, setPathEndNode,
    highlightedPath, setHighlightedPath,
    nodeForm, setNodeForm,
    aiPrompt, setAiPrompt,
    isTextToGraphOpen,
    setIsTextToGraphOpen,
    isPodcastModalOpen,
    setIsPodcastModalOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isChatOpen, setIsChatOpen,
    isExportMenuOpen, setIsExportMenuOpen,
    isExportImageModalOpen, setIsExportImageModalOpen,
    
    // Presentation Mode
    isPresentationMode, setIsPresentationMode,
    presentationStep, setPresentationStep,

    isExportPDFOpen, setIsExportPDFOpen,
    isShareModalOpen, setIsShareModalOpen,
    isHelpOpen, setIsHelpOpen,
    exportImageOptions, setExportImageOptions,
    confirmModal, setConfirmModal,
    relatedNodes, setRelatedNodes,
    isRelatedLoading, setIsRelatedLoading,
    showRelatedSection, setShowRelatedSection,
    recommendations, setRecommendations,
    isRecommending, setIsRecommending,
    loading, setLoading,
    isAnalysisPanelOpen, setIsAnalysisPanelOpen,
    isExplorationMode, setIsExplorationMode,
    branchSuggestions, setBranchSuggestions,
    explorationPath, setExplorationPath,
    currentPathIndex, setCurrentPathIndex,
    isTimelineVisible, setIsTimelineVisible,
    historicalAlternativeBranches, setHistoricalAlternativeBranches,
    tutorMode, setTutorMode,
    extractedConcepts, setExtractedConcepts,
    isTutorMode, setIsTutorMode,
    suggestedNextTopics, setSuggestedNextTopics,
  };
};
