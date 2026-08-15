export * from './levelUtils';
export * from './traversal';
export * from './analysis';
export * from './regions';

import type { Node, Edge, NodeLevel } from '../../types';

export const getLevel = (node: Node, edges: Edge[], levelMap?: Map<string, NodeLevel>): NodeLevel => {
  if (node.level) return node.level as NodeLevel;
  
  const nodeId = String(node.id).trim();
  if (levelMap) {
    return levelMap.get(nodeId) ?? 'normal';
  }
  
  // 单趟同时统计 in/out 度，替代两次 edges.filter 的 O(2*edges) 扫描
  let outDegree = 0;
  let inDegree = 0;
  for (const e of edges) {
    if (String(e.source_knowledge_point_id).trim() === nodeId) outDegree++;
    if (String(e.target_knowledge_point_id).trim() === nodeId) inDegree++;
  }
  
  if (inDegree === 0 && outDegree > 0) return 'root';
  if (outDegree === 0 && inDegree > 0) return 'leaf';
  if (outDegree > 0 && inDegree > 0) return 'core';
  
  return 'normal';
};