import type { Node, Edge, RegionInfo, NodeLevel } from "@shared/types";

const LEVEL_WEIGHTS: Record<NodeLevel, number> = {
  root: 1.0,
  core: 0.8,
  sub: 0.6,
  normal: 0.4,
  leaf: 0.2,
};

export function calculateRegionAngles(
  regionCount: number,
): Array<{ angleStart: number; angleEnd: number }> {
  if (regionCount <= 0) {
    return [];
  }

  const anglePerRegion = (2 * Math.PI) / regionCount;
  const regions: Array<{ angleStart: number; angleEnd: number }> = [];

  for (let i = 0; i < regionCount; i++) {
    regions.push({
      angleStart: i * anglePerRegion,
      angleEnd: (i + 1) * anglePerRegion,
    });
  }

  return regions;
}

export function calculateNodeImportance(
  node: Node,
  degreeMap: Map<unknown, number>,
  edgeCount: number,
): number {
  const level = node.level ?? "normal";
  const levelScore = LEVEL_WEIGHTS[level] ?? 0.4;

  const nodeId = node.knowledge_point_id ?? node.id;
  const connectionCount = degreeMap.get(nodeId) ?? 0;

  const maxConnections = Math.max(edgeCount, 1);
  const connectionScore = Math.min(connectionCount / maxConnections, 1);

  const sources = node.properties?.sources ?? [];
  const sourceScore = Math.min(sources.length / 5, 1);

  const importance =
    levelScore * 0.5 + connectionScore * 0.3 + sourceScore * 0.2;

  return Math.max(0, Math.min(1, importance));
}

export function calculateNodePosition(
  node: Node,
  regionAngleStart: number,
  regionAngleEnd: number,
  importance: number,
  originPosition: { x: number; y: number },
  baseRadius: number,
  maxRadius: number,
): { x: number; y: number } {
  const distance = baseRadius + (1 - importance) * maxRadius;

  const angleRange = regionAngleEnd - regionAngleStart;
  const nodeId = node.knowledge_point_id ?? node.id;
  const seed = hashCode(nodeId);
  const randomAngle = (Math.abs(seed % 1000) / 1000) * angleRange;
  const angle = regionAngleStart + randomAngle;

  const x = originPosition.x + distance * Math.cos(angle);
  const y = originPosition.y + distance * Math.sin(angle);

  return { x, y };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

export function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  regions: RegionInfo[],
  originPosition: { x: number; y: number },
  baseRadius: number = 150,
  maxRadius: number = 300,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const processedNodeIds = new Set<string>();

  const degreeMap = new Map<unknown, number>();
  edges.forEach(edge => {
    const s = edge.source_knowledge_point_id;
    const t = edge.target_knowledge_point_id;
    if (s === t) {
      // self-loop: counts once
      degreeMap.set(s, (degreeMap.get(s) ?? 0) + 1);
    } else {
      degreeMap.set(s, (degreeMap.get(s) ?? 0) + 1);
      degreeMap.set(t, (degreeMap.get(t) ?? 0) + 1);
    }
  });

  for (const region of regions) {
    for (const node of region.nodes) {
      const importance = calculateNodeImportance(node, degreeMap, edges.length);
      const position = calculateNodePosition(
        node,
        region.angleStart,
        region.angleEnd,
        importance,
        originPosition,
        baseRadius,
        maxRadius,
      );
      const nodeId = node.knowledge_point_id ?? node.id;
      positions.set(nodeId, position);
      processedNodeIds.add(nodeId);
    }
  }

  const regionAngles = calculateRegionAngles(regions.length || 1);
  for (const node of nodes) {
    const nodeId = node.knowledge_point_id ?? node.id;
    if (!processedNodeIds.has(nodeId)) {
      const importance = calculateNodeImportance(node, degreeMap, edges.length);
      const regionIndex = Math.abs(hashCode(nodeId)) % regionAngles.length;
      const angleInfo = regionAngles[regionIndex];
      const position = calculateNodePosition(
        node,
        angleInfo.angleStart,
        angleInfo.angleEnd,
        importance,
        originPosition,
        baseRadius,
        maxRadius,
      );
      positions.set(nodeId, position);
    }
  }

  return positions;
}

export function avoidCollisions(
  positions: Map<string, { x: number; y: number }>,
  minDistance: number = 50,
): Map<string, { x: number; y: number }> {
  const adjustedPositions = new Map<string, { x: number; y: number }>();
  const entries = Array.from(positions.entries());

  for (const [id, pos] of entries) {
    adjustedPositions.set(id, { ...pos });
  }

  const iterations = 50;
  const dampingFactor = 0.1;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < entries.length; i++) {
      const idA = entries[i][0];
      const currentA = adjustedPositions.get(idA);
      if (!currentA) continue;

      let forceX = 0;
      let forceY = 0;

      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;

        const idB = entries[j][0];
        const currentB = adjustedPositions.get(idB);
        if (!currentB) continue;

        const dx = currentA.x - currentB.x;
        const dy = currentA.y - currentB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance && distance > 0) {
          const force = (minDistance - distance) / distance;
          forceX += dx * force * dampingFactor;
          forceY += dy * force * dampingFactor;
        }
      }

      adjustedPositions.set(idA, {
        x: currentA.x + forceX,
        y: currentA.y + forceY,
      });
    }
  }

  return adjustedPositions;
}
