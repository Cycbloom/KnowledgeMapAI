import React from 'react';
import { LayoutNode, LearningStatus, NodeLevel } from '../../types';
import { NodeRing } from './NodeRing';
import { NODE_STYLE_CONFIG, getRingRadius, getRingOpacity, getCenterDotRadius } from '../../config/nodeStyleConfig';
import { getLearningStatus, getStatusColors } from '../../config/learningStatusColors';
import { getLevel } from '../../lib/graphUtils';
import { Edge } from '../../types';

interface MindMapNodeProps {
  node: LayoutNode;
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selected: boolean;
  isDark: boolean;
  zoomLevel: number;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  focused?: boolean;
  forceShowText?: boolean;
  hasFocusMode?: boolean;
}

const getTextVisibility = (level: NodeLevel, zoomLevel: number, forceShowText: boolean = false): { visible: boolean; opacity: number } => {
  if (forceShowText) {
    return { visible: true, opacity: 1 };
  }
  
  const thresholds: Record<NodeLevel, { minZoom: number; maxOpacity: number }> = {
    root: { minZoom: 0, maxOpacity: 1 },
    core: { minZoom: 0.2, maxOpacity: 1 },
    sub: { minZoom: 0.4, maxOpacity: 0.95 },
    normal: { minZoom: 0.6, maxOpacity: 0.9 },
    leaf: { minZoom: 0.8, maxOpacity: 0.85 }
  };

  const threshold = thresholds[level] || thresholds.leaf;
  const visible = zoomLevel >= threshold.minZoom;
  
  const opacity = visible 
    ? Math.min(threshold.maxOpacity, (zoomLevel - threshold.minZoom) * 0.3 + 0.7)
    : 0;

  return { visible, opacity };
};

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  edges,
  nodeStatus,
  selected,
  isDark,
  zoomLevel,
  onClick,
  onMouseEnter,
  onMouseLeave,
  focused = false,
  forceShowText = false,
  hasFocusMode = false
}) => {
  const level = getLevel(node, edges);
  const styleConfig = NODE_STYLE_CONFIG[level];
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);
  const textVisibility = getTextVisibility(level, zoomLevel, forceShowText);
  
  const nodeOpacity = !hasFocusMode ? 1 : (focused ? 1 : 0.3);

  const rings = [];
  for (let i = 0; i < styleConfig.rings; i++) {
    const radius = getRingRadius(styleConfig.baseRadius, i, styleConfig.rings);
    const opacity = getRingOpacity(i, styleConfig.rings);
    const color = i === 0 ? colors.primary : colors.secondary;

    rings.push(
      <NodeRing
        key={`ring-${i}`}
        radius={radius}
        strokeWidth={styleConfig.strokeWidth}
        color={color}
        opacity={opacity}
        dashArray={styleConfig.dashArray}
        showGlow={i === 0 && styleConfig.showGlow}
        glowColor={colors.glow}
      />
    );
  }

  const centerDotRadius = styleConfig.showCenterDot ? getCenterDotRadius(styleConfig.baseRadius) : 0;
  const maxRadius = getRingRadius(styleConfig.baseRadius, styleConfig.rings - 1, styleConfig.rings) + styleConfig.strokeWidth;
  const textOffset = maxRadius + 12;
  const baseFontSize = level === 'root' ? 14 : level === 'core' ? 12 : 10;
  const scaledFontSize = baseFontSize / zoomLevel;
  const shadowBlur = 3 / zoomLevel;
  const shadowOffset = 1 / zoomLevel;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer', opacity: nodeOpacity, transition: 'opacity 0.2s ease' }}
    >
      <g
        style={{
          transition: 'transform 0.2s ease',
          transform: selected ? 'scale(1.1)' : 'scale(1)'
        }}
      >
        {rings}
        
        {styleConfig.showCenterDot && centerDotRadius > 0 && (
          <circle
            r={centerDotRadius}
            fill={colors.primary}
            style={{
              filter: selected ? 'drop-shadow(0 0 8px ' + colors.glow + ')' : 'none'
            }}
          />
        )}

        {selected && (
          <circle
            r={styleConfig.baseRadius + 8}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            opacity={0.5}
            strokeDasharray="4 4"
          />
        )}
      </g>
      
      <circle
        r={maxRadius}
        fill="transparent"
        onClick={onClick}
      />

      {textVisibility.visible && (
        <text
          x={0}
          y={textOffset}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scaledFontSize}
          fontWeight={level === 'root' ? 700 : level === 'core' ? 600 : 500}
          fill={isDark ? '#f1f5f9' : '#0f172a'}
          opacity={textVisibility.opacity}
          style={{
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease',
            textShadow: isDark 
              ? `0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)` 
              : `0 2px 4px rgba(0,0,0,0.15), 0 0 8px rgba(0,0,0,0.1)`
          }}
        >
          {node.title || '未命名'}
        </text>
      )}
    </g>
  );
};