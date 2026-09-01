import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_TITLES,
  type NodeLevel,
  type LayoutSuggestion,
  type BackboneModuleCustomConfig,
} from "@shared/types/graph";
import { logger } from "../../utils/logger";

export interface BackboneNode {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  level: NodeLevel;
  module: string;
  parentId?: string;
  suggestedContent?: string;
  color?: string;
  properties?: {
    backboneModule?: string;
    [key: string]: unknown;
  };
}

export interface BackboneEdge {
  source: string;
  target: string;
  relationship_type?: string;
  description?: string;
}

export interface BackboneModuleConfig {
  module: string;
  label: string;
  description: string;
  color: string;
  suggestedNodes: string[];
  relationshipToCore: string;
}

export interface BackboneNetwork {
  id: string;
  topic: string;
  description: string;
  nodes: BackboneNode[];
  edges: BackboneEdge[];
  modules: BackboneModuleConfig[];
  layoutSuggestion: LayoutSuggestion;
  estimatedNodes: number;
  reasoning: string;
}

export const BACKBONE_MODULE_CONFIGS: Record<
  BackboneModule,
  Omit<BackboneModuleConfig, "module">
> = {
  research_background: {
    label: BACKBONE_MODULE_LABELS.research_background,
    description: "研究主题的背景信息、发展历程和现状",
    color: BACKBONE_MODULE_COLORS.research_background,
    suggestedNodes: ["研究背景", "发展历程", "研究现状", "问题陈述"],
    relationshipToCore: "提供研究的基础和动机",
  },
  literature_review: {
    label: BACKBONE_MODULE_LABELS.literature_review,
    description: "相关文献的综述和分析",
    color: BACKBONE_MODULE_COLORS.literature_review,
    suggestedNodes: ["理论基础", "相关工作", "研究空白", "文献分析"],
    relationshipToCore: "建立理论基础和研究脉络",
  },
  research_methods: {
    label: BACKBONE_MODULE_LABELS.research_methods,
    description: "研究采用的方法论和技术手段",
    color: BACKBONE_MODULE_COLORS.research_methods,
    suggestedNodes: ["研究方法", "技术路线", "实验设计", "数据分析"],
    relationshipToCore: "提供研究的实施路径",
  },
  core_concepts: {
    label: BACKBONE_MODULE_LABELS.core_concepts,
    description: "研究的核心概念、定义和理论框架",
    color: BACKBONE_MODULE_COLORS.core_concepts,
    suggestedNodes: ["核心概念", "关键定义", "理论框架", "主要发现"],
    relationshipToCore: "研究的核心内容和贡献",
  },
  application_domains: {
    label: BACKBONE_MODULE_LABELS.application_domains,
    description: "研究成果的应用领域和实际场景",
    color: BACKBONE_MODULE_COLORS.application_domains,
    suggestedNodes: ["应用场景", "实践案例", "行业应用", "工具实现"],
    relationshipToCore: "展示研究的实际价值",
  },
  future_directions: {
    label: BACKBONE_MODULE_LABELS.future_directions,
    description: "未来研究方向和发展趋势",
    color: BACKBONE_MODULE_COLORS.future_directions,
    suggestedNodes: ["研究展望", "发展趋势", "开放问题", "潜在方向"],
    relationshipToCore: "指明后续研究方向",
  },
};

const BACKBONE_VALIDATION_RULES = {
  validLevels: ["root", "core"] as NodeLevel[],
  validModules: [
    BackboneModule.RESEARCH_BACKGROUND,
    BackboneModule.LITERATURE_REVIEW,
    BackboneModule.RESEARCH_METHODS,
    BackboneModule.CORE_CONCEPTS,
    BackboneModule.APPLICATION_DOMAINS,
    BackboneModule.FUTURE_DIRECTIONS,
  ] as BackboneModule[],
  validLayouts: [
    "radial",
    "tree",
    "network",
    "hierarchical",
  ] as LayoutSuggestion[],
  minNodesPerModule: 2,
  maxNodesPerModule: 10,
};

