import { Node, Edge, NodeLevel } from '../types';

export const getLinkNodeId = (node: string | any): string => {
  if (typeof node === 'string') return node;
  return node.id;
};

// Helper to determine node level based on hierarchy
// Modified to prioritize existing properties over dynamic calculation
export const getLevel = (node: Node, edges: Edge[]): NodeLevel => {
  // ALWAYS return the explicit level if it exists
  const explicitLevel = (node.level || (node.properties as any)?.level) as NodeLevel | undefined;
  if (explicitLevel) return explicitLevel;
  
  // Fallback ONLY if property is missing
  const degree = edges.filter(e => e.source_node_id === node.id || e.target_node_id === node.id).length;
  if (degree >= 10) return 'root';
  if (degree >= 6) return 'core';
  if (degree >= 4) return 'sub';
  if (degree >= 2) return 'normal';
  return 'leaf';
};

export const getNextLevel = (parentLevel: string): NodeLevel => {
  if (parentLevel === 'root') return 'core';
  if (parentLevel === 'core') return 'sub';
  if (parentLevel === 'sub') return 'normal';
  if (parentLevel === 'normal') return 'leaf';
  return 'leaf'; // Leaves produce leaves
};

// Get all descendant nodes (children, grandchildren, etc.) using BFS
export const getDescendantNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const normalizeId = (id: any) => String(id).trim();
  const startId = normalizeId(nodeId);
  
  const descendants = new Set<string>();
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  
  // Build adjacency list for children only (outgoing edges)
  const childrenMap = new Map<string, string[]>();
  nodes.forEach(node => {
    childrenMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    if (childrenMap.has(src)) {
      childrenMap.get(src)?.push(tgt);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId) || [];
    
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }
  
  return descendants;
};

// Get direct children only (not grandchildren)
export const getDirectChildren = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const normalizeId = (id: any) => String(id).trim();
  const startId = normalizeId(nodeId);
  
  const directChildren = new Set<string>();
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    if (src === startId) {
      directChildren.add(tgt);
    }
  });
  
  return directChildren;
};

// Get all ancestor nodes (parents, grandparents, etc.) using BFS
export const getAncestorNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const normalizeId = (id: any) => String(id).trim();
  const startId = normalizeId(nodeId);
  
  const ancestors = new Set<string>();
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  
  // Build adjacency list for parents only (incoming edges)
  const parentsMap = new Map<string, string[]>();
  nodes.forEach(node => {
    parentsMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    if (parentsMap.has(tgt)) {
      parentsMap.get(tgt)?.push(src);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const parents = parentsMap.get(currentId) || [];
    
    for (const parentId of parents) {
      if (!visited.has(parentId)) {
        visited.add(parentId);
        ancestors.add(parentId);
        queue.push(parentId);
      }
    }
  }
  
  return ancestors;
};

// Get all nodes to focus: selected node + ancestors + descendants
export const getFocusedNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const focused = new Set<string>();
  focused.add(nodeId);
  
  const descendants = getDescendantNodes(nodeId, nodes, edges);
  const ancestors = getAncestorNodes(nodeId, nodes, edges);
  
  descendants.forEach(id => focused.add(id));
  ancestors.forEach(id => focused.add(id));
  
  return focused;
};

// Get all links that connect focused nodes
export const getFocusedLinks = (focusedNodeIds: Set<string>, edges: Edge[]): Set<string> => {
  const focusedLinks = new Set<string>();
  
  edges.forEach(edge => {
    const src = String(edge.source_node_id).trim();
    const tgt = String(edge.target_node_id).trim();
    
    // Include link if both endpoints are in focused nodes
    if (focusedNodeIds.has(src) && focusedNodeIds.has(tgt)) {
      focusedLinks.add(String(edge.id));
    }
  });
  
  return focusedLinks;
};

