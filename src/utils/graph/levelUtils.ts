import type { NodeLevel } from '../../types';

export const LEVEL_ORDER: NodeLevel[] = ['root', 'core', 'sub', 'normal', 'leaf'];

export function getNextLevel(currentLevel: string): NodeLevel {
  const index = LEVEL_ORDER.indexOf(currentLevel as NodeLevel);
  if (index === -1 || index >= LEVEL_ORDER.length - 1) {
    return 'leaf';
  }
  return LEVEL_ORDER[index + 1];
}

export function getPreviousLevel(currentLevel: string): NodeLevel {
  const index = LEVEL_ORDER.indexOf(currentLevel as NodeLevel);
  if (index <= 0) {
    return 'root';
  }
  return LEVEL_ORDER[index - 1];
}

export function getLevelIndex(level: string): number {
  return LEVEL_ORDER.indexOf(level as NodeLevel);
}

export const LEVEL_WEIGHTS: Record<NodeLevel, number> = {
  root: 1.0,
  core: 0.8,
  sub: 0.6,
  normal: 0.4,
  leaf: 0.2
};

export const getLevelColor = (level: NodeLevel): string => {
  const colors: Record<NodeLevel, string> = {
    root: 'bg-primary-500',
    core: 'bg-primary-500',
    sub: 'bg-secondary-500',
    normal: 'bg-tertiary-500',
    leaf: 'bg-tertiary-500'
  };
  return colors[level] || colors.normal;
};

export const getLevelColorHex = (level: NodeLevel): string => {
  const colors: Record<NodeLevel, string> = {
    root: '#8B5CF6',
    core: '#EF4444',
    sub: '#F59E0B',
    normal: '#3B82F6',
    leaf: '#10B981'
  };
  return colors[level] || colors.normal;
};

export const getLevelLabel = (level: NodeLevel): string => {
  const labels: Record<NodeLevel, string> = {
    root: '根节点',
    core: '核心节点',
    sub: '次级节点',
    normal: '普通节点',
    leaf: '叶子节点'
  };
  return labels[level] || labels.normal;
};