function validateBackboneNode(
  node: unknown,
  index: number,
  validModuleSet: Set<string>,
): BackboneNode | null {
  if (typeof node !== "object" || node === null) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: not an object`,
    );
    return null;
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== "string" || !n.id.trim()) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: missing id`,
    );
    return null;
  }

  if (typeof n.title !== "string" || !n.title.trim()) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: missing title`,
    );
    return null;
  }

  const level = n.level as NodeLevel;
  if (!BACKBONE_VALIDATION_RULES.validLevels.includes(level)) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: invalid level "${level}", only root and core are allowed`,
    );
    return null;
  }

  const module = n.module as string;
  if (!validModuleSet.has(module)) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: invalid module "${module}"`,
    );
    return null;
  }

  let description = n.description as string | undefined;
  if (!description || !description.trim()) {
    const moduleConfig = BACKBONE_MODULE_CONFIGS[module as BackboneModule];
    if (level === "root") {
      description = `${n.title}：${moduleConfig?.description || `关于${n.title}的核心内容`}`;
    } else {
      description = `${n.title}：${moduleConfig?.label || module}中的核心概念`;
    }
    logger.info(
      `[Backbone Network] Generated default description for node "${n.title}": ${description}`,
    );
  }

  return {
    id: n.id as string,
    title: n.title as string,
    description,
    summary: n.summary as string | undefined,
    level,
    module,
    parentId: n.parentId as string | undefined,
    suggestedContent: n.suggestedContent as string | undefined,
    color: n.color as string | undefined,
  };
}

function validateBackboneEdge(
  edge: unknown,
  validNodeIds: Set<string>,
  index: number,
): BackboneEdge | null {
  if (typeof edge !== "object" || edge === null) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: not an object`,
    );
    return null;
  }

  const e = edge as Record<string, unknown>;

  if (typeof e.source !== "string" || !validNodeIds.has(e.source)) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: invalid source "${e.source}"`,
    );
    return null;
  }

  if (typeof e.target !== "string" || !validNodeIds.has(e.target)) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: invalid target "${e.target}"`,
    );
    return null;
  }

  return {
    source: e.source as string,
    target: e.target as string,
    relationship_type: e.relationship_type as string | undefined,
    description: e.description as string | undefined,
  };
}

export function validateBackbone(
  backbone: unknown,
  topic: string,
  includeModules: BackboneModule[],
  customModules?: BackboneModuleCustomConfig[],
): BackboneNetwork | null {
  if (typeof backbone !== "object" || backbone === null) {
    logger.warn("[Backbone Network] Invalid backbone: not an object");
    return null;
  }

  const b = backbone as Record<string, unknown>;

  const validModuleSet = new Set<string>(
    customModules && customModules.length > 0
      ? customModules.map((m) => m.module_type)
      : includeModules,
  );

  if (!Array.isArray(b.nodes) || b.nodes.length === 0) {
    logger.warn("[Backbone Network] Invalid backbone: no nodes");
    return null;
  }

  const validNodes: BackboneNode[] = [];
  for (let i = 0; i < b.nodes.length; i++) {
    const validatedNode = validateBackboneNode(b.nodes[i], i, validModuleSet);
    if (validatedNode) {
      validNodes.push(validatedNode);
    }
  }

  if (validNodes.length === 0) {
    logger.warn("[Backbone Network] No valid nodes after validation");
    return null;
  }

  const validNodeIds = new Set(validNodes.map((n) => n.id));

  const validEdges: BackboneEdge[] = [];
  if (Array.isArray(b.edges)) {
    for (let i = 0; i < b.edges.length; i++) {
      const validatedEdge = validateBackboneEdge(b.edges[i], validNodeIds, i);
      if (validatedEdge) {
        validEdges.push(validatedEdge);
      }
    }
  }

  const layoutSuggestion = b.layoutSuggestion as LayoutSuggestion;
  const validLayout = BACKBONE_VALIDATION_RULES.validLayouts.includes(
    layoutSuggestion,
  )
    ? layoutSuggestion
    : "radial";

  const modules: BackboneModuleConfig[] =
    customModules && customModules.length > 0
      ? customModules.map((cm) => ({
          module: cm.module_type,
          label: cm.title,
          description: cm.description,
          color: cm.color,
          suggestedNodes: cm.suggestedNodes,
          relationshipToCore: cm.relationshipToCore,
        }))
      : includeModules.map((module) => ({
          module,
          ...BACKBONE_MODULE_CONFIGS[module],
        }));

  return {
    id: (b.id as string) || `backbone-${Date.now()}`,
    topic: (b.topic as string) || topic,
    description: (b.description as string) || "",
    nodes: validNodes,
    edges: validEdges,
    modules,
    layoutSuggestion: validLayout,
    estimatedNodes: Math.max(
      validNodes.length,
      (b.estimatedNodes as number) || validNodes.length,
    ),
    reasoning: (b.reasoning as string) || "",
  };
}

export function validateAndCorrectBackboneNodeTitle(
  node: BackboneNode,
  customModuleTitles?: Map<string, string>,
): {
  correctedNode: BackboneNode;
  wasCorrected: boolean;
  originalTitle?: string;
} {
  if (node.level !== "core") {
    return { correctedNode: node, wasCorrected: false };
  }

  if (customModuleTitles) {
    const expectedTitle = customModuleTitles.get(node.module);
    if (expectedTitle && node.title !== expectedTitle) {
      const originalTitle = node.title;
      logger.info(
        `[Backbone Network] Correcting core node title: "${originalTitle}" -> "${expectedTitle}" for module ${node.module}`,
      );
      return {
        correctedNode: {
          ...node,
          title: expectedTitle,
        },
        wasCorrected: true,
        originalTitle,
      };
    }
    return { correctedNode: node, wasCorrected: false };
  }

  const expectedTitle = BACKBONE_MODULE_TITLES[node.module as BackboneModule];

  if (node.title !== expectedTitle) {
    const originalTitle = node.title;
    logger.info(
      `[Backbone Network] Correcting core node title: "${originalTitle}" -> "${expectedTitle}" for module ${node.module}`,
    );

    return {
      correctedNode: {
        ...node,
        title: expectedTitle,
      },
      wasCorrected: true,
      originalTitle,
    };
  }

  return { correctedNode: node, wasCorrected: false };
}

