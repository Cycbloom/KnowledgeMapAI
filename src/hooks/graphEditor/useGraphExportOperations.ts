import type { Node, Edge, Graph } from '../../types';
import { GraphEditorState } from './index';
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
      frontendEventBus.publish("message_show", { content: 'JSON 导出成功', type: 'success' });
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: '导出失败', type: 'error' });
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
      frontendEventBus.publish("message_show", { content: 'Markdown 导出成功', type: 'success' });
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: 'Markdown 导出失败', type: 'error' });
    }
  };

  const handleExportAnki = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      frontendEventBus.publish("message_show", { content: '正在生成 Anki 卡片...', type: 'info' });
      
      const cards = await api.study.getCards({ graph_id: id });
      
      if (!cards || cards.length === 0) {
        frontendEventBus.publish("message_show", { content: '当前图谱没有复习卡片', type: 'warning' });
        return;
      }

      const content = generateAnkiDeck(cards, graphMeta.title);
      downloadFile(content, `${graphMeta.title}_anki.txt`, 'text/plain');
      
      frontendEventBus.publish("message_show", { content: 'Anki 导出成功', type: 'success' });
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: 'Anki 导出失败', type: 'error' });
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
      title: '删除图谱',
      message: `确定要删除当前图谱 "${graphMeta.title}" 吗？此操作无法撤销。`,
      onConfirm: () => {
        setLoading(true);
        deleteGraphMutation.mutate(id, {
          onSuccess: () => {
            frontendEventBus.publish("message_show", { content: '图谱已删除', type: 'success' });
            navigate('/dashboard');
          },
          onError: (err: unknown) => {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : '删除失败';
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
        frontendEventBus.publish("message_show", { content: '当前视图不支持图片导出', type: 'error' });
        setIsExportImageModalOpen(false);
        return;
      }
      const dataUrl = await graphRef.current.captureScreenshot(exportImageOptions);
      downloadImage(dataUrl, `${graphMeta?.title || 'graph'}_snapshot.png`);
      setIsExportImageModalOpen(false);
      frontendEventBus.publish("message_show", { content: '图片导出成功', type: 'success' });
    } catch (error) {
      console.error('Export image failed:', error);
      frontendEventBus.publish("message_show", { content: '图片导出失败', type: 'error' });
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
