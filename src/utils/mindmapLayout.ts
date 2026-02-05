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
  root: -200,
  core: -150,
  sub: -100,
  normal: -80,
  leaf: -50
};

const LEVEL_LINK_DISTANCE: Record<NodeLevel, number> = {
  root: 200,
  core: 150,
  sub: 120,
  normal: 100,
  leaf: 80
};

export const createMindMapLayout = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): LayoutResult => {
  const { width, height, chargeStrength, linkDistance, centerForce } = options;

  const layoutNodes: LayoutNode[] = nodes.map(node => ({
    ...node,
    x: width / 2 + (Math.random() - 0.5) * 100,
    y: height / 2 + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0
  }));

  const layoutLinks: LayoutLink[] = edges.map(edge => ({
    ...edge,
    source: edge.source_node_id,
    target: edge.target_node_id
  }));

  const simulation = d3.forceSimulation(layoutNodes)
    .force('link', d3.forceLink(layoutLinks)
      .id((d: any) => d.id)
      .distance(linkDistance || 100)
      .strength(0.5)
    )
    .force('charge', d3.forceManyBody()
      .strength((d: any) => {
        const level = getLevel(d, edges);
        return chargeStrength || LEVEL_CHARGE_STRENGTH[level];
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2)
      .strength(centerForce || 0.1)
    )
    .force('collide', d3.forceCollide()
      .radius((d: any) => {
        const level = getLevel(d, edges);
        return getLevelRadius(level);
      })
      .strength(0.7)
    )
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  simulation.stop();

  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  return {
    nodes: layoutNodes,
    links: layoutLinks
  };
};

const getLevelRadius = (level: NodeLevel): number => {
  const radii: Record<NodeLevel, number> = {
    root: 50,
    core: 40,
    sub: 32,
    normal: 26,
    leaf: 20
  };
  return radii[level] || 26;
};

export const getLinkNodeId = (node: string | LayoutNode): string => {
  if (typeof node === 'string') return node;
  return node.id;
};