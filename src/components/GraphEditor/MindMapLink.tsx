import React, { useMemo } from 'react';
import { LayoutNode, LayoutLink, LinkStyle, LinkAnimation } from '../../types';
import { THEME_COLORS } from '../../config/learningStatusColors';

interface MindMapLinkProps {
  link: LayoutLink;
  nodes: Map<string, LayoutNode>;
  isDark: boolean;
  highlighted?: boolean;
  focused?: boolean;
  hasFocusMode?: boolean;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
}

const MindMapLinkComponent: React.FC<MindMapLinkProps> = ({
  link,
  nodes,
  isDark,
  highlighted = false,
  focused = false,
  hasFocusMode = false,
  linkStyle = 'curved',
  linkAnimation = 'none'
}) => {
  const source = typeof link.source === 'string' ? nodes.get(link.source) : link.source;
  const target = typeof link.target === 'string' ? nodes.get(link.target) : link.target;

  if (!source || !target) return null;

  const colors = useMemo(() => isDark ? THEME_COLORS.dark : THEME_COLORS.light, [isDark]);
  
  const linkStyleConfig = useMemo(() => {
    let strokeColor = colors.link;
    let strokeWidth = 2;
    let opacity = 0.4;
    let strokeDasharray = 'none';
    
    const isTargetAccepted = target.is_accepted !== false;
    
    if (!isTargetAccepted) {
      strokeDasharray = '6,4';
      opacity = 0.3;
      strokeWidth = 1.5;
    }
    
    if (!hasFocusMode) {
      opacity = isTargetAccepted ? 0.4 : 0.3;
    } else if (focused) {
      strokeColor = colors.linkHighlight;
      strokeWidth = 3;
      opacity = 0.8;
    } else if (highlighted) {
      strokeColor = colors.linkHighlight;
      strokeWidth = 3;
      opacity = 0.8;
    } else {
      opacity = isTargetAccepted ? 0.1 : 0.05;
    }

    return { strokeColor, strokeWidth, opacity, strokeDasharray };
  }, [colors, hasFocusMode, focused, highlighted, target]);

  const pathData = useMemo(() => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    switch (linkStyle) {
      case 'straight':
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
      
      case 'step':
        const midX = (source.x + target.x) / 2;
        return `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;
      
      case 'bezier':
        const midX2 = (source.x + target.x) / 2;
        const midY2 = (source.y + target.y) / 2;
        const controlOffset = distance * 0.3;
        const perpX = (dy / distance) * controlOffset;
        const perpY = -(dx / distance) * controlOffset;
        return `M ${source.x} ${source.y} Q ${midX2 + perpX} ${midY2 + perpY} ${target.x} ${target.y}`;
      
      case 'curved':
      default:
        const midX3 = (source.x + target.x) / 2;
        const midY3 = (source.y + target.y) / 2;
        const controlOffset2 = distance * 0.2;
        return `M ${source.x} ${source.y} Q ${midX3} ${midY3} ${target.x} ${target.y}`;
    }
  }, [source.x, source.y, target.x, target.y, linkStyle]);

  const animationStyle = useMemo(() => {
    switch (linkAnimation) {
      case 'flow':
        return {
          strokeDasharray: '10, 10',
          animation: 'dash 1s linear infinite',
          transition: 'none'
        };
      case 'pulse':
        return {
          animation: 'pulse 2s ease-in-out infinite',
          transition: 'none'
        };
      case 'dash':
        return {
          strokeDasharray: '5, 5',
          animation: 'dash 0.5s linear infinite',
          transition: 'none'
        };
      case 'none':
      default:
        return {
          transition: 'stroke-width 0.2s, opacity 0.2s'
        };
    }
  }, [linkAnimation]);

  return (
    <>
      <style>
        {`
          @keyframes dash {
            to {
              stroke-dashoffset: -20;
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: ${linkStyleConfig.opacity};
            }
            50% {
              opacity: ${linkStyleConfig.opacity * 0.5};
            }
          }
        `}
      </style>
      <path
        d={pathData}
        fill="none"
        stroke={linkStyleConfig.strokeColor}
        strokeWidth={linkStyleConfig.strokeWidth}
        opacity={linkStyleConfig.opacity}
        strokeLinecap="round"
        strokeDasharray={linkStyleConfig.strokeDasharray}
        style={animationStyle}
      />
    </>
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
    prevProps.linkStyle === nextProps.linkStyle &&
    prevProps.linkAnimation === nextProps.linkAnimation &&
    prevProps.nodes.get(prevSourceId)?.x === nextProps.nodes.get(nextSourceId)?.x &&
    prevProps.nodes.get(prevSourceId)?.y === nextProps.nodes.get(nextSourceId)?.y &&
    prevProps.nodes.get(prevTargetId)?.x === nextProps.nodes.get(nextTargetId)?.x &&
    prevProps.nodes.get(prevTargetId)?.y === nextProps.nodes.get(nextTargetId)?.y
  );
});