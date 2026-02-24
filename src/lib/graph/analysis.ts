import type { Node, Edge, NodeLevel, NodeImportance, EdgeStrength } from '../../types';
import { getLevel } from './index';
import { LEVEL_WEIGHTS } from './levelUtils';

const normalizeId = (id: unknown): string => String(id).trim();

export interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  isolatedNodes: string[];
  disconnectedComponents: number;
  maxDepth: number;
  avgDepth: number;
  levelDistribution: Record<NodeLevel, number>;
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  centralNodes: Array<{ id: string; degree: number; title: string }>;
  rootNodes: string[];
  leafNodes: string[];
  nodesWithoutContent: string[];
  nodesWithManyChildren: Array<{ id: string; childrenCount: number; title: string }>;
  healthScore: number;
  healthIssues: string[];
}

export const analyzeGraph = (nodes: Node[], edges: Edge[]): GraphAnalysis => {
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const childrenMap = new Map<string, Set<string>>();
  const parentsMap = new Map<string, Set<string>>();
  
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    outDegree.set(id, 0);
    inDegree.set(id, 0);
    childrenMap.set(id, new Set());
    parentsMap.set(id, new Set());
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    
    outDegree.set(src, (outDegree.get(src) || 0) + 1);
    inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    childrenMap.get(src)?.add(tgt);
    parentsMap.get(tgt)?.add(src);
  });
  
  const degrees = new Map<string, number>();
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    const degree = (outDegree.get(id) || 0) + (inDegree.get(id) || 0);
    degrees.set(id, degree);
  });
  
  const isolatedNodes = nodes
    .filter(node => (degrees.get(normalizeId(node.id)) || 0) === 0)
    .map(node => node.id);
  
  const visited = new Set<string>();
  let componentCount = 0;
  
  const bfs = (startId: string) => {
    const queue = [startId];
    visited.add(startId);
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const children = childrenMap.get(current) || new Set();
      const parents = parentsMap.get(current) || new Set();
      
      [...children, ...parents].forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  };
  
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    if (!visited.has(id)) {
      bfs(id);
      componentCount++;
    }
  });
  
  const depths = new Map<string, number>();
  const rootNodes: string[] = [];
  
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    if ((inDegree.get(id) || 0) === 0 && (outDegree.get(id) || 0) > 0) {
      rootNodes.push(node.id);
    }
  });
  
  if (rootNodes.length === 0) {
    const sortedByOutDegree = [...nodes]
      .sort((a, b) => (outDegree.get(normalizeId(b.id)) || 0) - (outDegree.get(normalizeId(a.id)) || 0))
      .slice(0, Math.min(3, nodes.length));
    rootNodes.push(...sortedByOutDegree.map(n => n.id));
  }
  
  const calculateDepth = (startId: string) => {
    const queue: Array<{ id: string; depth: number }> = [{ id: normalizeId(startId), depth: 0 }];
    const localVisited = new Set<string>();
    
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      const { id, depth } = item;
      if (localVisited.has(id)) continue;
      localVisited.add(id);
      
      const currentDepth = depths.get(id) || 0;
      depths.set(id, Math.max(currentDepth, depth));
      
      const children = childrenMap.get(id) || new Set();
      children.forEach(childId => {
        if (!localVisited.has(childId)) {
          queue.push({ id: childId, depth: depth + 1 });
        }
      });
    }
  };
  
  rootNodes.forEach(rootId => calculateDepth(rootId));
  
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    if (!depths.has(id)) {
      depths.set(id, 0);
    }
  });
  
  const depthValues = Array.from(depths.values());
  const maxDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const avgDepth = depthValues.length > 0 
    ? depthValues.reduce((a, b) => a + b, 0) / depthValues.length 
    : 0;
  
  const levelDistribution: Record<NodeLevel, number> = {
    root: 0, core: 0, sub: 0, normal: 0, leaf: 0
  };
  
  nodes.forEach(node => {
    const level = getLevel(node, edges);
    levelDistribution[level]++;
  });
  
  const degreeValues = Array.from(degrees.values());
  const avgDegree = degreeValues.length > 0 
    ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length 
    : 0;
  const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;
  const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;
  
  const centralNodes = [...nodes]
    .map(node => ({
      id: node.id,
      degree: degrees.get(normalizeId(node.id)) || 0,
      title: node.title
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);
  
  const leafNodes = nodes
    .filter(node => (outDegree.get(normalizeId(node.id)) || 0) === 0)
    .map(node => node.id);
  
  const nodesWithoutContent = nodes
    .filter(node => !node.content || node.content.trim().length === 0)
    .map(node => node.id);
  
  const nodesWithManyChildren = [...nodes]
    .map(node => ({
      id: node.id,
      childrenCount: childrenMap.get(normalizeId(node.id))?.size || 0,
      title: node.title
    }))
    .filter(n => n.childrenCount >= 5)
    .sort((a, b) => b.childrenCount - a.childrenCount)
    .slice(0, 10);
  
  const healthIssues: string[] = [];
  let healthScore = 100;
  
  if (isolatedNodes.length > 0) {
    const penalty = Math.min(20, isolatedNodes.length * 2);
    healthScore -= penalty;
    healthIssues.push(`${isolatedNodes.length} 个孤立节点`);
  }
  
  if (componentCount > 1) {
    const penalty = Math.min(15, (componentCount - 1) * 5);
    healthScore -= penalty;
    healthIssues.push(`${componentCount} 个不连通的组件`);
  }
  
  if (nodesWithoutContent.length > nodes.length * 0.3) {
    const penalty = Math.min(15, Math.floor(nodesWithoutContent.length / nodes.length * 30));
    healthScore -= penalty;
    healthIssues.push(`${nodesWithoutContent.length} 个节点缺少内容`);
  }
  
  if (rootNodes.length === 0) {
    healthScore -= 10;
    healthIssues.push('缺少根节点');
  }
  
  if (avgDegree < 1) {
    healthScore -= 10;
    healthIssues.push('平均连接度较低');
  }
  
  healthScore = Math.max(0, healthScore);
  
  if (healthScore === 100) {
    healthIssues.push('图谱结构健康');
  }
  
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    isolatedNodes,
    disconnectedComponents: componentCount,
    maxDepth,
    avgDepth: Math.round(avgDepth * 10) / 10,
    levelDistribution,
    avgDegree: Math.round(avgDegree * 10) / 10,
    maxDegree,
    minDegree,
    centralNodes,
    rootNodes,
    leafNodes,
    nodesWithoutContent,
    nodesWithManyChildren,
    healthScore: Math.round(healthScore),
    healthIssues
  };
};

