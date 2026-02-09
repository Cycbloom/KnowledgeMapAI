import { hierarchy, tree } from 'd3-hierarchy';
import { Node, Edge, LayoutNode, LayoutLink } from '../../types';

interface TreeLayoutOptions {
  width: number;
  height: number;
  nodeSize?: [number, number];
}

export const createTreeLayout = (
  nodes: Node[],
  edges: Edge[],
  options: TreeLayoutOptions
): { nodes: LayoutNode[]; links: LayoutLink[] } => {
  const { width, height, nodeSize = [200, 150] } = options;
  
  // Find root nodes (nodes with no incoming edges)
  const normalizeId = (id: any) => String(id).trim();
  const incomingEdges = new Set<string>();
  edges.forEach(edge => {
    incomingEdges.add(normalizeId(edge.target_node_id));
  });
  
  const rootNodes = nodes.filter(node => 
    !incomingEdges.has(normalizeId(node.id))
  );
  
  // If no root nodes, use first node
  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }
  
  // Build tree structure from first root
  const rootNode = rootNodes[0];
  if (!rootNode) {
    // If no root, return all nodes in a simple layout
    const layoutNodes: LayoutNode[] = nodes.map((node, index) => ({
      ...node,
      x: (index % 10) * 200 + 100,
      y: Math.floor(index / 10) * 200 + 100,
      fx: (index % 10) * 200 + 100,
      fy: Math.floor(index / 10) * 200 + 100
    }));
    const layoutLinks: LayoutLink[] = edges.map(edge => ({
      ...edge,
      source: normalizeId(edge.source_node_id),
      target: normalizeId(edge.target_node_id)
    }));
    return { nodes: layoutNodes, links: layoutLinks };
  }
  
  // Build children map
  const childrenMap = new Map<string, Node[]>();
  nodes.forEach(node => {
    childrenMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_node_id);
    const tgt = normalizeId(edge.target_node_id);
    if (childrenMap.has(src)) {
      const targetNode = nodes.find(n => normalizeId(n.id) === tgt);
      if (targetNode) {
        childrenMap.get(src)!.push(targetNode);
      }
    }
  });
  
  // Convert to d3-hierarchy format
  // d3-hierarchy expects the data directly, not wrapped in { data: ... }
  const buildHierarchy = (node: Node): any => {
    const children = childrenMap.get(normalizeId(node.id)) || [];
    if (children.length === 0) {
      return node; // Leaf node: return node directly
    }
    // Non-leaf node: return node with children
    return {
      ...node,
      children: children.map(buildHierarchy)
    };
  };
  
  const root = hierarchy(buildHierarchy(rootNode));
  
  // Create tree layout
  const treeLayout = tree<Node>()
    .nodeSize(nodeSize)
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));
  
  treeLayout(root);
  
  // Convert to layout nodes
  const layoutNodes: LayoutNode[] = [];
  const addedNodeIds = new Set<string>();
  root.each((d: any) => {
    // d.data is the original node object
    const node = d.data;
    const nodeId = normalizeId(node.id);
    
    // Skip if node already added (to avoid duplicates)
    if (addedNodeIds.has(nodeId)) {
      return;
    }
    
    // Mark node as added
    addedNodeIds.add(nodeId);
    
    // Ensure we preserve all node properties
    layoutNodes.push({
      ...node,
      x: d.x + width / 2,
      y: d.y + 100,
      fx: d.x + width / 2,
      fy: d.y + 100
    });
  });
  
  // Create layout links - include all links between nodes in the tree
  const treeNodeIds = new Set(layoutNodes.map(n => normalizeId(n.id)));
  const nodeIdMap = new Map(layoutNodes.map(n => [normalizeId(n.id), n]));
  
  const layoutLinks: LayoutLink[] = edges
    .filter(edge => {
      const src = normalizeId(edge.source_node_id);
      const tgt = normalizeId(edge.target_node_id);
      // Only include links where both nodes are in the tree layout
      return treeNodeIds.has(src) && treeNodeIds.has(tgt);
    })
    .map(edge => ({
      ...edge,
      source: normalizeId(edge.source_node_id),
      target: normalizeId(edge.target_node_id)
    }));
  
  return { nodes: layoutNodes, links: layoutLinks };
};

