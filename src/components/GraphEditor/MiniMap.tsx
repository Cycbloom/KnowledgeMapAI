import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface MiniMapProps {
  nodes: { id: string; x: number; y: number }[];
  transform: { x: number; y: number; k: number };
  containerWidth: number;
  containerHeight: number;
  onTransformChange: (newTransform: { x: number; y: number; k: number }) => void;
  width?: number;
  height?: number;
  className?: string;
  viewCenterX?: number;
  viewCenterY?: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  nodes,
  transform,
  containerWidth,
  containerHeight,
  onTransformChange,
  width = 240,
  height = 160,
  className = '',
  viewCenterX,
  viewCenterY
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Use provided view center or default to container center
  const targetCenterX = viewCenterX ?? containerWidth / 2;
  const targetCenterY = viewCenterY ?? containerHeight / 2;

  // Calculate the bounding box of the graph content
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // Add some padding
    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [nodes]);

  // Calculate scale to fit the graph into the minimap
  const scale = useMemo(() => {
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    return Math.min(scaleX, scaleY);
  }, [width, height, bounds]);

  // Calculate viewport rect in minimap coordinates
  // The viewport (container) shows a portion of the graph space defined by transform:
  // screenX = graphX * k + x
  // graphX = (screenX - x) / k
  // Viewport covers graphX from -x/k to (containerWidth-x)/k
  const viewportRect = useMemo(() => {
    // Top-left of viewport in graph coordinates
    const graphLeft = -transform.x / transform.k;
    const graphTop = -transform.y / transform.k;
    
    // Bottom-right of viewport in graph coordinates
    const graphRight = (containerWidth - transform.x) / transform.k;
    const graphBottom = (containerHeight - transform.y) / transform.k;

    // Map to minimap coordinates
    // minimapX = (graphX - bounds.minX) * scale
    const x = (graphLeft - bounds.minX) * scale;
    const y = (graphTop - bounds.minY) * scale;
    const w = (graphRight - graphLeft) * scale;
    const h = (graphBottom - graphTop) * scale;

    return { x, y, w, h };
  }, [transform, containerWidth, containerHeight, bounds, scale]);

  // Center the content in the minimap
  const offsetX = (width - bounds.width * scale) / 2;
  const offsetY = (height - bounds.height * scale) / 2;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  // Calculate visible center offset
  // If we have sidebars (implied by containerWidth/Height being full window but visible area smaller),
  // we might want to adjust center. But typically containerWidth passed here is the full canvas width.
  // The user issue "offset to top-left" suggests the center calculation is biased.
  // Standard center: containerWidth / 2.
  // If the user feels it's top-left, maybe the actual visual center is different due to UI overlays?
  // Let's assume the passed containerWidth/Height are the full canvas dimensions.
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && e.type !== 'mousedown') return;
    
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    // Click position relative to minimap
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;

    // Convert click position (minimap space) to graph space
    // minimapX = (graphX - bounds.minX) * scale + offsetX
    // graphX = (minimapX - offsetX) / scale + bounds.minX
    const graphCenterX = (clickX - offsetX) / scale + bounds.minX;
    const graphCenterY = (clickY - offsetY) / scale + bounds.minY;

    // We want to center the viewport on this graph position
    // Center of viewport in screen space is (targetCenterX, targetCenterY)
    // screenX = graphX * k + x
    // x = screenX - graphX * k
    const newX = targetCenterX - graphCenterX * transform.k;
    const newY = targetCenterY - graphCenterY * transform.k;

    onTransformChange({ ...transform, x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove as any);
    } else {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove as any);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  if (nodes.length === 0) return null;

  return (
    <div 
      className={`bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden backdrop-blur-sm ${className}`}
      style={{ width, height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        className="cursor-crosshair w-full h-full"
      >
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
          {/* Background for bounds */}
          <rect 
            x={bounds.minX} 
            y={bounds.minY} 
            width={bounds.width} 
            height={bounds.height} 
            fill="transparent" 
          />
          
          {/* Nodes */}
          {nodes.map(node => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={Math.max(40, 5 / scale)} // Ensure at least ~5px visual size
              fill={isDark ? '#94a3b8' : '#64748b'}
              opacity={0.8}
            />
          ))}
        </g>

        {/* Viewport Indicator */}
        <rect
          x={Math.max(0, Math.min(width - viewportRect.w, viewportRect.x + offsetX))}
          y={Math.max(0, Math.min(height - viewportRect.h, viewportRect.y + offsetY))}
          width={Math.min(width, viewportRect.w)}
          height={Math.min(height, viewportRect.h)}
          fill="transparent"
          stroke={isDark ? '#38bdf8' : '#0284c7'}
          strokeWidth="2"
          className="pointer-events-none transition-all duration-75"
        />
        <rect
          x={Math.max(0, Math.min(width - viewportRect.w, viewportRect.x + offsetX))}
          y={Math.max(0, Math.min(height - viewportRect.h, viewportRect.y + offsetY))}
          width={Math.min(width, viewportRect.w)}
          height={Math.min(height, viewportRect.h)}
          fill={isDark ? '#38bdf8' : '#0284c7'}
          fillOpacity="0.1"
          className="pointer-events-none transition-all duration-75"
        />
      </svg>
    </div>
  );
};