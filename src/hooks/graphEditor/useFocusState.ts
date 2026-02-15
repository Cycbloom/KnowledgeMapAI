import { useState } from 'react';
import { Node } from '../../types';

export interface FocusState {
  focusedNodeId: string | null;
  setFocusedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  focusedNodeIds: Set<string>;
  setFocusedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  focusedLinkIds: Set<string>;
  setFocusedLinkIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceShowTextIds: Set<string>;
  setForceShowTextIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pathStartNode: Node | null;
  setPathStartNode: React.Dispatch<React.SetStateAction<Node | null>>;
  pathEndNode: Node | null;
  setPathEndNode: React.Dispatch<React.SetStateAction<Node | null>>;
  highlightedPath: { nodes: Set<string>; links: Set<string> } | null;
  setHighlightedPath: React.Dispatch<React.SetStateAction<{ nodes: Set<string>; links: Set<string> } | null>>;
}

export const useFocusState = (): FocusState => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedNodeIds, setFocusedNodeIds] = useState<Set<string>>(new Set());
  const [focusedLinkIds, setFocusedLinkIds] = useState<Set<string>>(new Set());
  const [forceShowTextIds, setForceShowTextIds] = useState<Set<string>>(new Set());
  const [pathStartNode, setPathStartNode] = useState<Node | null>(null);
  const [pathEndNode, setPathEndNode] = useState<Node | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: Set<string>; links: Set<string> } | null>(null);

  return {
    focusedNodeId,
    setFocusedNodeId,
    focusedNodeIds,
    setFocusedNodeIds,
    focusedLinkIds,
    setFocusedLinkIds,
    forceShowTextIds,
    setForceShowTextIds,
    pathStartNode,
    setPathStartNode,
    pathEndNode,
    setPathEndNode,
    highlightedPath,
    setHighlightedPath,
  };
};
