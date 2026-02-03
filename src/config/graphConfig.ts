import { Node } from '../types/index';

export const LEVEL_CONFIG = {
  root: { 
    chargeStrength: -60, 
    radius: 1.4, 
    color: '#8B5CF6', 
    emissive: '#5B21B6', 
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.3,
    visibleDistance: Infinity
  },
  core: { 
    chargeStrength: -40, 
    radius: 1.1, 
    color: '#F43F5E', 
    emissive: '#9F1239', 
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.2,
    visibleDistance: 240
  },
  sub: { 
    chargeStrength: -30, 
    radius: 0.8, 
    color: '#F59E0B', 
    emissive: '#92400E', 
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.1,
    visibleDistance: 120
  },
  normal: { 
    chargeStrength: -20, 
    radius: 0.5, 
    color: '#10B981', 
    emissive: '#065F46', 
    emissiveIntensity: 0.2,
    roughness: 0.4,
    metalness: 0.1,
    visibleDistance: 60
  },
  leaf: { 
    chargeStrength: -10, 
    radius: 0.3, 
    color: '#3B82F6', 
    emissive: '#1E40AF', 
    emissiveIntensity: 0.1,
    roughness: 0.5,
    metalness: 0.0,
    visibleDistance: 30
  }
} as const;

export const THEME_CONFIG = {
  dark: {
    background: 'bg-slate-900',
    grid: {
      color1: undefined, // Default three.js
      color2: undefined,
      opacity: 0.2
    },
    lighting: {
      ambientIntensity: 0.4,
      pointIntensity: 1,
    },
    text: {
      color: 'white',
      outline: '#000000',
      opacity: 1
    },
    link: {
      color: '#9ca3af',
      opacity: 0.6,
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
