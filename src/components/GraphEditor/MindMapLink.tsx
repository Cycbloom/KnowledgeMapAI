import React from 'react';
import { LayoutNode, LayoutLink } from '../../types';
import { THEME_COLORS } from '../../config/learningStatusColors';

interface MindMapLinkProps {
  link: LayoutLink;
  nodes: Map<string, LayoutNode>;
  isDark: boolean;
  highlighted?: boolean;
}

export const MindMapLink: React.FC<MindMapLinkProps> = ({
  link,
  nodes,
  isDark,
  highlighted = false
}) => {
  const source = typeof link.source === 'string' ? nodes.get(link.source) : link.source;
  const target = typeof link.target === 'string' ? nodes.get(link.target) : link.target;

  if (!source || !target) return null;

  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const strokeColor = highlighted ? colors.linkHighlight : colors.link;
  const strokeWidth = highlighted ? 3 : 2;
  const opacity = highlighted ? 0.8 : 0.4;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  const controlOffset = distance * 0.2;

  const pathData = `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;

  return (
    <path
      d={pathData}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      opacity={opacity}
      strokeLinecap="round"
      style={{
        transition: 'stroke-width 0.2s, opacity 0.2s'
      }}
    />
  );
};