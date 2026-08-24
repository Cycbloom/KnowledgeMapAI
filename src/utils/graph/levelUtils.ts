import i18next from 'i18next';
import type { Node, Edge, NodeLevel } from '../../types';

export {
  LEVEL_ORDER,
  LEVEL_WEIGHTS,
  getNextLevel,
  getPreviousLevel,
  getLevelIndex,
} from '@shared/utils/levelUtils';

export const buildLevelMap = (nodes: Node[], edges: Edge[]): Map<string, NodeLevel> => {
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    const id = String(node.id).trim();
    outDegree.set(id, 0);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    const sourceId = String(edge.source_knowledge_point_id).trim();
    const targetId = String(edge.target_knowledge_point_id).trim();
    outDegree.set(sourceId, (outDegree.get(sourceId) ?? 0) + 1);
    inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
  }

  const levelMap = new Map<string, NodeLevel>();
  for (const node of nodes) {
    const id = String(node.id).trim();
    if (node.level) {
      levelMap.set(id, node.level);
      continue;
    }
    const out = outDegree.get(id) ?? 0;
    const inCount = inDegree.get(id) ?? 0;
    if (inCount === 0 && out > 0) {
      levelMap.set(id, 'root');
    } else if (out === 0 && inCount > 0) {
      levelMap.set(id, 'leaf');
    } else if (out > 0 && inCount > 0) {
      levelMap.set(id, 'core');
    } else {
      levelMap.set(id, 'normal');
    }
  }

  return levelMap;
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
  return i18next.t(`graphLevel.${level}`, { defaultValue: i18next.t('graphLevel.normal') });
};
