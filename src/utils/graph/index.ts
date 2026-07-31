export * from './levelUtils';
export * from './traversal';
export * from './analysis';
export * from './regions';

import type { Node, Edge, NodeLevel } from '../../types';

export const getLevel = (node: Node, edges: Edge[]): NodeLevel => {
  if (node.level) return node.level as NodeLevel;
  
  const nodeId = String(node.id).trim();
  
  const outDegree = edges.filter(e => 
    String(e.source_knowledge_point_id).trim() === nodeId
  ).length;
  
  const inDegree = edges.filter(e => 
    String(e.target_knowledge_point_id).trim() === nodeId
  ).length;
  
  if (inDegree === 0 && outDegree > 0) return 'root';
  if (outDegree === 0 && inDegree > 0) return 'leaf';
  if (outDegree > 0 && inDegree > 0) return 'core';
  
  return 'normal';
};