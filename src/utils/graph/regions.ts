import type { Node, Edge } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_LABEL_I18N_KEYS,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_ICONS,
  type CustomRegion,
  type RegionInfo,
  type GraphBackboneModule,
} from "@shared/types/graph";
import i18n from "../../i18n";

export interface ComputeRegionsParams {
  nodes: Node[];
  edges: Edge[];
  templateType?: string;
  backboneModules?: GraphBackboneModule[];
  customRegions: CustomRegion[];
  collapsedRegions: string[];
}

export function computeRegions(params: ComputeRegionsParams): RegionInfo[] {
  const {
    nodes,
    templateType,
    backboneModules,
    customRegions,
    collapsedRegions,
  } = params;

  if (nodes.length === 0) return [];

  const isTopicResearch = templateType === "topic_research";

  if (isTopicResearch) {
    if (backboneModules && backboneModules.length > 0) {
      const angleStep = (2 * Math.PI) / backboneModules.length;

      const moduleGroups = new Map<string, Node[]>();
      nodes.forEach((n) => {
        const module = n.properties?.backboneModule;
        if (module) {
          const group = moduleGroups.get(module);
          if (group) {
            group.push(n);
          } else {
            moduleGroups.set(module, [n]);
          }
        }
      });

      return backboneModules
        .sort(
          (a: GraphBackboneModule, b: GraphBackboneModule) =>
            a.display_order - b.display_order,
        )
        .map((module: GraphBackboneModule, index: number) => {
          const angleStart = index * angleStep;
          const angleEnd = (index + 1) * angleStep;

          const regionNodes = moduleGroups.get(module.module_type) || [];

          return {
            id: `region-${module.module_type}`,
            name: module.title,
            color:
              module.color ||
              BACKBONE_MODULE_COLORS[module.module_type as BackboneModule],
            icon:
              module.icon ||
              BACKBONE_MODULE_ICONS[module.module_type as BackboneModule],
            angleStart,
            angleEnd,
            nodes: regionNodes,
            isCollapsed: collapsedRegions.includes(
              `region-${module.module_type}`,
            ),
          };
        });
    }

    const orderedBackboneModules = [
      BackboneModule.RESEARCH_BACKGROUND,
      BackboneModule.LITERATURE_REVIEW,
      BackboneModule.RESEARCH_METHODS,
      BackboneModule.CORE_CONCEPTS,
      BackboneModule.APPLICATION_DOMAINS,
      BackboneModule.FUTURE_DIRECTIONS,
    ];

    const angleStep = (2 * Math.PI) / 6;

    const moduleGroups = new Map<string, Node[]>();
    nodes.forEach((n) => {
      const module = n.properties?.backboneModule;
      if (module) {
        const group = moduleGroups.get(module);
        if (group) {
          group.push(n);
        } else {
          moduleGroups.set(module, [n]);
        }
      }
    });

    return orderedBackboneModules.map((module, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes = moduleGroups.get(module) || [];

      return {
        id: `region-${module}`,
        name: i18n.t(BACKBONE_MODULE_LABEL_I18N_KEYS[module]),
        color: BACKBONE_MODULE_COLORS[module],
        icon: BACKBONE_MODULE_ICONS[module],
        angleStart,
        angleEnd,
        nodes: regionNodes,
        isCollapsed: collapsedRegions.includes(`region-${module}`),
      };
    });
  } else {
    if (customRegions.length === 0) {
      const levelGroups = new Map<string, Node[]>();

      nodes.forEach((node) => {
        const level = node.level || "leaf";
        if (!levelGroups.has(level)) {
          levelGroups.set(level, []);
        }
        levelGroups.get(level)?.push(node);
      });

      const levels = Array.from(levelGroups.keys());
      const angleStep = (2 * Math.PI) / levels.length;

      return levels.map((level, index) => {
        const angleStart = index * angleStep;
        const angleEnd = (index + 1) * angleStep;

        return {
          id: `region-${level}`,
          name:
            level === "root"
              ? i18n.t("graphMap.levelLabels.root")
              : level === "core"
                ? i18n.t("graphMap.levelLabels.core")
                : i18n.t("graphMap.levelLabels.leaf"),
          color: `hsl(${(index * 360) / levels.length}, 70%, 50%)`,
          angleStart,
          angleEnd,
          nodes: levelGroups.get(level) || [],
          isCollapsed: collapsedRegions.includes(`region-${level}`),
        };
      });
    }

    const angleStep = (2 * Math.PI) / customRegions.length;

    const regionNodeSets = customRegions.map(
      (region) => new Set(region.nodeIds),
    );

    return customRegions.map((region, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes = nodes.filter((n) =>
        regionNodeSets[index].has(n.id),
      );

      return {
        id: region.id,
        name: region.name,
        color: region.color,
        angleStart,
        angleEnd,
        nodes: regionNodes,
        isCollapsed: collapsedRegions.includes(region.id),
      };
    });
  }
}