// BFS algorithm for shortest path (unweighted graph)
export const findShortestPath = (nodes: Node[], edges: Edge[], startId: string, endId: string) => {
  // 1. Robust ID normalization
  const normalizeId = (id: any) => String(id).trim();
  
  const sId = normalizeId(startId);
  const eId = normalizeId(endId);

  if (sId === eId) {
    return { nodes: new Set([sId]), links: new Set<string>() };
  }

  // 2. Build Adjacency List for better performance and debugging
  // Map<NodeId, Array<{neighborId, edgeId}>>
  const adj = new Map<string, Array<{id: string, edgeId: string}>>();
  
  // Initialize adjacency list for all nodes to ensure we handle isolated nodes gracefully
  nodes.forEach(node => {
    adj.set(normalizeId(node.id), []);
  });

  // Populate adjacency list
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    const edgeId = String(edge.id);

    // Undirected graph: add edges both ways
    if (adj.has(src)) {
      adj.get(src)?.push({ id: tgt, edgeId });
    } else {
      // Fallback if node missing from nodes array but present in edges
      adj.set(src, [{ id: tgt, edgeId }]);
    }

    if (adj.has(tgt)) {
      adj.get(tgt)?.push({ id: src, edgeId });
    } else {
      adj.set(tgt, [{ id: src, edgeId }]);
    }
  });

  // 3. Standard BFS
  const queue: string[] = [sId];
  const visited = new Set<string>([sId]);
  const parent = new Map<string, { nodeId: string, edgeId: string }>();
  
  let found = false;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    if (currentId === eId) {
      found = true;
      break;
    }

    const neighbors = adj.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        parent.set(neighbor.id, { nodeId: currentId, edgeId: neighbor.edgeId });
        queue.push(neighbor.id);
      }
    }
  }

  // 4. Reconstruct Path
  if (found) {
    const pathNodes = new Set<string>();
    const pathLinks = new Set<string>();
    
    let curr = eId;
    pathNodes.add(curr);
    
    while (curr !== sId) {
      const p = parent.get(curr);
      if (!p) break; // Should not happen if found is true
      
      pathLinks.add(p.edgeId);
      pathNodes.add(p.nodeId);
      curr = p.nodeId;
    }
    
    return { nodes: pathNodes, links: pathLinks };
  }
  
  return { nodes: new Set<string>(), links: new Set<string>() };
};

// ========== Graph Analysis Functions ==========

export interface GraphAnalysis {
  // Basic metrics
  nodeCount: number;
  edgeCount: number;
  isolatedNodes: string[];
  disconnectedComponents: number;
  
  // Structure metrics
  maxDepth: number;
  avgDepth: number;
  levelDistribution: Record<NodeLevel, number>;
  
  // Connectivity metrics
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  centralNodes: Array<{ id: string; degree: number; title: string }>;
  
  // Hierarchy metrics
  rootNodes: string[];
  leafNodes: string[];
  nodesWithoutContent: string[];
  nodesWithManyChildren: Array<{ id: string; childrenCount: number; title: string }>;
  
  // Health score (0-100)
  healthScore: number;
  healthIssues: string[];
}

/**
 * Comprehensive graph analysis
 */