export function getMockBackbone(
  topic: string,
  includeModules: BackboneModule[],
  customModules?: BackboneModuleCustomConfig[],
): {
  backbone: BackboneNetwork;
  metadata: {
    topic: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
} {
  const nodes: BackboneNode[] = [];
  const edges: BackboneEdge[] = [];

  const mainRootId = "root-main";
  const defaultModule =
    customModules?.[0]?.module_type ||
    includeModules[0] ||
    BackboneModule.CORE_CONCEPTS;
  const defaultColor =
    customModules?.[0]?.color ||
    BACKBONE_MODULE_COLORS[defaultModule as BackboneModule] ||
    "#10B981";

  nodes.push({
    id: mainRootId,
    title: topic,
    description: `${topic}研究的核心主题`,
    level: "root",
    module: defaultModule,
    suggestedContent: `关于${topic}的核心概念和定义`,
    color: defaultColor,
  });

  const useCustomModules = customModules && customModules.length > 0;

  const moduleItems = useCustomModules && customModules ? customModules : includeModules;

  for (const item of moduleItems) {
    const moduleType = useCustomModules
      ? (item as BackboneModuleCustomConfig).module_type
      : (item as BackboneModule);
    const title = useCustomModules
      ? (item as BackboneModuleCustomConfig).title
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].label;
    const description = useCustomModules
      ? (item as BackboneModuleCustomConfig).description
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].description;
    const color = useCustomModules
      ? (item as BackboneModuleCustomConfig).color
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].color;
    const suggestedNodes = useCustomModules
      ? (item as BackboneModuleCustomConfig).suggestedNodes
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].suggestedNodes;

    const coreNodeId = `core-${moduleType}`;

    nodes.push({
      id: coreNodeId,
      title,
      description,
      level: "core",
      module: moduleType,
      suggestedContent: description,
      color,
      properties: {
        backboneModule: moduleType,
      },
    });

    edges.push({
      source: mainRootId,
      target: coreNodeId,
      relationship_type: "contains",
      description: `${topic}包含${title}模块`,
    });

    const suggested = suggestedNodes.slice(0, 3);
    suggested.forEach((suggestedTitle, idx) => {
      const subNodeId = `sub-${moduleType}-${idx}`;
      nodes.push({
        id: subNodeId,
        title: suggestedTitle,
        description: `${title}中的核心概念`,
        level: "sub",
        module: moduleType,
        parentId: coreNodeId,
        suggestedContent: `关于${suggestedTitle}的详细内容`,
        color,
      });

      edges.push({
        source: coreNodeId,
        target: subNodeId,
        relationship_type: "contains",
        description: `${title}包含${suggestedTitle}`,
      });
    });
  }

  const backboneModules: BackboneModuleConfig[] = (useCustomModules && customModules)
    ? customModules.map((cm) => ({
        module: cm.module_type,
        label: cm.title,
        description: cm.description,
        color: cm.color,
        suggestedNodes: cm.suggestedNodes,
        relationshipToCore: cm.relationshipToCore,
      }))
    : includeModules.map((module) => ({
        module,
        ...BACKBONE_MODULE_CONFIGS[module],
      }));

  return {
    backbone: {
      id: `backbone-mock-${Date.now()}`,
      topic,
      description: `${topic}的骨干网络结构（模拟数据）`,
      nodes,
      edges,
      modules: backboneModules,
      layoutSuggestion: "radial",
      estimatedNodes: nodes.length * 3,
      reasoning: "模拟骨干网络结构，用于无 API Key 时的展示",
    },
    metadata: {
      topic,
      generatedAt: new Date().toISOString(),
      provider: "mock",
      model: "mock",
    },
  };
}

/** 去重 core 级骨干节点：每个模块仅保留首个 core 节点 */
export function deduplicateBackboneNodes(nodes: BackboneNode[]): BackboneNode[] {
  const moduleMap = new Map<string, BackboneNode>();
  const rootNodes: BackboneNode[] = [];
  const otherNodes: BackboneNode[] = [];

  for (const node of nodes) {
    if (node.level === "root" && !node.properties?.backboneModule) {
      rootNodes.push(node);
      continue;
    }

    if (
      node.level === "core" &&
      node.properties?.backboneModule &&
      node.title
    ) {
      const existing = moduleMap.get(node.properties.backboneModule);
      if (!existing) {
        moduleMap.set(node.properties.backboneModule, node);
      } else {
        logger.info(
          `[Backbone Network] Duplicating backbone node for module ${node.properties.backboneModule}, keeping first one`,
        );
      }
    } else {
      otherNodes.push(node);
    }
  }

  return [...rootNodes, ...Array.from(moduleMap.values()), ...otherNodes];
}
