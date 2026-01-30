import { Node } from '../types/index';

export const LEVEL_CONFIG = {
  root: { 
    chargeStrength: -60, 
    radius: 1.4, 
    color: '#8B5CF6', 
    emissive: '#5B21B6', 
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.3
  },
  core: { 
    chargeStrength: -40, 
    radius: 1.1, 
    color: '#F43F5E', 
    emissive: '#9F1239', 
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.2
  },
  sub: { 
    chargeStrength: -30, 
    radius: 0.8, 
    color: '#F59E0B', 
    emissive: '#92400E', 
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.1
  },
  normal: { 
    chargeStrength: -20, 
    radius: 0.5, 
    color: '#10B981', 
    emissive: '#065F46', 
    emissiveIntensity: 0.2,
    roughness: 0.4,
    metalness: 0.1
  },
  leaf: { 
    chargeStrength: -10, 
    radius: 0.3, 
    color: '#3B82F6', 
    emissive: '#1E40AF', 
    emissiveIntensity: 0.1,
    roughness: 0.5,
    metalness: 0.0
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
