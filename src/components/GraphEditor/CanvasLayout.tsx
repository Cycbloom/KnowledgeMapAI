import React from 'react';
import { TemplateLayout } from '../types';

interface CanvasLayoutProps {
  layout?: TemplateLayout;
  width: number;
  height: number;
}

export const CanvasLayout: React.FC<CanvasLayoutProps> = ({
  layout,
  width,
  height,
}) => {
  if (!layout) return null;

  if (layout.type === 'quadrant' && layout.showAxes) {
    return (
      <g className="canvas-layout">
        {layout.zones?.map((zone) => (
          <g key={zone.id}>
            <rect
              x={zone.bounds.x}
              y={zone.bounds.y}
              width={zone.bounds.width}
              height={zone.bounds.height}
              fill={zone.color || 'rgba(200, 200, 200, 0.1)'}
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="1"
            />
            {layout.showLabels && (
              <text
                x={zone.bounds.x + zone.bounds.width / 2}
                y={zone.bounds.y + zone.bounds.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-sm font-medium fill-gray-700 dark:fill-gray-300"
                style={{ pointerEvents: 'none' }}
              >
                {zone.label}
              </text>
            )}
          </g>
        ))}

        {layout.axes?.x && (
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(0, 0, 0, 0.3)"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        )}

        {layout.axes?.y && (
          <line
            x1={width / 2}
            y1={0}
            x2={width / 2}
            y2={height}
            stroke="rgba(0, 0, 0, 0.3)"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        )}

        {layout.axes?.x && layout.showLabels && (
          <text
            x={width - 10}
            y={height / 2 - 10}
            textAnchor="end"
            className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
            style={{ pointerEvents: 'none' }}
          >
            {layout.axes.x.label}
          </text>
        )}

        {layout.axes?.y && layout.showLabels && (
          <text
            x={width / 2 + 10}
            y={10}
            textAnchor="start"
            className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
            style={{ pointerEvents: 'none' }}
          >
            {layout.axes.y.label}
          </text>
        )}
      </g>
    );
  }

  if (layout.type === 'timeline' && layout.showLabels) {
    const isHorizontal = layout.timeline?.direction === 'horizontal';
    
    return (
      <g className="canvas-layout">
        {isHorizontal ? (
          <>
            <line
              x1={50}
              y1={height / 2}
              x2={width - 50}
              y2={height / 2}
              stroke="rgba(0, 0, 0, 0.3)"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            {layout.timeline?.startLabel && (
              <text
                x={50}
                y={height / 2 - 15}
                textAnchor="start"
                className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
                style={{ pointerEvents: 'none' }}
              >
                {layout.timeline.startLabel}
              </text>
            )}
            {layout.timeline?.endLabel && (
              <text
                x={width - 50}
                y={height / 2 - 15}
                textAnchor="end"
                className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
                style={{ pointerEvents: 'none' }}
              >
                {layout.timeline.endLabel}
              </text>
            )}
          </>
        ) : (
          <>
            <line
              x1={width / 2}
              y1={50}
              x2={width / 2}
              y2={height - 50}
              stroke="rgba(0, 0, 0, 0.3)"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            {layout.timeline?.startLabel && (
              <text
                x={width / 2 + 10}
                y={50}
                textAnchor="start"
                className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
                style={{ pointerEvents: 'none' }}
              >
                {layout.timeline.startLabel}
              </text>
            )}
            {layout.timeline?.endLabel && (
              <text
                x={width / 2 + 10}
                y={height - 50}
                textAnchor="start"
                className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
                style={{ pointerEvents: 'none' }}
              >
                {layout.timeline.endLabel}
              </text>
            )}
          </>
        )}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="rgba(0, 0, 0, 0.3)"
            />
          </marker>
        </defs>
      </g>
    );
  }

  if (layout.showGrid) {
    const gridSize = 50;
    const verticalLines = Math.ceil(width / gridSize);
    const horizontalLines = Math.ceil(height / gridSize);

    return (
      <g className="canvas-layout">
        {Array.from({ length: verticalLines }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * gridSize}
            y1={0}
            x2={i * gridSize}
            y2={height}
            stroke="rgba(0, 0, 0, 0.05)"
            strokeWidth="1"
            style={{ pointerEvents: 'none' }}
          />
        ))}
        {Array.from({ length: horizontalLines }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={i * gridSize}
            x2={width}
            y2={i * gridSize}
            stroke="rgba(0, 0, 0, 0.05)"
            strokeWidth="1"
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </g>
    );
  }

  return null;
};