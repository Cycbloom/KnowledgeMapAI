import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { LayoutNode, LearningStatus, NodeLevel, CenterDotShape, ColorScheme, GraphColorMode } from '../../types';
import { NodeRing } from './NodeRing';
import { 
  NODE_STYLE_CONFIG, 
  getRingRadius, 
  getRingOpacity, 
  getCenterDotRadius,
  getShadowStyle,
  getGradientId,
  getCenterDotPath
} from '../../config/nodeStyleConfig';
import { getLearningStatus, getStatusColors, getLevelColors } from '../../config/learningStatusColors';
import { getLevel, calculateNodeImportance } from '../../lib/graphUtils';
import { Edge, NodeSizeMode, Node } from '../../types';

interface MindMapNodeProps {
  node: LayoutNode;
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selected: boolean;
  multiSelected?: boolean;
  isDark: boolean;
  zoomLevel: number;
  onClick: (e?: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  focused?: boolean;
  forceShowText?: boolean;
  hasFocusMode?: boolean;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
  isNew?: boolean;
  nodeSizeMode?: NodeSizeMode;
  nodeImportance?: number;
  allNodes?: Node[];
  onContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  isSelectableAsParent?: boolean;
  isExcludedAsParent?: boolean;
  isSelectedAsParent?: boolean;
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

const MindMapNodeComponent: React.FC<MindMapNodeProps> = ({
  node,
  edges,
  nodeStatus,
  selected,
  multiSelected = false,
  isDark,
  zoomLevel,
  onClick,
  onMouseEnter,
  onMouseLeave,
  focused = false,
  forceShowText = false,
  hasFocusMode = false,
  colorScheme = 'default',
  coloringMode = 'status',
  isNew = false,
  nodeSizeMode = 'fixed',
  nodeImportance,
  allNodes = [],
  onContextMenu,
  isSelectableAsParent = false,
  isExcludedAsParent = false,
  isSelectedAsParent = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const level = getLevel(node, edges);
  const tags = useMemo(() => node.tags || node.properties?.tags || [], [node.tags, node.properties]);
  
  const dynamicSize = useMemo(() => {
    if (nodeSizeMode === 'fixed') {
      return 1.0;
    }
    
    if (nodeImportance !== undefined) {
      return 0.8 + nodeImportance * 0.7;
    }
    
    if (allNodes.length > 0) {
      const importance = calculateNodeImportance(node as Node, allNodes, edges, nodeStatus);
      return 0.8 + importance.score * 0.7;
    }
    
    return 1.0;
  }, [nodeSizeMode, nodeImportance, allNodes, node, edges, nodeStatus]);
  
  const styleConfig = useMemo(() => {
    const baseConfig = NODE_STYLE_CONFIG[level];
    return {
      ...baseConfig,
      baseRadius: baseConfig.baseRadius * dynamicSize
    };
  }, [level, dynamicSize]);
  
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = useMemo(() => {
    if (coloringMode === 'level') {
      return getLevelColors(level, isDark);
    }
    return getStatusColors(status, isDark, colorScheme);
  }, [coloringMode, level, status, isDark, colorScheme]);
  
  const textVisibility = getTextVisibility(level, zoomLevel, forceShowText);
  
  const nodeOpacity = !hasFocusMode ?1 : (focused ?1 : 0.3);
  const isAccepted = node.is_accepted !== false;
  const hoverScale = isHovered ? styleConfig.animation.hoverScale : 1;
  const showHoverGlow = isHovered && styleConfig.animation.hoverGlow;
  const shadowStyle = getShadowStyle(styleConfig.shadow);
  const transitionDuration = styleConfig.animation.transitionDuration;

  const animationTransform = useMemo(() => {
    if (!isNew) return { scale: 1, opacity: 1 };
    return { scale: 0, opacity: 0 };
  }, [isNew]);

  const currentScale = isNew ? hoverScale : animationTransform.scale;
  const currentOpacity = isNew ? (isAccepted ? nodeOpacity : nodeOpacity * 0.5) : animationTransform.opacity;

  const rings = useMemo(() => {
    const result = [];
    for (let i = 0; i < styleConfig.rings; i++) {
      const radius = getRingRadius(styleConfig.baseRadius, i, styleConfig.rings, styleConfig.ringSpacing);
      const opacity = getRingOpacity(i, styleConfig.rings);
      const color = i === 0 ? colors.primary : colors.secondary;
      const gradientId = getGradientId(node.id, i);

      result.push(
        <NodeRing
          key={`ring-${i}`}
          radius={radius}
          strokeWidth={styleConfig.strokeWidth}
          color={color}
          opacity={opacity}
          dashArray={styleConfig.dashArray}
          showGlow={i === 0 && styleConfig.showGlow}
          glowColor={colors.glow}
          gradient={styleConfig.gradient}
          gradientId={gradientId}
          enableRotation={styleConfig.animation.enablePulse && i === 0}
          rotationSpeed={styleConfig.animation.pulseSpeed}
          shadowBlur={styleConfig.shadow.enabled ? styleConfig.shadow.blur : 0}
          shadowColor={styleConfig.shadow.color}
        />
      );
    }
    return result;
  }, [styleConfig, colors.primary, colors.secondary, colors.glow, node.id]);

  const gradientDefinitions = useMemo(() => {
    const defs = [];
    defs.push(
      <linearGradient key="multiSelectGradient" id="multiSelectGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
        <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
        <stop offset="100%" stopColor="#ec4899" stopOpacity="1" />
      </linearGradient>
    );
    for (let i = 0; i < styleConfig.rings; i++) {
      const gradientId = getGradientId(node.id, i);
      const gradientColors = styleConfig.gradient.colors.length > 0 
        ? styleConfig.gradient.colors 
        : [colors.primary, colors.secondary];

      if (styleConfig.gradient.enabled) {
        if (styleConfig.gradient.type === 'radial') {
          defs.push(
            <radialGradient key={gradientId} id={gradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={gradientColors[0]} stopOpacity="0.8" />
              <stop offset="100%" stopColor={gradientColors[1] || gradientColors[0]} stopOpacity="0.2" />
            </radialGradient>
          );
        } else {
          const angle = styleConfig.gradient.angle || 0;
          const rad = (angle * Math.PI) / 180;
          const x1 = 50 - Math.cos(rad) * 50;
          const y1 = 50 - Math.sin(rad) * 50;
          const x2 = 50 + Math.cos(rad) * 50;
          const y2 = 50 + Math.sin(rad) * 50;

          defs.push(
            <linearGradient 
              key={gradientId} 
              id={gradientId} 
              x1={`${x1}%`} 
              y1={`${y1}%`} 
              x2={`${x2}%`} 
              y2={`${y2}%`}
            >
              <stop offset="0%" stopColor={gradientColors[0]} stopOpacity="0.8" />
              <stop offset="100%" stopColor={gradientColors[1] || gradientColors[0]} stopOpacity="0.2" />
            </linearGradient>
          );
        }
      }
    }
    return defs;
  }, [styleConfig.gradient, colors.primary, colors.secondary, node.id, styleConfig.rings]);

  const centerDotRadius = styleConfig.showCenterDot ? getCenterDotRadius(styleConfig.baseRadius) : 0;
  const centerDotPath = getCenterDotPath(centerDotRadius, styleConfig.centerDotShape);
  const maxRadius = useMemo(() => getRingRadius(styleConfig.baseRadius, 0, styleConfig.rings, styleConfig.ringSpacing) + styleConfig.strokeWidth / 2, [styleConfig.baseRadius, styleConfig.rings, styleConfig.strokeWidth, styleConfig.ringSpacing]);
  const textOffset = useMemo(() => maxRadius + 12, [maxRadius]);
  const baseFontSize = level === 'root' ? 14 : level === 'core' ? 12 : 10;
  const scaledFontSize = useMemo(() => baseFontSize / zoomLevel, [baseFontSize, zoomLevel]);
  const tagOffset = useMemo(() => textOffset + scaledFontSize * 1.4, [textOffset, scaledFontSize]);
  const shadowBlur = useMemo(() => 3 / zoomLevel, [zoomLevel]);
  const shadowOffset = useMemo(() => 1 / zoomLevel, [zoomLevel]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(e);
  }, [onClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCircleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(e);
  }, [onClick]);

  const handleCircleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    setIsHovered(true);
    onMouseEnter?.(e);
  }, [onMouseEnter]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onMouseLeave?.();
  }, [onMouseLeave]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, node);
    }
  }, [onContextMenu, node]);

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ 
        cursor: isExcludedAsParent ? 'not-allowed' : isSelectableAsParent ? 'crosshair' : 'pointer',  
        opacity: isExcludedAsParent ? 0.3 : currentOpacity,
        transition: `opacity ${transitionDuration}ms ease`
      }}
    >
      <svg width={0} height={0}>
        <defs>
          {gradientDefinitions}
        </defs>
      </svg>
      
      {isSelectableAsParent && !isSelectedAsParent && (
        <circle
          r={styleConfig.baseRadius + 12}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 3"
          opacity={0.6}
          className="animate-pulse"
        />
      )}
      {isSelectableAsParent && isSelectedAsParent && (
        <circle
          r={styleConfig.baseRadius + 12}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          opacity={0.8}
        />
      )}
      <g
        style={{
          transition: `transform ${transitionDuration}ms ease`,
          transform: `scale(${currentScale})`,
          filter: shadowStyle
        }}
      >
        {isAccepted ? (
          <>
            {rings}
            
            {styleConfig.showCenterDot && centerDotRadius > 0 && styleConfig.centerDotShape === 'circle' && (
              <circle
                r={centerDotRadius}
                fill={colors.primary}
                style={{
                  filter: (selected || showHoverGlow) ? `drop-shadow(0 0 ${8 / zoomLevel}px ${colors.glow})` : 'none'
                }}
              />
            )}
            
            {styleConfig.showCenterDot && centerDotRadius > 0 && styleConfig.centerDotShape !== 'circle' && centerDotPath && (
              <path
                d={centerDotPath}
                fill={colors.primary}
                style={{
                  filter: (selected || showHoverGlow) ? `drop-shadow(0 0 ${8 / zoomLevel}px ${colors.glow})` : 'none'
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
            
            {multiSelected && !selected && (
              <>
                <circle
                  r={styleConfig.baseRadius + 14}
                  fill="none"
                  stroke="url(#multiSelectGradient)"
                  strokeWidth={3}
                  opacity={0.9}
                  className="animate-pulse"
                />
                <circle
                  r={styleConfig.baseRadius + 10}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
              </>
            )}
          </>
        ) : (
          <>
            <rect
              x={-styleConfig.baseRadius}
              y={-styleConfig.baseRadius}
              width={styleConfig.baseRadius * 2}
              height={styleConfig.baseRadius * 2}
              rx={4}
              fill={isDark ? 'rgba(156, 163, 175, 0.3)' : 'rgba(107, 114, 128, 0.3)'}
              stroke={isDark ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)'}
              strokeWidth={1.5}
            />
            {selected && (
              <rect
                x={-styleConfig.baseRadius - 4}
                y={-styleConfig.baseRadius - 4}
                width={styleConfig.baseRadius * 2 + 8}
                height={styleConfig.baseRadius * 2 + 8}
                rx={6}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                opacity={0.5}
                strokeDasharray="4 4"
              />
            )}
          </>
        )}
      </g>
      
      <circle
        r={maxRadius}
        fill="transparent"
        onClick={handleCircleClick}
        onMouseDown={handleCircleMouseDown}
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
          opacity={textVisibility.opacity * (isAccepted ? 1 : 0.6)}
          style={{
            pointerEvents: 'none',
            transition: `opacity ${transitionDuration}ms ease`,
            textShadow: isDark 
              ? `0 ${2 / zoomLevel}px ${4 / zoomLevel}px rgba(0,0,0,0.8), 0 0 ${8 / zoomLevel}px rgba(0,0,0,0.4)` 
              : `0 ${2 / zoomLevel}px ${4 / zoomLevel}px rgba(0,0,0,0.15), 0 0 ${8 / zoomLevel}px rgba(0,0,0,0.1)`
          }}
        >
          {node.title || '未命名'}
        </text>
      )}
      
      {textVisibility.visible && tags && tags.length > 0 && (
        <text
          x={0}
          y={tagOffset}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scaledFontSize * 0.8}
          fontWeight={400}
          fill={isDark ? '#cbd5e1' : '#475569'}
          opacity={textVisibility.opacity * 0.8}
          style={{
            pointerEvents: 'none',
            transition: `opacity ${transitionDuration}ms ease`,
            textShadow: isDark 
              ? `0 ${1 / zoomLevel}px ${2 / zoomLevel}px rgba(0,0,0,0.8)` 
              : 'none'
          }}
        >
          {tags.slice(0, 3).join(', ') + (tags.length > 3 ? '...' : '')}
        </text>
      )}
    </g>
  );
};

