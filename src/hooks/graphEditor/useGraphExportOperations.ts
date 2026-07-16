import type { Node, Edge, Graph } from '../../types';
import { GraphEditorState } from './index';
import { useTranslation } from 'react-i18next';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { api } from '../../services/api';
import { generateJSON, downloadFile, downloadImage, generateAnkiDeck } from '../../utils/exportUtils';
import { UseMutationResult } from '@tanstack/react-query';

interface UseGraphExportOperationsProps {
  id: string;
  graphMeta: Graph | undefined;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: {
    deleteGraphMutation: UseMutationResult<void, Error, string, unknown>;
  };
  navigate: (path: string) => void;
}

export const useGraphExportOperations = ({
  id,
  graphMeta,
  nodes,
  edges,
  state,
  mutations,
  navigate
}: UseGraphExportOperationsProps) => {
  const { t } = useTranslation();
  const { 
    setConfirmModal,
    setLoading,
    graphRef,
    exportImageOptions,
    setIsExportMenuOpen,
    setIsExportPDFOpen,
    setIsExportImageModalOpen,
    setIsShareModalOpen
  } = state;
  const { deleteGraphMutation } = mutations;

  const handleExportJSON = async () => {
    if (!graphMeta) return;
    try {
      const json = generateJSON(graphMeta, nodes, edges);
      downloadFile(json, `${graphMeta.title}_backup.json`, 'application/json');
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.jsonSuccess'), type: 'success' });
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.exportFailed'), type: 'error' });
    }
  };

  const handleExportMarkdown = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      const blob = await api.data.export(id, 'markdown');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${graphMeta.title}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.markdownSuccess'), type: 'success' });
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.markdownFailed'), type: 'error' });
    }
  };

  const handleExportAnki = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.ankiGenerating'), type: 'info' });

      const cards = await api.study.getCards({ graph_id: id });

      if (!cards || cards.length === 0) {
        frontendEventBus.publish("message_show", { content: t('graphEditor.export.noCards'), type: 'warning' });
        return;
      }

      const content = generateAnkiDeck(cards, graphMeta.title);
      downloadFile(content, `${graphMeta.title}_anki.txt`, 'text/plain');

      frontendEventBus.publish("message_show", { content: t('graphEditor.export.ankiSuccess'), type: 'success' });
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.ankiFailed'), type: 'error' });
    }
  };

  const handleExportPDF = async () => {
    if (!id || !graphMeta) return;
    setIsExportMenuOpen(false);
    setIsExportPDFOpen(true);
  };

  const handleDeleteGraph = () => {
    if (!id || !graphMeta) return;
    
    setConfirmModal({
      isOpen: true,
      title: t('graphEditor.export.deleteGraphConfirm.title'),
      message: t('graphEditor.export.deleteGraphConfirm.message', { title: graphMeta.title }),
      onConfirm: () => {
        setLoading(true);
        deleteGraphMutation.mutate(id, {
          onSuccess: () => {
            frontendEventBus.publish("message_show", { content: t('graphEditor.export.graphDeleted'), type: 'success' });
            navigate('/dashboard');
          },
          onError: (err: unknown) => {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : t('graphEditor.export.deleteFailed');
            frontendEventBus.publish("message_show", { content: errorMessage, type: 'error' });
            setLoading(false);
            setConfirmModal({ ...state.confirmModal, isOpen: false });
          },
        });
      }
    });
  };

  const handleExportImage = () => {
    setIsExportMenuOpen(false);
    setIsExportImageModalOpen(true);
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const confirmExportImage = async () => {
    try {
      if (!graphRef.current?.captureScreenshot) {
        frontendEventBus.publish("message_show", { content: t('graphEditor.export.notSupported'), type: 'error' });
        setIsExportImageModalOpen(false);
        return;
      }
      const dataUrl = await graphRef.current.captureScreenshot(exportImageOptions);
      const safeTitle = (graphMeta?.title || 'graph').replace(/[^a-z0-9\u4e00-\u9fff]/gi, '_').toLowerCase();
      downloadImage(dataUrl, `${safeTitle}-graph.png`);
      setIsExportImageModalOpen(false);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.success'), type: 'success' });
    } catch (error) {
      console.error('Export image failed:', error);
      frontendEventBus.publish("message_show", { content: t('graphEditor.export.failed'), type: 'error' });
    }
  };

  return {
    handleExportJSON,
    handleExportMarkdown,
    handleExportAnki,
    handleExportPDF,
    handleDeleteGraph,
    handleExportImage,
    handleShare,
    confirmExportImage
  };
};
