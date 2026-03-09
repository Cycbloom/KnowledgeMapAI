import { describe, it, expect } from 'vitest';
import { parseMarkdownToGraph } from '../../utils/markdownParser';

describe('markdownParser', () => {
  it('should parse simple markdown with headers', () => {
    const markdown = `
# Root Node
## Child 1
Content for child 1
## Child 2
Content for child 2
    `.trim();

    const result = parseMarkdownToGraph(markdown);

    expect(result.graph_title).toBe('Root Node');
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    const root = result.nodes.find(n => n.title === 'Root Node');
    expect(root).toBeDefined();
    expect(root?.level).toBe('root');

    const child1 = result.nodes.find(n => n.title === 'Child 1');
    expect(child1?.content).toBe('Content for child 1');
    expect(child1?.level).toBe('core');
  });

  it('should handle nested hierarchy correctly', () => {
    const markdown = `
# Root
## Level 2
### Level 3
#### Level 4
    `.trim();

    const result = parseMarkdownToGraph(markdown);
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    const l4 = result.nodes.find(n => n.title === 'Level 4');
    expect(l4?.level).toBe('normal');
  });

  it('should handle text without headers as a single node', () => {
    const text = 'Just some plain text content';
    const result = parseMarkdownToGraph(text);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].title).toBe('Just some plain text');
    expect(result.nodes[0].content).toBe(text);
  });

  it('should parse obsidian style links [[Target]]', () => {
    const markdown = `
# Node A
Links to [[Node B]]
# Node B
Content B
    `.trim();

    const result = parseMarkdownToGraph(markdown);
    
    expect(result.nodes).toHaveLength(2);
    
    const linkEdge = result.edges.find(e => e.relationship === 'relates_to');
    expect(linkEdge).toBeDefined();
    
    const nodeA = result.nodes.find(n => n.title === 'Node A');
    const nodeB = result.nodes.find(n => n.title === 'Node B');
    
    expect(linkEdge?.source).toBe(nodeA?.id);
    expect(linkEdge?.target).toBe(nodeB?.id);
  });

  it('should handle empty input', () => {
    const result = parseMarkdownToGraph('');
    expect(result.nodes).toHaveLength(0);
  });
});