export const MindMapNode = React.memo(MindMapNodeComponent, (prevProps, nextProps) => {
  const nodeStatusEqual = 
    (!prevProps.nodeStatus && !nextProps.nodeStatus) ||
    (prevProps.nodeStatus && nextProps.nodeStatus && 
     prevProps.nodeStatus[prevProps.node.id] === nextProps.nodeStatus[nextProps.node.id]);
  
  return Boolean(
    prevProps.node.id === nextProps.node.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.multiSelected === nextProps.multiSelected &&
    prevProps.focused === nextProps.focused &&
    prevProps.hasFocusMode === nextProps.hasFocusMode &&
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.forceShowText === nextProps.forceShowText &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.isNew === nextProps.isNew &&
    prevProps.isSelectableAsParent === nextProps.isSelectableAsParent &&
    prevProps.isExcludedAsParent === nextProps.isExcludedAsParent &&
    prevProps.isSelectedAsParent === nextProps.isSelectedAsParent &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.node.level === nextProps.node.level &&
    prevProps.node.is_accepted === nextProps.node.is_accepted &&
    prevProps.colorScheme === nextProps.colorScheme &&
    prevProps.coloringMode === nextProps.coloringMode &&
    prevProps.nodeSizeMode === nextProps.nodeSizeMode &&
    prevProps.nodeImportance === nextProps.nodeImportance &&
    nodeStatusEqual
  );
});