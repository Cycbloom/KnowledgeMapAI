import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { rafThrottle } from '@/utils/performanceUtils';
import type { CombinedViewLayoutMode, KnowledgePoint, GraphNodeWithKnowledgePoint, Edge } from '../../types';

interface MergedNode {
  id: string;
  knowledgePoint: KnowledgePoint;
  graphIds: string[];
  graphNodes: GraphNodeWithKnowledgePoint[];
  isShared: boolean;
  primaryColor: string;
  colors: string[];
}

interface MergedEdge extends Edge {
  graphId: string;
  color: string;
}

interface CombinedViewCanvasProps {
  nodes: MergedNode[];
  edges: MergedEdge[];
  graphColors: Record<string, string>;
  layoutMode: CombinedViewLayoutMode;
  highlightedGraphId: string | null;
  hiddenGraphIds: Set<string>;
  onNodeClick?: (node: MergedNode) => void;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

const NODE_RADIUS = 30;
const SHARED_NODE_RADIUS = 35;

function calculateLayout(
  nodes: MergedNode[],
  _edges: MergedEdge[],
  layoutMode: CombinedViewLayoutMode,
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return positions;
  
  if (layoutMode === 'grouped') {
    const graphGroups = new Map<string, MergedNode[]>();
    
    nodes.forEach(node => {
      const primaryGraph = node.graphIds[0];
      if (!graphGroups.has(primaryGraph)) {
        graphGroups.set(primaryGraph, []);
      }
      graphGroups.get(primaryGraph)?.push(node);
    });
    
    const numGroups = graphGroups.size;
    const groupAngle = (2 * Math.PI) / numGroups;
    const groupRadius = Math.min(width, height) * 0.3;
    const centerX = width / 2;
    const centerY = height / 2;
    
    let groupIndex = 0;
    graphGroups.forEach((groupNodes, _graphId) => {
      const groupCenterX = centerX + Math.cos(groupAngle * groupIndex - Math.PI / 2) * groupRadius;
      const groupCenterY = centerY + Math.sin(groupAngle * groupIndex - Math.PI / 2) * groupRadius;
      
      const nodeAngle = (2 * Math.PI) / groupNodes.length;
      const nodeRadius = Math.min(100, groupNodes.length * 15);
      
      groupNodes.forEach((node, nodeIndex) => {
        positions.set(node.id, {
          x: groupCenterX + Math.cos(nodeAngle * nodeIndex) * nodeRadius,
          y: groupCenterY + Math.sin(nodeAngle * nodeIndex) * nodeRadius
        });
      });
      
      groupIndex++;
    });
  } else if (layoutMode === 'merged') {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const sharedNodes = nodes.filter(n => n.isShared);
    const regularNodes = nodes.filter(n => !n.isShared);
    
    sharedNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / sharedNodes.length - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * (radius * 0.3),
        y: centerY + Math.sin(angle) * (radius * 0.3)
      });
    });
    
    regularNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / regularNodes.length;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
  } else {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
  }
  
  return positions;
}

