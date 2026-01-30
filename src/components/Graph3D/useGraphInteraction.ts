import { useState, useEffect } from 'react';
import { SimNode, SimLink } from '../../config/graphConfig';
import * as THREE from 'three';

interface InteractionProps {
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  highlightedPath?: { nodes: Set<string>, links: Set<string> } | null;
  nodesRef: React.MutableRefObject<SimNode[]>;
  linksRef: React.MutableRefObject<SimLink[]>;
}

export const useGraphInteraction = ({
  selectedNodeId,
  selectedNodeIds,
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

    // 2. Multiple Selection
    if (selectedNodeIds && selectedNodeIds.size > 1) {
      setHighlightedNodes(new Set(selectedNodeIds));
      setHighlightedLinks(new Set());
      return;
    }

    // 3. Single Selection
    const activeId = selectedNodeId || (selectedNodeIds?.size === 1 ? Array.from(selectedNodeIds)[0] : null);

    if (!activeId) {
      setHighlightedNodes(new Set());
      setHighlightedLinks(new Set());
      return;
    }

    // 4. Spotlight logic: find neighbors
    const neighbors = new Set<string>();
    const connectedLinks = new Set<string>();
    neighbors.add(activeId);

    // We iterate over linksRef.current
    // Note: This runs in useEffect, so it uses the links at that moment.
    // If links change (topology), this might need to re-run.
    // However, usually selectedNodeId changes, or we might need to depend on simulationVersion if provided.
    
    linksRef.current.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

      if (sourceId === activeId) {
        neighbors.add(targetId);
        connectedLinks.add(link.id);
      } else if (targetId === activeId) {
        neighbors.add(sourceId);
        connectedLinks.add(link.id);
      }
    });

    setHighlightedNodes(neighbors);
    setHighlightedLinks(connectedLinks);

  }, [selectedNodeId, selectedNodeIds, highlightedPath, linksRef]); // We rely on linksRef reference stable

  return {
    highlightedNodes,
    highlightedLinks
  };
};
