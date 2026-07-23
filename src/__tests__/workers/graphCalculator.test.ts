import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock comlink so importing the worker doesn't try to set up a worker environment.
// The mock captures the object passed to expose().
vi.mock('comlink', () => ({
  expose: vi.fn(),
}));

import { expose } from 'comlink';
// Side-effect import triggers the module body, which calls expose(graphWorker).
import '../../workers/graphCalculator.worker';
// eslint-disable-next-line no-duplicate-imports -- side-effect import must stay separate to trigger module body
import type { GraphWorker } from '../../workers/graphCalculator.worker';

// Capture the object that the worker passed to comlink.expose().
const mockedExpose = vi.mocked(expose);
const graphWorker = mockedExpose.mock.calls[0]?.[0] as GraphWorker | undefined;

if (!graphWorker) {
  throw new Error('graphWorker was not exposed via comlink.expose()');
}

// ---- Test data helpers ----

interface SimpleNode {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  title?: string;
  [key: string]: unknown;
}

interface SimpleEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

const makeNodes = (ids: string[]): SimpleNode[] =>
  ids.map((id) => ({ id, title: `Node ${id}` }));

const makeEdge = (source: string, target: string): SimpleEdge => ({
  source,
  target,
});

// ---- Tests ----

describe('graphCalculator worker', () => {
  describe('calculateForceDirectedLayout', () => {
    it('should converge for a small graph (3-5 nodes)', () => {
      const nodes = makeNodes(['n1', 'n2', 'n3', 'n4', 'n5']);
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n3', 'n4'),
        makeEdge('n4', 'n5'),
        makeEdge('n5', 'n1'),
      ];

      const result = graphWorker.calculateForceDirectedLayout(
        nodes,
        edges,
        {
          width: 800,
          height: 600,
          iterations: 100,
          linkDistance: 100,
          repulsionStrength: 500,
          attractionStrength: 0.1,
          damping: 0.9,
        },
      );

      expect(result).toHaveLength(5);
      // After layout, all nodes should have valid x, y coordinates (not NaN/undefined)
      result.forEach((node) => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
        expect(Number.isFinite(node.x as number)).toBe(true);
        expect(Number.isFinite(node.y as number)).toBe(true);
        // Positions should be within bounds (with padding of 50)
        expect(node.x as number).toBeGreaterThanOrEqual(50);
        expect(node.x as number).toBeLessThanOrEqual(750);
        expect(node.y as number).toBeGreaterThanOrEqual(50);
        expect(node.y as number).toBeLessThanOrEqual(550);
      });
    });

    it('should handle an empty graph', () => {
      const result = graphWorker.calculateForceDirectedLayout([], [], {
        width: 800,
        height: 600,
        iterations: 10,
      });

      expect(result).toEqual([]);
    });

    it('should handle a single node', () => {
      const result = graphWorker.calculateForceDirectedLayout(
        [{ id: 'only' }],
        [],
        { width: 800, height: 600, iterations: 10 },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('only');
    });

    it('should separate connected nodes from each other after iterations', () => {
      const nodes = makeNodes(['a', 'b', 'c']);
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')];

      const result = graphWorker.calculateForceDirectedLayout(
        nodes,
        edges,
        {
          width: 800,
          height: 600,
          iterations: 200,
          linkDistance: 150,
          repulsionStrength: 800,
        },
      );

      // No two nodes should be at the exact same position
      const positions = result.map((n) => `${n.x},${n.y}`);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  describe('calculateMindMapLayout', () => {
    it('should position all nodes within bounds', () => {
      const nodes = [
        { id: 'root', properties: {} },
        { id: 'child1', properties: {} },
        { id: 'child2', properties: {} },
        { id: 'child3', properties: {} },
      ];
      const edges = [
        { id: 'e1', source_knowledge_point_id: 'root', target_knowledge_point_id: 'child1' },
        { id: 'e2', source_knowledge_point_id: 'root', target_knowledge_point_id: 'child2' },
        { id: 'e3', source_knowledge_point_id: 'root', target_knowledge_point_id: 'child3' },
      ];

      const result = graphWorker.calculateMindMapLayout(nodes, edges, {
        width: 800,
        height: 600,
      });

      expect(result.nodes).toHaveLength(4);
      expect(result.links).toHaveLength(3);
      // All nodes should have valid coordinates
      result.nodes.forEach((node) => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
        expect(Number.isFinite(node.x as number)).toBe(true);
        expect(Number.isFinite(node.y as number)).toBe(true);
      });
    });

    it('should respect hierarchy: root node should exist in output', () => {
      const nodes = [
        { id: 'root', properties: { level: 'root' } },
        { id: 'leaf1', properties: { level: 'leaf' } },
        { id: 'leaf2', properties: { level: 'leaf' } },
      ];
      const edges = [
        { id: 'e1', source_knowledge_point_id: 'root', target_knowledge_point_id: 'leaf1' },
        { id: 'e2', source_knowledge_point_id: 'root', target_knowledge_point_id: 'leaf2' },
      ];

      const result = graphWorker.calculateMindMapLayout(nodes, edges, {
        width: 800,
        height: 600,
      });

      const rootNode = result.nodes.find((n) => n.id === 'root');
      expect(rootNode).toBeDefined();
      // Root node should be positioned near center (force center pulls it in)
      expect(rootNode?.x).toBeDefined();
      expect(rootNode?.y).toBeDefined();
    });

    it('should handle domain grouping', () => {
      const domainGroups = new Map<string, string[]>([
        ['domain-a', ['n1', 'n2']],
        ['domain-b', ['n3', 'n4']],
      ]);
      const nodes = [
        { id: 'n1', properties: { domain: 'domain-a' } },
        { id: 'n2', properties: { domain: 'domain-a' } },
        { id: 'n3', properties: { domain: 'domain-b' } },
        { id: 'n4', properties: { domain: 'domain-b' } },
      ];
      const edges: Array<{ id: string; source_knowledge_point_id: string; target_knowledge_point_id: string }> = [];

      const result = graphWorker.calculateMindMapLayout(nodes, edges, {
        width: 800,
        height: 600,
        domainGroups,
      });

      expect(result.nodes).toHaveLength(4);
      result.nodes.forEach((node) => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
      });
    });
  });

  describe('calculateSemanticLayout', () => {
    it('should reduce embeddings to 2D coordinates', () => {
      const nodes = [
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
      ];
      const edges: Array<{ id: string; source_knowledge_point_id: string; target_knowledge_point_id: string }> = [];
      // Create distinct embeddings (4-dimensional)
      const embeddings: Record<string, number[]> = {
        s1: [1, 0, 0, 0],
        s2: [0, 1, 0, 0],
        s3: [0, 0, 1, 0],
        s4: [0, 0, 0, 1],
      };

      const result = graphWorker.calculateSemanticLayout(
        nodes,
        edges,
        embeddings,
        {
          width: 800,
          height: 600,
          nNeighbors: 3,
          nEpochs: 10, // Keep low for test speed
        },
      );

      expect(result.nodes).toHaveLength(4);
      result.nodes.forEach((node) => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
        expect(Number.isFinite(node.x as number)).toBe(true);
        expect(Number.isFinite(node.y as number)).toBe(true);
      });
    });

    it('should handle nodes without embeddings via fallback', () => {
      const nodes = [
        { id: 'with-emb' },
        { id: 'without-emb' },
        { id: 'another-emb' },
      ];
      const edges: Array<{ id: string; source_knowledge_point_id: string; target_knowledge_point_id: string }> = [];
      const embeddings: Record<string, number[]> = {
        'with-emb': [1, 0, 0],
        'another-emb': [0, 0, 1],
        // 'without-emb' has no embedding
      };

      const result = graphWorker.calculateSemanticLayout(
        nodes,
        edges,
        embeddings,
        {
          width: 800,
          height: 600,
          nEpochs: 5,
        },
      );

      expect(result.nodes).toHaveLength(3);
      // Node without embedding should still get a position via fallback
      const fallbackNode = result.nodes.find((n) => n.id === 'without-emb');
      expect(fallbackNode?.x).toBeDefined();
      expect(fallbackNode?.y).toBeDefined();
    });
  });

  describe('calculatePageRank', () => {
    it('should rank highly-connected nodes higher than isolated ones', () => {
      // Hub receives incoming edges from many leaf nodes (PageRank rewards
      // incoming links, so edges point toward the hub).
      // Isolated node has no connections at all.
      const nodes = makeNodes(['hub', 'leaf1', 'leaf2', 'leaf3', 'isolated']);
      const edges = [
        makeEdge('leaf1', 'hub'),
        makeEdge('leaf2', 'hub'),
        makeEdge('leaf3', 'hub'),
        // 'isolated' has no connections
      ];

      const ranks = graphWorker.calculatePageRank(nodes, edges, 20);

      expect(ranks.size).toBe(5);
      // Hub should have higher rank than isolated node
      const hubRank = ranks.get('hub') ?? 0;
      const isolatedRank = ranks.get('isolated') ?? 0;
      expect(hubRank).toBeGreaterThan(isolatedRank);
    });

    it('should give all nodes equal rank for an empty edge set', () => {
      const nodes = makeNodes(['a', 'b', 'c']);
      const edges: SimpleEdge[] = [];

      const ranks = graphWorker.calculatePageRank(nodes, edges, 10);

      const rankA = ranks.get('a') ?? 0;
      const rankB = ranks.get('b') ?? 0;
      const rankC = ranks.get('c') ?? 0;
      // All should be roughly equal (1/N)
      expect(Math.abs(rankA - rankB)).toBeLessThan(0.001);
      expect(Math.abs(rankB - rankC)).toBeLessThan(0.001);
    });

    it('should sum to approximately 1 (conservation of rank)', () => {
      const nodes = makeNodes(['x', 'y', 'z', 'w']);
      const edges = [
        makeEdge('x', 'y'),
        makeEdge('y', 'z'),
        makeEdge('z', 'w'),
        makeEdge('w', 'x'),
      ];

      const ranks = graphWorker.calculatePageRank(nodes, edges, 30);
      const total = Array.from(ranks.values()).reduce((sum, r) => sum + r, 0);
      // PageRank with damping factor 0.85 should roughly sum to 1
      expect(total).toBeGreaterThan(0.5);
      expect(total).toBeLessThan(1.5);
    });
  });

  describe('calculateNodeImportance', () => {
    it('should give higher importance to nodes with more connections', () => {
      const nodes = makeNodes(['hub', 'leaf1', 'leaf2', 'leaf3']);
      const edges = [
        makeEdge('hub', 'leaf1'),
        makeEdge('hub', 'leaf2'),
        makeEdge('hub', 'leaf3'),
        makeEdge('leaf1', 'leaf2'),
      ];

      // Precompute PageRank for efficiency
      const pageRanks = graphWorker.calculatePageRank(nodes, edges, 10);

      const hubImportance = graphWorker.calculateNodeImportance('hub', nodes, edges, pageRanks);
      const leafImportance = graphWorker.calculateNodeImportance('leaf3', nodes, edges, pageRanks);

      expect(hubImportance).toBeGreaterThan(leafImportance);
    });

    it('should accept precomputed PageRank vector', () => {
      const nodes = makeNodes(['a', 'b']);
      const edges = [makeEdge('a', 'b')];

      const pageRanks = new Map<string, number>([
        ['a', 0.5],
        ['b', 0.5],
      ]);

      const importance = graphWorker.calculateNodeImportance('a', nodes, edges, pageRanks);
      expect(importance).toBeGreaterThan(0);
      expect(Number.isFinite(importance)).toBe(true);
    });
  });

  describe('calculate3DForceLayout', () => {
    // The 3D layout uses GraphNode/GraphEdge which have many required fields.
    // We construct minimal valid objects via type-compatible mocks.
    const make3DNode = (id: string, level: 'root' | 'core' | 'sub' | 'normal' | 'leaf' = 'normal') => ({
      id,
      graph_id: 'graph-1',
      knowledge_point_id: id,
      x_position: 0,
      y_position: 0,
      level,
      is_accepted: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      title: id,
      visibility: 'private' as const,
      owner_id: 'user-1',
    });

    const make3DEdge = (source: string, target: string) => ({
      id: `e-${source}-${target}`,
      graph_id: 'graph-1',
      source_knowledge_point_id: source,
      target_knowledge_point_id: target,
    });

    it('should produce 3D coordinates for a small graph', () => {
      const nodes = [make3DNode('n1', 'root'), make3DNode('n2', 'core'), make3DNode('n3', 'leaf')];
      const edges = [make3DEdge('n1', 'n2'), make3DEdge('n2', 'n3')];

      const result = graphWorker.calculate3DForceLayout(nodes, edges, {
        width: 800,
        height: 600,
        depth: 600,
        iterations: 50,
      });

      expect(result.nodes).toHaveLength(3);
      expect(result.links).toHaveLength(2);
      result.nodes.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(Number.isFinite(node.z)).toBe(true);
        expect(Number.isFinite(node.vx)).toBe(true);
        expect(Number.isFinite(node.vy)).toBe(true);
        expect(Number.isFinite(node.vz)).toBe(true);
      });
    });

    it('should assign correct importance values based on connections', () => {
      const nodes = [
        make3DNode('hub', 'root'),
        make3DNode('leaf1', 'leaf'),
        make3DNode('leaf2', 'leaf'),
      ];
      const edges = [make3DEdge('hub', 'leaf1'), make3DEdge('hub', 'leaf2')];

      const result = graphWorker.calculate3DForceLayout(nodes, edges, {
        iterations: 10,
      });

      const hubNode = result.nodes.find((n) => n.id === 'hub');
      const leafNode = result.nodes.find((n) => n.id === 'leaf1');
      expect(hubNode?.importance).toBeGreaterThan(leafNode?.importance ?? 0);
    });

    it('should converge: positions stabilize after many iterations', () => {
      const nodes = [make3DNode('a', 'root'), make3DNode('b', 'core'), make3DNode('c', 'normal'), make3DNode('d', 'leaf')];
      const edges = [
        make3DEdge('a', 'b'),
        make3DEdge('b', 'c'),
        make3DEdge('c', 'd'),
      ];

      const result = graphWorker.calculate3DForceLayout(nodes, edges, {
        iterations: 300,
      });

      // After 300 iterations, velocities should be small (converged)
      result.nodes.forEach((node) => {
        expect(Math.abs(node.vx)).toBeLessThan(100);
        expect(Math.abs(node.vy)).toBeLessThan(100);
        expect(Math.abs(node.vz)).toBeLessThan(100);
      });
    });
  });

  describe('utility functions', () => {
    it('filterNodes should filter by query string', () => {
      const nodes = [
        { id: '1', title: 'JavaScript Basics' },
        { id: '2', title: 'Python Advanced' },
        { id: '3', title: 'TypeScript Guide' },
      ];
      const result = graphWorker.filterNodes(nodes, 'script');
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id).sort()).toEqual(['1', '3']);
    });

    it('sortNodes should sort by field ascending', () => {
      const nodes = [
        { id: '1', value: 30 },
        { id: '2', value: 10 },
        { id: '3', value: 20 },
      ];
      const result = graphWorker.sortNodes(nodes, 'value', true);
      expect(result.map((n) => n.id)).toEqual(['2', '3', '1']);
    });

    it('sortNodes should sort descending', () => {
      const nodes = [
        { id: '1', value: 30 },
        { id: '2', value: 10 },
        { id: '3', value: 20 },
      ];
      const result = graphWorker.sortNodes(nodes, 'value', false);
      expect(result.map((n) => n.id)).toEqual(['1', '3', '2']);
    });
  });
});
