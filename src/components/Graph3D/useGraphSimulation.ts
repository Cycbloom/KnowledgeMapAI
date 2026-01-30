import { useEffect, useRef, useState, useMemo } from 'react';
import { Node, Edge } from '../../types/index';
import { SimNode, SimLink } from '../../config/graphConfig';

export const useGraphSimulation = (rawNodes: Node[], rawEdges: Edge[]) => {
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

    // Process nodes to add levels (Visual Logic)
    // We do this here to ensure nodesRef has the correct visual properties
    const nodeDegrees = new Map<string, number>();
    rawEdges.forEach(edge => {
      const sId = String(edge.source_node_id);
      const tId = String(edge.target_node_id);
      nodeDegrees.set(sId, (nodeDegrees.get(sId) || 0) + 1);
      nodeDegrees.set(tId, (nodeDegrees.get(tId) || 0) + 1);
    });

    const simNodes: SimNode[] = rawNodes.map(n => {
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
      return { ...n, id: nodeIdStr, level };
    });

    const simLinks: SimLink[] = rawEdges.map(e => ({
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
      payload: { nodes: simNodes, links: simLinks }
    });

  }, [rawNodes, rawEdges]);

  return {
    nodesRef,
    linksRef,
    nodesMapRef,
    simulationVersion,
    isLoading
  };
};
