import { Node, Edge, NodeStatus } from '../../types';
import { GraphEditorState } from './index';
import { message } from "../../utils/messageHelper";
import { findShortestPath } from '../../utils/graph/graphUtils';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

interface UseGraphInteractionProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, NodeStatus> | undefined;
  state: GraphEditorState;
  handleDeleteNode: (node: Node) => void;
}

export const useGraphInteraction = ({
  nodes,
  edges,
  nodeStatus,
  state,
  handleDeleteNode
}: UseGraphInteractionProps) => {
  const { t } = useTranslation();
  const {
    isDeleteMode,
    isPathfindingMode,
    pathStartNode, setPathStartNode,
    pathEndNode, setPathEndNode,
    setHighlightedPath,
    setSelectedNode,
    setSelectedNodeIds,
    setPrevSidebarMode,
    setSidebarMode,
    sidebarMode
  } = state;

  const handleNodeClick = useCallback((node: Node) => {
    if (isDeleteMode) {
      handleDeleteNode(node);
      return;
    }

    if (nodeStatus && nodeStatus[node.id]?.locked) {
      message.warning(`${t('graphEditor.interaction.nodeLocked')}${t('graphEditor.interaction.nodeLockedHint')}`);
      return;
    }

    if (isPathfindingMode) {
      if (!pathStartNode) {
        setPathStartNode(node);
        message.info(t('graphEditor.interaction.selectEndNode'));
      } else if (!pathEndNode) {
        setPathEndNode(node);
        const path = findShortestPath(nodes, edges, pathStartNode.id, node.id);
        if (path.nodes.size > 0) {
          setHighlightedPath(path);
          message.success(t('graphEditor.interaction.pathFound', { count: path.nodes.size - 1 }));
        } else {
          message.error(t('graphEditor.interaction.pathNotFound'));
        }
      } else {
        setPathStartNode(node);
        setPathEndNode(null);
        setHighlightedPath(null);
      }
      return;
    }

    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('detail');
    
    if (state.graphRef.current?.centerNode) {
      state.graphRef.current.centerNode(node.id, { forceRightPanelOpen: true });
    }
  }, [
    isDeleteMode,
    handleDeleteNode,
    nodeStatus,
    isPathfindingMode,
    pathStartNode,
    setPathStartNode,
    pathEndNode,
    setPathEndNode,
    nodes,
    edges,
    setHighlightedPath,
    setSelectedNode,
    setSelectedNodeIds,
    setPrevSidebarMode,
    setSidebarMode,
    sidebarMode,
    state.graphRef,
    t,
  ]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    const newSet = new Set(ids);
    setSelectedNodeIds(newSet);
    
    if (newSet.size === 1) {
      const node = nodes.find(n => n.id === ids[0]);
      if (node) {
        setSelectedNode(node);
        setPrevSidebarMode(sidebarMode);
        setSidebarMode('edit');
      }
    } else if (newSet.size > 1) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
    
    if (newSet.size === 0) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
  }, [
    setSelectedNodeIds,
    nodes,
    setSelectedNode,
    setPrevSidebarMode,
    setSidebarMode,
    sidebarMode,
  ]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setSidebarMode('none');
  }, [setSelectedNode, setSelectedNodeIds, setSidebarMode]);

  return {
    handleNodeClick,
    handleSelectionChange,
    handleBackgroundClick
  };
};
