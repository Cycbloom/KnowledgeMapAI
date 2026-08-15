import i18next from 'i18next';
import type { Node, Edge, NodeLevel, NodeImportance, EdgeStrength } from '../../types';
import { getLevel } from './index';
import { LEVEL_WEIGHTS, buildLevelMap } from './levelUtils';

const normalizeId = (id: unknown): string => String(id).trim();

export interface GraphEdgeMaps {
  adjacency: Map<string, Set<string>>;
  parentMap: Map<string, string[]>;
}

export const buildGraphEdgeMaps = (nodes: Node[], edges: Edge[]): GraphEdgeMaps => {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(node => {
    adjacency.set(normalizeId(node.id), new Set());
  });
  const parentMap = new Map<string, string[]>();
  edges.forEach(e => {
    const src = normalizeId(e.source_knowledge_point_id);
    const tgt = normalizeId(e.target_knowledge_point_id);
    adjacency.get(src)?.add(tgt);
    adjacency.get(tgt)?.add(src);
    if (!parentMap.has(tgt)) parentMap.set(tgt, []);
    parentMap.get(tgt)?.push(src);
  });
  return { adjacency, parentMap };
};

export interface NodeImportanceMaps {
  degreeMap: Map<string, number>;
  childrenMap: Map<string, number>;
  levelMap: Map<string, NodeLevel>;
}

export const buildNodeImportanceMaps = (nodes: Node[], edges: Edge[]): NodeImportanceMaps => {
  const degreeMap = new Map<string, number>();
  const childrenMap = new Map<string, number>();
  nodes.forEach((n) => {
    const nid = normalizeId(n.id);
    degreeMap.set(nid, 0);
    childrenMap.set(nid, 0);
  });
  edges.forEach((e) => {
    const src = normalizeId(e.source_knowledge_point_id);
    const tgt = normalizeId(e.target_knowledge_point_id);
    degreeMap.set(src, (degreeMap.get(src) ?? 0) + 1);
    degreeMap.set(tgt, (degreeMap.get(tgt) ?? 0) + 1);
    childrenMap.set(src, (childrenMap.get(src) ?? 0) + 1);
  });
  const levelMap = buildLevelMap(nodes, edges);
  return { degreeMap, childrenMap, levelMap };
};

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
    const level: NodeLevel = node.level
      ? (node.level as NodeLevel)
      : (() => {
          const out = outDegree.get(normalizeId(node.id)) ?? 0;
          const inCount = inDegree.get(normalizeId(node.id)) ?? 0;
          if (inCount === 0 && out > 0) return 'root';
          if (out === 0 && inCount > 0) return 'leaf';
          if (out > 0 && inCount > 0) return 'core';
          return 'normal';
        })();
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
  
  // 单趟统计 leaf 与无内容节点，替代两次 filter+map 的 O(2*nodes) 扫描
  const leafNodes: string[] = [];
  const nodesWithoutContent: string[] = [];
  for (const node of nodes) {
    if ((outDegree.get(normalizeId(node.id)) || 0) === 0) leafNodes.push(node.id);
    if (!node.content || node.content.trim().length === 0) nodesWithoutContent.push(node.id);
  }
  
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
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.isolatedNodes', { count: isolatedNodes.length }));
  }
  
  if (componentCount > 1) {
    const penalty = Math.min(15, (componentCount - 1) * 5);
    healthScore -= penalty;
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.disconnectedComponents', { count: componentCount }));
  }
  
  if (nodesWithoutContent.length > nodes.length * 0.3) {
    const penalty = Math.min(15, Math.floor(nodesWithoutContent.length / nodes.length * 30));
    healthScore -= penalty;
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.nodesWithoutContent', { count: nodesWithoutContent.length }));
  }
  
  if (rootNodes.length === 0) {
    healthScore -= 10;
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.missingRoot'));
  }
  
  if (avgDegree < 1) {
    healthScore -= 10;
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.lowAvgDegree'));
  }
  
  healthScore = Math.max(0, healthScore);
  
  if (healthScore === 100) {
    healthIssues.push(i18next.t('graphEditor.graphAnalysis.health.healthy'));
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
  
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => {
    nodeMap.set(normalizeId(node.id), node);
  });

  siblingsMap.forEach((siblings, parentId) => {
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const src = siblings[i];
        const tgt = siblings[j];
        const key = `${src}-${tgt}`;
        
        if (!existingConnections.has(key)) {
          const sourceNode = nodeMap.get(src);
          const targetNode = nodeMap.get(tgt);
          
          if (sourceNode && targetNode) {
            const parentNode = nodeMap.get(parentId);
            const parentTitle = parentNode?.title || i18next.t('graphEditor.graphAnalysis.connections.unknownParent');
            suggestions.push({
              sourceId: sourceNode.id,
              targetId: targetNode.id,
              reason: i18next.t('graphEditor.graphAnalysis.connections.sameParent', { parentTitle })
            });
          }
        }
      }
    }
  });
  
  return suggestions.slice(0, maxSuggestions);
};

