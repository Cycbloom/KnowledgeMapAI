import { useCallback } from 'react';
import type { Node, Edge } from '../../types';
import { getFocusedNodes, getFocusedLinks, getDirectChildren } from '../../utils/graph/graphUtils';

interface UseGraphEditorHandlersOptions {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSidebarMode: (mode: string) => void;
  setFocusedNodeId: (id: string | null) => void;
  setFocusedNodeIds: (ids: Set<string>) => void;
  setFocusedLinkIds: (ids: Set<string>) => void;
  setForceShowTextIds: (ids: Set<string>) => void;
  setContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void;
  setIsDeleteMode: (mode: boolean) => void;
  setIsPathfindingMode: (mode: boolean) => void;
  setIsSelectingParent: (selecting: boolean) => void;
  isSelectingParent: boolean;
  handleSelectParentFromGraph: (nodeId: string) => void;
  nodeOps: {
    handleDeleteNode: (node: Node) => void;
  };
}

export const useGraphEditorHandlers = (options: UseGraphEditorHandlersOptions) => {
  const {
    nodes,
    edges,
    selectedNode,
    setSelectedNode,
    setSelectedNodeIds,
    setSidebarMode: _setSidebarMode,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    setForceShowTextIds,
    setContextMenu,
    setIsDeleteMode,
    setIsPathfindingMode,
    setIsSelectingParent,
    isSelectingParent,
    handleSelectParentFromGraph,
    nodeOps
  } = options;

  const handleNodeClick = useCallback((node: Node) => {
    if (isSelectingParent) {
      handleSelectParentFromGraph(node.id);
      return;
    }

    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setFocusedNodeId(node.id);
    
    const focusedNodes = getFocusedNodes(node.id, nodes, edges);
    const focusedLinks = getFocusedLinks(focusedNodes, edges);
    setFocusedNodeIds(focusedNodes);
    setFocusedLinkIds(focusedLinks);
    
    const directChildren = getDirectChildren(node.id, nodes, edges);
    setForceShowTextIds(new Set([node.id, ...directChildren]));
    
    setContextMenu(null);
    setIsDeleteMode(false);
    setIsPathfindingMode(false);
  }, [
    isSelectingParent, 
    handleSelectParentFromGraph, 
    setSelectedNode, 
    setSelectedNodeIds, 
    setFocusedNodeId, 
    nodes, 
    edges, 
    setFocusedNodeIds, 
    setFocusedLinkIds, 
    setForceShowTextIds, 
    setContextMenu, 
    setIsDeleteMode, 
    setIsPathfindingMode
  ]);

  const handleCanvasClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
    setForceShowTextIds(new Set());
    setContextMenu(null);
    setIsDeleteMode(false);
    setIsPathfindingMode(false);
    setIsSelectingParent(false);
  }, [
    setSelectedNode, 
    setSelectedNodeIds, 
    setFocusedNodeId, 
    setFocusedNodeIds, 
    setFocusedLinkIds, 
    setForceShowTextIds, 
    setContextMenu, 
    setIsDeleteMode, 
    setIsPathfindingMode, 
    setIsSelectingParent
  ]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setSelectedNodeIds(new Set([nodeId]));
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, [nodes, setSelectedNode, setSelectedNodeIds, setContextMenu]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isSelectingParent) {
        setIsSelectingParent(false);
      } else if (selectedNode) {
        setSelectedNode(null);
        setSelectedNodeIds(new Set());
        setFocusedNodeId(null);
        setFocusedNodeIds(new Set());
        setFocusedLinkIds(new Set());
      }
      setContextMenu(null);
      setIsDeleteMode(false);
      setIsPathfindingMode(false);
    }
    
    if (e.key === 'Delete' && selectedNode) {
      e.preventDefault();
      nodeOps.handleDeleteNode(selectedNode);
    }
  }, [
    isSelectingParent, 
    setIsSelectingParent, 
    selectedNode, 
    setSelectedNode, 
    setSelectedNodeIds, 
    setFocusedNodeId, 
    setFocusedNodeIds, 
    setFocusedLinkIds, 
    setContextMenu, 
    setIsDeleteMode, 
    setIsPathfindingMode, 
    nodeOps
  ]);

  return {
    handleNodeClick,
    handleCanvasClick,
    handleNodeContextMenu,
    handleKeyDown
  };
};
