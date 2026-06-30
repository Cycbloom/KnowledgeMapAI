import type {
  TemplateNode,
  TemplateEdge,
  TemplateDifficulty,
  LayoutSuggestion,
  NodeLevel,
} from "@shared/types/graph";
import { logger } from "../../utils/logger";

export interface GeneratedTemplateNode extends TemplateNode {
  suggestedContent?: string;
  backboneModule?: import("@shared/types/graph").BackboneModule;
  needsRefinement?: boolean;
}

export interface GeneratedTemplateEdge extends TemplateEdge {
  description?: string;
}

export interface GeneratedTemplateScheme {
  id: string;
  name: string;
  description: string;
  nodes: GeneratedTemplateNode[];
  edges: GeneratedTemplateEdge[];
  layoutSuggestion: LayoutSuggestion;
  estimatedNodes: number;
  difficulty: TemplateDifficulty;
  tags: string[];
  reasoning: string;
}

const TEMPLATE_VALIDATION_RULES = {
  minNodes: 3,
  maxNodes: 50,
  validLevels: ["root", "core", "sub", "normal", "leaf"] as NodeLevel[],
  validDifficulties: ["easy", "medium", "hard"] as TemplateDifficulty[],
  validLayouts: [
    "radial",
    "tree",
    "network",
    "hierarchical",
  ] as LayoutSuggestion[],
};

export { TEMPLATE_VALIDATION_RULES };

export function validateNode(
  node: unknown,
  index: number,
): GeneratedTemplateNode | null {
  if (typeof node !== "object" || node === null) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: not an object`,
    );
    return null;
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== "string" || !n.id.trim()) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: missing id`,
    );
    return null;
  }

  if (typeof n.title !== "string" || !n.title.trim()) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: missing title`,
    );
    return null;
  }

  const level = n.level as NodeLevel;
  if (!TEMPLATE_VALIDATION_RULES.validLevels.includes(level)) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: invalid level "${level}"`,
    );
    return null;
  }

  return {
    id: n.id as string,
    title: n.title as string,
    description: n.description as string | undefined,
    summary: n.summary as string | undefined,
    level,
    parentId: n.parentId as string | undefined,
    aiPrompt: n.aiPrompt as string | undefined,
    color: n.color as string | undefined,
    suggestedContent: n.suggestedContent as string | undefined,
    backboneModule: n.backboneModule as import("@shared/types/graph").BackboneModule | undefined,
    needsRefinement: n.needsRefinement as boolean | undefined,
  };
}

export function validateEdge(
  edge: unknown,
  validNodeIds: Set<string>,
  index: number,
): GeneratedTemplateEdge | null {
  if (typeof edge !== "object" || edge === null) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: not an object`,
    );
    return null;
  }

  const e = edge as Record<string, unknown>;

  if (typeof e.source !== "string" || !validNodeIds.has(e.source)) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: invalid source "${e.source}"`,
    );
    return null;
  }

  if (typeof e.target !== "string" || !validNodeIds.has(e.target)) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: invalid target "${e.target}"`,
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

export function validateTemplate(
  template: unknown,
  index: number,
): GeneratedTemplateScheme | null {
  if (typeof template !== "object" || template === null) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: not an object`,
    );
    return null;
  }

  const t = template as Record<string, unknown>;

  if (typeof t.name !== "string" || !t.name.trim()) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: missing name`,
    );
    return null;
  }

  if (
    !Array.isArray(t.nodes) ||
    t.nodes.length < TEMPLATE_VALIDATION_RULES.minNodes
  ) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: insufficient nodes`,
    );
    return null;
  }

  const validNodes: GeneratedTemplateNode[] = [];
  for (let i = 0; i < t.nodes.length; i++) {
    const validatedNode = validateNode(t.nodes[i], i);
    if (validatedNode) {
      validNodes.push(validatedNode);
    }
  }

  if (validNodes.length < TEMPLATE_VALIDATION_RULES.minNodes) {
    logger.warn(
      `[Template Generator] Template "${t.name}" has too few valid nodes`,
    );
    return null;
  }

  const validNodeIds = new Set(validNodes.map((n) => n.id));

  const validEdges: GeneratedTemplateEdge[] = [];
  if (Array.isArray(t.edges)) {
    for (let i = 0; i < t.edges.length; i++) {
      const validatedEdge = validateEdge(t.edges[i], validNodeIds, i);
      if (validatedEdge) {
        validEdges.push(validatedEdge);
      }
    }
  }

  const layoutSuggestion = t.layoutSuggestion as LayoutSuggestion;
  const validLayout = TEMPLATE_VALIDATION_RULES.validLayouts.includes(
    layoutSuggestion,
  )
    ? layoutSuggestion
    : "radial";

  const difficulty = t.difficulty as TemplateDifficulty;
  const validDifficulty = TEMPLATE_VALIDATION_RULES.validDifficulties.includes(
    difficulty,
  )
    ? difficulty
    : "medium";

  const tags = Array.isArray(t.tags)
    ? (t.tags as string[]).filter((tag) => typeof tag === "string").slice(0, 10)
    : [];

  return {
    id: (t.id as string) || `template-${index + 1}`,
    name: t.name as string,
    description: (t.description as string) || "",
    nodes: validNodes,
    edges: validEdges,
    layoutSuggestion: validLayout,
    estimatedNodes: Math.min(
      TEMPLATE_VALIDATION_RULES.maxNodes,
      Math.max(
        TEMPLATE_VALIDATION_RULES.minNodes,
        (t.estimatedNodes as number) || validNodes.length,
      ),
    ),
    difficulty: validDifficulty,
    tags,
    reasoning: (t.reasoning as string) || "",
  };
}
