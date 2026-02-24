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
  const { width, height: _height, nodeSize = [200, 150] } = options;
  
  const normalizeId = (id: any) => String(id).trim();
  
  // Find root nodes (nodes with no incoming edges)
  const incomingEdges = new Set<string>();
  edges.forEach(edge => {
    incomingEdges.add(normalizeId(edge.target_knowledge_point_id));
  });
  
  const rootNodes = nodes.filter(node => 
    !incomingEdges.has(normalizeId(node.id))
  );
  
  // If no root nodes, use first node
  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }
  
  if (rootNodes.length === 0) {
    return { nodes: [], links: [] };
  }
  
  // Build children map
  const childrenMap = new Map<string, Node[]>();
  nodes.forEach(node => {
    childrenMap.set(normalizeId(node.id), []);
  });
  
  edges.forEach(edge => {
    const src = normalizeId(edge.source_knowledge_point_id);
    const tgt = normalizeId(edge.target_knowledge_point_id);
    if (childrenMap.has(src)) {
      const targetNode = nodes.find(n => normalizeId(n.id) === tgt);
      if (targetNode) {
        childrenMap.get(src)?.push(targetNode);
      }
    }
  });
  
  // Convert to d3-hierarchy format
  const buildHierarchy = (node: Node): any => {
    const children = childrenMap.get(normalizeId(node.id)) || [];
    if (children.length === 0) {
      return node;
    }
    return {
      ...node,
      children: children.map(buildHierarchy)
    };
  };
  
  // Process all root nodes
  const layoutNodes: LayoutNode[] = [];
  const addedNodeIds = new Set<string>();
  let currentYOffset = 100;
  
  rootNodes.forEach((rootNode, _rootIndex) => {
    const root = hierarchy(buildHierarchy(rootNode));
    
    const treeLayout = tree<Node>()
      .nodeSize(nodeSize)
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));
    
    treeLayout(root);
    
    // Calculate the width of this tree
    let minX = Infinity, maxX = -Infinity;
    root.each((d: any) => {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
    });
    
    // Add nodes from this tree
    root.each((d: any) => {
      const node = d.data;
      const nodeId = normalizeId(node.id);
      
      if (addedNodeIds.has(nodeId)) {
        return;
      }
      
      addedNodeIds.add(nodeId);
      
      layoutNodes.push({
        ...node,
        x: d.x + width / 2,
        y: d.y + currentYOffset,
        fx: d.x + width / 2,
        fy: d.y + currentYOffset
      });
    });
    
    // Calculate the height of this tree
    let maxDepth = 0;
    root.each((d: any) => {
      maxDepth = Math.max(maxDepth, d.depth);
    });
    
    // Update Y offset for next tree (add spacing between trees)
    currentYOffset += (maxDepth + 1) * nodeSize[1] + 100;
  });
  
  // Add any remaining nodes that weren't part of any tree
  nodes.forEach((node, index) => {
    const nodeId = normalizeId(node.id);
    if (!addedNodeIds.has(nodeId)) {
      addedNodeIds.add(nodeId);
      layoutNodes.push({
        ...node,
        x: (index % 10) * 200 + 100,
        y: currentYOffset + Math.floor(index / 10) * 150,
        fx: (index % 10) * 200 + 100,
        fy: currentYOffset + Math.floor(index / 10) * 150
      });
    }
  });
  
  // Create layout links
  const treeNodeIds = new Set(layoutNodes.map(n => normalizeId(n.id)));
  
  const layoutLinks: LayoutLink[] = edges
    .filter(edge => {
      const src = normalizeId(edge.source_knowledge_point_id);
      const tgt = normalizeId(edge.target_knowledge_point_id);
      return treeNodeIds.has(src) && treeNodeIds.has(tgt);
    })
    .map(edge => ({
      ...edge,
      source: normalizeId(edge.source_knowledge_point_id),
      target: normalizeId(edge.target_knowledge_point_id)
    }));
  
  return { nodes: layoutNodes, links: layoutLinks };
};
