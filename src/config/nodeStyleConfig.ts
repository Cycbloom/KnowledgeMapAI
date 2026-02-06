import React from 'react';
import { NodeStyle, NodeStyleVariant, NodeLevel, NodeShape, CenterDotShape, ShadowConfig, AnimationConfig, GradientConfig } from '../types';

export interface NodeStyleConfig {
  variant: NodeStyleVariant;
  rings: number;
  baseRadius: number;
  strokeWidth: number;
  showCenterDot: boolean;
  showGlow: boolean;
  dashArray?: string;
  shape: NodeShape;
  centerDotShape: CenterDotShape;
  shadow: ShadowConfig;
  animation: AnimationConfig;
  ringSpacing: number;
  gradient: GradientConfig;
}

export const NODE_STYLE_CONFIG: Record<NodeLevel, NodeStyleConfig> = {
  root: {
    variant: 'triple',
    rings: 3,
    baseRadius: 50,
    strokeWidth: 3,
    showCenterDot: true,
    showGlow: true,
    shape: 'circle',
    centerDotShape: 'circle',
    shadow: {
      enabled: true,
      blur: 8,
      offsetX: 0,
      offsetY: 2,
      color: 'rgba(0,0,0,0.2)'
    },
    animation: {
      hoverScale: 1.15,
      hoverGlow: true,
      transitionDuration: 200,
      enablePulse: false,
      pulseSpeed: 2
    },
    ringSpacing: 8,
    gradient: {
      enabled: false,
      type: 'radial',
      colors: [],
      angle: 0
    }
  },
  core: {
    variant: 'double',
    rings: 2,
    baseRadius: 40,
    strokeWidth: 2.5,
    showCenterDot: true,
    showGlow: true,
    shape: 'circle',
    centerDotShape: 'circle',
    shadow: {
      enabled: true,
      blur: 6,
      offsetX: 0,
      offsetY: 2,
      color: 'rgba(0,0,0,0.15)'
    },
    animation: {
      hoverScale: 1.12,
      hoverGlow: true,
      transitionDuration: 200,
      enablePulse: false,
      pulseSpeed: 2
    },
    ringSpacing: 6,
    gradient: {
      enabled: false,
      type: 'radial',
      colors: [],
      angle: 0
    }
  },
  sub: {
    variant: 'double',
    rings: 2,
    baseRadius: 32,
    strokeWidth: 2,
    showCenterDot: true,
    showGlow: false,
    shape: 'circle',
    centerDotShape: 'circle',
    shadow: {
      enabled: true,
      blur: 4,
      offsetX: 0,
      offsetY: 1,
      color: 'rgba(0,0,0,0.12)'
    },
    animation: {
      hoverScale: 1.1,
      hoverGlow: true,
      transitionDuration: 200,
      enablePulse: false,
      pulseSpeed: 2
    },
    ringSpacing: 5,
    gradient: {
      enabled: false,
      type: 'radial',
      colors: [],
      angle: 0
    }
  },
  normal: {
    variant: 'single',
    rings: 1,
    baseRadius: 26,
    strokeWidth: 2,
    showCenterDot: true,
    showGlow: false,
    shape: 'circle',
    centerDotShape: 'circle',
    shadow: {
      enabled: false,
      blur: 3,
      offsetX: 0,
      offsetY: 1,
      color: 'rgba(0,0,0,0.1)'
    },
    animation: {
      hoverScale: 1.08,
      hoverGlow: false,
      transitionDuration: 150,
      enablePulse: false,
      pulseSpeed: 2
    },
    ringSpacing: 4,
    gradient: {
      enabled: false,
      type: 'radial',
      colors: [],
      angle: 0
    }
  },
  leaf: {
    variant: 'single',
    rings: 1,
    baseRadius: 20,
    strokeWidth: 1.5,
    showCenterDot: true,
    showGlow: false,
    shape: 'circle',
    centerDotShape: 'circle',
    shadow: {
      enabled: false,
      blur: 2,
      offsetX: 0,
      offsetY: 1,
      color: 'rgba(0,0,0,0.08)'
    },
    animation: {
      hoverScale: 1.05,
      hoverGlow: false,
      transitionDuration: 150,
      enablePulse: false,
      pulseSpeed: 2
    },
    ringSpacing: 3,
    gradient: {
      enabled: false,
      type: 'radial',
      colors: [],
      angle: 0
    }
  }
};

export const VARIANT_STYLES: Record<NodeStyleVariant, Partial<NodeStyleConfig>> = {
  single: {
    rings: 1,
    dashArray: undefined
  },
  double: {
    rings: 2,
    dashArray: undefined
  },
  triple: {
    rings: 3,
    dashArray: undefined
  },
  dashed: {
    rings: 1,
    dashArray: '4 4'
  },
  dotted: {
    rings: 1,
    dashArray: '2 4'
  },
  gradient: {
    rings: 2,
    dashArray: undefined,
    gradient: {
      enabled: true,
      type: 'radial',
      colors: ['#ffffff', '#f0f0f0'],
      angle: 0
    }
  },
  filled: {
    rings: 1,
    dashArray: undefined,
    gradient: {
      enabled: true,
      type: 'radial',
      colors: ['#ffffff', '#e0e0e0'],
      angle: 0
    }
  },
  outlined: {
    rings: 1,
    dashArray: undefined,
    strokeWidth: 3
  },
  'gradient-fill': {
    rings: 1,
    dashArray: undefined,
    gradient: {
      enabled: true,
      type: 'linear',
      colors: ['#ffffff', '#f5f5f5'],
      angle: 45
    }
  }
};

export const getRingRadius = (baseRadius: number, ringIndex: number, totalRings: number, ringSpacing: number = 0): number => {
  if (ringSpacing > 0) {
    return baseRadius - (ringIndex * ringSpacing);
  }
  const step = baseRadius / totalRings;
  return baseRadius - (ringIndex * step);
};

export const getRingOpacity = (ringIndex: number, totalRings: number): number => {
  const progress = ringIndex / (totalRings - 1);
  const easeOut = 1 - Math.pow(1 - progress, 2);
  return 0.9 - (easeOut * 0.4);
};

export const getCenterDotRadius = (baseRadius: number): number => {
  return baseRadius * 0.15;
};

export const getShadowStyle = (shadow: ShadowConfig): string => {
  if (!shadow.enabled) return 'none';
  return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;
};

export const getGradientId = (nodeId: string, ringIndex: number): string => {
  return `gradient-${nodeId}-${ringIndex}`;
};

export const getCenterDotPath = (radius: number, shape: CenterDotShape): string | null => {
  switch (shape) {
    case 'circle':
      return null;
    case 'diamond':
      const d = radius * 1.2;
      return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
    case 'star':
      const spikes = 5;
      const outerRadius = radius * 1.3;
      const innerRadius = radius * 0.5;
      let rot = Math.PI / 2 * 3;
      const cx = 0;
      const cy = 0;
      let step = Math.PI / spikes;
      let path = '';
      
      path += `M ${cx} ${cy - outerRadius} `;
      
      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        path += `L ${x} ${y} `;
        rot += step;
        
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        path += `L ${x} ${y} `;
        rot += step;
      }
      
      path += 'Z';
      return path;
    case 'none':
      return null;
    default:
      return null;
  }
};