export const CombinedViewCanvas: React.FC<CombinedViewCanvasProps> = ({
  nodes,
  edges,
  graphColors,
  layoutMode,
  highlightedGraphId,
  hiddenGraphIds,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const { t } = useTranslation();

  // 保持 ref 与 state 同步，用于回调中获取最新值而不触发重新渲染
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // 使用 rafThrottle 限制高频事件触发的 React 状态更新
  const throttledSetTransform = useMemo(() => rafThrottle((t: Transform) => {
    setTransform(t);
  }), []);
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const nodePositions = useMemo(
    () => calculateLayout(
      nodes,
      edges,
      layoutMode,
      dimensions.width,
      dimensions.height
    ),
    [nodes, edges, layoutMode, dimensions.width, dimensions.height]
  );
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const prev = transformRef.current;
    const newK = Math.max(0.1, Math.min(5, prev.k * scaleFactor));
    const newTransform = { ...prev, k: newK };
    transformRef.current = newTransform;
    throttledSetTransform(newTransform);
  }, [throttledSetTransform]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform.x, transform.y]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const newTransform = {
        ...transformRef.current,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      transformRef.current = newTransform;
      throttledSetTransform(newTransform);
    }
  }, [isDragging, dragStart, throttledSetTransform]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const visibleNodes = nodes.filter(node => 
    !node.graphIds.every(gid => hiddenGraphIds.has(gid))
  );
  
  // 预构建可见节点 id 集合，避免每条边在线性扫描 visibleNodes（原为 O(edges*visibleNodes)）
  const visibleNodeIdSet = new Set(visibleNodes.map(n => n.id));
  
  const visibleEdges = edges.filter(edge => 
    !hiddenGraphIds.has(edge.graphId) && 
    visibleNodeIdSet.has(edge.source_knowledge_point_id) &&
    visibleNodeIdSet.has(edge.target_knowledge_point_id)
  );
  
  const getNodeOpacity = (node: MergedNode): number => {
    if (!highlightedGraphId) return 1;
    return node.graphIds.includes(highlightedGraphId) ? 1 : 0.3;
  };
  
  const getEdgeOpacity = (edge: MergedEdge): number => {
    if (!highlightedGraphId) return 0.6;
    return edge.graphId === highlightedGraphId ? 0.8 : 0.2;
  };

  const focusedNodeTitle = hoveredNodeId
    ? nodes.find(n => n.id === hoveredNodeId)?.knowledgePoint.title ?? ''
    : '';
  const canvasAriaLabel = t('combinedViewPage.canvas.ariaLabel', {
    count: nodes.length,
    focus: focusedNodeTitle,
  });

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ background: 'radial-gradient(circle, #1a1a2e 0%, #16213e 100%)' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        role="application"
        aria-label={canvasAriaLabel}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <title>{canvasAriaLabel}</title>
        <desc>{t('combinedViewPage.canvas.desc')}</desc>
        <defs>
          {Object.entries(graphColors).map(([id, color]) => (
            <radialGradient key={`gradient-${id}`} id={`gradient-${id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="0.4" />
            </radialGradient>
          ))}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shared-glow">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {visibleEdges.map((edge) => {
            const sourcePos = nodePositions.get(edge.source_knowledge_point_id);
            const targetPos = nodePositions.get(edge.target_knowledge_point_id);
            if (!sourcePos || !targetPos) return null;
            
            return (
              <line
                key={edge.id}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke={edge.color}
                strokeWidth={2}
                strokeOpacity={getEdgeOpacity(edge)}
                style={{ transition: 'stroke-opacity 0.2s' }}
              />
            );
          })}
          
          {visibleNodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            
            const isHovered = hoveredNodeId === node.id;
            const radius = node.isShared ? SHARED_NODE_RADIUS : NODE_RADIUS;
            
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onNodeClick?.(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: 'pointer' }}
              >
                {node.isShared && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke="url(#shared-glow)"
                    strokeWidth={3}
                    strokeDasharray="5,3"
                    opacity={0.5}
                  />
                )}
                
                {node.colors.slice(0, 3).map((color, index) => {
                  const angle = (2 * Math.PI * index) / node.colors.length;
                  const arcPath = describeArc(0, 0, radius, 
                    (angle * 180 / Math.PI), 
                    ((angle + 2 * Math.PI / node.colors.length) * 180 / Math.PI)
                  );
                  return (
                    <path
                      key={index}
                      d={arcPath}
                      fill={color}
                      stroke={color}
                      strokeWidth={2}
                      opacity={getNodeOpacity(node)}
                      filter={isHovered ? 'url(#glow)' : undefined}
                    />
                  );
                })}
                
                <circle
                  r={radius * 0.7}
                  fill="#1a1a2e"
                  opacity={getNodeOpacity(node)}
                />
                
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={11}
                  fontWeight={node.isShared ? 'bold' : 'normal'}
                  opacity={getNodeOpacity(node)}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.knowledgePoint.title.length > 8 
                    ? `${node.knowledgePoint.title.slice(0, 8)  }...`
                    : node.knowledgePoint.title
                  }
                </text>
                
                {isHovered && (
                  <g>
                    <rect
                      x={radius + 10}
                      y={-30}
                      width={Math.max(150, node.knowledgePoint.title.length * 10)}
                      height={60}
                      rx={4}
                      fill="#2a2a4e"
                      stroke="#4a4a6e"
                      strokeWidth={1}
                    />
                    <text
                      x={radius + 15}
                      y={-10}
                      fill="white"
                      fontSize={12}
                      fontWeight="bold"
                    >
                      {node.knowledgePoint.title}
                    </text>
                    <text
                      x={radius + 15}
                      y={10}
                      fill="#aaa"
                      fontSize={10}
                    >
                      {t('combinedViewPage.canvas.graphCount', { count: node.graphIds.length })}
                    </text>
                    <text
                      x={radius + 15}
                      y={25}
                      fill="#888"
                      fontSize={9}
                    >
                      {node.isShared ? t('combinedViewPage.nodeDetail.shared') : t('combinedViewPage.nodeDetail.independent')}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setTransform(prev => ({ ...prev, k: Math.min(5, prev.k * 1.2) }))}
          className="min-w-[44px] min-h-[44px] w-auto h-auto bg-gray-700 hover:bg-gray-600 rounded text-white flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, k: Math.max(0.1, prev.k * 0.8) }))}
          className="min-w-[44px] min-h-[44px] w-auto h-auto bg-gray-700 hover:bg-gray-600 rounded text-white flex items-center justify-center"
        >
          -
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
          className="min-w-[44px] min-h-[44px] w-auto h-auto bg-gray-700 hover:bg-gray-600 rounded text-white flex items-center justify-center text-xs"
        >
          ⟲
        </button>
      </div>
    </div>
  );
};

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", x, y,
    "Z"
  ].join(" ");
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}
