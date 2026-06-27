import { expose } from 'comlink';
import * as d3 from 'd3-force';
import type { SimulationNodeDatum } from 'd3-force';
import { quadtree } from 'd3-quadtree';
import { UMAP } from 'umap-js';
import type {
  LayoutNode3D,
  LayoutLink3D,
  LayoutResult3D,
} from '../three/layout/forceLayout3D';
import type { Node as GraphNode, Edge as GraphEdge, NodeLevel } from '../types';

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

  // Quadtree-backed repulsion. Instead of an O(n^2) all-pairs loop, build a
  // quadtree per iteration and prune subtrees whose bounding box lies outside
  // the repulsion radius. Repulsion falls off as 1/r^2, so contributions below
  // a small magnitude threshold are negligible and safe to skip.
  const minRepulsionForce = 0.05;
  const repulsionRadius = Math.sqrt(repulsionStrength / minRepulsionForce);
  const repulsionRadius2 = repulsionRadius * repulsionRadius;

  for (let iter = 0; iter < iterations; iter++) {
    const nodesArray = Array.from(nodeMap.values());

    const qt = quadtree<Node>()
      .x((d: Node) => d.x ?? 0)
      .y((d: Node) => d.y ?? 0)
      .addAll(nodesArray);

    for (let i = 0; i < nodesArray.length; i++) {
      const nodeA = nodesArray[i];
      const ax = nodeA.x ?? 0;
      const ay = nodeA.y ?? 0;
      let fx = 0;
      let fy = 0;

      qt.visit((node, x0, y0, x1, y1) => {
        if (Array.isArray(node)) {
          // Internal node: skip the whole subtree when its bounding box is
          // entirely outside the query circle around (ax, ay).
          let closestX = ax;
          if (ax < x0) closestX = x0;
          else if (ax > x1) closestX = x1;
          let closestY = ay;
          if (ay < y0) closestY = y0;
          else if (ay > y1) closestY = y1;
          const ddx = ax - closestX;
          const ddy = ay - closestY;
          return ddx * ddx + ddy * ddy > repulsionRadius2;
        }
        // Leaf: exact pairwise repulsion against every point stored here
        // (coincident points are chained via `next`).
        let leaf: typeof node | undefined = node;
        while (leaf) {
          const point = leaf.data;
          if (point !== nodeA) {
            const dx = ax - (point.x ?? 0);
            const dy = ay - (point.y ?? 0);
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= repulsionRadius2) {
              const distance = Math.sqrt(dist2) || 1;
              const force = repulsionStrength / (distance * distance);
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          }
          leaf = leaf.next;
        }
        return false;
      });

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

const calculatePageRank = (
  nodes: Node[],
  edges: Edge[],
  iterations: number = 20
): Map<string, number> => {
  const dampingFactor = 0.85;

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

  return ranks;
};

const calculateNodeImportance = (
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  pageRanks?: Map<string, number>
): number => {
  const outDegree = edges.filter(e => e.source === nodeId).length;
  const inDegree = edges.filter(e => e.target === nodeId).length;
  const totalDegree = outDegree + inDegree;

  // Reuse a precomputed PageRank vector when provided so batch callers pay
  // the iterative cost only once for the whole graph instead of per node.
  const ranks = pageRanks ?? calculatePageRank(nodes, edges);

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

// ============ 3D Force Layout (offloaded from main thread) ============
// Mirrors src/three/layout/forceLayout3D.ts but runs inside the worker so the
// main thread stays responsive. Collision detection uses a uniform spatial
// grid (O(n) average) instead of the original O(n^2) pairwise check.

const LEVEL_PRIORITY_3D: Record<NodeLevel, number> = {
  root: 0,
  core: 1,
  sub: 2,
  normal: 3,
  leaf: 4,
};

function get3DLevelNumber(level?: NodeLevel): number {
  if (!level) return 3;
  return LEVEL_PRIORITY_3D[level] ?? 3;
}

function compute3DNodeImportance(node: GraphNode, edges: GraphEdge[]): number {
  const connections = edges.filter(
    e => e.source_knowledge_point_id === node.id || e.target_knowledge_point_id === node.id
  ).length;
  const childCount = edges.filter(e => e.source_knowledge_point_id === node.id).length;
  const levelFactor = Math.max(1, 5 - get3DLevelNumber(node.level));
  return connections * 0.3 + childCount * 0.5 + levelFactor * 0.5;
}

interface Layout3DOptions {
  width?: number;
  height?: number;
  depth?: number;
  iterations?: number;
}

const calculate3DForceLayout = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Layout3DOptions = {}
): LayoutResult3D => {
  const { width: _width = 800, height: _height = 600, depth = 600, iterations = 300 } = options;

  const layoutNodes: LayoutNode3D[] = nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = 100 + Math.random() * 100;
    return {
      id: node.id,
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
      y: Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
      z: (Math.random() - 0.5) * depth * 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      level: get3DLevelNumber(node.level),
      importance: compute3DNodeImportance(node, edges),
      data: node,
    };
  });

  const nodeMap = new Map<string, LayoutNode3D>();
  layoutNodes.forEach(n => nodeMap.set(n.id, n));

  const layoutLinks: LayoutLink3D[] = edges.map(edge => ({
    source: edge.source_knowledge_point_id,
    target: edge.target_knowledge_point_id,
    strength: 1,
  }));

  const centerX = 0;
  const centerY = 0;
  const centerZ = 0;

  // Uniform-grid collision detection. The cell size equals the collision
  // threshold, so any node within collision range must live in one of the 27
  // neighbouring cells — turning the old O(n^2) all-pairs check into O(n).
  const collisionDistance = 60;
  const cellSize = collisionDistance;

  for (let iter = 0; iter < iterations; iter++) {
    layoutNodes.forEach(node => {
      node.vx += (centerX - node.x) * 0.001;
      node.vy += (centerY - node.y) * 0.001;
      node.vz += (centerZ - node.z) * 0.001;
    });

    layoutLinks.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const idealDist = 80;
      const force = (dist - idealDist) * 0.02 * link.strength;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;

      source.vx += fx;
      source.vy += fy;
      source.vz += fz;
      target.vx -= fx;
      target.vy -= fy;
      target.vz -= fz;
    });

    const grid = new Map<string, LayoutNode3D[]>();
    for (const node of layoutNodes) {
      const key = `${Math.floor(node.x / cellSize)},${Math.floor(node.y / cellSize)},${Math.floor(node.z / cellSize)}`;
      const bucket = grid.get(key);
      if (bucket) {
        bucket.push(node);
      } else {
        grid.set(key, [node]);
      }
    }

    layoutNodes.forEach(node => {
      const cx = Math.floor(node.x / cellSize);
      const cy = Math.floor(node.y / cellSize);
      const cz = Math.floor(node.z / cellSize);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!bucket) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const other = bucket[bi];
              if (other === node) continue;
              const ddx = other.x - node.x;
              const ddy = other.y - node.y;
              const ddz = other.z - node.z;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1;
              if (dist < collisionDistance) {
                const force = (collisionDistance - dist) * 0.05;
                const fx = (ddx / dist) * force;
                const fy = (ddy / dist) * force;
                const fz = (ddz / dist) * force;
                node.vx -= fx;
                node.vy -= fy;
                node.vz -= fz;
              }
            }
          }
        }
      }
    });

    layoutNodes.forEach(node => {
      node.vx *= 0.9;
      node.vy *= 0.9;
      node.vz *= 0.9;
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;
    });
  }

  return { nodes: layoutNodes, links: layoutLinks };
};

const graphWorker = {
  calculateForceDirectedLayout,
  calculateNodeImportance,
  calculatePageRank,
  filterNodes,
  sortNodes,
  calculateMindMapLayout,
  calculateSemanticLayout,
  calculate3DForceLayout,
};

export type GraphWorker = typeof graphWorker;

expose(graphWorker);
