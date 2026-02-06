import React, { useMemo } from 'react';
import { LayoutNode, LayoutLink } from '../../types';
import { THEME_COLORS } from '../../config/learningStatusColors';

interface MindMapLinkProps {
  link: LayoutLink;
  nodes: Map<string, LayoutNode>;
  isDark: boolean;
  highlighted?: boolean;
  focused?: boolean;
  hasFocusMode?: boolean;
}

const MindMapLinkComponent: React.FC<MindMapLinkProps> = ({
  link,
  nodes,
  isDark,
  highlighted = false,
  focused = false,
  hasFocusMode = false
}) => {
  const source = typeof link.source === 'string' ? nodes.get(link.source) : link.source;
  const target = typeof link.target === 'string' ? nodes.get(link.target) : link.target;

  if (!source || !target) return null;

  const colors = useMemo(() => isDark ? THEME_COLORS.dark : THEME_COLORS.light, [isDark]);
  
  const linkStyle = useMemo(() => {
    let strokeColor = colors.link;
    let strokeWidth = 2;
    let opacity = 0.4;
    
    if (!hasFocusMode) {
      opacity = 0.4;
    } else if (focused) {
      strokeColor = colors.linkHighlight;
      strokeWidth = 3;
      opacity = 0.8;
    } else if (highlighted) {
      strokeColor = colors.linkHighlight;
      strokeWidth = 3;
      opacity = 0.8;
    } else {
      opacity = 0.1;
    }

    return { strokeColor, strokeWidth, opacity };
  }, [colors, hasFocusMode, focused, highlighted]);

  const pathData = useMemo(() => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

    const controlOffset = distance * 0.2;

    return `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;
  }, [source.x, source.y, target.x, target.y]);

  return (
    <path
      d={pathData}
      fill="none"
      stroke={linkStyle.strokeColor}
      strokeWidth={linkStyle.strokeWidth}
      opacity={linkStyle.opacity}
      strokeLinecap="round"
      style={{
        transition: 'stroke-width 0.2s, opacity 0.2s'
      }}
    />
  );
};

export const MindMapLink = React.memo(MindMapLinkComponent, (prevProps, nextProps) => {
  const getSourceId = (link: LayoutLink) => typeof link.source === 'string' ? link.source : link.source.id;
  const getTargetId = (link: LayoutLink) => typeof link.target === 'string' ? link.target : link.target.id;
  
  const prevSourceId = getSourceId(prevProps.link);
  const nextSourceId = getSourceId(nextProps.link);
  const prevTargetId = getTargetId(prevProps.link);
  const nextTargetId = getTargetId(nextProps.link);
  
  return (
    prevProps.link.id === nextProps.link.id &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.highlighted === nextProps.highlighted &&
    prevProps.focused === nextProps.focused &&
    prevProps.hasFocusMode === nextProps.hasFocusMode &&
    prevProps.nodes.get(prevSourceId)?.x === nextProps.nodes.get(nextSourceId)?.x &&
    prevProps.nodes.get(prevSourceId)?.y === nextProps.nodes.get(nextSourceId)?.y &&
    prevProps.nodes.get(prevTargetId)?.x === nextProps.nodes.get(nextTargetId)?.x &&
    prevProps.nodes.get(prevTargetId)?.y === nextProps.nodes.get(nextTargetId)?.y
  );
});