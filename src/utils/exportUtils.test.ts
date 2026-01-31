import { generateMarkdown } from './exportUtils';
import { Graph, Node, Edge } from '../types';

describe('exportUtils', () => {
  const mockGraph: Graph = {
    id: 'g1',
    title: 'Test Graph',
    description: 'A test graph',
    created_at: '2023-01-01'
  };

  const mockNodes: Node[] = [
    { id: 'n1', graph_id: 'g1', title: 'Root Node', level: 'root', x_position: 0, y_position: 0 },
    { id: 'n2', graph_id: 'g1', title: 'Core Node', level: 'core', x_position: 0, y_position: 0 },
    { id: 'n3', graph_id: 'g1', title: 'Leaf Node', level: 'leaf', content: 'Leaf Content', x_position: 0, y_position: 0 },
  ];

  const mockEdges: Edge[] = [
    { id: 'e1', source_node_id: 'n1', target_node_id: 'n2' },
    { id: 'e2', source_node_id: 'n2', target_node_id: 'n3' },
  ];

  it('generates markdown with correct hierarchy', () => {
    const md = generateMarkdown(mockGraph, mockNodes, mockEdges);
    
    expect(md).toContain('# Test Graph');
    expect(md).toContain('A test graph');
    expect(md).toContain('## Root Node');
    expect(md).toContain('### Core Node');
    expect(md).toContain('- **Leaf Node**');
    expect(md).toContain('  Leaf Content');
  });

  it('handles disconnected nodes', () => {
    const disconnectedNodes = [
      ...mockNodes,
      { id: 'n4', graph_id: 'g1', title: 'Lonely Node', level: 'root', x_position: 0, y_position: 0 }
    ];
    
    const md = generateMarkdown(mockGraph, disconnectedNodes, mockEdges);
    // Should appear as another root
    expect(md).toContain('## Lonely Node');
  });
});
