import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import type { NodeLevel } from "@shared/types/graph";
import type { StudyCardRow } from "@shared/types/database";
import type { LearningPathNode } from "./learningPathService";

export interface NodeForPath {
  id: string;
  title: string;
  content?: string;
  level: NodeLevel;
}

export interface EdgeForPath {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
}

export interface LearningProgress {
  nodeId: string;
  nodeTitle: string;
  masteryLevel: number;
  lastReviewDate: Date | null;
  nextReviewDate: Date | null;
  reviewCount: number;
  stability: number;
  difficulty: number;
}

export interface LearningPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  estimatedTime: number;
  prerequisites: string[];
  isCompleted: boolean;
  masteryLevel: number;
  nextReviewDate: string | null;
}

export async function buildProgressMap(
  supabase: SupabaseClient,
  userId: string,
  nodes: (NodeForPath | null)[],
): Promise<Map<string, LearningProgress>> {
  const { data: studyCards } = await supabase
    .from("study_cards")
    .select(
      `
      knowledge_point_id,
      fsrs_stability,
      fsrs_difficulty,
      fsrs_elapsed_days,
      fsrs_scheduled_days,
      fsrs_last_review,
      next_review,
      review_count
    `,
    )
    .eq("user_id", userId);

  const progressMap = new Map<string, LearningProgress>();

  if (studyCards) {
    studyCards.forEach((p: Pick<StudyCardRow, 'knowledge_point_id' | 'review_count' | 'fsrs_stability' | 'fsrs_difficulty' | 'fsrs_last_review' | 'next_review'>) => {
      const nodeId = p.knowledge_point_id;
      if (nodeId) {
        const existing = progressMap.get(nodeId) || {
          nodeId,
          nodeTitle: "",
          masteryLevel: 0,
          lastReviewDate: null,
          nextReviewDate: null,
          reviewCount: 0,
          stability: 0,
          difficulty: 0,
        };

        existing.reviewCount = Math.max(
          existing.reviewCount,
          p.review_count || 0,
        );
        existing.stability = Math.max(
          existing.stability,
          p.fsrs_stability || 0,
        );
        existing.difficulty = p.fsrs_difficulty || 0;

        if (p.fsrs_last_review)
          {existing.lastReviewDate = new Date(p.fsrs_last_review);}
        if (p.next_review) existing.nextReviewDate = new Date(p.next_review);

        existing.masteryLevel = Math.min(
          1,
          (existing.stability / 30) * (1 - existing.difficulty / 10),
        );
        progressMap.set(nodeId, existing);
      }
    });
  }

  nodes.forEach((node: NodeForPath | null) => {
    if (!node) return;
    if (!progressMap.has(node.id)) {
      progressMap.set(node.id, {
        nodeId: node.id,
        nodeTitle: node.title,
        masteryLevel: 0,
        lastReviewDate: null,
        nextReviewDate: null,
        reviewCount: 0,
        stability: 0,
        difficulty: 0,
      });
    } else {
      const progress = progressMap.get(node.id);
      if (progress) {
        progress.nodeTitle = node.title;
      }
    }
  });

  return progressMap;
}

export function buildDependencyMaps(
  nodes: (NodeForPath | null)[],
  edges: EdgeForPath[],
): {
  parentMap: Map<string, string[]>;
  childMap: Map<string, string[]>;
} {
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  nodes.forEach((node: NodeForPath | null) => {
    if (!node) return;
    parentMap.set(node.id, []);
    childMap.set(node.id, []);
  });

  edges.forEach((edge: EdgeForPath) => {
    const parents = parentMap.get(edge.target_knowledge_point_id) || [];
    parents.push(edge.source_knowledge_point_id);
    parentMap.set(edge.target_knowledge_point_id, parents);

    const children = childMap.get(edge.source_knowledge_point_id) || [];
    children.push(edge.target_knowledge_point_id);
    childMap.set(edge.source_knowledge_point_id, children);
  });

  return { parentMap, childMap };
}