export const analyzeGraph = (nodes: Node[], edges: Edge[]): GraphAnalysis => {
  const normalizeId = (id: any) => String(id).trim();
  
  // Build adjacency lists
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
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    
    outDegree.set(src, (outDegree.get(src) || 0) + 1);
    inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    childrenMap.get(src)?.add(tgt);
    parentsMap.get(tgt)?.add(src);
  });
  
  // Calculate degrees
  const degrees = new Map<string, number>();
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    const degree = (outDegree.get(id) || 0) + (inDegree.get(id) || 0);
    degrees.set(id, degree);
  });
  
  // Find isolated nodes
  const isolatedNodes = nodes
    .filter(node => (degrees.get(normalizeId(node.id)) || 0) === 0)
    .map(node => node.id);
  
  // Find disconnected components using BFS
  const visited = new Set<string>();
  let componentCount = 0;
  
  const bfs = (startId: string) => {
    const queue = [startId];
    visited.add(startId);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
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
  
  // Calculate depth for each node
  const depths = new Map<string, number>();
  const rootNodes: string[] = [];
  
  // Find root nodes (no incoming edges)
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    if ((inDegree.get(id) || 0) === 0 && (outDegree.get(id) || 0) > 0) {
      rootNodes.push(node.id);
    }
  });
  
  // If no clear root, use nodes with highest out-degree
  if (rootNodes.length === 0) {
    const sortedByOutDegree = [...nodes]
      .sort((a, b) => (outDegree.get(normalizeId(b.id)) || 0) - (outDegree.get(normalizeId(a.id)) || 0))
      .slice(0, Math.min(3, nodes.length));
    rootNodes.push(...sortedByOutDegree.map(n => n.id));
  }
  
  // Calculate depth using BFS from root nodes
  const calculateDepth = (startId: string) => {
    const queue: Array<{ id: string; depth: number }> = [{ id: normalizeId(startId), depth: 0 }];
    const localVisited = new Set<string>();
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
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
  
  // If still no depths, assign depth 0 to all
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
  
  // Level distribution
  const levelDistribution: Record<NodeLevel, number> = {
    root: 0,
    core: 0,
    sub: 0,
    normal: 0,
    leaf: 0
  };
  
  nodes.forEach(node => {
    const level = getLevel(node, edges);
    levelDistribution[level]++;
  });
  
  // Degree statistics
  const degreeValues = Array.from(degrees.values());
  const avgDegree = degreeValues.length > 0 
    ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length 
    : 0;
  const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;
  const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;
  
  // Central nodes (top 5 by degree)
  const centralNodes = [...nodes]
    .map(node => ({
      id: node.id,
      degree: degrees.get(normalizeId(node.id)) || 0,
      title: node.title
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);
  
  // Leaf nodes (no outgoing edges)
  const leafNodes = nodes
    .filter(node => (outDegree.get(normalizeId(node.id)) || 0) === 0)
    .map(node => node.id);
  
  // Nodes without content
  const nodesWithoutContent = nodes
    .filter(node => !node.content || node.content.trim().length === 0)
    .map(node => node.id);
  
  // Nodes with many children (potential candidates for expansion)
  const nodesWithManyChildren = [...nodes]
    .map(node => ({
      id: node.id,
      childrenCount: childrenMap.get(normalizeId(node.id))?.size || 0,
      title: node.title
    }))
    .filter(n => n.childrenCount >= 5)
    .sort((a, b) => b.childrenCount - a.childrenCount)
    .slice(0, 10);
  
  // Calculate health score
  const healthIssues: string[] = [];
  let healthScore = 100;
  
  // Deduct points for issues
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

/**
 * Find nodes that should be connected but aren't (based on similarity)
 */
export const findMissingConnections = (
  nodes: Node[],
  edges: Edge[],
  maxSuggestions: number = 10
): Array<{ sourceId: string; targetId: string; reason: string }> => {
  const normalizeId = (id: any) => String(id).trim();
  const suggestions: Array<{ sourceId: string; targetId: string; reason: string }> = [];
  
  // Build existing connections set
  const existingConnections = new Set<string>();
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    existingConnections.add(`${src}-${tgt}`);
    existingConnections.add(`${tgt}-${src}`); // Undirected
  });
  
  // Find nodes with same parent (siblings that might be related)
  const parentMap = new Map<string, Set<string>>();
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    if (!parentMap.has(tgt)) {
      parentMap.set(tgt, new Set());
    }
    parentMap.get(tgt)!.add(src);
  });
  
  // Group nodes by parent
  const siblingsMap = new Map<string, string[]>();
  nodes.forEach(node => {
    const id = normalizeId(node.id);
    const parents = parentMap.get(id) || new Set();
    parents.forEach(parentId => {
      if (!siblingsMap.has(parentId)) {
        siblingsMap.set(parentId, []);
      }
      siblingsMap.get(parentId)!.push(id);
    });
  });
  
  // Suggest connections between siblings
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
