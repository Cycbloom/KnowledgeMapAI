import { NodeStyle, NodeStyleVariant, NodeLevel } from '../types';

export interface NodeStyleConfig {
  variant: NodeStyleVariant;
  rings: number;
  baseRadius: number;
  strokeWidth: number;
  showCenterDot: boolean;
  showGlow: boolean;
  dashArray?: string;
}

export const NODE_STYLE_CONFIG: Record<NodeLevel, NodeStyleConfig> = {
  root: {
    variant: 'triple',
    rings: 3,
    baseRadius: 50,
    strokeWidth: 3,
    showCenterDot: true,
    showGlow: true
  },
  core: {
    variant: 'double',
    rings: 2,
    baseRadius: 40,
    strokeWidth: 2.5,
    showCenterDot: true,
    showGlow: true
  },
  sub: {
    variant: 'double',
    rings: 2,
    baseRadius: 32,
    strokeWidth: 2,
    showCenterDot: true,
    showGlow: false
  },
  normal: {
    variant: 'single',
    rings: 1,
    baseRadius: 26,
    strokeWidth: 2,
    showCenterDot: true,
    showGlow: false
  },
  leaf: {
    variant: 'single',
    rings: 1,
    baseRadius: 20,
    strokeWidth: 1.5,
    showCenterDot: true,
    showGlow: false
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
    dashArray: undefined
  }
};

export const getRingRadius = (baseRadius: number, ringIndex: number, totalRings: number): number => {
  const step = baseRadius / totalRings;
  return baseRadius - (ringIndex * step);
};

export const getRingOpacity = (ringIndex: number, totalRings: number): number => {
  return 0.8 - (ringIndex * 0.2);
};

export const getCenterDotRadius = (baseRadius: number): number => {
  return baseRadius * 0.15;
};