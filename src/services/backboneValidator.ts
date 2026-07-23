import type { Node } from '../types';
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_ICONS,
  BACKBONE_MODULE_COLORS,
} from '@shared/types/graph';

export const isBackboneNode = (node: Node): boolean => {
  return !!node.properties?.backboneModule;
};

export const getBackboneModule = (node: Node): BackboneModule | undefined => {
  return node.properties?.backboneModule as BackboneModule | undefined;
};

export const getBackboneModuleTitle = (node: Node): string | undefined => {
  const module = getBackboneModule(node);
  return module ? BACKBONE_MODULE_LABELS[module] : undefined;
};

export const getBackboneModuleIcon = (node: Node): string | undefined => {
  const module = getBackboneModule(node);
  return module ? BACKBONE_MODULE_ICONS[module] : undefined;
};

export const getBackboneModuleColor = (node: Node): string | undefined => {
  const module = getBackboneModule(node);
  return module ? BACKBONE_MODULE_COLORS[module] : undefined;
};

export const getBackboneModuleInfo = (
  node: Node,
): {
  isBackbone: boolean;
  module?: BackboneModule;
  title?: string;
  icon?: string;
  color?: string;
} => {
  const module = getBackboneModule(node);
  const isBackbone = !!module;

  return {
    isBackbone,
    module,
    title: module ? BACKBONE_MODULE_LABELS[module] : undefined,
    icon: module ? BACKBONE_MODULE_ICONS[module] : undefined,
    color: module ? BACKBONE_MODULE_COLORS[module] : undefined,
  };
};

export const canEditBackboneNodeTitle = (node: Node): boolean => {
  return !isBackboneNode(node);
};

export const canDeleteBackboneNode = (_node: Node): boolean => {
  return true;
};

export const getBackboneNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(isBackboneNode);
};

export const getNodesByModule = (
  nodes: Node[],
  module: BackboneModule,
): Node[] => {
  return nodes.filter((node) => getBackboneModule(node) === module);
};

export const groupNodesByModule = (
  nodes: Node[],
): Record<BackboneModule, Node[]> => {
  const result: Record<BackboneModule, Node[]> = {
    [BackboneModule.RESEARCH_BACKGROUND]: [],
    [BackboneModule.LITERATURE_REVIEW]: [],
    [BackboneModule.RESEARCH_METHODS]: [],
    [BackboneModule.CORE_CONCEPTS]: [],
    [BackboneModule.APPLICATION_DOMAINS]: [],
    [BackboneModule.FUTURE_DIRECTIONS]: [],
  };

  nodes.forEach((node) => {
    const module = getBackboneModule(node);
    if (module) {
      result[module].push(node);
    }
  });

  return result;
};
