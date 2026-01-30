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

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/simulationWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, nodes: updatedNodes } = e.data;
      
      if (type === 'tick') {
        // Update local node positions IN PLACE
        // We assume the order and count of updatedNodes matches nodesRef.current
        // or we match by ID if necessary. For performance, array index matching is preferred 
        // if we guarantee order. The worker usually returns the same array order.
        
        // However, to be safe and robust against potential worker logic changes:
        if (nodesRef.current.length === 0 && updatedNodes.length > 0) {
           // Initial population if empty
           nodesRef.current = updatedNodes;
           // Update map
           nodesMapRef.current.clear();
           updatedNodes.forEach((n: SimNode) => nodesMapRef.current.set(n.id, n));
           setSimulationVersion(v => v + 1);
        } else {
           // In-place update
           const localNodes = nodesRef.current;
           const map = nodesMapRef.current;
           
           updatedNodes.forEach((n: any) => {
             const localNode = map.get(n.id);
             if (localNode) {
               localNode.x = n.x;
               localNode.y = n.y;
               localNode.z = n.z;
               localNode.vx = n.vx;
               localNode.vy = n.vy;
               localNode.vz = n.vz;
             }
           });
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
      
      if (n.properties?.level) {
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
    workerRef.current.postMessage({
      type: 'updateData',
      payload: { nodes: simNodes, links: simLinks }
    });

  }, [rawNodes, rawEdges]);

  return {
    nodesRef,
    linksRef,
    nodesMapRef,
    simulationVersion
  };
};