export function calculateGlobalMaxDegree(nodes: Node[], edges: Edge[]): number {
  const degreeMap = new Map<string, number>();
  nodes.forEach(n => {
    degreeMap.set(normalizeId(n.id), 0);
  });
  edges.forEach(e => {
    const src = normalizeId(e.source_knowledge_point_id);
    const tgt = normalizeId(e.target_knowledge_point_id);
    degreeMap.set(src, (degreeMap.get(src) ?? 0) + 1);
    degreeMap.set(tgt, (degreeMap.get(tgt) ?? 0) + 1);
  });
  return Math.max(1, ...degreeMap.values());
}

export function calculateGlobalMaxChildren(nodes: Node[], edges: Edge[]): number {
  const childrenMap = new Map<string, number>();
  nodes.forEach(n => {
    childrenMap.set(normalizeId(n.id), 0);
  });
  edges.forEach(e => {
    const src = normalizeId(e.source_knowledge_point_id);
    childrenMap.set(src, (childrenMap.get(src) ?? 0) + 1);
  });
  return Math.max(1, ...childrenMap.values());
}

export const calculateNodeImportance = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  nodeStatus?: Record<string, { mastered?: boolean }>,
  maxDegree?: number,
  maxChildren?: number,
  maps?: NodeImportanceMaps
): NodeImportance => {
  const nodeId = normalizeId(node.id);

  const { degreeMap, childrenMap, levelMap } = maps ?? buildNodeImportanceMaps(nodes, edges);

  const degree = degreeMap.get(nodeId) ?? 0;
  const childrenCount = childrenMap.get(nodeId) ?? 0;

  const level = getLevel(node, edges, levelMap);
  const levelWeight = LEVEL_WEIGHTS[level] || 0.2;

  const contentLength = node.content ? Math.min(node.content.length / 2000, 1.0) : 0;

  const masteryWeight = nodeStatus?.[node.id]?.mastered ? 0.1 : 0;

  const finalMaxDegree = maxDegree ?? Math.max(1, ...degreeMap.values());
  const normalizedDegree = Math.min(degree / finalMaxDegree, 1.0);

  const finalMaxChildren = maxChildren ?? Math.max(1, ...childrenMap.values());
  const normalizedChildren = Math.min(childrenCount / finalMaxChildren, 1.0);
  
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
  edges: Edge[],
  maps?: GraphEdgeMaps
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
  const relationshipType = edge.relationship_type || 'contains';
  const relationshipTypeWeight = relationshipWeights[relationshipType] || 0.5;
  
  const { adjacency, parentMap } = maps ?? buildGraphEdgeMaps(nodes, edges);
  
  const sourceConnections = adjacency.get(sourceId) || new Set<string>();
  const targetConnections = adjacency.get(targetId) || new Set<string>();
  
  let commonConnections = 0;
  sourceConnections.forEach(id => {
    if (targetConnections.has(id)) commonConnections++;
  });
  
  const normalizedCommonConnections = Math.min(commonConnections / 10, 1.0);
  
  const pathCount = countPaths(sourceId, targetId, nodes, edges, adjacency);
  const normalizedPathCount = Math.min(pathCount / 5, 1.0);
  
  let hierarchyWeight = 0.5;
  const isParentChild = adjacency.get(sourceId)?.has(targetId) ?? false;
  
  if (isParentChild) {
    hierarchyWeight = 1.0;
  } else {
    const sourceParents = parentMap.get(sourceId) || [];
    const targetParents = parentMap.get(targetId) || [];

    // 将 targetParents 预构建为 Set，替代 find 内层 includes 的 O(lenS*lenT) 扫描
    const targetParentsSet = new Set(targetParents);
    const commonParent = sourceParents.find((p) => targetParentsSet.has(p));
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
  edges: Edge[],
  adjacency?: Map<string, Set<string>>
): number => {
  const start = normalizeId(startId);
  const end = normalizeId(endId);
  
  if (start === end) return 1;
  
  const adj = adjacency ?? (() => {
    const m = new Map<string, Set<string>>();
    nodes.forEach(node => m.set(normalizeId(node.id), new Set()));
    edges.forEach(edge => {
      const src = normalizeId(edge.source_knowledge_point_id);
      const tgt = normalizeId(edge.target_knowledge_point_id);
      m.get(src)?.add(tgt);
      m.get(tgt)?.add(src);
    });
    return m;
  })();
  
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