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
