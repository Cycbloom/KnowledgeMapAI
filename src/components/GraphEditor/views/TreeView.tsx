import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Node, Edge, ColorScheme, LinkStyle, LinkAnimation, GraphColorMode } from '../../../types';
import type { Node as GraphNode } from '../../../types';
import { MindMapNode } from '../MindMapNode';
import { MindMapLink } from '../MindMapLink';
import { createTreeLayout } from '../../../utils/layouts/treeLayout';
import { THEME_COLORS } from '../../../config/learningStatusColors';
import { useTheme } from '../../../hooks/useTheme';
import { calculateNodeImportance, calculateEdgeStrength } from '../../../lib/graphUtils';
import { NodeSizeMode, EdgeWidthMode } from '../../../types';

interface TreeViewProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
  nodeSizeMode?: NodeSizeMode;
  edgeWidthMode?: EdgeWidthMode;
  coloringMode?: GraphColorMode;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export const TreeView: React.FC<TreeViewProps> = ({
  nodes,
  edges,
  nodeStatus,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 600,
  colorScheme = 'default',
  linkStyle = 'curved',
  linkAnimation = 'none',
  nodeSizeMode = 'fixed',
  edgeWidthMode = 'fixed',
  coloringMode = 'level'
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width, height });

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateContainerSize();
    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    return createTreeLayout(nodes, edges, {
      width: containerSize.width,
      height: containerSize.height
    });
  }, [nodes, edges, containerSize]);

  const visibleNodes = useMemo(() => {
    if (!layout) return [];
    return layout.nodes.filter(node => node.is_accepted !== false);
  }, [layout]);

  const visibleLinks = useMemo(() => {
    if (!layout) return [];
    const visibleNodeIds = new Set(visibleNodes.map(n => String(n.id).trim()));
    return layout.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [layout, visibleNodes]);

  // Calculate node importance map
  const nodeImportanceMap = useMemo(() => {
    if (nodeSizeMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    visibleNodes.forEach(node => {
      const importance = calculateNodeImportance(node as Node, nodes, edges, nodeStatus);
      map.set(node.id, importance.score);
    });
    return map;
  }, [visibleNodes, nodes, edges, nodeStatus, nodeSizeMode]);

  // Calculate edge strength map
  const edgeStrengthMap = useMemo(() => {
    if (edgeWidthMode === 'fixed') return new Map<string, number>();
    const map = new Map<string, number>();
    visibleLinks.forEach(link => {
      const edge = edges.find(e => e.id === link.id);
      if (edge) {
        const strength = calculateEdgeStrength(edge, nodes, edges);
        map.set(link.id, strength.score);
      }
    });
    return map;
  }, [visibleLinks, edges, nodes, edgeWidthMode]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    
    setTransform(prev => {
      const newK = Math.max(0.1, Math.min(5, prev.k * delta));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, k: newK };
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newX = mouseX - (mouseX - prev.x) * delta;
      const newY = mouseY - (mouseY - prev.y) * delta;
      
      return { x: newX, y: newY, k: newK };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, transform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!layout) return null;

  // Create nodesMap with all layout nodes (not just visible) for link resolution
  const nodesMap = new Map(layout.nodes.map(n => [String(n.id).trim(), n]));
  
  // Filter links to only show those connecting visible nodes
  const visibleNodeIds = new Set(visibleNodes.map(n => String(n.id).trim()));

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height}
        className="absolute inset-0"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Links */}
          <g className="links">
            {visibleLinks.map(link => {
              const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
              const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
              
              // Only render link if both source and target are visible
              if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) {
                return null;
              }
              
              // Get the actual node objects from nodesMap
              const sourceNode = nodesMap.get(sourceId);
              const targetNode = nodesMap.get(targetId);
              
              // Skip if nodes not found
              if (!sourceNode || !targetNode) {
                return null;
              }
              
              // Create link with node objects instead of IDs
              const linkWithNodes = {
                ...link,
                source: sourceNode,
                target: targetNode
              };
              
              return (
                <MindMapLink
                  key={link.id}
                  link={linkWithNodes}
                  nodes={nodesMap}
                  isDark={isDark}
                  linkStyle={linkStyle}
                  linkAnimation={linkAnimation}
                  edgeWidthMode={edgeWidthMode}
                  edgeStrength={edgeStrengthMap.get(link.id)}
                  allNodes={nodes}
                  allEdges={edges}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {visibleNodes.map(node => (
              <MindMapNode
                key={node.id}
                node={node}
                edges={edges}
                nodeStatus={nodeStatus}
                selected={selectedNodeId === node.id}
                isDark={isDark}
                zoomLevel={transform.k}
                onClick={() => onNodeClick(node as GraphNode)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                focused={hoveredNodeId === node.id}
                colorScheme={colorScheme}
                nodeSizeMode={nodeSizeMode}
                nodeImportance={nodeImportanceMap.get(node.id)}
                allNodes={nodes}
                coloringMode={coloringMode}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
};

