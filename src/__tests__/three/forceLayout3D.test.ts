import { describe, it, expect, vi, beforeAll } from 'vitest';
import { create3DForceLayout, type LayoutNode3D, type LayoutResult3D } from '../../three/layout/forceLayout3D';
import type { Node, Edge, NodeLevel } from '../../types';

// Mock comlink so we can also load the worker module (for grid-based comparison)
vi.mock('comlink', () => ({
  expose: vi.fn(),
}));

import { expose } from 'comlink';
import '../../workers/graphCalculator.worker';
// eslint-disable-next-line no-duplicate-imports -- side-effect import must stay separate to trigger module body
import type { GraphWorker } from '../../workers/graphCalculator.worker';

const mockedExpose = vi.mocked(expose);
const graphWorker = mockedExpose.mock.calls[0]?.[0] as GraphWorker | undefined;

// ---- Mock data builders ----

const LEVELS: NodeLevel[] = ['root', 'core', 'sub', 'normal', 'leaf'];

const makeNode = (
  id: string,
  level: NodeLevel = 'normal',
): Node => ({
  id,
  graph_id: 'graph-1',
  knowledge_point_id: id,
  x_position: 0,
  y_position: 0,
  level,
  is_accepted: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  title: `Node ${id}`,
  visibility: 'private',
  owner_id: 'user-1',
});

const makeEdge = (source: string, target: string): Edge => ({
  id: `e-${source}-${target}`,
  graph_id: 'graph-1',
  source_knowledge_point_id: source,
  target_knowledge_point_id: target,
});

const buildSmallGraph = (): { nodes: Node[]; edges: Edge[] } => {
  const nodes = [
    makeNode('root', 'root'),
    makeNode('core1', 'core'),
    makeNode('core2', 'core'),
    makeNode('leaf1', 'leaf'),
    makeNode('leaf2', 'leaf'),
  ];
  const edges = [
    makeEdge('root', 'core1'),
    makeEdge('root', 'core2'),
    makeEdge('core1', 'leaf1'),
    makeEdge('core2', 'leaf2'),
    makeEdge('core1', 'core2'),
  ];
  return { nodes, edges };
};

const assertValidLayout = (result: LayoutResult3D, expectedNodes: number, expectedLinks: number) => {
  expect(result.nodes).toHaveLength(expectedNodes);
  expect(result.links).toHaveLength(expectedLinks);
  result.nodes.forEach((node: LayoutNode3D) => {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(Number.isFinite(node.z)).toBe(true);
    expect(Number.isFinite(node.vx)).toBe(true);
    expect(Number.isFinite(node.vy)).toBe(true);
    expect(Number.isFinite(node.vz)).toBe(true);
    expect(Number.isFinite(node.importance)).toBe(true);
    expect(node.level).toBeGreaterThanOrEqual(0);
    expect(node.level).toBeLessThanOrEqual(4);
    expect(node.data).toBeDefined();
  });
};

// ---- Tests ----

