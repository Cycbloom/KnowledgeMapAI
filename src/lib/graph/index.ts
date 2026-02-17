export * from './levelUtils';
export * from './traversal';
export * from './analysis';

import type { Node, Edge, NodeLevel } from '../../types';

export const getLevel = (node: Node, edges: Edge[]): NodeLevel => {
  if (node.level) return node.level as NodeLevel;
  
  const nodeId = String(node.id).trim();
  
  const outDegree = edges.filter(e => 
    String(e.source_node_id).trim() === nodeId
  ).length;
  
  const inDegree = edges.filter(e => 
    String(e.target_node_id).trim() === nodeId
  ).length;
  
  if (inDegree === 0 && outDegree > 0) return 'root';
  if (outDegree === 0 && inDegree > 0) return 'leaf';
  if (outDegree > 0 && inDegree > 0) return 'core';
  
  return 'normal';
};
