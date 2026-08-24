import type { NodeLevel } from "@shared/types/graph-core";

export type { NodeLevel };

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
