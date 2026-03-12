import React, { useMemo } from 'react';
import { LayoutNode, LayoutLink, LinkStyle, LinkAnimation, EdgeWidthMode, Edge, Node, RelationshipTypeConfig, RelationshipCategory } from '../../../types';
import { THEME_COLORS } from '../../../config/learningStatusColors';
import { calculateEdgeStrength } from '../../../lib/graphUtils';
import { getRelationshipTypeConfig, getDefaultRelationshipType } from '../../../config/relationshipTypes';

interface MindMapLinkProps {
  link: LayoutLink;
  nodes: Map<string, LayoutNode>;
  isDark: boolean;
  highlighted?: boolean;
  focused?: boolean;
  hasFocusMode?: boolean;
  linkStyle?: LinkStyle;
  linkAnimation?: LinkAnimation;
  edgeWidthMode?: EdgeWidthMode;
  edgeStrength?: number;
  allNodes?: Node[];
  allEdges?: Edge[];
  customColor?: string;
  showLabels?: boolean;
  showArrows?: boolean;
  relationshipTypeConfig?: RelationshipTypeConfig;
  onContextMenu?: (event: React.MouseEvent, link: LayoutLink) => void;
}

const normalizeId = (id: any) => String(id).trim();

const CATEGORIES_WITH_ARROW: RelationshipCategory[] = ['dependency', 'causal', 'interaction'];

const getLineStyleDashArray = (lineStyle: string): string => {
  const dashArrays: Record<string, string> = {
    solid: 'none',
    dashed: '8,4',
    dotted: '2,2',
    double: '4,2,1,2',
  };
  return dashArrays[lineStyle] || 'none';
};

