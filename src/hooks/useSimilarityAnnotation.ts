import { useState, useMemo, useCallback } from 'react';
import { generateGroupColors } from '../utils/similarityColors';

export interface SimilarConceptGroup {
  id: string;
  members: Array<{
    knowledgePointId: string;
    title: string;
    similarity?: number;
  }>;
  suggestedTargetId: string;
  autoMergeConfidence: number;
}

export interface AnnotationLine {
  sourceId: string;
  targetId: string;
  color: string;
  dashed: boolean;
}

export interface UseSimilarityAnnotationOptions {
  graphId: string;
  enabled: boolean;
  similarGroups: SimilarConceptGroup[];
}

export interface UseSimilarityAnnotationReturn {
  isAnnotationMode: boolean;
  setAnnotationMode: (enabled: boolean) => void;
  highlightedNodes: Set<string>;
  highlightedGroups: Map<string, string[]>;
  annotationLines: AnnotationLine[];
  activeGroupId: string | null;
  setActiveGroup: (groupId: string | null) => void;
  getNodeColor: (nodeId: string) => string | undefined;
}

export function useSimilarityAnnotation(
  options: UseSimilarityAnnotationOptions
): UseSimilarityAnnotationReturn {
  const { enabled, similarGroups } = options;
  const [isAnnotationMode, setAnnotationMode] = useState(enabled);
  const [activeGroupId, setActiveGroup] = useState<string | null>(null);

  const groupColors = useMemo(() => {
    if (!isAnnotationMode || similarGroups.length === 0) {
      return [];
    }
    return generateGroupColors(similarGroups.length);
  }, [isAnnotationMode, similarGroups.length]);

  const groupIdToColor = useMemo(() => {
    const map = new Map<string, string>();
    similarGroups.forEach((group, index) => {
      if (groupColors[index]) {
        map.set(group.id, groupColors[index]);
      }
    });
    return map;
  }, [similarGroups, groupColors]);

  const highlightedNodes = useMemo<Set<string>>(() => {
    if (!isAnnotationMode) {
      return new Set();
    }

    const nodes = new Set<string>();

    if (activeGroupId) {
      const activeGroup = similarGroups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        activeGroup.members.forEach(member => {
          nodes.add(member.knowledgePointId);
        });
      }
    } else {
      similarGroups.forEach(group => {
        group.members.forEach(member => {
          nodes.add(member.knowledgePointId);
        });
      });
    }

    return nodes;
  }, [isAnnotationMode, similarGroups, activeGroupId]);

  const highlightedGroups = useMemo<Map<string, string[]>>(() => {
    if (!isAnnotationMode) {
      return new Map();
    }

    const groups = new Map<string, string[]>();

    if (activeGroupId) {
      const activeGroup = similarGroups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        groups.set(
          activeGroupId,
          activeGroup.members.map(m => m.knowledgePointId)
        );
      }
    } else {
      similarGroups.forEach(group => {
        groups.set(
          group.id,
          group.members.map(m => m.knowledgePointId)
        );
      });
    }

    return groups;
  }, [isAnnotationMode, similarGroups, activeGroupId]);

  const annotationLines = useMemo<AnnotationLine[]>(() => {
    if (!isAnnotationMode) {
      return [];
    }

    const lines: AnnotationLine[] = [];
    const groupsToProcess = activeGroupId
      ? similarGroups.filter(g => g.id === activeGroupId)
      : similarGroups;

    groupsToProcess.forEach(group => {
      const color = groupIdToColor.get(group.id);
      if (!color || group.members.length < 2) return;

      const targetId = group.suggestedTargetId;
      const otherMembers = group.members.filter(
        m => m.knowledgePointId !== targetId
      );

      otherMembers.forEach(member => {
        lines.push({
          sourceId: targetId,
          targetId: member.knowledgePointId,
          color,
          dashed: true,
        });
      });

      for (let i = 0; i < otherMembers.length; i++) {
        for (let j = i + 1; j < otherMembers.length; j++) {
          lines.push({
            sourceId: otherMembers[i].knowledgePointId,
            targetId: otherMembers[j].knowledgePointId,
            color,
            dashed: true,
          });
        }
      }
    });

    return lines;
  }, [isAnnotationMode, similarGroups, activeGroupId, groupIdToColor]);

  const nodeIdToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    similarGroups.forEach(group => {
      group.members.forEach(member => {
        map.set(member.knowledgePointId, group.id);
      });
    });
    return map;
  }, [similarGroups]);

  const getNodeColor = useCallback(
    (nodeId: string): string | undefined => {
      if (!isAnnotationMode || !highlightedNodes.has(nodeId)) {
        return undefined;
      }

      if (activeGroupId && nodeIdToGroupId.get(nodeId) !== activeGroupId) {
        return undefined;
      }

      const groupId = nodeIdToGroupId.get(nodeId);
      if (!groupId) return undefined;

      return groupIdToColor.get(groupId);
    },
    [isAnnotationMode, highlightedNodes, activeGroupId, nodeIdToGroupId, groupIdToColor]
  );

  return {
    isAnnotationMode,
    setAnnotationMode,
    highlightedNodes,
    highlightedGroups,
    annotationLines,
    activeGroupId,
    setActiveGroup,
    getNodeColor,
  };
}