export const findMissingConnections = (
  nodes: Node[],
  edges: Edge[],
  maxSuggestions: number = 10
): Array<{ sourceId: string; targetId: string; reason: string }> => {
  const suggestions: Array<{ sourceId: string; targetId: string; reason: string }> = [];
  
  const existingConnections = new Set<string>();
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    existingConnections.add(`${src}-${tgt}`);
    existingConnections.add(`${tgt}-${src}`);
  });
  
  const parentMap = new Map<string, Set<string>>();
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    if (!parentMap.has(tgt)) {
      parentMap.set(tgt, new Set());
    }
    parentMap.get(tgt)?.add(src);
  });
  
  const siblingsMap = new Map<string, string[]>();
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    const parents = parentMap.get(id) || new Set();
    parents.forEach(parentId => {
      if (!siblingsMap.has(parentId)) {
        siblingsMap.set(parentId, []);
      }
      siblingsMap.get(parentId)?.push(id);
    });
  });
  
  siblingsMap.forEach((siblings, parentId) => {
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const src = siblings[i];
        const tgt = siblings[j];
        const key = `${src}-${tgt}`;
        
        if (!existingConnections.has(key)) {
          const sourceNode = nodes.find(n => normalizeId(n.id) === src);
          const targetNode = nodes.find(n => normalizeId(n.id) === tgt);
          
          if (sourceNode && targetNode) {
            suggestions.push({
              sourceId: sourceNode.id,
              targetId: targetNode.id,
              reason: `同属于 "${nodes.find(n => normalizeId(n.id) === parentId)?.title || '未知'}" 的子节点`
            });
          }
        }
      }
    }
  });
  
  return suggestions.slice(0, maxSuggestions);
};

export const calculateNodeImportance = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  nodeStatus?: Record<string, { mastered?: boolean }>
): NodeImportance => {
  const nodeId = normalizeId(node.id);
  
  const degree = edges.filter(e => 
    normalizeId(e.source_knowledge_point_id) === nodeId || 
    normalizeId(e.target_knowledge_point_id) === nodeId
  ).length;
  
  const childrenCount = edges.filter(e => 
    normalizeId(e.source_knowledge_point_id) === nodeId
  ).length;
  
  const level = getLevel(node, edges);
  const levelWeight = LEVEL_WEIGHTS[level] || 0.2;
  
  const contentLength = node.content ? Math.min(node.content.length / 2000, 1.0) : 0;
  
  const masteryWeight = nodeStatus?.[node.id]?.mastered ? 0.1 : 0;
  
  const maxDegree = Math.max(1, ...nodes.map(n =>
    edges.filter(e => 
      normalizeId(e.source_knowledge_point_id) === normalizeId(n.id) || 
      normalizeId(e.target_knowledge_point_id) === normalizeId(n.id)
    ).length
  ));
  const normalizedDegree = Math.min(degree / maxDegree, 1.0);
  
  const maxChildren = Math.max(1, ...nodes.map(n =>
    edges.filter(e => normalizeId(e.source_knowledge_point_id) === normalizeId(n.id)).length
  ));
  const normalizedChildren = Math.min(childrenCount / maxChildren, 1.0);
  
  const score = (
    normalizedDegree * 0.3 +
    normalizedChildren * 0.25 +
    levelWeight * 0.2 +
    contentLength * 0.15 +
    masteryWeight * 0.1
  );
  
  return {
    score: Math.min(Math.max(score, 0), 1),
    factors: {
      degree: normalizedDegree,
      childrenCount: normalizedChildren,
      level: levelWeight,
      contentLength
    }
  };
};

