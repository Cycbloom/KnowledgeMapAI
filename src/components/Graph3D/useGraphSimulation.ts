import { useEffect, useRef, useState, useMemo } from 'react';
import { Node, Edge } from '../../types/index';
import { SimNode, SimLink } from '../../config/graphConfig';

export const useGraphSimulation = (
  rawNodes: Node[], 
  rawEdges: Edge[],
  collapsedNodeIds: Set<string> = new Set(),
  layoutMode: '3d-force' | '2d-tree' | '3d-sphere' = '3d-force'
) => {
  const workerRef = useRef<Worker | null>(null);
  
  // These refs hold the latest simulation state (positions)
  // They are updated directly by the worker without triggering re-renders
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const nodesMapRef = useRef<Map<string, SimNode>>(new Map());

  // Version counter to trigger re-renders only when topology changes (nodes/edges count or structure)
  const [simulationVersion, setSimulationVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/simulationWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, positions } = e.data;
      
      if (type === 'tick') {
        setIsLoading(false);
        
        const localNodes = nodesRef.current;
        if (!localNodes || localNodes.length === 0) return;

        // Ensure length match to avoid mismatch during hot-reload or race conditions
        // positions is a Float32Array [x, y, z, x, y, z, ...]
        if (positions && positions.length === localNodes.length * 3) {
           for (let i = 0; i < localNodes.length; i++) {
             localNodes[i].x = positions[i * 3];
             localNodes[i].y = positions[i * 3 + 1];
             localNodes[i].z = positions[i * 3 + 2];
             // Note: We don't update velocities (vx, vy, vz) as they are rarely used for rendering
             // and saving bandwidth is priority.
           }
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Process Data and Send to Worker
  useEffect(() => {
    if (!workerRef.current) return;

    // 1. Identify hidden nodes (descendants of collapsed nodes)
    const hiddenNodeIds = new Set<string>();
    
    // Build adjacency list for traversal (Source -> Targets)
    const adj = new Map<string, string[]>();
    rawEdges.forEach(e => {
      const s = String(e.source_node_id);
      const t = String(e.target_node_id);
      if (!adj.has(s)) adj.set(s, []);
      adj.get(s)?.push(t);
    });

    // Traverse from each collapsed node
    const stack = [...collapsedNodeIds];
    while (stack.length > 0) {
      const current = stack.pop()!;
      // Note: We don't hide the collapsed node itself, only its children
      // But if a node is hidden, its children should also be hidden
      
      const children = adj.get(current) || [];
      children.forEach(childId => {
        if (!hiddenNodeIds.has(childId)) {
          hiddenNodeIds.add(childId);
          stack.push(childId); // Continue traversal
        }
      });
    }

    // 2. Filter Nodes
    // We only keep nodes that are NOT hidden
    // Exception: If a node is in collapsedNodeIds, it is visible (it's the parent)
    const visibleNodes = rawNodes.filter(n => !hiddenNodeIds.has(String(n.id)));
    const visibleNodeIds = new Set(visibleNodes.map(n => String(n.id)));

    // 3. Process nodes to add levels (Visual Logic)
    // We do this here to ensure nodesRef has the correct visual properties
    const nodeDegrees = new Map<string, number>();
    rawEdges.forEach(edge => {
      const sId = String(edge.source_node_id);
      const tId = String(edge.target_node_id);
      // Only count degree if both ends are visible
      if (visibleNodeIds.has(sId) && visibleNodeIds.has(tId)) {
        nodeDegrees.set(sId, (nodeDegrees.get(sId) || 0) + 1);
        nodeDegrees.set(tId, (nodeDegrees.get(tId) || 0) + 1);
      }
    });

    const simNodes: SimNode[] = visibleNodes.map(n => {
      const nodeIdStr = String(n.id);
      let level: any = 'leaf';
      const degree = nodeDegrees.get(nodeIdStr) || 0;
      
      if (n.level) {
        level = n.level;
      } else if (n.properties?.level) {
         level = n.properties.level;
      } else {
         if (degree >= 10) level = 'root';
         else if (degree >= 6) level = 'core';
         else if (degree >= 4) level = 'sub';
         else if (degree >= 2) level = 'normal';
      }
      
      // Mark as collapsed for visual indicator
      const isCollapsed = collapsedNodeIds.has(nodeIdStr);
      
      // Try to preserve existing simulation data to avoid "empty frames" during re-render
      const existing = nodesMapRef.current.get(nodeIdStr);

      return { 
        ...n, 
        id: nodeIdStr, 
        level, 
        collapsed: isCollapsed,
        x: existing?.x,
        y: existing?.y,
        z: existing?.z,
        vx: existing?.vx,
        vy: existing?.vy,
        vz: existing?.vz
      };
    });

    // 4. Filter Links
    const simLinks: SimLink[] = rawEdges
      .filter(e => visibleNodeIds.has(String(e.source_node_id)) && visibleNodeIds.has(String(e.target_node_id)))
      .map(e => ({
        id: String(e.id),
        source: String(e.source_node_id),
        target: String(e.target_node_id)
      }));

    // Update Refs
    nodesRef.current = simNodes;
    linksRef.current = simLinks;
    
    // Rebuild Map
    nodesMapRef.current.clear();
    simNodes.forEach(n => nodesMapRef.current.set(n.id, n));

    // Notify components that topology changed
    setSimulationVersion(v => v + 1);

    // Send to worker
    setIsLoading(true);
    workerRef.current.postMessage({
      type: 'updateData',
      payload: {
        nodes: simNodes,
        links: simLinks,
        layoutMode // Pass layout mode
      }
    });

  }, [rawNodes, rawEdges, collapsedNodeIds, layoutMode]); // Re-run when these change

  return {
    nodesRef,
    linksRef,
    nodesMapRef,
    simulationVersion,
    isLoading
  };
};
