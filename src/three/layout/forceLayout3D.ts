import { Node, Edge, NodeLevel } from '../../types';

export interface LayoutNode3D {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  level: number;
  importance: number;
  data: Node;
}

export interface LayoutLink3D {
  source: string;
  target: string;
  strength: number;
}

export interface LayoutResult3D {
  nodes: LayoutNode3D[];
  links: LayoutLink3D[];
}

const LEVEL_PRIORITY: Record<NodeLevel, number> = {
  'root': 0,
  'core': 1,
  'sub': 2,
  'normal': 3,
  'leaf': 4
};

function getLevelNumber(level?: NodeLevel): number {
  if (!level) return 3;
  return LEVEL_PRIORITY[level] ?? 3;
}

function calculateNodeImportance(node: Node, nodes: Node[], edges: Edge[]): number {
  const connections = edges.filter(e => e.source_node_id === node.id || e.target_node_id === node.id).length;
  const childCount = edges.filter(e => e.source_node_id === node.id).length;
  const levelFactor = Math.max(1, 5 - getLevelNumber(node.level));
  return connections * 0.3 + childCount * 0.5 + levelFactor * 0.5;
}

export function create3DForceLayout(
  nodes: Node[],
  edges: Edge[],
  options: {
    width?: number;
    height?: number;
    depth?: number;
    iterations?: number;
  } = {}
): LayoutResult3D {
  const { width = 800, height = 600, depth = 600, iterations = 300 } = options;

  const layoutNodes: LayoutNode3D[] = nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2;
    const radius = 100 + Math.random() * 100;
    return {
      id: node.id,
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
      y: Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
      z: (Math.random() - 0.5) * depth * 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      level: getLevelNumber(node.level),
      importance: calculateNodeImportance(node, nodes, edges),
      data: node
    };
  });

  const nodeMap = new Map<string, LayoutNode3D>();
  layoutNodes.forEach(n => nodeMap.set(n.id, n));

  const layoutLinks: LayoutLink3D[] = edges.map(edge => ({
    source: edge.source_node_id,
    target: edge.target_node_id,
    strength: 1
  }));

  const centerX = 0;
  const centerY = 0;
  const centerZ = 0;

  for (let i = 0; i < iterations; i++) {
    layoutNodes.forEach(node => {
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      const dz = centerZ - node.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      node.vx += dx * 0.001;
      node.vy += dy * 0.001;
      node.vz += dz * 0.001;
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

    for (let j = 0; j < layoutNodes.length; j++) {
      for (let k = j + 1; k < layoutNodes.length; k++) {
        const n1 = layoutNodes[j];
        const n2 = layoutNodes[k];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dz = n2.z - n1.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const minDist = 60;
        
        if (dist < minDist) {
          const force = (minDist - dist) * 0.05;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          n1.vx -= fx;
          n1.vy -= fy;
          n1.vz -= fz;
          n2.vx += fx;
          n2.vy += fy;
          n2.vz += fz;
        }
      }
    }

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
}
