import type { Node, Edge, Graph } from '../../types';
import { GraphEditorState } from './index';
import { useTranslation } from 'react-i18next';
import { message } from "../../utils/messageHelper";
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
      message.success(t('graphEditor.export.jsonSuccess'));
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      message.error(t('graphEditor.export.exportFailed'));
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
      message.success(t('graphEditor.export.markdownSuccess'));
    } catch (err) {
      console.error(err);
      message.error(t('graphEditor.export.markdownFailed'));
    }
  };

  const handleExportAnki = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      message.info(t('graphEditor.export.ankiGenerating'));

      const cards = await api.study.getCards({ graph_id: id });

      if (!cards || cards.length === 0) {
        message.warning(t('graphEditor.export.noCards'));
        return;
      }

      const content = generateAnkiDeck(cards, graphMeta.title);
      downloadFile(content, `${graphMeta.title}_anki.txt`, 'text/plain');

      message.success(t('graphEditor.export.ankiSuccess'));
    } catch (err) {
      console.error(err);
      message.error(t('graphEditor.export.ankiFailed'));
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
            message.success(t('graphEditor.export.graphDeleted'));
            navigate('/dashboard');
          },
          onError: (err: unknown) => {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : t('graphEditor.export.deleteFailed');
            message.error(errorMessage);
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
        message.error(t('graphEditor.export.notSupported'));
        setIsExportImageModalOpen(false);
        return;
      }
      const dataUrl = await graphRef.current.captureScreenshot(exportImageOptions);
      if (!dataUrl) return;
      const safeTitle = (graphMeta?.title || 'graph').replace(/[^a-z0-9\u4e00-\u9fff]/gi, '_').toLowerCase();
      downloadImage(dataUrl, `${safeTitle}-graph.png`);
      setIsExportImageModalOpen(false);
      message.success(t('graphEditor.export.success'));
    } catch (error) {
      console.error('Export image failed:', error);
      message.error(t('graphEditor.export.failed'));
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
