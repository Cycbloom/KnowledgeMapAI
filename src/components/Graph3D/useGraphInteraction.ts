import { useState, useEffect } from 'react';
import { SimNode, SimLink } from '../../config/graphConfig';
import * as THREE from 'three';

interface InteractionProps {
  selectedNodeId?: string | null;
  highlightedPath?: { nodes: Set<string>, links: Set<string> } | null;
  nodesRef: React.MutableRefObject<SimNode[]>;
  linksRef: React.MutableRefObject<SimLink[]>;
}

export const useGraphInteraction = ({
  selectedNodeId,
  highlightedPath,
  nodesRef,
  linksRef
}: InteractionProps) => {
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedLinks, setHighlightedLinks] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 1. If external highlighted path is provided, use it
    if (highlightedPath) {
      setHighlightedNodes(highlightedPath.nodes);
      setHighlightedLinks(highlightedPath.links);
      return;
    }

    // 2. If nothing selected, clear
    if (!selectedNodeId) {
      setHighlightedNodes(new Set());
      setHighlightedLinks(new Set());
      return;
    }

    // 3. Spotlight logic: find neighbors
    const neighbors = new Set<string>();
    const connectedLinks = new Set<string>();
    neighbors.add(selectedNodeId);

    // We iterate over linksRef.current
    // Note: This runs in useEffect, so it uses the links at that moment.
    // If links change (topology), this might need to re-run.
    // However, usually selectedNodeId changes, or we might need to depend on simulationVersion if provided.
    
    linksRef.current.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

      if (sourceId === selectedNodeId) {
        neighbors.add(targetId);
        connectedLinks.add(link.id);
      } else if (targetId === selectedNodeId) {
        neighbors.add(sourceId);
        connectedLinks.add(link.id);
      }
    });

    setHighlightedNodes(neighbors);
    setHighlightedLinks(connectedLinks);

  }, [selectedNodeId, highlightedPath, linksRef]); // We rely on linksRef reference stable

  return {
    highlightedNodes,
    highlightedLinks
  };
};
