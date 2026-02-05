import React from 'react';
import { LayoutNode, LearningStatus } from '../../types';
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
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  edges,
  nodeStatus,
  selected,
  isDark,
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
  const level = getLevel(node, edges);
  const styleConfig = NODE_STYLE_CONFIG[level];
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);

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

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
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
    </g>
  );
};