export function topologicalSort(
  nodes: (NodeForPath | null)[],
  parentMap: Map<string, string[]>,
): string[] {
  const sortedNodes: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (nodeId: string, path: string[] = []): boolean => {
    if (temp.has(nodeId)) {
      cycleNodes.add(nodeId);
      logger.warn(`检测到循环依赖: ${[...path, nodeId].join(" -> ")}`);
      return false;
    }
    if (visited.has(nodeId)) return true;

    temp.add(nodeId);

    const parents = parentMap.get(nodeId) || [];
    for (const parentId of parents) {
      if (!visit(parentId, [...path, nodeId])) {
        break;
      }
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    sortedNodes.push(nodeId);
    return true;
  };

  nodes.forEach((node: NodeForPath | null) => {
    if (!node) return;
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  });

  if (cycleNodes.size > 0) {
    logger.info(`检测到 ${cycleNodes.size} 个循环依赖节点，已按最优顺序排列`);
  }

  return sortedNodes;
}

export function calculateEstimatedTime(
  masteryLevel: number,
  level: string = "normal",
  parentCount: number = 0,
  childCount: number = 0,
): number {
  let baseTime = 15;

  switch (level) {
    case "beginner":
      baseTime = 25;
      break;
    case "intermediate":
      baseTime = 20;
      break;
    case "advanced":
      baseTime = 30;
      break;
    default:
      baseTime = 15;
  }

  const dependencyFactor = Math.max(0, parentCount - 1) * 2;
  const successorFactor = Math.max(0, childCount - 1) * 1;

  const adjustedTime = baseTime + dependencyFactor + successorFactor;

  const masteryReduction = masteryLevel * 10;

  return Math.max(5, Math.round(adjustedTime - masteryReduction));
}

export function generateSuggestions(
  stages: LearningPathStage[],
  today: Date,
): string[] {
  const suggestions: string[] = [];

  const highPriorityCount = stages.filter(
    (s) => s.priority === "high" && !s.isCompleted,
  ).length;
  if (highPriorityCount > 5) {
    suggestions.push(i18next.t("learningPath.api.suggestions.increaseDailyTime"));
  }

  const lowMasteryNodes = stages.filter(
    (s) => s.masteryLevel < 0.3 && !s.isCompleted,
  );
  if (lowMasteryNodes.length > 0) {
    suggestions.push(
      i18next.t("learningPath.api.suggestions.lowMasteryPriority", {
        nodes: lowMasteryNodes
          .slice(0, 3)
          .map((n) => n.nodeTitle)
          .join("、"),
      }),
    );
  }

  const dueReviews = stages.filter(
    (s) => s.nextReviewDate && new Date(s.nextReviewDate) <= today,
  );
  if (dueReviews.length > 0) {
    suggestions.push(i18next.t("learningPath.api.suggestions.dueReviews", { count: dueReviews.length }));
  }

  const advancedNodes = stages.filter(
    (s) => s.level === "advanced" && !s.isCompleted,
  );
  if (advancedNodes.length > 3) {
    suggestions.push(i18next.t("learningPath.api.suggestions.advancedNodes"));
  }

  return suggestions;
}

export function findPath(
  startId: string,
  endId: string,
  childMap: Map<string, string[]>,
): string[] {
  const queue: Array<{ id: string; path: string[] }> = [
    { id: startId, path: [startId] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { id, path } = item;

    if (id === endId) return path;

    const children = childMap.get(id) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, path: [...path, childId] });
      }
    }
  }

  return [];
}

