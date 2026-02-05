import React, { useState, useRef, useMemo } from 'react';
import { Node, NodeLevel } from '../types';

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
  viewMode: 'outline' | 'mindmap';
  setViewMode: React.Dispatch<React.SetStateAction<'outline' | 'mindmap'>>;
  
  // Interaction Modes
  isPathfindingMode: boolean;
  setIsPathfindingMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDeleteMode: boolean;
  setIsDeleteMode: React.Dispatch<React.SetStateAction<boolean>>;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  
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

  // Layout & View
  const [showGrid, setShowGrid] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'outline' | 'mindmap'>('mindmap');

  // Interaction
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
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

  return {
    graphRef,
    selectedNode, setSelectedNode,
    selectedNodeIds, setSelectedNodeIds,
    selectionBox, setSelectionBox,
    sidebarMode, setSidebarMode,
    prevSidebarMode, setPrevSidebarMode,
    isMobileMenuOpen, setIsMobileMenuOpen,
    showGrid, setShowGrid,
    collapsedNodeIds, setCollapsedNodeIds,
    viewMode, setViewMode,
    isPathfindingMode, setIsPathfindingMode,
    isDeleteMode, setIsDeleteMode,
    isFocusMode, setIsFocusMode,
    pathStartNode, setPathStartNode,
    pathEndNode, setPathEndNode,
    highlightedPath, setHighlightedPath,
    nodeForm, setNodeForm,
    aiPrompt, setAiPrompt,
    isTextToGraphOpen, setIsTextToGraphOpen,
    isSettingsOpen, setIsSettingsOpen,
    isChatOpen, setIsChatOpen,
    isExportMenuOpen, setIsExportMenuOpen,
    isExportImageModalOpen, setIsExportImageModalOpen,
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
  };
};
