import { useState } from 'react';

export interface RelatedNode {
  id: string;
  title: string;
  content?: string;
  graph_id: string;
  graph_title?: string;
  similarity?: number;
  knowledge_point_id?: string;
}

interface Recommendation {
  id: string;
  title: string;
  reason?: string;
  confidence?: number;
}

export interface MiscState {
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
  relatedNodes: RelatedNode[];
  setRelatedNodes: React.Dispatch<React.SetStateAction<RelatedNode[]>>;
  isRelatedLoading: boolean;
  setIsRelatedLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showRelatedSection: boolean;
  setShowRelatedSection: React.Dispatch<React.SetStateAction<boolean>>;
  recommendations: Recommendation[];
  setRecommendations: React.Dispatch<React.SetStateAction<Recommendation[]>>;
  isRecommending: boolean;
  setIsRecommending: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useMiscState = (): MiscState => {
  const [exportImageOptions, setExportImageOptions] = useState({
    transparent: false,
    fitView: true,
    hideGrid: true
  });

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

  const [relatedNodes, setRelatedNodes] = useState<RelatedNode[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [showRelatedSection, setShowRelatedSection] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [loading, setLoading] = useState(false);

  return {
    exportImageOptions,
    setExportImageOptions,
    confirmModal,
    setConfirmModal,
    relatedNodes,
    setRelatedNodes,
    isRelatedLoading,
    setIsRelatedLoading,
    showRelatedSection,
    setShowRelatedSection,
    recommendations,
    setRecommendations,
    isRecommending,
    setIsRecommending,
    loading,
    setLoading,
  };
};
