import { expose } from 'comlink';

interface Node {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  [key: string]: unknown;
}

interface Edge {
  source: string;
  target: string;
  [key: string]: unknown;
}

interface LayoutOptions {
  width: number;
  height: number;
  iterations?: number;
  linkDistance?: number;
  repulsionStrength?: number;
  attractionStrength?: number;
  damping?: number;
}

const calculateForceDirectedLayout = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): Node[] => {
  const {
    width,
    height,
    iterations = 300,
    linkDistance = 100,
    repulsionStrength = 500,
    attractionStrength = 0.1,
    damping = 0.9,
  } = options;

  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      ...node,
      x: node.x ?? Math.random() * width,
      y: node.y ?? Math.random() * height,
      vx: 0,
      vy: 0,
    });
  });

  const adjacencyList = new Map<string, Set<string>>();
  edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, new Set());
    }
    if (!adjacencyList.has(edge.target)) {
      adjacencyList.set(edge.target, new Set());
    }
    adjacencyList.get(edge.source)?.add(edge.target);
    adjacencyList.get(edge.target)?.add(edge.source);
  });

  for (let iter = 0; iter < iterations; iter++) {
    const nodesArray = Array.from(nodeMap.values());

    for (let i = 0; i < nodesArray.length; i++) {
      const nodeA = nodesArray[i];
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < nodesArray.length; j++) {
        if (i === j) continue;
        const nodeB = nodesArray[j];

        const dx = (nodeA.x ?? 0) - (nodeB.x ?? 0);
        const dy = (nodeA.y ?? 0) - (nodeB.y ?? 0);
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = repulsionStrength / (distance * distance);
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      }

      const neighbors = adjacencyList.get(nodeA.id);
      if (neighbors) {
        neighbors.forEach(neighborId => {
          const neighbor = nodeMap.get(neighborId);
          if (neighbor) {
            const dx = (neighbor.x ?? 0) - (nodeA.x ?? 0);
            const dy = (neighbor.y ?? 0) - (nodeA.y ?? 0);
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = distance - linkDistance;
            const force = displacement * attractionStrength;

            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
          }
        });
      }

      nodeA.vx = ((nodeA.vx ?? 0) + fx) * damping;
      nodeA.vy = ((nodeA.vy ?? 0) + fy) * damping;
    }

    nodesArray.forEach(node => {
      node.x = (node.x ?? 0) + (node.vx ?? 0);
      node.y = (node.y ?? 0) + (node.vy ?? 0);

      node.x = Math.max(50, Math.min(width - 50, node.x ?? 0));
      node.y = Math.max(50, Math.min(height - 50, node.y ?? 0));
    });
  }

  return Array.from(nodeMap.values());
};

const calculateNodeImportance = (
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): number => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const outDegree = edges.filter(e => e.source === nodeId).length;
  const inDegree = edges.filter(e => e.target === nodeId).length;
  const totalDegree = outDegree + inDegree;

  const dampingFactor = 0.85;
  const iterations = 20;

  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  edges.forEach(edge => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, []);
    }
    incomingEdges.get(edge.target)?.push(edge.source);
    outgoingEdges.get(edge.source)?.push(edge.target);
  });

  const ranks = new Map<string, number>();
  nodes.forEach(n => ranks.set(n.id, 1 / nodes.length));

  for (let i = 0; i < iterations; i++) {
    const newRanks = new Map<string, number>();

    nodes.forEach(node => {
      let rank = (1 - dampingFactor) / nodes.length;
      const incoming = incomingEdges.get(node.id) || [];

      incoming.forEach(sourceId => {
        const sourceRank = ranks.get(sourceId) || 0;
        const sourceOutDegree = (outgoingEdges.get(sourceId) || []).length || 1;
        rank += dampingFactor * (sourceRank / sourceOutDegree);
      });

      newRanks.set(node.id, rank);
    });

    ranks.forEach((_, id) => ranks.set(id, newRanks.get(id) || 0));
  }

  const normalizedPageRank = (ranks.get(nodeId) || 0) * nodes.length;
  const degreeScore = totalDegree / (2 * Math.max(1, nodes.length - 1));

  return (normalizedPageRank * 0.6 + degreeScore * 0.4);
};

const filterNodes = (
  nodes: Node[],
  query: string,
  searchFields: string[] = ['title', 'content', 'name']
): Node[] => {
  const lowerQuery = query.toLowerCase();

  return nodes.filter(node => {
    return searchFields.some(field => {
      const value = node[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowerQuery);
      }
      return false;
    });
  });
};

const sortNodes = (
  nodes: Node[],
  sortBy: string,
  ascending: boolean = true
): Node[] => {
  const sorted = [...nodes].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === undefined && bVal === undefined) return 0;
    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }

    return 0;
  });

  return ascending ? sorted : sorted.reverse();
};

const graphWorker = {
  calculateForceDirectedLayout,
  calculateNodeImportance,
  filterNodes,
  sortNodes,
};

export type GraphWorker = typeof graphWorker;

expose(graphWorker);