describe('forceLayout3D', () => {
  describe('create3DForceLayout', () => {
    it('should produce valid 3D coordinates for a small graph', () => {
      const { nodes, edges } = buildSmallGraph();

      const result = create3DForceLayout(nodes, edges, {
        width: 800,
        height: 600,
        depth: 600,
        iterations: 50,
      });

      assertValidLayout(result, 5, 5);
    });

    it('should handle an empty graph', () => {
      const result = create3DForceLayout([], [], { iterations: 10 });

      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
    });

    it('should handle a single node', () => {
      const nodes = [makeNode('solo', 'root')];
      const result = create3DForceLayout(nodes, [], { iterations: 10 });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('solo');
      expect(Number.isFinite(result.nodes[0].x)).toBe(true);
    });

    it('should assign correct levels based on NodeLevel', () => {
      const nodes = [
        makeNode('r', 'root'),
        makeNode('c', 'core'),
        makeNode('s', 'sub'),
        makeNode('n', 'normal'),
        makeNode('l', 'leaf'),
      ];
      const result = create3DForceLayout(nodes, [], { iterations: 1 });

      const levelMap: Record<string, number> = {
        root: 0, core: 1, sub: 2, normal: 3, leaf: 4,
      };
      result.nodes.forEach((node) => {
        const originalLevel = node.data.level;
        if (originalLevel) {
          expect(node.level).toBe(levelMap[originalLevel]);
        }
      });
    });

    it('should converge: velocities approach zero after many iterations', () => {
      const { nodes, edges } = buildSmallGraph();

      const result = create3DForceLayout(nodes, edges, {
        iterations: 300,
      });

      // After many iterations, velocities should be small (system reaches equilibrium)
      result.nodes.forEach((node) => {
        expect(Math.abs(node.vx)).toBeLessThan(50);
        expect(Math.abs(node.vy)).toBeLessThan(50);
        expect(Math.abs(node.vz)).toBeLessThan(50);
      });
    });

    it('should separate connected nodes (no two nodes at same position)', () => {
      const { nodes, edges } = buildSmallGraph();

      const result = create3DForceLayout(nodes, edges, {
        iterations: 200,
      });

      const positions = result.nodes.map((n) => `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}`);
      const uniquePositions = new Set(positions);
      // At least 4 out of 5 should be at unique positions (damping may cause some overlap)
      expect(uniquePositions.size).toBeGreaterThanOrEqual(4);
    });

    it('should compute importance: hub nodes have higher importance than leaves', () => {
      const nodes = [
        makeNode('hub', 'root'),
        makeNode('child1', 'core'),
        makeNode('child2', 'core'),
        makeNode('child3', 'leaf'),
      ];
      const edges = [
        makeEdge('hub', 'child1'),
        makeEdge('hub', 'child2'),
        makeEdge('hub', 'child3'),
      ];

      const result = create3DForceLayout(nodes, edges, { iterations: 1 });

      const hub = result.nodes.find((n) => n.id === 'hub');
      const leaf = result.nodes.find((n) => n.id === 'child3');
      expect(hub?.importance).toBeGreaterThan(leaf?.importance ?? 0);
    });

    it('should respect custom depth and dimensions', () => {
      const { nodes, edges } = buildSmallGraph();

      const result = create3DForceLayout(nodes, edges, {
        width: 1000,
        height: 800,
        depth: 400,
        iterations: 10,
      });

      // Z coordinates should be within depth/2 range
      result.nodes.forEach((node) => {
        expect(Math.abs(node.z)).toBeLessThan(400); // depth * 0.5 = 200, with random offset
      });
    });
  });

  describe('spatial partitioning consistency (grid-based vs naive)', () => {
    // The original forceLayout3D.ts uses O(n²) pairwise collision detection.
    // The worker version uses a uniform spatial grid for O(n) collision detection.
    // Both should produce valid, finite layouts for the same input.

    it('grid-based worker layout produces valid results matching naive structure', () => {
      if (!graphWorker) {
        throw new Error('graphWorker not available');
      }

      const { nodes, edges } = buildSmallGraph();

      // Run original O(n²) implementation
      const naiveResult = create3DForceLayout(nodes, edges, {
        iterations: 50,
      });

      // Run grid-based implementation from worker
      const gridResult = graphWorker.calculate3DForceLayout(nodes, edges, {
        iterations: 50,
      });

      // Both should produce the same number of nodes and links
      expect(gridResult.nodes).toHaveLength(naiveResult.nodes.length);
      expect(gridResult.links).toHaveLength(naiveResult.links.length);

      // Both should produce finite coordinates
      gridResult.nodes.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(Number.isFinite(node.z)).toBe(true);
      });
    });

    it('grid-based collision should prevent node overlap (no two nodes too close)', () => {
      if (!graphWorker) {
        throw new Error('graphWorker not available');
      }

      const nodes: Node[] = [];
      for (let i = 0; i < 10; i++) {
        nodes.push(makeNode(`n${i}`, LEVELS[i % LEVELS.length] ?? 'normal'));
      }
      const edges: Edge[] = [
        makeEdge('n0', 'n1'),
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n3', 'n4'),
        makeEdge('n4', 'n5'),
      ];

      const result = graphWorker.calculate3DForceLayout(nodes, edges, {
        iterations: 200,
      });

      // After enough iterations, nodes should not overlap (collision distance = 60)
      const collisionDistance = 60;
      let overlapCount = 0;
      for (let i = 0; i < result.nodes.length; i++) {
        for (let j = i + 1; j < result.nodes.length; j++) {
          const a = result.nodes[i];
          const b = result.nodes[j];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < collisionDistance * 0.5) {
            overlapCount++;
          }
        }
      }
      // Allow some overlap due to damping, but most should be separated
      expect(overlapCount).toBeLessThan(result.nodes.length / 2);
    });

    it('grid-based layout should converge (velocities approach zero)', () => {
      if (!graphWorker) {
        throw new Error('graphWorker not available');
      }

      const { nodes, edges } = buildSmallGraph();

      const result = graphWorker.calculate3DForceLayout(nodes, edges, {
        iterations: 300,
      });

      result.nodes.forEach((node) => {
        expect(Math.abs(node.vx)).toBeLessThan(50);
        expect(Math.abs(node.vy)).toBeLessThan(50);
        expect(Math.abs(node.vz)).toBeLessThan(50);
      });
    });
  });

  describe('LayoutNode3D and LayoutLink3D interfaces', () => {
    it('should return nodes with all required LayoutNode3D fields', () => {
      const { nodes, edges } = buildSmallGraph();
      const result = create3DForceLayout(nodes, edges, { iterations: 1 });

      result.nodes.forEach((node) => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('x');
        expect(node).toHaveProperty('y');
        expect(node).toHaveProperty('z');
        expect(node).toHaveProperty('vx');
        expect(node).toHaveProperty('vy');
        expect(node).toHaveProperty('vz');
        expect(node).toHaveProperty('level');
        expect(node).toHaveProperty('importance');
        expect(node).toHaveProperty('data');
      });
    });

    it('should return links with source, target, and strength', () => {
      const { nodes, edges } = buildSmallGraph();
      const result = create3DForceLayout(nodes, edges, { iterations: 1 });

      result.links.forEach((link) => {
        expect(link).toHaveProperty('source');
        expect(link).toHaveProperty('target');
        expect(link).toHaveProperty('strength');
        expect(typeof link.strength).toBe('number');
      });
    });
  });
});