export const calculateEdgeStrength = (
  edge: Edge,
  nodes: Node[],
  edges: Edge[]
): EdgeStrength => {
  const sourceId = normalizeId(edge.source_knowledge_point_id);
  const targetId = normalizeId(edge.target_knowledge_point_id);
  
  const relationshipWeights: Record<string, number> = {
    'contains': 1.0,
    'related': 0.7,
    'depends_on': 0.8,
    'similar_to': 0.6,
    'part_of': 0.9
  };
  const relationshipType = edge.relationship_type || 'related';
  const relationshipTypeWeight = relationshipWeights[relationshipType] || 0.5;
  
  const sourceConnections = new Set<string>();
  const targetConnections = new Set<string>();
  
  edges.forEach(e => {
    const src = normalizeId(e.source_knowledge_point_id);
    const tgt = normalizeId(e.target_knowledge_point_id);
    
    if (src === sourceId || tgt === sourceId) {
      if (src === sourceId) sourceConnections.add(tgt);
      if (tgt === sourceId) sourceConnections.add(src);
    }
    if (src === targetId || tgt === targetId) {
      if (src === targetId) targetConnections.add(tgt);
      if (tgt === targetId) targetConnections.add(src);
    }
  });
  
  let commonConnections = 0;
  sourceConnections.forEach(id => {
    if (targetConnections.has(id)) commonConnections++;
  });
  
  const normalizedCommonConnections = Math.min(commonConnections / 10, 1.0);
  
  const pathCount = countPaths(sourceId, targetId, nodes, edges);
  const normalizedPathCount = Math.min(pathCount / 5, 1.0);
  
  let hierarchyWeight = 0.5;
  const isParentChild = edges.some(e => 
    normalizeId(e.source_knowledge_point_id) === sourceId && 
    normalizeId(e.target_knowledge_point_id) === targetId
  );
  
  if (isParentChild) {
    hierarchyWeight = 1.0;
  } else {
    const sourceParents = edges
      .filter(e => normalizeId(e.target_knowledge_point_id) === sourceId)
      .map(e => normalizeId(e.source_knowledge_point_id));
    const targetParents = edges
      .filter(e => normalizeId(e.target_knowledge_point_id) === targetId)
      .map(e => normalizeId(e.source_knowledge_point_id));
    
    const commonParent = sourceParents.find(p => targetParents.includes(p));
    if (commonParent) {
      hierarchyWeight = 0.8;
    }
  }
  
  const score = (
    relationshipTypeWeight * 0.4 +
    normalizedCommonConnections * 0.3 +
    normalizedPathCount * 0.2 +
    hierarchyWeight * 0.1
  );
  
  return {
    score: Math.min(Math.max(score, 0), 1),
    factors: {
      relationshipType,
      commonConnections: normalizedCommonConnections,
      pathCount: normalizedPathCount
    }
  };
};

const countPaths = (
  startId: string,
  endId: string,
  nodes: Node[],
  edges: Edge[]
): number => {
  const start = normalizeId(startId);
  const end = normalizeId(endId);
  
  if (start === end) return 1;
  
  const adj = new Map<string, Set<string>>();
  nodes.forEach(node => {
    adj.set(normalizeId(node.id), new Set());
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    adj.get(src)?.add(tgt);
    adj.get(tgt)?.add(src);
  });
  
  let pathCount = 0;
  const queue: Array<{ id: string; depth: number; visited: Set<string> }> = [
    { id: start, depth: 0, visited: new Set([start]) }
  ];
  
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { id, depth, visited } = item;
    
    if (depth > 3) continue;
    
    const neighbors = adj.get(id) || new Set();
    for (const neighbor of neighbors) {
      if (neighbor === end) {
        pathCount++;
        continue;
      }
      
      if (!visited.has(neighbor) && depth < 3) {
        queue.push({
          id: neighbor,
          depth: depth + 1,
          visited: new Set([...visited, neighbor])
        });
      }
    }
  }
  
  return Math.min(pathCount, 5);
};
