import { Node, Edge, LayoutNode, LayoutLink, NodeLevel } from '../../types';
import { getLevel } from '../../lib/graphUtils';

interface HierarchyLayoutOptions {
  width: number;
  height: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

const LEVEL_ORDER: Record<NodeLevel, number> = {
  root: 0,
  core: 1,
  sub: 2,
  normal: 3,
  leaf: 4
};

export const createHierarchyLayout = (
  nodes: Node[],
  edges: Edge[],
  options: HierarchyLayoutOptions
): { nodes: LayoutNode[]; links: LayoutLink[] } => {
  const { width, height, horizontalSpacing = 150, verticalSpacing = 200 } = options;
  
  // Group nodes by level
  const nodesByLevel = new Map<NodeLevel, Node[]>();
  nodes.forEach(node => {
    const level = getLevel(node, edges);
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });
  
  // Sort levels
  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => 
    (LEVEL_ORDER[a] || 4) - (LEVEL_ORDER[b] || 4)
  );
  
  // Calculate positions
  const layoutNodes: LayoutNode[] = [];
  const startY = 100;
  
  sortedLevels.forEach((level, levelIndex) => {
    const levelNodes = nodesByLevel.get(level) || [];
    const levelY = startY + levelIndex * verticalSpacing;
    const totalWidth = levelNodes.length * horizontalSpacing;
    const startX = (width - totalWidth) / 2 + horizontalSpacing / 2;
    
    levelNodes.forEach((node, nodeIndex) => {
      layoutNodes.push({
        ...node,
        x: startX + nodeIndex * horizontalSpacing,
        y: levelY,
        fx: startX + nodeIndex * horizontalSpacing,
        fy: levelY
      });
    });
  });
  
  // Create layout links - normalize IDs for consistent matching
  const normalizeId = (id: any) => String(id).trim();
  const nodeIdMap = new Map(layoutNodes.map(n => [normalizeId(n.id), n]));
  
  const layoutLinks: LayoutLink[] = edges
    .filter(edge => {
      // Only include links where both source and target are in the layout
      const sourceId = normalizeId(edge.source_node_id);
      const targetId = normalizeId(edge.target_node_id);
      return nodeIdMap.has(sourceId) && nodeIdMap.has(targetId);
    })
    .map(edge => ({
      ...edge,
      source: normalizeId(edge.source_node_id),
      target: normalizeId(edge.target_node_id)
    }));
  
  return { nodes: layoutNodes, links: layoutLinks };
};