const MindMapLinkComponent: React.FC<MindMapLinkProps> = ({
  link,
  nodes,
  isDark,
  highlighted = false,
  focused = false,
  hasFocusMode = false,
  linkStyle = 'curved',
  linkAnimation = 'none',
  edgeWidthMode = 'fixed',
  edgeStrength,
  allNodes = [],
  allEdges = [],
  customColor,
  showLabels = false,
  showArrows = true,
  relationshipTypeConfig,
  onContextMenu,
}) => {
  const sourceId = typeof link.source === 'string' ? normalizeId(link.source) : normalizeId(link.source.id);
  const targetId = typeof link.target === 'string' ? normalizeId(link.target) : normalizeId(link.target.id);
  
  const source = typeof link.source === 'string' ? nodes.get(sourceId) : link.source;
  const target = typeof link.target === 'string' ? nodes.get(targetId) : link.target;

  const colors = useMemo(() => isDark ? THEME_COLORS.dark : THEME_COLORS.light, [isDark]);
  
  const dynamicWidth = useMemo(() => {
    if (edgeWidthMode === 'fixed') {
      return 2;
    }
    
    if (edgeStrength !== undefined) {
      return 1 + edgeStrength * 4;
    }
    
    if (allNodes.length > 0 && allEdges.length > 0) {
      const strength = calculateEdgeStrength(link as Edge, allNodes, allEdges);
      return 1 + strength.score * 4;
    }
    
    return 2;
  }, [edgeWidthMode, edgeStrength, allNodes, allEdges, link]);

  const relationshipConfig = useMemo(() => {
    if (relationshipTypeConfig) {
      return relationshipTypeConfig;
    }
    if (link.relationship_type) {
      return getRelationshipTypeConfig(link.relationship_type);
    }
    return getDefaultRelationshipType();
  }, [relationshipTypeConfig, link.relationship_type]);

  const shouldShowArrow = useMemo(() => {
    if (!showArrows) return false;
    
    if (link.show_arrow !== undefined && link.show_arrow !== null) {
      return link.show_arrow;
    }
    
    const configShowArrow = relationshipConfig?.show_arrow;
    if (typeof configShowArrow === 'boolean') {
      return configShowArrow;
    }
    
    return relationshipConfig ? CATEGORIES_WITH_ARROW.includes(relationshipConfig.category) : false;
  }, [showArrows, link.show_arrow, relationshipConfig]);

  const edgeLabel = useMemo(() => {
    if (link.custom_label) {
      return link.custom_label;
    }
    return relationshipConfig?.display_name || link.relationship_type || '';
  }, [link.custom_label, relationshipConfig?.display_name, link.relationship_type]);

  const linkStyleConfig = useMemo(() => {
    if (!target) {
      return { 
        strokeColor: customColor || colors.link, 
        strokeWidth: 2, 
        opacity: 0.4, 
        strokeDasharray: 'none',
        showArrow: false,
      };
    }
    
    let strokeColor = customColor || link.custom_color || relationshipConfig?.color || colors.link;
    let strokeWidth = dynamicWidth;
    let opacity = 0.4;
    let strokeDasharray = getLineStyleDashArray(link.custom_line_style || relationshipConfig?.line_style || 'solid');
    
    const isTargetAccepted = target.is_accepted !== false;
    
    if (!isTargetAccepted) {
      strokeDasharray = '6,4';
      opacity = 0.3;
      strokeWidth = Math.max(1, dynamicWidth * 0.75);
    }
    
    if (!hasFocusMode) {
      opacity = isTargetAccepted ? 0.4 : 0.3;
    } else if (focused) {
      strokeColor = customColor || link.custom_color || relationshipConfig?.color || colors.linkHighlight;
      strokeWidth = Math.max(3, dynamicWidth * 1.5);
      opacity = 0.8;
    } else if (highlighted) {
      strokeColor = customColor || link.custom_color || relationshipConfig?.color || colors.linkHighlight;
      strokeWidth = Math.max(3, dynamicWidth * 1.5);
      opacity = 0.8;
    } else {
      opacity = isTargetAccepted ? 0.1 : 0.05;
    }

    return { 
      strokeColor, 
      strokeWidth, 
      opacity, 
      strokeDasharray,
      showArrow: shouldShowArrow,
    };
  }, [colors, hasFocusMode, focused, highlighted, target, dynamicWidth, customColor, link.custom_color, link.custom_line_style, relationshipConfig, shouldShowArrow]);

  const pathData = useMemo(() => {
    if (!source || !target) return '';
    
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    switch (linkStyle) {
      case 'straight':
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
      
      case 'step': {
        const midX = (source.x + target.x) / 2;
        return `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;
      }
      
      case 'bezier': {
        const midX2 = (source.x + target.x) / 2;
        const midY2 = (source.y + target.y) / 2;
        const controlOffset = distance * 0.3;
        const perpX = (dy / distance) * controlOffset;
        const perpY = -(dx / distance) * controlOffset;
        return `M ${source.x} ${source.y} Q ${midX2 + perpX} ${midY2 + perpY} ${target.x} ${target.y}`;
      }
      
      case 'curved':
      default: {
        const midX3 = (source.x + target.x) / 2;
        const midY3 = (source.y + target.y) / 2;
        return `M ${source.x} ${source.y} Q ${midX3} ${midY3} ${target.x} ${target.y}`;
      }
    }
  }, [source, target, linkStyle]);

  const animationStyle = useMemo(() => {
    const baseTransition = 'stroke-width 0.2s, opacity 0.2s';
    
    switch (linkAnimation) {
      case 'flow':
        return {
          strokeDasharray: '10, 10',
          animation: 'dash 1s linear infinite',
          transition: baseTransition
        };
      case 'pulse':
        return {
          animation: 'pulse 2s ease-in-out infinite',
          transition: baseTransition
        };
      case 'dash':
        return {
          strokeDasharray: '5, 5',
          animation: 'dash 0.5s linear infinite',
          transition: baseTransition
        };
      case 'none':
      default:
        return {
          transition: baseTransition
        };
    }
  }, [linkAnimation]);

  if (!source || !target) return null;

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const arrowId = `arrow-${link.id}`;
  const arrowSize = Math.max(4, Math.min(8, linkStyleConfig.strokeWidth * 2));

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, link);
    }
  };

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
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          orient="auto-start-reverse"
        >
          <path 
            d="M 0 0 L 10 5 L 0 10 z" 
            fill={linkStyleConfig.strokeColor}
            opacity={linkStyleConfig.opacity}
          />
        </marker>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        onContextMenu={handleContextMenu}
        style={{ cursor: onContextMenu ? 'pointer' : 'default' }}
      />
      <path
        d={pathData}
        fill="none"
        stroke={linkStyleConfig.strokeColor}
        strokeWidth={linkStyleConfig.strokeWidth}
        opacity={linkStyleConfig.opacity}
        strokeLinecap="round"
        strokeDasharray={linkStyleConfig.strokeDasharray}
        style={animationStyle}
        markerEnd={linkStyleConfig.showArrow ? `url(#${arrowId})` : undefined}
        onContextMenu={handleContextMenu}
      />
      {showLabels && edgeLabel && (
        <g>
          <rect
            x={midX - edgeLabel.length * 3 - 4}
            y={midY - 8}
            width={edgeLabel.length * 6 + 8}
            height={16}
            fill={isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)'}
            rx={3}
            ry={3}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={isDark ? '#fff' : '#000'}
            opacity={0.9}
          >
            {edgeLabel}
          </text>
        </g>
      )}
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

  const relationshipConfigEqual = 
    prevProps.relationshipTypeConfig?.id === nextProps.relationshipTypeConfig?.id &&
    prevProps.relationshipTypeConfig?.color === nextProps.relationshipTypeConfig?.color &&
    prevProps.relationshipTypeConfig?.line_style === nextProps.relationshipTypeConfig?.line_style &&
    prevProps.relationshipTypeConfig?.show_arrow === nextProps.relationshipTypeConfig?.show_arrow;
  
  return (
    prevProps.link.id === nextProps.link.id &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.highlighted === nextProps.highlighted &&
    prevProps.focused === nextProps.focused &&
    prevProps.hasFocusMode === nextProps.hasFocusMode &&
    prevProps.linkStyle === nextProps.linkStyle &&
    prevProps.linkAnimation === nextProps.linkAnimation &&
    prevProps.showLabels === nextProps.showLabels &&
    prevProps.showArrows === nextProps.showArrows &&
    prevProps.customColor === nextProps.customColor &&
    relationshipConfigEqual &&
    prevProps.link.show_arrow === nextProps.link.show_arrow &&
    prevProps.link.custom_label === nextProps.link.custom_label &&
    prevProps.link.custom_color === nextProps.link.custom_color &&
    prevProps.link.custom_line_style === nextProps.link.custom_line_style &&
    prevProps.link.relationship_type === nextProps.link.relationship_type &&
    prevProps.nodes.get(prevSourceId)?.x === nextProps.nodes.get(nextSourceId)?.x &&
    prevProps.nodes.get(prevSourceId)?.y === nextProps.nodes.get(nextSourceId)?.y &&
    prevProps.nodes.get(prevTargetId)?.x === nextProps.nodes.get(nextTargetId)?.x &&
    prevProps.nodes.get(prevTargetId)?.y === nextProps.nodes.get(nextTargetId)?.y
  );
});
