import type { Node, Edge } from '../../types';

const normalizeId = (id: unknown): string => String(id).trim();

export const getDescendantNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const startId = normalizeId(nodeId);
  
  const descendants = new Set<string>();
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  
  const childrenMap = new Map<string, string[]>();
  nodes.forEach(node => {
    childrenMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    if (childrenMap.has(src)) {
      childrenMap.get(src)?.push(tgt);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
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

export const getDirectChildren = (nodeId: string, _nodes: Node[], edges: Edge[]): Set<string> => {
  const startId = normalizeId(nodeId);
  const directChildren = new Set<string>();
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    if (src === startId) {
      directChildren.add(tgt);
    }
  });
  
  return directChildren;
};

export const getAncestorNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const startId = normalizeId(nodeId);
  
  const ancestors = new Set<string>();
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  
  const parentsMap = new Map<string, string[]>();
  nodes.forEach(node => {
    parentsMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    if (parentsMap.has(tgt)) {
      parentsMap.get(tgt)?.push(src);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
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

export const getFocusedNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Set<string> => {
  const focused = new Set<string>();
  focused.add(nodeId);
  
  const descendants = getDescendantNodes(nodeId, nodes, edges);
  const ancestors = getAncestorNodes(nodeId, nodes, edges);
  
  descendants.forEach(id => focused.add(id));
  ancestors.forEach(id => focused.add(id));
  
  return focused;
};

export const getFocusedLinks = (focusedNodeIds: Set<string>, edges: Edge[]): Set<string> => {
  const focusedLinks = new Set<string>();
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    
    if (focusedNodeIds.has(src) && focusedNodeIds.has(tgt)) {
      focusedLinks.add(String(edge.id));
    }
  });
  
  return focusedLinks;
};

export const findShortestPath = (nodes: Node[], edges: Edge[], startId: string, endId: string) => {
  const sId = normalizeId(startId);
  const eId = normalizeId(endId);

  if (sId === eId) {
    return { nodes: new Set([sId]), links: new Set<string>() };
  }

  const adj = new Map<string, Array<{id: string, edgeId: string}>>();
  
  nodes.forEach(node => {
    adj.set(normalizeId(node.id), []);
  });

  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    const edgeId = String(edge.id);

    if (adj.has(src)) {
      adj.get(src)?.push({ id: tgt, edgeId });
    } else {
      adj.set(src, [{ id: tgt, edgeId }]);
    }

    if (adj.has(tgt)) {
      adj.get(tgt)?.push({ id: src, edgeId });
    } else {
      adj.set(tgt, [{ id: src, edgeId }]);
    }
  });

  const queue: string[] = [sId];
  const visited = new Set<string>([sId]);
  const parent = new Map<string, { nodeId: string, edgeId: string }>();
  
  let found = false;

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    
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

  if (found) {
    const pathNodes = new Set<string>();
    const pathLinks = new Set<string>();
    
    let curr = eId;
    pathNodes.add(curr);
    
    while (curr !== sId) {
      const p = parent.get(curr);
      if (!p) break;
      
      pathLinks.add(p.edgeId);
      pathNodes.add(p.nodeId);
      curr = p.nodeId;
    }
    
    return { nodes: pathNodes, links: pathLinks };
  }
  
  return { nodes: new Set<string>(), links: new Set<string>() };
};

export const getLinkNodeId = (node: string | { id: string }): string => {
  if (typeof node === 'string') return node;
  return node.id;
};
