import { Node, Edge, LayoutNode, LayoutLink, NodeLevel } from '../types';
import * as d3 from 'd3-force';
import { getLevel } from '../lib/graphUtils';

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
}

const LEVEL_CHARGE_STRENGTH: Record<NodeLevel, number> = {
  root: -300,
  core: -250,
  sub: -180,
  normal: -150,
  leaf: -120
};

const LEVEL_LINK_DISTANCE: Record<NodeLevel, number> = {
  root: 280,
  core: 220,
  sub: 180,
  normal: 150,
  leaf: 120
};

export const createMindMapLayout = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): LayoutResult => {
  const { width, height, chargeStrength, linkDistance, centerForce } = options;

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

  const layoutNodes: LayoutNode[] = nodes.map(node => ({
    ...node,
    x: width / 2 + (Math.random() - 0.5) * 100,
    y: height / 2 + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0
  }));

  const layoutLinks: LayoutLink[] = edges
    .filter(edge => nodeIds.has(edge.source_node_id) && nodeIds.has(edge.target_node_id))
    .map(edge => ({
      ...edge,
      source: edge.source_node_id,
      target: edge.target_node_id
    }));

  const simulation = d3.forceSimulation(layoutNodes)
    .force('link', d3.forceLink(layoutLinks)
      .id((d: any) => d.id)
      .distance(dynamicLinkDistance)
      .strength(0.3)
    )
    .force('charge', d3.forceManyBody()
      .strength((d: any) => {
        const level = getLevel(d, edges);
        return dynamicChargeStrength * (1 + (LEVEL_CHARGE_STRENGTH[level] / -100));
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2)
      .strength(dynamicCenterForce)
    )
    .force('collide', d3.forceCollide()
      .radius((d: any) => {
        const level = getLevel(d, edges);
        const baseRadius = getLevelRadius(level);
        return nodeCount > 50 ? baseRadius * 1.2 : baseRadius;
      })
      .strength(0.9)
    )
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03));

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