import { Node } from '../types/index';

export const LEVEL_CONFIG = {
  root: { 
    chargeStrength: -60, 
    radius: 1.6, 
    color: '#FDB813', // Sun/Gold
    emissive: '#F59E0B', 
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.5,
    visibleDistance: Infinity
  },
  core: { 
    chargeStrength: -40, 
    radius: 1.2, 
    color: '#60A5FA', // Blue Giant
    emissive: '#3B82F6', 
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.3,
    visibleDistance: 500
  },
  sub: { 
    chargeStrength: -30, 
    radius: 0.9, 
    color: '#F87171', // Red/Orange Star
    emissive: '#EF4444', 
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.2,
    visibleDistance: 250
  },
  normal: { 
    chargeStrength: -20, 
    radius: 0.6, 
    color: '#A78BFA', // Purple/White Star
    emissive: '#8B5CF6', 
    emissiveIntensity: 1.2,
    roughness: 0.4,
    metalness: 0.1,
    visibleDistance: 120
  },
  leaf: { 
    chargeStrength: -10, 
    radius: 0.3, 
    color: '#E2E8F0', // White/Distant Star
    emissive: '#94A3B8', 
    emissiveIntensity: 0.8,
    roughness: 0.5,
    metalness: 0.1,
    visibleDistance: 60
  }
} as const;

export const THEME_CONFIG = {
  dark: {
    background: 'bg-black', // Deep space
    grid: {
      color1: undefined,
      color2: undefined,
      opacity: 0.0
    },
    lighting: {
      ambientIntensity: 0.2,
      pointIntensity: 2,
    },
    text: {
      color: '#f8fafc',
      outline: '#000000',
      opacity: 0.9
    },
    link: {
      color: '#38bdf8', // Light cyan connections
      opacity: 0.15,    // Very subtle
      highlightOpacity: 0.05
    }
  },
  light: {
    background: 'bg-slate-50',
    grid: {
      color1: 0x94a3b8,
      color2: 0xe2e8f0,
      opacity: 0.2
    },
    lighting: {
      ambientIntensity: 0.7,
      pointIntensity: 1,
    },
    text: {
      color: '#1e293b',
      outline: '#ffffff',
      opacity: 1
    },
    link: {
      color: '#64748b',
      opacity: 0.6,
      highlightOpacity: 0.05
    }
  }
} as const;

export type NodeLevel = keyof typeof LEVEL_CONFIG;

export interface SimNode extends Node {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  level?: NodeLevel;
  [key: string]: any;
}

export interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  id: string;
}
