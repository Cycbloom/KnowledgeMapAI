import type { Node, Edge } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_TITLES,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_ICONS,
  type CustomRegion,
  type RegionInfo,
  type GraphBackboneModule,
} from "@shared/types/graph";

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

      return backboneModules
        .sort(
          (a: GraphBackboneModule, b: GraphBackboneModule) =>
            a.display_order - b.display_order,
        )
        .map((module: GraphBackboneModule, index: number) => {
          const angleStart = index * angleStep;
          const angleEnd = (index + 1) * angleStep;

          const regionNodes = nodes.filter(
            (n) => n.properties?.backboneModule === module.module_type,
          );

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

    return orderedBackboneModules.map((module, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes = nodes.filter(
        (n) => n.properties?.backboneModule === module,
      );

      return {
        id: `region-${module}`,
        name: BACKBONE_MODULE_TITLES[module],
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
              ? "根节点"
              : level === "core"
                ? "骨干节点"
                : "叶节点",
          color: `hsl(${(index * 360) / levels.length}, 70%, 50%)`,
          angleStart,
          angleEnd,
          nodes: levelGroups.get(level) || [],
          isCollapsed: collapsedRegions.includes(`region-${level}`),
        };
      });
    }

    const angleStep = (2 * Math.PI) / customRegions.length;

    return customRegions.map((region, index) => {
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;

      const regionNodes = nodes.filter((n) => region.nodeIds.includes(n.id));

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