export function generateRulePath(
  nodes: (NodeForPath | null)[],
  _edges: EdgeForPath[],
  progressMap: Map<string, LearningProgress>,
  parentMap: Map<string, string[]>,
  childMap: Map<string, string[]>,
  targetNodeId: string | undefined,
  _dailyTimeMinutes: number,
): { stages: LearningPathStage[]; suggestions: string[] } {
  const sortedNodes = topologicalSort(nodes, parentMap);

  const today = new Date();
  const stages: LearningPathStage[] = [];
  let order = 0;

  // 预构建 nodeId -> node 映射，替代循环内 nodes.find 的 O(sortedNodes*nodes) 扫描
  const nodeById = new Map<string, NodeForPath>(
    nodes
      .filter((n): n is NodeForPath => n !== null)
      .map((n) => [n.id, n]),
  );

  for (const nodeId of sortedNodes) {
    const node = nodeById.get(nodeId);
    const progress = progressMap.get(nodeId);

    if (!node) continue;

    const parents = parentMap.get(nodeId) || [];
    const children = childMap.get(nodeId) || [];

    let priority: "high" | "medium" | "low" = "medium";
    let reason = "";

    if (
      progress &&
      progress.nextReviewDate &&
      new Date(progress.nextReviewDate) <= today
    ) {
      priority = "high";
      reason = i18next.t("learningPath.api.reasons.dueReview");
    } else if (!progress || progress.masteryLevel < 0.3) {
      priority = "high";
      reason = i18next.t("learningPath.api.reasons.needLearning");
    } else if (progress.masteryLevel < 0.6) {
      priority = "medium";
      reason = i18next.t("learningPath.api.reasons.needConsolidation");
    } else if (progress.masteryLevel < 0.8) {
      priority = "low";
      reason = i18next.t("learningPath.api.reasons.optionalReview");
    } else {
      priority = "low";
      reason = i18next.t("learningPath.api.reasons.mastered");
    }

    if (targetNodeId) {
      const pathToTarget = findPath(nodeId, targetNodeId, childMap);
      if (pathToTarget.length > 0) {
        priority = "high";
        reason = i18next.t("learningPath.api.reasons.targetPath");
      }
    }

    const estimatedTime = calculateEstimatedTime(
      progress?.masteryLevel || 0,
      node.level,
      parents.length,
      children.length,
    );

    stages.push({
      nodeId,
      nodeTitle: node.title,
      nodeContent: node.content || "",
      level: node.level || "normal",
      order: order++,
      priority,
      reason,
      estimatedTime,
      prerequisites: parents,
      isCompleted: (progress?.masteryLevel || 0) > 0.8,
      masteryLevel: progress?.masteryLevel || 0,
      nextReviewDate: progress?.nextReviewDate?.toISOString() || null,
    });
  }

  stages.sort((a, b) => {
    if (a.priority !== b.priority) {
      const priorityOrder: Record<"high" | "medium" | "low", number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.order - b.order;
  });

  const suggestions = generateSuggestions(stages, today);

  return { stages, suggestions };
}

export async function generateAIPath(
  supabase: SupabaseClient,
  userId: string,
  graphId: string,
  nodes: (NodeForPath | null)[],
  edges: EdgeForPath[],
  progressMap: Map<string, LearningProgress>,
  parentMap: Map<string, string[]>,
  childMap: Map<string, string[]>,
  targetGoal: string,
  learningStyle: string,
  dailyTimeMinutes: number,
  currentKnowledge: string | undefined,
  graphTitle: string,
  _providerType: string | undefined,
  model: string | undefined,
): Promise<{ stages: LearningPathStage[]; suggestions: string[] }> {
  const provider = await getAIProviderForTask("text");

  if (!provider.hasKey) {
    return generateRulePath(
      nodes,
      edges,
      progressMap,
      parentMap,
      childMap,
      undefined,
      dailyTimeMinutes,
    );
  }

  const validNodes = nodes.filter((n): n is NodeForPath => n !== null);
  
  const nodesInfo = validNodes.map((n) => {
    const progress = progressMap.get(n.id);
    return {
      title: n.title,
      level: n.level || "normal",
      mastery: progress?.masteryLevel || 0,
      isCompleted: (progress?.masteryLevel || 0) > 0.8,
    };
  });

  const nodeIdToTitle = new Map(validNodes.map((n) => [n.id, n.title]));
  const titleToNodeId = new Map(
    validNodes.map((n) => [n.title.toLowerCase(), n.id]),
  );
  // 复杂度降低：预构建小写标题->节点 Map，替代下方循环内多次 validNodes.find + toLowerCase 的 O(paths×nodes) 扫描
  const nodeByLowerTitle = new Map(
    validNodes.map((n) => [n.title.toLowerCase(), n]),
  );
  const edgesInfo = edges.map((e) => ({
    source:
      nodeIdToTitle.get(e.source_knowledge_point_id) ||
      e.source_knowledge_point_id,
    target:
      nodeIdToTitle.get(e.target_knowledge_point_id) ||
      e.target_knowledge_point_id,
    relationship: e.relationship_type,
  }));

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const mapPrerequisitesToUuids = (prereqs: string[]): string[] => {
    return (prereqs || [])
      .map((prereq: string) => {
        if (uuidPattern.test(prereq)) {
          return prereq;
        }
        return titleToNodeId.get(prereq.toLowerCase()) || null;
      })
      .filter((id): id is string => id !== null);
  };

  const systemPrompt = await promptService.getRenderedPrompt(
    supabase,
    "learning_path_generate",
    {
      graphTitle,
      targetGoal,
      learningStyle,
      dailyTimeMinutes,
      currentKnowledge: currentKnowledge || i18next.t("learningPath.api.defaults.notProvided"),
      nodesCount: nodes.length,
      isSequential: learningStyle === "sequential",
      isExploratory: learningStyle === "exploratory",
      isFocused: learningStyle === "focused",
      targetGoalProvided: !!targetGoal,
    },
    userId,
    graphId,
  );

  const userMessage = i18next.t("learningPath.api.prompts.pathUserMessage", {
    graphTitle,
    targetGoal,
    learningStyle:
      learningStyle === "sequential"
        ? "顺序学习"
        : learningStyle === "exploratory"
          ? "探索学习"
          : learningStyle === "focused"
            ? "专注学习"
            : "自定义",
    dailyTimeMinutes,
    currentKnowledgeLine: currentKnowledge
      ? `当前知识背景：${currentKnowledge}`
      : "",
    nodesCount: nodes.length,
    nodesList: JSON.stringify(nodesInfo, null, 2),
    relationsList: JSON.stringify(edgesInfo, null, 2),
  });

  try {
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"path": [], "suggestions": []}');

    const stages: LearningPathStage[] = [];

    for (let index = 0; index < (parsed.path || []).length; index++) {
      const item = parsed.path[index];
      let node: NodeForPath | undefined;
      if (item.nodeTitle) {
        node =
          nodeByLowerTitle.get(item.nodeTitle) ??
          nodeByLowerTitle.get(item.nodeTitle.toLowerCase());
      }

      if (!node && item.nodeTitle) {
        // 精确匹配失败后，仅对未命中的项做模糊子串扫描
        const lowerTitle = item.nodeTitle.toLowerCase();
        node = validNodes.find(
          (n) =>
            n.title.toLowerCase().includes(lowerTitle) ||
            lowerTitle.includes(n.title.toLowerCase()),
        );
      }

      if (!node) {
        logger.warn(
          `AI 返回的节点 "${item.nodeTitle}" 无法匹配到图谱中的知识点，已跳过`,
        );
        continue;
      }

      const progress = progressMap.get(node.id);

      stages.push({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeContent: node.content || "",
        level: node.level || item.level || "normal",
        order: stages.length,
        priority: item.priority || "medium",
        reason: item.reason || "",
        estimatedTime: item.estimatedTime || 15,
        prerequisites: mapPrerequisitesToUuids(item.prerequisites || []),
        isCompleted: progress?.masteryLevel
          ? progress.masteryLevel > 0.8
          : false,
        masteryLevel: progress?.masteryLevel || 0,
        nextReviewDate: progress?.nextReviewDate?.toISOString() || null,
      });
    }

    return {
      stages,
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    logger.error("AI Learning Path Error:", error);
    return generateRulePath(
      nodes,
      edges,
      progressMap,
      parentMap,
      childMap,
      undefined,
      dailyTimeMinutes,
    );
  }
}

export function buildTodayPlan(
  stages: LearningPathStage[],
  dailyTimeMinutes: number,
): LearningPathStage[] {
  const todayPlan: LearningPathStage[] = [];
  let remainingTime = dailyTimeMinutes;

  for (const stage of stages) {
    if (remainingTime <= 0) break;
    if (stage.isCompleted && stage.priority !== "high") continue;

    todayPlan.push(stage);
    remainingTime -= stage.estimatedTime;
  }

  return todayPlan;
}

export function calculateWeeklyProgress(
  dailyTimeMinutes: number,
  totalEstimatedTime: number,
): number[] {
  const weeklyProgress: number[] = [];
  let accumulatedTime = 0;

  for (let i = 0; i < 7; i++) {
    accumulatedTime += dailyTimeMinutes;
    weeklyProgress.push(
      Math.min(100, Math.round((accumulatedTime / totalEstimatedTime) * 100)),
    );
  }

  return weeklyProgress;
}

/**
 * Topological sort for LearningPathNode[] (Kahn's algorithm).
 * Different from topologicalSort which operates on NodeForPath[].
 * Handles cycles by appending remaining nodes at the end.
 */
export function topologicalSortNodes(nodes: LearningPathNode[]): LearningPathNode[] {
  const nodeMap = new Map<string, LearningPathNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });

  nodes.forEach((node) => {
    node.prerequisites.forEach((prereqId) => {
      if (nodeMap.has(prereqId)) {
        adjacency.get(prereqId)?.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      }
    });
  });

  const queue: string[] = [];
  nodes.forEach((node) => {
    if ((inDegree.get(node.id) || 0) === 0) {
      queue.push(node.id);
    }
  });

  queue.sort((a, b) => {
    const nodeA = nodeMap.get(a);
    const nodeB = nodeMap.get(b);
    return (nodeA?.order_index || 0) - (nodeB?.order_index || 0);
  });

  const result: LearningPathNode[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) break;
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    result.push(node);

    const neighbors = adjacency.get(nodeId) || [];
    neighbors.sort((a, b) => {
      const nodeA = nodeMap.get(a);
      const nodeB = nodeMap.get(b);
      return (nodeA?.order_index || 0) - (nodeB?.order_index || 0);
    });

    neighbors.forEach((neighborId) => {
      const newDegree = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) {
        queue.push(neighborId);
      }
    });
  }

  if (result.length < nodes.length) {
    // 预构建 result 节点 id 集合，替代 filter 内 result.includes(n) 的 O(result*nodes) 扫描
    const resultIds = new Set(result.map((n) => n.id));
    const remainingNodes = nodes.filter((n) => !resultIds.has(n.id));
    remainingNodes.sort((a, b) => a.order_index - b.order_index);
    result.push(...remainingNodes);
  }

  return result;
}
