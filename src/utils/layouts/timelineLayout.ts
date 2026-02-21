import { Node, Edge, LayoutNode, LayoutLink } from '../../types';

interface TimelineLayoutOptions {
  width: number;
  height: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  sortBy?: 'created_at' | 'updated_at';
}

export const createTimelineLayout = (
  nodes: Node[],
  edges: Edge[],
  options: TimelineLayoutOptions
): { nodes: LayoutNode[]; links: LayoutLink[] } => {
  const { width, height, horizontalSpacing = 200, verticalSpacing = 150, sortBy = 'created_at' } = options;
  
  // Sort nodes by time
  const sortedNodes = [...nodes].sort((a, b) => {
    const timeA = new Date(a[sortBy] || a.created_at || '1970-01-01').getTime();
    const timeB = new Date(b[sortBy] || b.created_at || '1970-01-01').getTime();
    return timeA - timeB;
  });
  
  // Group nodes by time periods (days)
  const nodesByPeriod = new Map<string, Node[]>();
  sortedNodes.forEach(node => {
    const time = new Date(node[sortBy] || node.created_at || Date.now());
    const periodKey = time.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!nodesByPeriod.has(periodKey)) {
      nodesByPeriod.set(periodKey, []);
    }
    nodesByPeriod.get(periodKey)!.push(node);
  });
  
  // Calculate positions
  const layoutNodes: LayoutNode[] = [];
  const periods = Array.from(nodesByPeriod.keys()).sort();
  const startX = 100;
  const centerY = height / 2;
  
  periods.forEach((period, periodIndex) => {
    const periodNodes = nodesByPeriod.get(period) || [];
    const periodX = startX + periodIndex * horizontalSpacing;
    const totalHeight = periodNodes.length * verticalSpacing;
    const startY = centerY - totalHeight / 2 + verticalSpacing / 2;
    
    periodNodes.forEach((node, nodeIndex) => {
      layoutNodes.push({
        ...node,
        x: periodX,
        y: startY + nodeIndex * verticalSpacing,
        fx: periodX,
        fy: startY + nodeIndex * verticalSpacing
      });
    });
  });
  
  // Create layout links
  const layoutLinks: LayoutLink[] = edges.map(edge => ({
    ...edge,
    source: edge.source_knowledge_point_id,
    target: edge.target_knowledge_point_id
  }));
  
  return { nodes: layoutNodes, links: layoutLinks };
};
