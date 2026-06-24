import { useCallback } from 'react';
import type { Node, Edge } from '../../types';
import { getFocusedNodes, getFocusedLinks, getDirectChildren } from '../../lib/graphUtils';

interface UseFocusNodeProps {
  nodes: Node[];
  edges: Edge[];
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setFocusedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setFocusedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setFocusedLinkIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setForceShowTextIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface UseFocusNodeReturn {
  focusNode: (nodeId: string) => void;
  focusNodeWithNode: (node: Node) => void;
  clearFocus: () => void;
}

export const useFocusNode = ({
  nodes,
  edges,
  setSelectedNode,
  setSelectedNodeIds,
  setFocusedNodeId,
  setFocusedNodeIds,
  setFocusedLinkIds,
  setForceShowTextIds,
}: UseFocusNodeProps): UseFocusNodeReturn => {
  const focusNodeWithNode = useCallback(
    (node: Node) => {
      setSelectedNode(node);
      setSelectedNodeIds(new Set([node.id]));
      setFocusedNodeId(node.id);
      const focusedNodes = getFocusedNodes(node.id, nodes, edges);
      setFocusedNodeIds(focusedNodes);
      const focusedLinks = getFocusedLinks(focusedNodes, edges);
      setFocusedLinkIds(focusedLinks);
      const directChildren = getDirectChildren(node.id, nodes, edges);
      setForceShowTextIds(new Set([node.id, ...directChildren]));
    },
    [nodes, edges, setSelectedNode, setSelectedNodeIds, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, setForceShowTextIds],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      focusNodeWithNode(node);
    },
    [nodes, focusNodeWithNode],
  );

  const clearFocus = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
    setForceShowTextIds(new Set());
  }, [setSelectedNode, setSelectedNodeIds, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, setForceShowTextIds]);

  return { focusNode, focusNodeWithNode, clearFocus };
};
