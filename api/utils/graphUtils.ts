import { Node, Edge } from '../types/index.js';

export type NodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

export const getNextLevel = (parentLevel: string): NodeLevel => {
  if (parentLevel === 'root') return 'core';
  if (parentLevel === 'core') return 'sub';
  if (parentLevel === 'sub') return 'normal';
  if (parentLevel === 'normal') return 'leaf';
  return 'leaf'; // Leaves produce leaves
};
