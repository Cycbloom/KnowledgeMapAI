import React, { useMemo } from 'react';
import { GradientConfig } from '../../../types';

interface NodeRingProps {
  radius: number;
  strokeWidth: number;
  color: string;
  opacity?: number;
  dashArray?: string;
  showGlow?: boolean;
  glowColor?: string;
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
  opacity = 1,
  dashArray,
  showGlow = false,
  glowColor,
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

  return (
    <g style={rotationStyle}>
      {showGlow && glowColor && (
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
      )}
      <circle
        r={radius}
        fill={fillStyle}
        stroke={strokeStyle}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeDasharray={dashArray}
        style={shadowStyle}
      />
    </g>
  );
});