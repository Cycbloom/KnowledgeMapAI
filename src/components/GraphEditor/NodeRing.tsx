import React from 'react';

interface NodeRingProps {
  radius: number;
  strokeWidth: number;
  color: string;
  opacity?: number;
  dashArray?: string;
  showGlow?: boolean;
  glowColor?: string;
}

export const NodeRing: React.FC<NodeRingProps> = ({
  radius,
  strokeWidth,
  color,
  opacity = 1,
  dashArray,
  showGlow = false,
  glowColor
}) => {
  return (
    <g>
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
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeDasharray={dashArray}
      />
    </g>
  );
};