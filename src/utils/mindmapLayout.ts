import { Node, Edge, LayoutNode, LayoutLink, NodeLevel } from '../types';
import * as d3 from 'd3-force';
import type { SimulationNodeDatum } from 'd3-force';
import { buildLevelMap, getLevel } from '../utils/graph/graphUtils';
import { UMAP } from 'umap-js';

export interface LayoutResult {
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutOptions {
  width: number;
  height: number;
  chargeStrength?: number;
  linkDistance?: number;
  centerForce?: number;
  domainGroups?: Map<string, string[]>;
}

const LEVEL_CHARGE_STRENGTH: Record<NodeLevel, number> = {
  root: -300,
  core: -250,
  sub: -180,
  normal: -150,
  leaf: -120
};

export const createMindMapLayout = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): LayoutResult => {
  const { width, height, chargeStrength, linkDistance, centerForce, domainGroups } = options;

  const nodeCount = nodes.length;

  const dynamicLinkDistance = linkDistance || (() => {
    if (nodeCount > 100) return 150;
    if (nodeCount > 50) return 130;
    return 100;
  })();

  const dynamicChargeStrength = chargeStrength || (() => {
    if (nodeCount > 100) return -200;
    if (nodeCount > 50) return -150;
    return -100;
  })();

  const dynamicCenterForce = centerForce || (() => {
    if (nodeCount > 100) return 0.2;
    if (nodeCount > 50) return 0.18;
    return 0.15;
  })();

  const dynamicIterations = (() => {
    if (nodeCount > 100) return 700;
    if (nodeCount > 50) return 600;
    return 500;
  })();

  const nodeIds = new Set(nodes.map(n => n.id));

  const levelMap = buildLevelMap(nodes, edges);

  const domainIndexByKey = domainGroups
    ? new Map(
        Array.from(domainGroups.keys()).map((key, idx) => [key, idx] as const),
      )
    : undefined;

  const layoutNodes: LayoutNode[] = nodes.map(node => {
    const domain = node.properties?.domain as string | undefined;
    let initialX = width / 2 + (Math.random() - 0.5) * 100;
    let initialY = height / 2 + (Math.random() - 0.5) * 100;
    
    if (domain && domainGroups && domainIndexByKey) {
      const domainNodeIds = domainGroups.get(domain);
      if (domainNodeIds) {
        const domainIndex = domainIndexByKey.get(domain) ?? 0;
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
      vy: 0
    };
  });

  const layoutLinks: LayoutLink[] = edges
    .filter(edge => nodeIds.has(edge.source_knowledge_point_id) && nodeIds.has(edge.target_knowledge_point_id))
    .map(edge => ({
      ...edge,
      source: edge.source_knowledge_point_id,
      target: edge.target_knowledge_point_id
    }));

  const simulation = d3.forceSimulation(layoutNodes)
    .force('link', d3.forceLink(layoutLinks)
      .id((d: SimulationNodeDatum) => (d as LayoutNode).id)
      .distance(dynamicLinkDistance)
      .strength(0.3)
    )
    .force('charge', d3.forceManyBody()
      .strength((d: SimulationNodeDatum) => {
        const layoutNode = d as LayoutNode;
        const level = getLevel(layoutNode, edges, levelMap);
        return dynamicChargeStrength * (1 + (LEVEL_CHARGE_STRENGTH[level] / -100));
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2)
      .strength(dynamicCenterForce)
    )
    .force('collide', d3.forceCollide()
      .radius((d: SimulationNodeDatum) => {
        const layoutNode = d as LayoutNode;
        const level = getLevel(layoutNode, edges, levelMap);
        const baseRadius = getLevelRadius(level);
        return nodeCount > 50 ? baseRadius * 1.2 : baseRadius;
      })
      .strength(0.9)
    )
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03));

  if (domainGroups && domainGroups.size > 0) {
    const domainCenters = new Map<string, { x: number; y: number }>();
    const domainIndex = Array.from(domainGroups.keys());
    
    domainIndex.forEach((domain, idx) => {
      const angle = (idx / domainGroups.size) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.25;
      domainCenters.set(domain, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius
      });
    });

    simulation.force('domain', (alpha: number) => {
      layoutNodes.forEach(node => {
        const domain = node.properties?.domain as string | undefined;
        if (domain && domainCenters.has(domain)) {
          const center = domainCenters.get(domain);
          if (center) {
            node.vx = (node.vx || 0) + (center.x - node.x) * alpha * 0.1;
            node.vy = (node.vy || 0) + (center.y - node.y) * alpha * 0.1;
          }
        }
      });
    });
  }

  simulation.stop();

  for (let i = 0; i < dynamicIterations; i++) {
    simulation.tick();
  }

  return {
    nodes: layoutNodes,
    links: layoutLinks
  };
};

const getLevelRadius = (level: NodeLevel): number => {
  const radii: Record<NodeLevel, number> = {
    root: 70,
    core: 60,
    sub: 50,
    normal: 40,
    leaf: 35
  };
  return radii[level] || 40;
};

export const getLinkNodeId = (node: string | LayoutNode): string => {
  if (typeof node === 'string') return node;
  return node.id;
};

export interface SemanticLayoutOptions {
  width: number;
  height: number;
  nNeighbors?: number;
  minDist?: number;
  nEpochs?: number;
}

export const createSemanticLayout = (
  nodes: Node[],
  edges: Edge[],
  embeddings: Map<string, number[]>,
  options: SemanticLayoutOptions,
): LayoutResult => {
  const { width, height, nNeighbors, minDist = 0.1, nEpochs = 200 } = options;

  // 单趟分桶有/无 embedding 节点，替代两次 filter 的 O(2*nodes) 扫描
  const nodesWithEmbedding: typeof nodes = [];
  const nodesWithoutEmbedding: typeof nodes = [];
  for (const n of nodes) {
    const emb = embeddings.get(n.id);
    if (emb !== undefined && emb.length > 0) nodesWithEmbedding.push(n);
    else nodesWithoutEmbedding.push(n);
  }

  const semanticPositions: Map<string, { x: number; y: number }> = new Map();

  if (nodesWithEmbedding.length >= 3) {
    // 单趟收集有效 embedding，替代 map+filter 两次扫描
    const embeddingMatrix: number[][] = [];
    for (const n of nodesWithEmbedding) {
      const emb = embeddings.get(n.id);
      if (emb !== undefined && emb.length > 0) embeddingMatrix.push(emb);
    }
    const effectiveNNeighbors = nNeighbors || Math.min(15, nodesWithEmbedding.length - 1);

    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: effectiveNNeighbors,
      minDist,
      nEpochs,
    });

    const embedding2d: number[][] = umap.fit(embeddingMatrix);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
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

  const fallbackPositions: Map<string, { x: number; y: number }> = new Map();
  if (nodesWithoutEmbedding.length > 0) {
    const fallbackLayout = createMindMapLayout(nodesWithoutEmbedding, edges, {
      width,
      height,
    });
    fallbackLayout.nodes.forEach(n => {
      fallbackPositions.set(n.id, { x: n.x, y: n.y });
    });
  }

  const nodeIds = new Set(nodes.map(n => n.id));

  const layoutNodes: LayoutNode[] = nodes.map(node => {
    const pos = semanticPositions.get(node.id) || fallbackPositions.get(node.id) || {
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

  const layoutLinks: LayoutLink[] = edges
    .filter(edge => nodeIds.has(edge.source_knowledge_point_id) && nodeIds.has(edge.target_knowledge_point_id))
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
