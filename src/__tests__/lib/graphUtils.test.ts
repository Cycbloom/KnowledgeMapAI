import { describe, it, expect } from 'vitest';
import { 
  getLevel, 
  getNextLevel, 
  findShortestPath,
  getDescendantNodes,
  getDirectChildren,
  getAncestorNodes,
  getFocusedNodes,
  getFocusedLinks,
  analyzeGraph,
  findMissingConnections,
  calculateNodeImportance,
  calculateEdgeStrength,
  getPreviousLevel,
  getLevelIndex,
  getLevelColor,
  getLevelColorHex,
  getLevelLabel,
  LEVEL_ORDER,
  LEVEL_WEIGHTS
} from '../../utils/graph/graphUtils';
import { Node, Edge } from '@shared/types';

describe('Graph Utils', () => {
  describe('getLevel', () => {
    it('should return explicit level if exists', () => {
      const node: Node = { 
        id: '1', title: 'test', x: 0, y: 0, z: 0,
        level: 'core'
      } as any;
      expect(getLevel(node, [])).toBe('core');
    });

    it('should calculate level based on degree', () => {
      const node: Node = { id: '1', title: 'test', x: 0, y: 0, z: 0 } as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
        { id: 'e2', source_knowledge_point_id: '3', target_knowledge_point_id: '1' },
      ] as any;
      
      expect(getLevel(node, edges)).toBe('core');
      expect(getLevel(node, [])).toBe('normal');
      
      const leafEdges: Edge[] = [
        { id: 'e3', source_knowledge_point_id: '2', target_knowledge_point_id: '1' },
      ] as any;
      expect(getLevel(node, leafEdges)).toBe('leaf');
      
      const rootEdges: Edge[] = [
        { id: 'e4', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;
      expect(getLevel(node, rootEdges)).toBe('root');
    });

    it('should handle node id with whitespace', () => {
      const node: Node = { id: ' 1 ', title: 'test', x: 0, y: 0, z: 0 } as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;
      expect(getLevel(node, edges)).toBe('root');
    });
  });

  describe('getNextLevel', () => {
    it('should return correct next level', () => {
      expect(getNextLevel('root')).toBe('core');
      expect(getNextLevel('core')).toBe('sub');
      expect(getNextLevel('sub')).toBe('normal');
      expect(getNextLevel('normal')).toBe('leaf');
      expect(getNextLevel('leaf')).toBe('leaf');
    });

    it('should return leaf for unknown level', () => {
      expect(getNextLevel('unknown')).toBe('leaf');
    });
  });

  describe('getPreviousLevel', () => {
    it('should return correct previous level', () => {
      expect(getPreviousLevel('leaf')).toBe('normal');
      expect(getPreviousLevel('normal')).toBe('sub');
      expect(getPreviousLevel('sub')).toBe('core');
      expect(getPreviousLevel('core')).toBe('root');
      expect(getPreviousLevel('root')).toBe('root');
    });

    it('should return root for unknown level', () => {
      expect(getPreviousLevel('unknown')).toBe('root');
    });
  });

  describe('getLevelIndex', () => {
    it('should return correct index for each level', () => {
      expect(getLevelIndex('root')).toBe(0);
      expect(getLevelIndex('core')).toBe(1);
      expect(getLevelIndex('sub')).toBe(2);
      expect(getLevelIndex('normal')).toBe(3);
      expect(getLevelIndex('leaf')).toBe(4);
    });

    it('should return -1 for unknown level', () => {
      expect(getLevelIndex('unknown')).toBe(-1);
    });
  });

  describe('getLevelColor', () => {
    it('should return correct color class for each level', () => {
      expect(getLevelColor('root')).toBe('bg-primary-500');
      expect(getLevelColor('core')).toBe('bg-primary-500');
      expect(getLevelColor('sub')).toBe('bg-secondary-500');
      expect(getLevelColor('normal')).toBe('bg-tertiary-500');
      expect(getLevelColor('leaf')).toBe('bg-tertiary-500');
    });
  });

  describe('getLevelColorHex', () => {
    it('should return correct hex color for each level', () => {
      expect(getLevelColorHex('root')).toBe('#8B5CF6');
      expect(getLevelColorHex('core')).toBe('#EF4444');
      expect(getLevelColorHex('sub')).toBe('#F59E0B');
      expect(getLevelColorHex('normal')).toBe('#3B82F6');
      expect(getLevelColorHex('leaf')).toBe('#10B981');
    });
  });

  describe('getLevelLabel', () => {
    it('should return correct Chinese label for each level', () => {
      expect(getLevelLabel('root')).toBe('根节点');
      expect(getLevelLabel('core')).toBe('核心节点');
      expect(getLevelLabel('sub')).toBe('次级节点');
      expect(getLevelLabel('normal')).toBe('普通节点');
      expect(getLevelLabel('leaf')).toBe('叶子节点');
    });
  });

  describe('LEVEL_ORDER', () => {
    it('should have correct order', () => {
      expect(LEVEL_ORDER).toEqual(['root', 'core', 'sub', 'normal', 'leaf']);
    });
  });

  describe('LEVEL_WEIGHTS', () => {
    it('should have correct weights', () => {
      expect(LEVEL_WEIGHTS.root).toBe(1.0);
      expect(LEVEL_WEIGHTS.core).toBe(0.8);
      expect(LEVEL_WEIGHTS.sub).toBe(0.6);
      expect(LEVEL_WEIGHTS.normal).toBe(0.4);
      expect(LEVEL_WEIGHTS.leaf).toBe(0.2);
    });
  });

  describe('findShortestPath', () => {
    const nodes: Node[] = [
      { id: '1', title: '1' },
      { id: '2', title: '2' },
      { id: '3', title: '3' },
      { id: '4', title: '4' },
      { id: '5', title: '5' },
    ] as any;

    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
      { id: 'e3', source_knowledge_point_id: '1', target_knowledge_point_id: '4' },
    ] as any;

    it('should find shortest path between connected nodes', () => {
      const result = findShortestPath(nodes, edges, '1', '3');
      expect(result.nodes.size).toBe(3);
      expect(result.nodes.has('1')).toBe(true);
      expect(result.nodes.has('2')).toBe(true);
      expect(result.nodes.has('3')).toBe(true);
      expect(result.links.size).toBe(2);
      expect(result.links.has('e1')).toBe(true);
      expect(result.links.has('e2')).toBe(true);
    });

    it('should return single node if start === end', () => {
      const result = findShortestPath(nodes, edges, '1', '1');
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has('1')).toBe(true);
      expect(result.links.size).toBe(0);
    });

    it('should return empty if no path exists', () => {
      const result = findShortestPath(nodes, edges, '1', '5');
      expect(result.nodes.size).toBe(0);
      expect(result.links.size).toBe(0);
    });

    it('should find direct path', () => {
      const result = findShortestPath(nodes, edges, '1', '4');
      expect(result.nodes.size).toBe(2);
      expect(result.nodes.has('1')).toBe(true);
      expect(result.nodes.has('4')).toBe(true);
      expect(result.links.size).toBe(1);
      expect(result.links.has('e3')).toBe(true);
    });
  });

  describe('getDescendantNodes', () => {
    const nodes: Node[] = [
      { id: '1', title: 'root' },
      { id: '2', title: 'child1' },
      { id: '3', title: 'child2' },
      { id: '4', title: 'grandchild' },
    ] as any;

    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '1', target_knowledge_point_id: '3' },
      { id: 'e3', source_knowledge_point_id: '2', target_knowledge_point_id: '4' },
    ] as any;

    it('should return all descendants', () => {
      const descendants = getDescendantNodes('1', nodes, edges);
      expect(descendants.size).toBe(3);
      expect(descendants.has('2')).toBe(true);
      expect(descendants.has('3')).toBe(true);
      expect(descendants.has('4')).toBe(true);
    });

    it('should return empty set for leaf node', () => {
      const descendants = getDescendantNodes('4', nodes, edges);
      expect(descendants.size).toBe(0);
    });

    it('should return only direct children for node without grandchildren', () => {
      const descendants = getDescendantNodes('3', nodes, edges);
      expect(descendants.size).toBe(0);
    });
  });

  describe('getDirectChildren', () => {
    const nodes: Node[] = [
      { id: '1', title: 'root' },
      { id: '2', title: 'child1' },
      { id: '3', title: 'child2' },
    ] as any;

    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '1', target_knowledge_point_id: '3' },
    ] as any;

    it('should return direct children only', () => {
      const children = getDirectChildren('1', nodes, edges);
      expect(children.size).toBe(2);
      expect(children.has('2')).toBe(true);
      expect(children.has('3')).toBe(true);
    });

    it('should return empty set for node without children', () => {
      const children = getDirectChildren('2', nodes, edges);
      expect(children.size).toBe(0);
    });
  });

  describe('getAncestorNodes', () => {
    const nodes: Node[] = [
      { id: '1', title: 'root' },
      { id: '2', title: 'child' },
      { id: '3', title: 'grandchild' },
    ] as any;

    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
    ] as any;

    it('should return all ancestors', () => {
      const ancestors = getAncestorNodes('3', nodes, edges);
      expect(ancestors.size).toBe(2);
      expect(ancestors.has('1')).toBe(true);
      expect(ancestors.has('2')).toBe(true);
    });

    it('should return empty set for root node', () => {
      const ancestors = getAncestorNodes('1', nodes, edges);
      expect(ancestors.size).toBe(0);
    });
  });

  describe('getFocusedNodes', () => {
    const nodes: Node[] = [
      { id: '1', title: 'root' },
      { id: '2', title: 'child' },
      { id: '3', title: 'grandchild' },
      { id: '4', title: 'unrelated' },
    ] as any;

    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
    ] as any;

    it('should return focused nodes including self, ancestors and descendants', () => {
      const focused = getFocusedNodes('2', nodes, edges);
      expect(focused.size).toBe(3);
      expect(focused.has('1')).toBe(true);
      expect(focused.has('2')).toBe(true);
      expect(focused.has('3')).toBe(true);
      expect(focused.has('4')).toBe(false);
    });
  });

  describe('getFocusedLinks', () => {
    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
      { id: 'e3', source_knowledge_point_id: '3', target_knowledge_point_id: '4' },
    ] as any;

    it('should return links where both endpoints are in focused set', () => {
      const focusedNodes = new Set(['1', '2', '3']);
      const focusedLinks = getFocusedLinks(focusedNodes, edges);
      expect(focusedLinks.size).toBe(2);
      expect(focusedLinks.has('e1')).toBe(true);
      expect(focusedLinks.has('e2')).toBe(true);
      expect(focusedLinks.has('e3')).toBe(false);
    });
  });

  describe('analyzeGraph', () => {
    it('should analyze empty graph', () => {
      const result = analyzeGraph([], []);
      expect(result.nodeCount).toBe(0);
      expect(result.edgeCount).toBe(0);
      expect(result.isolatedNodes).toEqual([]);
      expect(result.disconnectedComponents).toBe(0);
    });

    it('should analyze simple connected graph', () => {
      const nodes: Node[] = [
        { id: '1', title: 'root', content: 'content' },
        { id: '2', title: 'child', content: 'content' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;

      const result = analyzeGraph(nodes, edges);
      expect(result.nodeCount).toBe(2);
      expect(result.edgeCount).toBe(1);
      expect(result.isolatedNodes).toEqual([]);
      expect(result.disconnectedComponents).toBe(1);
      expect(result.rootNodes).toContain('1');
      expect(result.leafNodes).toContain('2');
    });

    it('should detect isolated nodes', () => {
      const nodes: Node[] = [
        { id: '1', title: 'connected' },
        { id: '2', title: 'isolated' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '3' },
      ] as any;

      const result = analyzeGraph(nodes, edges);
      expect(result.isolatedNodes).toContain('2');
    });

    it('should calculate level distribution', () => {
      const nodes: Node[] = [
        { id: '1', title: 'root' },
        { id: '2', title: 'leaf' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;

      const result = analyzeGraph(nodes, edges);
      expect(result.levelDistribution.root).toBe(1);
      expect(result.levelDistribution.leaf).toBe(1);
    });

    it('should calculate health score', () => {
      const nodes: Node[] = [
        { id: '1', title: 'root', content: 'content' },
        { id: '2', title: 'child', content: 'content' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;

      const result = analyzeGraph(nodes, edges);
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });

    it('should detect nodes without content', () => {
      const nodes: Node[] = [
        { id: '1', title: 'with content', content: 'some content' },
        { id: '2', title: 'without content', content: '' },
        { id: '3', title: 'no content field' },
      ] as any;
      const edges: Edge[] = [];

      const result = analyzeGraph(nodes, edges);
      expect(result.nodesWithoutContent.length).toBe(2);
    });
  });

  describe('findMissingConnections', () => {
    it('should suggest connections between siblings', () => {
      const nodes: Node[] = [
        { id: '1', title: 'parent' },
        { id: '2', title: 'child1' },
        { id: '3', title: 'child2' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
        { id: 'e2', source_knowledge_point_id: '1', target_knowledge_point_id: '3' },
      ] as any;

      const suggestions = findMissingConnections(nodes, edges);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].sourceId).toBeDefined();
      expect(suggestions[0].targetId).toBeDefined();
      expect(suggestions[0].reason).toContain('同属于');
    });

    it('should not suggest existing connections', () => {
      const nodes: Node[] = [
        { id: '1', title: 'parent' },
        { id: '2', title: 'child1' },
        { id: '3', title: 'child2' },
      ] as any;
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
        { id: 'e2', source_knowledge_point_id: '1', target_knowledge_point_id: '3' },
        { id: 'e3', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
      ] as any;

      const suggestions = findMissingConnections(nodes, edges);
      const hasConnection = suggestions.some(
        s => (s.sourceId === '2' && s.targetId === '3') || (s.sourceId === '3' && s.targetId === '2')
      );
      expect(hasConnection).toBe(false);
    });

    it('should respect maxSuggestions parameter', () => {
      const nodes: Node[] = Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        title: `node${i}`,
      })) as any;
      const edges: Edge[] = Array.from({ length: 19 }, (_, i) => ({
        id: `e${i}`,
        source_knowledge_point_id: '0',
        target_knowledge_point_id: String(i + 1),
      })) as any;

      const suggestions = findMissingConnections(nodes, edges, 5);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('calculateNodeImportance', () => {
    const nodes: Node[] = [
      { id: '1', title: 'root', content: 'test content' },
      { id: '2', title: 'child', content: 'test' },
      { id: '3', title: 'leaf', content: '' },
    ] as any;
    const edges: Edge[] = [
      { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      { id: 'e2', source_knowledge_point_id: '2', target_knowledge_point_id: '3' },
    ] as any;

    it('should calculate importance score', () => {
      const importance = calculateNodeImportance(nodes[0], nodes, edges);
      expect(importance.score).toBeGreaterThanOrEqual(0);
      expect(importance.score).toBeLessThanOrEqual(1);
      expect(importance.factors).toBeDefined();
    });

    it('should give higher score to nodes with more connections', () => {
      const importance1 = calculateNodeImportance(nodes[0], nodes, edges);
      const importance3 = calculateNodeImportance(nodes[2], nodes, edges);
      expect(importance1.score).toBeGreaterThan(importance3.score);
    });

    it('should consider mastery status', () => {
      const nodeStatus = { '1': { mastered: true } };
      const importanceWithMastery = calculateNodeImportance(nodes[0], nodes, edges, nodeStatus);
      const importanceWithoutMastery = calculateNodeImportance(nodes[0], nodes, edges);
      expect(importanceWithMastery.score).toBeGreaterThanOrEqual(importanceWithoutMastery.score);
    });
  });

  describe('calculateEdgeStrength', () => {
    const nodes: Node[] = [
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
      { id: '3', title: 'c' },
    ] as any;

    it('should calculate strength score', () => {
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2', relationship_type: 'contains' },
      ] as any;
      const strength = calculateEdgeStrength(edges[0], nodes, edges);
      expect(strength.score).toBeGreaterThanOrEqual(0);
      expect(strength.score).toBeLessThanOrEqual(1);
      expect(strength.factors).toBeDefined();
    });

    it('should give higher score to contains relationship', () => {
      const edgesContains: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2', relationship_type: 'contains' },
      ] as any;
      const edgesRelated: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2', relationship_type: 'related' },
      ] as any;

      const strengthContains = calculateEdgeStrength(edgesContains[0], nodes, edgesContains);
      const strengthRelated = calculateEdgeStrength(edgesRelated[0], nodes, edgesRelated);
      expect(strengthContains.score).toBeGreaterThan(strengthRelated.score);
    });

    it('should handle edge without relationship_type', () => {
      const edges: Edge[] = [
        { id: 'e1', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;
      const strength = calculateEdgeStrength(edges[0], nodes, edges);
      expect(strength.score).toBeGreaterThanOrEqual(0);
      expect(strength.factors.relationshipType).toBe('contains');
    });
  });
});
