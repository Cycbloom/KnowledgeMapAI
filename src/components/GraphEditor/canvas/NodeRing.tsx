import React, { useMemo } from 'react';
import { GradientConfig, NodeShape } from '../../../types';
import { getNodeShapePath } from '../../../config/nodeStyleConfig';

interface NodeRingProps {
  radius: number;
  strokeWidth: number;
  color: string;
  /** 节点几何形状，默认圆形 */
  shape?: NodeShape;
  opacity?: number;
  dashArray?: string;
  showGlow?: boolean;
  glowColor?: string;
  /** 渐变光晕的 defs id（唯一，按节点生成）；提供时渲染径向渐变光晕盘 */
  glowId?: string;
  gradient?: GradientConfig;
  gradientId?: string;
  enableRotation?: boolean;
  rotationSpeed?: number;
  shadowBlur?: number;
  shadowColor?: string;
}

export const NodeRing = React.memo(({
  radius,
  strokeWidth,
  color,
  shape = 'circle',
  opacity = 1,
  dashArray,
  showGlow = false,
  glowColor,
  glowId,
  gradient,
  gradientId,
  enableRotation = false,
  rotationSpeed = 2,
  shadowBlur = 0,
  shadowColor = 'rgba(0,0,0,0.1)'
}: NodeRingProps) => {
  const rotationStyle = useMemo(() => {
    if (!enableRotation) return {};
    return {
      animation: `rotate ${rotationSpeed}s linear infinite`,
      transformOrigin: 'center'
    };
  }, [enableRotation, rotationSpeed]);

  const fillStyle = useMemo(() => {
    if (gradient?.enabled && gradientId) {
      return `url(#${gradientId})`;
    }
    return 'none';
  }, [gradient, gradientId]);

  const strokeStyle = useMemo(() => {
    return fillStyle === 'none' ? color : 'none';
  }, [fillStyle, color]);

  const shadowStyle = useMemo(() => {
    if (shadowBlur <= 0) return {};
    return {
      filter: `drop-shadow(0 0 ${shadowBlur}px ${shadowColor})`
    };
  }, [shadowBlur, shadowColor]);

  // 光晕盘半径：在节点边缘外再延伸一圈柔和辉光
  const glowRadius = useMemo(() => {
    return radius + Math.max(8, radius * 0.5) + strokeWidth * 2;
  }, [radius, strokeWidth]);

  const useGradientGlow = showGlow && glowColor && glowId;

  // 非圆形形状渲染外轮廓路径，圆形保持 <circle> 以复用既有优化与旋转动画
  const shapePath = shape !== 'circle' ? getNodeShapePath(shape, radius) : null;

  return (
    <g style={rotationStyle}>
      {showGlow && glowColor && (
        <>
          {useGradientGlow && (
            <>
              <defs>
                <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={glowColor} stopOpacity="0.42" />
                  <stop offset="55%" stopColor={glowColor} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle
                r={glowRadius}
                fill={`url(#${glowId})`}
              />
            </>
          )}
          <circle
            r={radius + strokeWidth}
            fill="none"
            stroke={glowColor}
            strokeWidth={strokeWidth * 2}
            opacity={0.3}
            style={{
              filter: 'blur(2px)'
            }}
          />
        </>
      )}
      {shapePath ? (
        <path
          d={shapePath}
          fill={fillStyle}
          stroke={strokeStyle}
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray={dashArray}
          style={shadowStyle}
        />
      ) : (
        <circle
          r={radius}
          fill={fillStyle}
          stroke={strokeStyle}
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray={dashArray}
          style={shadowStyle}
        />
      )}
    </g>
  );
});
