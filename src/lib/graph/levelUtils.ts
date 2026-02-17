import type { NodeLevel } from '../../types';

export const getLevelColor = (level: NodeLevel): string => {
  const colors = {
    root: 'bg-purple-500',
    core: 'bg-red-500',
    sub: 'bg-orange-500',
    normal: 'bg-blue-500',
    leaf: 'bg-green-500'
  };
  return colors[level] || colors.normal;
};

export const getLevelColorHex = (level: NodeLevel): string => {
  const colors = {
    root: '#8B5CF6',
    core: '#EF4444',
    sub: '#F59E0B',
    normal: '#3B82F6',
    leaf: '#10B981'
  };
  return colors[level] || colors.normal;
};

export const getLevelLabel = (level: NodeLevel): string => {
  const labels = {
    root: '根节点',
    core: '核心节点',
    sub: '次级节点',
    normal: '普通节点',
    leaf: '叶子节点'
  };
  return labels[level] || labels.normal;
};

export const getNextLevel = (parentLevel: string): NodeLevel => {
  if (parentLevel === 'root') return 'core';
  if (parentLevel === 'core') return 'sub';
  if (parentLevel === 'sub') return 'normal';
  if (parentLevel === 'normal') return 'leaf';
  return 'leaf';
};

export const LEVEL_WEIGHTS: Record<NodeLevel, number> = {
  root: 1.0,
  core: 0.8,
  sub: 0.6,
  normal: 0.4,
  leaf: 0.2
};
