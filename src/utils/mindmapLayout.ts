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
  /** 已有节点的初始坐标：用于在布局重算/视图切换时保留原有布局，而非每次随机重排 */
  initialPositions?: Map<string, { x: number; y: number }>;
  /** 主线程 fallback 模式：>50 节点时降级采样/减少迭代，避免同步计算卡 UI */
  fast?: boolean;
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
  const { width, height, chargeStrength, linkDistance, centerForce, domainGroups, initialPositions, fast } = options;

  const nodeCount = nodes.length;

  /** fast 模式下 >50 节点仍跑全量迭代会卡 UI 数百 ms，降采样迭代次数 */
  const FAST_MAX_ITERATIONS = 150;

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
    if (fast && nodeCount > 50) return FAST_MAX_ITERATIONS;
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
    const priorPosition = initialPositions?.get(node.id);
    let initialX: number;
    let initialY: number;

    // 已有坐标：直接作为初始位置，保留原有布局（视图切换/增改节点时不再随机整图重排）
    if (priorPosition && Number.isFinite(priorPosition.x) && Number.isFinite(priorPosition.y)) {
      initialX = priorPosition.x;
      initialY = priorPosition.y;
    } else {
      initialX = width / 2 + (Math.random() - 0.5) * 100;
      initialY = height / 2 + (Math.random() - 0.5) * 100;

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
  /** 无 embedding 节点的初始坐标，用于保留原有布局 */
  initialPositions?: Map<string, { x: number; y: number }>;
  /** 主线程 fallback 模式：embedding >50 时抽样跑 UMAP，其余节点就近锚定 */
  fast?: boolean;
}

export const createSemanticLayout = (
  nodes: Node[],
  edges: Edge[],
  embeddings: Map<string, number[]>,
  options: SemanticLayoutOptions,
): LayoutResult => {
  const { width, height, nNeighbors, minDist = 0.1, nEpochs = 200, initialPositions, fast } = options;

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
    /** fast 模式下 >50 个 embedding 时抽样跑 UMAP，其余节点就近锚定 */
    const FAST_SAMPLE_SIZE = 50;

    // 单趟收集有效 embedding，替代 map+filter 两次扫描
    const embeddingMatrix: number[][] = [];
    for (const n of nodesWithEmbedding) {
      const emb = embeddings.get(n.id);
      if (emb !== undefined && emb.length > 0) embeddingMatrix.push(emb);
    }

    const needSampling = fast && embeddingMatrix.length > FAST_SAMPLE_SIZE;
    const sampledIndices: number[] = [];
    if (needSampling) {
      // 均匀抽样：保留首尾并在中间等距取样，保持 embedding 空间覆盖
      const total = embeddingMatrix.length;
      for (let i = 0; i < FAST_SAMPLE_SIZE; i++) {
        sampledIndices.push(Math.round((i * (total - 1)) / (FAST_SAMPLE_SIZE - 1)));
      }
    }

    const fitMatrix = needSampling
      ? sampledIndices.map((idx) => embeddingMatrix[idx])
      : embeddingMatrix;

    const effectiveNNeighbors = nNeighbors || Math.min(15, fitMatrix.length - 1);

    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: effectiveNNeighbors,
      minDist,
      nEpochs: needSampling ? Math.min(nEpochs, 100) : nEpochs,
    });

    const embedding2d: number[][] = umap.fit(fitMatrix);

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

    const scaledPoint = (point: [number, number] | number[]): { x: number; y: number } => {
      const scaledX = (point[0] - minX) * scale;
      const scaledY = (point[1] - minY) * scale;
      const offsetX = (availableWidth - rangeX * scale) / 2;
      const offsetY = (availableHeight - rangeY * scale) / 2;
      return { x: padding + offsetX + scaledX, y: padding + offsetY + scaledY };
    };

    if (needSampling) {
      // 抽样节点直接采用 UMAP 结果
      sampledIndices.forEach((originalIdx, sampleRank) => {
        semanticPositions.set(nodesWithEmbedding[originalIdx].id, scaledPoint(embedding2d[sampleRank]));
      });
      // 非抽样节点：在 embedding 空间找最近抽样节点，锚定在其附近并加抖动
      const sampledEmbeddings = sampledIndices.map((idx) => embeddingMatrix[idx]);
      nodesWithEmbedding.forEach((node, i) => {
        if (semanticPositions.has(node.id)) return;
        const emb = embeddingMatrix[i];
        let nearestRank = 0;
        let nearestDist = Infinity;
        for (let s = 0; s < sampledEmbeddings.length; s++) {
          let dist = 0;
          const target = sampledEmbeddings[s];
          for (let d = 0; d < emb.length; d++) {
            const diff = emb[d] - (target[d] ?? 0);
            dist += diff * diff;
          }
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestRank = s;
          }
        }
        const anchor = scaledPoint(embedding2d[nearestRank]);
        semanticPositions.set(node.id, {
          x: anchor.x + (Math.random() - 0.5) * 40,
          y: anchor.y + (Math.random() - 0.5) * 40,
        });
      });
    } else {
      nodesWithEmbedding.forEach((node, i) => {
        semanticPositions.set(node.id, scaledPoint(embedding2d[i]));
      });
    }
  }

  const fallbackPositions: Map<string, { x: number; y: number }> = new Map();
  if (nodesWithoutEmbedding.length > 0) {
    const fallbackLayout = createMindMapLayout(nodesWithoutEmbedding, edges, {
      width,
      height,
      fast,
      initialPositions,
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
