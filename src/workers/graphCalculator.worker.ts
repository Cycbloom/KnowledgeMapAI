import { expose } from 'comlink';
import * as d3 from 'd3-force';
import type { SimulationNodeDatum } from 'd3-force';
import { UMAP } from 'umap-js';

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

// ============ MindMap Layout Types ============

type MindMapNodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

interface MindMapLayoutNode {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  level?: MindMapNodeLevel;
  properties?: Record<string, unknown>;
}

interface MindMapLayoutEdge {
  id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface MindMapLayoutOptions {
  width: number;
  height: number;
  chargeStrength?: number;
  linkDistance?: number;
  centerForce?: number;
  domainGroups?: Map<string, string[]>;
}

interface MindMapLayoutResult {
  nodes: MindMapLayoutNode[];
  links: Array<MindMapLayoutEdge & { source: string; target: string }>;
}

// ============ MindMap Layout Implementation ============

const LEVEL_CHARGE_STRENGTH: Record<MindMapNodeLevel, number> = {
  root: -300,
  core: -250,
  sub: -180,
  normal: -150,
  leaf: -120,
};

function getMindMapLevel(
  node: MindMapLayoutNode,
  edges: MindMapLayoutEdge[]
): MindMapNodeLevel {
  if (node.level) return node.level;

  const nodeId = String(node.id).trim();

  const outDegree = edges.filter(
    (e) => String(e.source_knowledge_point_id).trim() === nodeId
  ).length;

  const inDegree = edges.filter(
    (e) => String(e.target_knowledge_point_id).trim() === nodeId
  ).length;

  if (inDegree === 0 && outDegree > 0) return 'root';
  if (outDegree === 0 && inDegree > 0) return 'leaf';
  if (outDegree > 0 && inDegree > 0) return 'core';

  return 'normal';
}

function getLevelRadius(level: MindMapNodeLevel): number {
  const radii: Record<MindMapNodeLevel, number> = {
    root: 70,
    core: 60,
    sub: 50,
    normal: 40,
    leaf: 35,
  };
  return radii[level] || 40;
}

const calculateMindMapLayout = (
  nodes: MindMapLayoutNode[],
  edges: MindMapLayoutEdge[],
  options: MindMapLayoutOptions
): MindMapLayoutResult => {
  const { width, height, chargeStrength, linkDistance, centerForce, domainGroups } =
    options;

  const nodeCount = nodes.length;

  // Dynamic parameter adjustment based on node count
  const dynamicLinkDistance = linkDistance ?? (nodeCount > 100 ? 150 : nodeCount > 50 ? 130 : 100);
  const dynamicChargeStrength = chargeStrength ?? (nodeCount > 100 ? -200 : nodeCount > 50 ? -150 : -100);
  const dynamicCenterForce = centerForce ?? (nodeCount > 100 ? 0.2 : nodeCount > 50 ? 0.18 : 0.15);
  const dynamicIterations = nodeCount > 100 ? 700 : nodeCount > 50 ? 600 : 500;

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Initialize layout nodes with domain-grouped initial positions
  const layoutNodes: MindMapLayoutNode[] = nodes.map((node) => {
    const domain = node.properties?.domain as string | undefined;
    let initialX = width / 2 + (Math.random() - 0.5) * 100;
    let initialY = height / 2 + (Math.random() - 0.5) * 100;

    if (domain && domainGroups) {
      const domainNodeIds = domainGroups.get(domain);
      if (domainNodeIds) {
        const domainIndex = Array.from(domainGroups.keys()).indexOf(domain);
        const angle = (domainIndex / domainGroups.size) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.3;
        initialX = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
        initialY = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
      }
    }

    return {
      ...node,
      x: initialX,
      y: initialY,
      vx: 0,
      vy: 0,
    };
  });

  // Build layout links
  const layoutLinks: MindMapLayoutResult['links'] = edges
    .filter(
      (edge) =>
        nodeIds.has(edge.source_knowledge_point_id) &&
        nodeIds.has(edge.target_knowledge_point_id)
    )
    .map((edge) => ({
      ...edge,
      source: edge.source_knowledge_point_id,
      target: edge.target_knowledge_point_id,
    }));

  // Build d3-force simulation
  const simulation = d3
    .forceSimulation(layoutNodes as SimulationNodeDatum[])
    .force(
      'link',
      d3
        .forceLink(layoutLinks)
        .id((d: SimulationNodeDatum) => (d as MindMapLayoutNode).id)
        .distance(dynamicLinkDistance)
        .strength(0.3)
    )
    .force(
      'charge',
      d3.forceManyBody().strength((d: SimulationNodeDatum) => {
        const layoutNode = d as MindMapLayoutNode;
        const level = getMindMapLevel(layoutNode, edges);
        return (
          dynamicChargeStrength *
          (1 + LEVEL_CHARGE_STRENGTH[level] / -100)
        );
      })
    )
    .force(
      'center',
      d3.forceCenter(width / 2, height / 2).strength(dynamicCenterForce)
    )
    .force(
      'collide',
      d3
        .forceCollide()
        .radius((d: SimulationNodeDatum) => {
          const layoutNode = d as MindMapLayoutNode;
          const level = getMindMapLevel(layoutNode, edges);
          const baseRadius = getLevelRadius(level);
          return nodeCount > 50 ? baseRadius * 1.2 : baseRadius;
        })
        .strength(0.9)
    )
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03));

  // Domain grouping force
  if (domainGroups && domainGroups.size > 0) {
    const domainCenters = new Map<string, { x: number; y: number }>();
    const domainIndexList = Array.from(domainGroups.keys());

    domainIndexList.forEach((domain, idx) => {
      const angle = (idx / domainGroups.size) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.25;
      domainCenters.set(domain, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    simulation.force('domain', (alpha: number) => {
      layoutNodes.forEach((node) => {
        const domain = node.properties?.domain as string | undefined;
        if (domain && domainCenters.has(domain)) {
          const center = domainCenters.get(domain)!;
          node.vx = (node.vx || 0) + (center.x - (node.x ?? 0)) * alpha * 0.1;
          node.vy = (node.vy || 0) + (center.y - (node.y ?? 0)) * alpha * 0.1;
        }
      });
    });
  }

  simulation.stop();

  // Run synchronous ticks in worker
  for (let i = 0; i < dynamicIterations; i++) {
    simulation.tick();
  }

  return {
    nodes: layoutNodes,
    links: layoutLinks,
  };
};

// ============ Semantic Layout Types ============

interface SemanticLayoutNode {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  level?: MindMapNodeLevel;
  properties?: Record<string, unknown>;
}

interface SemanticLayoutOptions {
  width: number;
  height: number;
  nNeighbors?: number;
  minDist?: number;
  nEpochs?: number;
}

interface SemanticLayoutResult {
  nodes: SemanticLayoutNode[];
  links: Array<MindMapLayoutEdge & { source: string; target: string }>;
}

// ============ Semantic Layout Implementation ============

const calculateSemanticLayout = (
  nodes: SemanticLayoutNode[],
  edges: MindMapLayoutEdge[],
  embeddings: Record<string, number[]>,
  options: SemanticLayoutOptions,
): SemanticLayoutResult => {
  const { width, height, nNeighbors, minDist = 0.1, nEpochs = 200 } = options;

  const nodesWithEmbedding = nodes.filter(
    n => embeddings[n.id] && embeddings[n.id].length > 0,
  );
  const nodesWithoutEmbedding = nodes.filter(
    n => !embeddings[n.id] || embeddings[n.id].length === 0,
  );

  const semanticPositions = new Map<string, { x: number; y: number }>();

  if (nodesWithEmbedding.length >= 3) {
    const embeddingMatrix = nodesWithEmbedding.map(n => embeddings[n.id]);
    const effectiveNNeighbors =
      nNeighbors || Math.min(15, nodesWithEmbedding.length - 1);

    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: effectiveNNeighbors,
      minDist,
      nEpochs,
    });

    const embedding2d: number[][] = umap.fit(embeddingMatrix);

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const point of embedding2d) {
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 100;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    const scale = Math.min(availableWidth / rangeX, availableHeight / rangeY);

    nodesWithEmbedding.forEach((node, i) => {
      const scaledX = (embedding2d[i][0] - minX) * scale;
      const scaledY = (embedding2d[i][1] - minY) * scale;
      const offsetX = (availableWidth - rangeX * scale) / 2;
      const offsetY = (availableHeight - rangeY * scale) / 2;
      semanticPositions.set(node.id, {
        x: padding + offsetX + scaledX,
        y: padding + offsetY + scaledY,
      });
    });
  }

  const fallbackPositions = new Map<string, { x: number; y: number }>();
  if (nodesWithoutEmbedding.length > 0) {
    const fallbackLayout = calculateMindMapLayout(nodesWithoutEmbedding, edges, {
      width,
      height,
    });
    fallbackLayout.nodes.forEach(n => {
      fallbackPositions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    });
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  const layoutNodes: SemanticLayoutNode[] = nodes.map(node => {
    const pos =
      semanticPositions.get(node.id) ||
      fallbackPositions.get(node.id) || {
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100,
      };
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
    };
  });

  const layoutLinks: SemanticLayoutResult['links'] = edges
    .filter(
      edge =>
        nodeIds.has(edge.source_knowledge_point_id) &&
        nodeIds.has(edge.target_knowledge_point_id),
    )
    .map(edge => ({
      ...edge,
      source: edge.source_knowledge_point_id,
      target: edge.target_knowledge_point_id,
    }));

  return {
    nodes: layoutNodes,
    links: layoutLinks,
  };
};

const graphWorker = {
  calculateForceDirectedLayout,
  calculateNodeImportance,
  filterNodes,
  sortNodes,
  calculateMindMapLayout,
  calculateSemanticLayout,
};

export type GraphWorker = typeof graphWorker;

expose(graphWorker);
