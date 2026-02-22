import { describe, it, expect } from 'vitest';
import { getLevel, getNextLevel, findShortestPath } from './graphUtils';
import { Node, Edge } from '../types';

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
      
      // Degree 2 (in + out) -> core
      expect(getLevel(node, edges)).toBe('core');
      
      // Degree 0 (no edges) -> normal (isolated node)
      expect(getLevel(node, [])).toBe('normal');
      
      // Only incoming edges -> leaf
      const leafEdges: Edge[] = [
        { id: 'e3', source_knowledge_point_id: '2', target_knowledge_point_id: '1' },
      ] as any;
      expect(getLevel(node, leafEdges)).toBe('leaf');
      
      // Only outgoing edges -> root
      const rootEdges: Edge[] = [
        { id: 'e4', source_knowledge_point_id: '1', target_knowledge_point_id: '2' },
      ] as any;
      expect(getLevel(node, rootEdges)).toBe('root');
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
      // 1 -> 2 -> 3
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
      // 1 and 5 are disconnected
      const result = findShortestPath(nodes, edges, '1', '5');
      expect(result.nodes.size).toBe(0);
      expect(result.links.size).toBe(0);
    });
  });
});
