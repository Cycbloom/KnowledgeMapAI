import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { graphService } from "../graph/index";
import type { NodeLevel } from "@shared/types/graph";
import type { StudyCardRow } from "@shared/types/database";

interface NodeForPath {
  id: string;
  title: string;
  content?: string;
  level: NodeLevel;
}

interface EdgeForPath {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
}

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type: "single_graph" | "cross_graph";
  total_estimated_time: number;
  ai_generated: boolean;
  status: "active" | "completed" | "paused" | "archived";
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes?: LearningPathNode[];
  progress?: LearningPathProgressSummary;
}

export interface LearningPathNode {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPathProgress {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  started_at?: string;
  completed_at?: string;
}

export interface LearningPathProgressSummary {
  total_nodes: number;
  completed_nodes: number;
  in_progress_nodes: number;
  pending_nodes: number;
  skipped_nodes: number;
  total_time_spent: number;
  progress_percentage: number;
}

export interface LearningPlan {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  planned_duration?: number;
  planned_nodes: string[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type?: "single_graph" | "cross_graph";
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: CreateLearningPathNodeInput[];
}

export interface CreateLearningPathNodeInput {
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time?: number;
  is_milestone?: boolean;
  prerequisites?: string[];
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  goal?: string;
  target_date?: string;
  status?: "active" | "completed" | "paused" | "archived";
  daily_minutes_target?: number;
}

export interface UpdateNodeStatusInput {
  status: "pending" | "in_progress" | "completed" | "skipped";
  notes?: string;
  time_spent?: number;
  progress_percentage?: number;
}

export interface LearningPathWithNodeCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  target_date: string | null;
  source_graph_id: string | null;
  domain_id: string | null;
  path_type: string;
  total_estimated_time: number;
  ai_generated: boolean;
  status: string;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes_count: number;
  completed_nodes_count: number;
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

export interface LearningPathResult {
  id?: string;
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
  aiGenerated: boolean;
  targetGoal?: string;
  savedPath?: LearningPath;
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
          existing.lastReviewDate = new Date(p.fsrs_last_review);
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
      const progress = progressMap.get(node.id)!;
      progress.nodeTitle = node.title;
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
    suggestions.push("建议增加每日学习时间，有较多待学习/复习的知识点");
  }

  const lowMasteryNodes = stages.filter(
    (s) => s.masteryLevel < 0.3 && !s.isCompleted,
  );
  if (lowMasteryNodes.length > 0) {
    suggestions.push(
      `建议优先学习：${lowMasteryNodes
        .slice(0, 3)
        .map((n) => n.nodeTitle)
        .join("、")}`,
    );
  }

  const dueReviews = stages.filter(
    (s) => s.nextReviewDate && new Date(s.nextReviewDate) <= today,
  );
  if (dueReviews.length > 0) {
    suggestions.push(`有 ${dueReviews.length} 个知识点需要复习`);
  }

  const advancedNodes = stages.filter(
    (s) => s.level === "advanced" && !s.isCompleted,
  );
  if (advancedNodes.length > 3) {
    suggestions.push("有较多高级知识点，建议确保前置知识已掌握");
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
    const { id, path } = queue.shift()!;

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

  for (const nodeId of sortedNodes) {
    const node = nodes.find((n: NodeForPath | null) => n?.id === nodeId);
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
      reason = "需要复习：已到复习时间";
    } else if (!progress || progress.masteryLevel < 0.3) {
      priority = "high";
      reason = "需要学习：尚未掌握";
    } else if (progress.masteryLevel < 0.6) {
      priority = "medium";
      reason = "需要巩固：掌握程度较低";
    } else if (progress.masteryLevel < 0.8) {
      priority = "low";
      reason = "可选复习：基本掌握";
    } else {
      priority = "low";
      reason = "已掌握：可跳过";
    }

    if (targetNodeId) {
      const pathToTarget = findPath(nodeId, targetNodeId, childMap);
      if (pathToTarget.length > 0) {
        priority = "high";
        reason = "目标路径上的知识点";
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
      currentKnowledge: currentKnowledge || "未提供",
      nodesCount: nodes.length,
      isSequential: learningStyle === "sequential",
      isExploratory: learningStyle === "exploratory",
      isFocused: learningStyle === "focused",
      targetGoalProvided: !!targetGoal,
    },
    userId,
    graphId,
  );

  const userMessage = `图谱标题：${graphTitle}
目标：${targetGoal}
学习风格：${learningStyle === "sequential" ? "顺序学习" : learningStyle === "exploratory" ? "探索学习" : learningStyle === "focused" ? "专注学习" : "自定义"}
每日学习时间：${dailyTimeMinutes} 分钟
${currentKnowledge ? `当前知识背景：${currentKnowledge}` : ""}
知识点列表（共 ${nodes.length} 个）：
${JSON.stringify(nodesInfo, null, 2)}
知识点关系：
${JSON.stringify(edgesInfo, null, 2)}
请根据以上信息，规划一条最优的学习路径。注意：如果有明确的学习目标，只需要选择与目标直接相关的核心节点（5-15个），不需要包含图谱中的所有节点。`;

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
      let node = validNodes.find(
        (n) =>
          n.title === item.nodeTitle ||
          n.title.toLowerCase() === item.nodeTitle?.toLowerCase(),
      );

      if (!node && item.nodeTitle) {
        const searchTitle = item.nodeTitle.toLowerCase();
        node = validNodes.find(
          (n) =>
            n.title.toLowerCase().includes(searchTitle) ||
            searchTitle.includes(n.title.toLowerCase()),
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

export class LearningPathService {
  async createLearningPath(
    supabase: SupabaseClient,
    userId: string,
    input: CreateLearningPathInput,
  ): Promise<LearningPath> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description || null,
        goal: input.goal || null,
        target_date: input.target_date || null,
        source_graph_id: input.source_graph_id || null,
        domain_id: input.domain_id || null,
        path_type: input.path_type || "single_graph",
        total_estimated_time: input.total_estimated_time || 0,
        ai_generated: input.ai_generated || false,
        daily_minutes_target: input.daily_minutes_target || 30,
        status: "active",
      })
      .select()
      .single();

    if (pathError) {
      logger.error("createLearningPath error:", pathError);
      throw pathError;
    }

    if (input.nodes && input.nodes.length > 0) {
      const nodesData = input.nodes.map((node) => ({
        path_id: path.id,
        knowledge_point_id: node.knowledge_point_id || null,
        graph_id: node.graph_id || null,
        order_index: node.order_index,
        title: node.title,
        description: node.description || null,
        estimated_time: node.estimated_time || 30,
        is_milestone: node.is_milestone || false,
        prerequisites: node.prerequisites || [],
        status: "pending" as const,
      }));

      const { error: nodesError } = await supabase
        .from("learning_path_nodes")
        .insert(nodesData);

      if (nodesError) {
        logger.error("createLearningPath nodes error:", nodesError);
        await supabase.from("learning_paths").delete().eq("id", path.id);
        throw nodesError;
      }

      const totalEstimatedTime = input.nodes.reduce(
        (sum, n) => sum + (n.estimated_time || 30),
        0,
      );
      await supabase
        .from("learning_paths")
        .update({ total_estimated_time: totalEstimatedTime })
        .eq("id", path.id);

      path.total_estimated_time = totalEstimatedTime;
    }

    const result = await this.getLearningPath(supabase, path.id, userId);
    return result!;
  }

  async getLearningPaths(
    supabase: SupabaseClient,
    userId: string,
    status?: string,
  ): Promise<LearningPathWithNodeCount[]> {
    let query = supabase
      .from("learning_paths")
      .select(
        `
        id,
        user_id,
        title,
        description,
        goal,
        target_date,
        source_graph_id,
        domain_id,
        path_type,
        total_estimated_time,
        ai_generated,
        status,
        daily_minutes_target,
        created_at,
        updated_at
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: paths, error } = await query;

    if (error) {
      logger.error("getLearningPaths error:", error);
      throw error;
    }

    if (!paths || paths.length === 0) {
      return [];
    }

    const pathIds = paths.map((p) => p.id);

    const { data: nodesData, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("path_id, status")
      .in("path_id", pathIds);

    if (nodesError) {
      logger.error("getLearningPaths nodes error:", nodesError);
      throw nodesError;
    }

    const nodeStatsMap = new Map<
      string,
      { total: number; completed: number }
    >();

    (nodesData || []).forEach((node) => {
      const stats = nodeStatsMap.get(node.path_id) || {
        total: 0,
        completed: 0,
      };
      stats.total++;
      if (node.status === "completed") {
        stats.completed++;
      }
      nodeStatsMap.set(node.path_id, stats);
    });

    return paths.map((path) => {
      const stats = nodeStatsMap.get(path.id) || { total: 0, completed: 0 };
      return {
        ...path,
        nodes_count: stats.total,
        completed_nodes_count: stats.completed,
      };
    });
  }

  async getLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPath | null> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError) {
      if (pathError.code === "PGRST116") {
        return null;
      }
      logger.error("getLearningPath error:", pathError);
      throw pathError;
    }

    if (!path) {
      return null;
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true });

    if (nodesError) {
      logger.error("getLearningPath nodes error:", nodesError);
      throw nodesError;
    }

    const progress = await this.getPathProgress(supabase, pathId, userId);

    return {
      ...path,
      nodes: nodes || [],
      progress,
    };
  }

  async updateLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: UpdateLearningPathInput,
  ): Promise<LearningPath> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("learning_paths")
      .update(updateData)
      .eq("id", pathId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("updateLearningPath error:", error);
      throw error;
    }

    if (!data) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    return (await this.getLearningPath(
      supabase,
      pathId,
      userId,
    )) as LearningPath;
  }

  async deleteLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    hardDelete: boolean = false,
  ): Promise<void> {
    const { data: path, error: checkError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (checkError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (hardDelete) {
      const { error } = await supabase
        .from("learning_paths")
        .delete()
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath hard delete error:", error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("learning_paths")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath archive error:", error);
        throw error;
      }
    }
  }

  async addNodeToPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: CreateLearningPathNodeInput,
  ): Promise<LearningPathNode> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { data: node, error } = await supabase
      .from("learning_path_nodes")
      .insert({
        path_id: pathId,
        knowledge_point_id: input.knowledge_point_id || null,
        graph_id: input.graph_id || null,
        order_index: input.order_index,
        title: input.title,
        description: input.description || null,
        estimated_time: input.estimated_time || 30,
        is_milestone: input.is_milestone || false,
        prerequisites: input.prerequisites || [],
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("addNodeToPath error:", error);
      throw error;
    }

    await this.recalculateTotalTime(supabase, pathId);

    return node;
  }

  async updateNodeStatus(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: UpdateNodeStatusInput,
  ): Promise<LearningPathNode> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select("id, path_id, started_at")
      .eq("id", nodeId)
      .eq("path_id", pathId)
      .single();

    if (nodeError || !node) {
      throw new AppError("节点不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在或无权访问", 403, ErrorCodes.FORBIDDEN);
    }

    const now = new Date().toISOString();
    const nodeUpdateData: Record<string, unknown> = {
      status: input.status,
      updated_at: now,
    };

    if (input.status === "in_progress" && !node.started_at) {
      nodeUpdateData.started_at = now;
    }

    if (input.status === "completed") {
      nodeUpdateData.completed_at = now;
    }

    const { data: updatedNode, error } = await supabase
      .from("learning_path_nodes")
      .update(nodeUpdateData)
      .eq("id", nodeId)
      .select()
      .single();

    if (error) {
      logger.error("updateNodeStatus error:", error);
      throw error;
    }

    const progressData: Record<string, unknown> = {
      user_id: userId,
      path_id: pathId,
      node_id: nodeId,
      status: input.status,
      updated_at: now,
    };

    if (input.notes !== undefined) {
      progressData.notes = input.notes;
    }
    if (input.time_spent !== undefined) {
      progressData.time_spent = input.time_spent;
    }
    if (input.progress_percentage !== undefined) {
      progressData.progress_percentage = input.progress_percentage;
    }

    if (input.status === "in_progress") {
      progressData.started_at = now;
    }
    if (input.status === "completed") {
      progressData.completed_at = now;
      progressData.progress_percentage = 100;
    }

    const { error: upsertError } = await supabase
      .from("learning_path_progress")
      .upsert(progressData, { onConflict: "user_id,path_id,node_id" });

    if (upsertError) {
      logger.error("updateNodeStatus progress upsert error:", upsertError);
    }

    await this.checkAndUpdatePathCompletion(supabase, pathId, userId);

    return updatedNode;
  }

  async reorderNodes(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    nodeOrders: { id: string; order_index: number }[],
  ): Promise<void> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updates = nodeOrders.map((item) =>
      supabase
        .from("learning_path_nodes")
        .update({
          order_index: item.order_index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("path_id", pathId),
    );

    const results = await Promise.all(updates);

    for (const result of results) {
      if (result.error) {
        logger.error("reorderNodes error:", result.error);
        throw result.error;
      }
    }
  }

  async removeNodeFromPath(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { error } = await supabase
      .from("learning_path_nodes")
      .delete()
      .eq("id", nodeId)
      .eq("path_id", pathId);

    if (error) {
      logger.error("removeNodeFromPath error:", error);
      throw error;
    }

    await this.recalculateTotalTime(supabase, pathId);
  }

  async updateProgress(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: {
      progress_percentage?: number;
      time_spent?: number;
      notes?: string;
    },
  ): Promise<LearningPathProgress> {
    const { data: existing, error: checkError } = await supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .eq("node_id", nodeId)
      .maybeSingle();

    if (checkError) {
      logger.error("updateProgress check error:", checkError);
      throw checkError;
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      user_id: userId,
      path_id: pathId,
      node_id: nodeId,
      updated_at: now,
    };

    if (input.progress_percentage !== undefined) {
      updateData.progress_percentage = input.progress_percentage;
    }
    if (input.time_spent !== undefined) {
      updateData.time_spent = existing
        ? (existing.time_spent || 0) + input.time_spent
        : input.time_spent;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    if (!existing) {
      updateData.started_at = now;
    }

    const { data, error } = await supabase
      .from("learning_path_progress")
      .upsert(updateData, { onConflict: "user_id,path_id,node_id" })
      .select()
      .single();

    if (error) {
      logger.error("updateProgress error:", error);
      throw error;
    }

    return data;
  }

  async getPathProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPathProgressSummary> {
    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, status, estimated_time")
      .eq("path_id", pathId);

    if (nodesError) {
      logger.error("getPathProgress nodes error:", nodesError);
      throw nodesError;
    }

    if (!nodes || nodes.length === 0) {
      return {
        total_nodes: 0,
        completed_nodes: 0,
        in_progress_nodes: 0,
        pending_nodes: 0,
        skipped_nodes: 0,
        total_time_spent: 0,
        progress_percentage: 0,
      };
    }

    const { data: progressData, error: progressError } = await supabase
      .from("learning_path_progress")
      .select("time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    if (progressError) {
      logger.error("getPathProgress progress error:", progressError);
    }

    const totalTimeSpent = (progressData || []).reduce(
      (sum, p) => sum + (p.time_spent || 0),
      0,
    );

    const stats = {
      total_nodes: nodes.length,
      completed_nodes: 0,
      in_progress_nodes: 0,
      pending_nodes: 0,
      skipped_nodes: 0,
    };

    nodes.forEach((node) => {
      switch (node.status) {
        case "completed":
          stats.completed_nodes++;
          break;
        case "in_progress":
          stats.in_progress_nodes++;
          break;
        case "skipped":
          stats.skipped_nodes++;
          break;
        default:
          stats.pending_nodes++;
      }
    });

    const progressPercentage =
      stats.total_nodes > 0
        ? Math.round((stats.completed_nodes / stats.total_nodes) * 100)
        : 0;

    return {
      ...stats,
      total_time_spent: totalTimeSpent,
      progress_percentage: progressPercentage,
    };
  }

  async createDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: {
      plan_date: string;
      planned_nodes: string[];
      planned_duration?: number;
      notes?: string;
    },
  ): Promise<LearningPlan> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id, daily_minutes_target")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { data, error } = await supabase
      .from("learning_path_progress")
      .upsert(
        {
          user_id: userId,
          path_id: pathId,
          node_id: input.planned_nodes[0],
          started_at: input.plan_date,
          planned_nodes: input.planned_nodes,
          planned_duration: input.planned_duration || path.daily_minutes_target,
          notes: input.notes || null,
          status: "pending",
          progress_percentage: 0,
          time_spent: 0,
        },
        { onConflict: "user_id,path_id,node_id" },
      )
      .select()
      .single();

    if (error) {
      logger.error("createDailyPlan error:", error);
      throw error;
    }

    return data;
  }

  async getDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    planDate: string,
  ): Promise<LearningPlan | null> {
    const { data, error } = await supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .gte("started_at", `${planDate}T00:00:00Z`)
      .lt("started_at", `${planDate}T23:59:59Z`)
      .maybeSingle();

    if (error) {
      logger.error("getDailyPlan error:", error);
      throw error;
    }

    return data;
  }

  async getDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningPlan[]> {
    let query = supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .order("started_at", { ascending: true });

    if (startDate) {
      query = query.gte("started_at", startDate);
    }
    if (endDate) {
      query = query.lte("started_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("getDailyPlans error:", error);
      throw error;
    }

    return data || [];
  }

  async updatePlanStatus(
    supabase: SupabaseClient,
    planId: string,
    userId: string,
    input: {
      status?: string;
      time_spent?: number;
      notes?: string;
      progress_percentage?: number;
    },
  ): Promise<LearningPlan> {
    const { data: plan, error: checkError } = await supabase
      .from("learning_path_progress")
      .select("id, path_id")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();

    if (checkError || !plan) {
      throw new AppError("计划不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("learning_path_progress")
      .update(updateData)
      .eq("id", planId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("updatePlanStatus error:", error);
      throw error;
    }

    return data;
  }

  private async recalculateTotalTime(
    supabase: SupabaseClient,
    pathId: string,
  ): Promise<void> {
    const { data: nodes, error } = await supabase
      .from("learning_path_nodes")
      .select("estimated_time")
      .eq("path_id", pathId);

    if (error) {
      logger.error("recalculateTotalTime error:", error);
      return;
    }

    const totalTime = (nodes || []).reduce(
      (sum, n) => sum + (n.estimated_time || 0),
      0,
    );

    await supabase
      .from("learning_paths")
      .update({ total_estimated_time: totalTime })
      .eq("id", pathId);
  }

  private async checkAndUpdatePathCompletion(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<void> {
    const progress = await this.getPathProgress(supabase, pathId, userId);

    if (
      progress.total_nodes > 0 &&
      progress.completed_nodes === progress.total_nodes
    ) {
      await supabase
        .from("learning_paths")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pathId);
    }
  }

  async setLearningGoal(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: {
      goal: string;
      target_date: string;
      daily_minutes_target?: number;
    },
  ): Promise<LearningPath> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id, user_id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const targetDate = new Date(input.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate <= today) {
      throw new AppError(
        "目标日期必须是未来的日期",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, estimated_time")
      .eq("path_id", pathId);

    if (nodesError) {
      logger.error("setLearningGoal nodes error:", nodesError);
      throw nodesError;
    }

    const totalEstimatedTime = (nodes || []).reduce(
      (sum, n) => sum + (n.estimated_time || 30),
      0,
    );

    const daysUntilTarget = Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dailyMinutesTarget =
      input.daily_minutes_target ||
      Math.ceil(totalEstimatedTime / daysUntilTarget);

    const { error: updateError } = await supabase
      .from("learning_paths")
      .update({
        goal: input.goal,
        target_date: input.target_date,
        daily_minutes_target: dailyMinutesTarget,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pathId);

    if (updateError) {
      logger.error("setLearningGoal update error:", updateError);
      throw updateError;
    }

    const result = await this.getLearningPath(supabase, pathId, userId);
    return {
      ...result!,
      total_estimated_time: totalEstimatedTime,
    } as LearningPath & { daily_node_count?: number };
  }

  async generateDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      respect_prerequisites?: boolean;
    },
  ): Promise<LearningPlan[]> {
    const path = await this.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (!path.target_date) {
      throw new AppError(
        "请先设置学习目标和目标日期",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const nodes = path.nodes || [];
    if (nodes.length === 0) {
      return [];
    }

    const startDate = options?.start_date
      ? new Date(options.start_date)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(path.target_date);
    const daysUntilTarget = Math.ceil(
      (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilTarget <= 0) {
      throw new AppError(
        "目标日期已过，请更新目标日期",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const pendingNodes = nodes.filter(
      (n) => n.status === "pending" || n.status === "in_progress",
    );

    if (pendingNodes.length === 0) {
      return [];
    }

    let orderedNodes: LearningPathNode[];
    if (options?.respect_prerequisites !== false) {
      orderedNodes = this.topologicalSort(pendingNodes);
    } else {
      orderedNodes = [...pendingNodes].sort(
        (a, b) => a.order_index - b.order_index,
      );
    }

    const dailyMinutesTarget = path.daily_minutes_target || 30;
    const plans: LearningPlan[] = [];
    const nodeQueue = [...orderedNodes];
    const now = new Date().toISOString();

    for (let day = 0; day < daysUntilTarget && nodeQueue.length > 0; day++) {
      const planDate = new Date(startDate);
      planDate.setDate(planDate.getDate() + day);
      const planDateStr = planDate.toISOString().split("T")[0];

      const plannedNodesForDay: string[] = [];
      let plannedDuration = 0;

      while (nodeQueue.length > 0) {
        const node = nodeQueue[0];
        const nodeTime = node.estimated_time || 30;

        if (plannedDuration + nodeTime <= dailyMinutesTarget) {
          plannedNodesForDay.push(node.id);
          plannedDuration += nodeTime;
          nodeQueue.shift();
        } else {
          break;
        }
      }

      if (plannedNodesForDay.length > 0) {
        plans.push({
          id: "",
          user_id: userId,
          path_id: pathId,
          node_id: plannedNodesForDay[0],
          status: "pending",
          progress_percentage: 0,
          time_spent: 0,
          planned_nodes: plannedNodesForDay,
          planned_duration: plannedDuration,
          started_at: planDateStr,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (plans.length > 0) {
      const plansToInsert = plans.map((p) => ({
        user_id: p.user_id,
        path_id: p.path_id,
        node_id: p.node_id,
        started_at: p.started_at,
        planned_nodes: p.planned_nodes,
        planned_duration: p.planned_duration,
        status: p.status,
        progress_percentage: p.progress_percentage,
        time_spent: p.time_spent,
      }));

      const { data: insertedPlans, error: insertError } = await supabase
        .from("learning_path_progress")
        .upsert(plansToInsert, { onConflict: "user_id,path_id,node_id" })
        .select();

      if (insertError) {
        logger.error("generateDailyPlans insert error:", insertError);
        throw insertError;
      }

      return (insertedPlans || []) as LearningPlan[];
    }

    return [];
  }

  private topologicalSort(nodes: LearningPathNode[]): LearningPathNode[] {
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
      const nodeId = queue.shift()!;
      result.push(nodeMap.get(nodeId)!);

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
      const remainingNodes = nodes.filter((n) => !result.includes(n));
      remainingNodes.sort((a, b) => a.order_index - b.order_index);
      result.push(...remainingNodes);
    }

    return result;
  }

  async estimateLearningTime(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<
    {
      node_id: string;
      title: string;
      base_time: number;
      difficulty_multiplier: number;
      user_speed_multiplier: number;
      estimated_time: number;
      confidence: "low" | "medium" | "high";
    }[]
  > {
    const path = await this.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const nodes = path.nodes || [];

    const { data: userSettings, error: settingsError } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    if (settingsError) {
      logger.warn("Failed to fetch user settings:", settingsError);
    }

    const userSettingsData = userSettings?.settings || {};
    const avgLearningSpeed = userSettingsData.avg_learning_speed || 1.0;

    const { data: studyCards, error: cardsError } = await supabase
      .from("study_cards")
      .select(
        "knowledge_point_id, difficulty, fsrs_stability, fsrs_difficulty, review_count",
      )
      .eq("user_id", userId);

    if (cardsError) {
      logger.warn("Failed to fetch study cards:", cardsError);
    }

    const cardStats = new Map<
      string,
      {
        avgDifficulty: number;
        avgStability: number;
        totalReviews: number;
      }
    >();

    (studyCards || []).forEach((card) => {
      const kpId = card.knowledge_point_id;
      if (!cardStats.has(kpId)) {
        cardStats.set(kpId, {
          avgDifficulty: 0,
          avgStability: 0,
          totalReviews: 0,
        });
      }
      const stats = cardStats.get(kpId)!;
      stats.avgDifficulty += card.difficulty || 1;
      stats.avgStability += card.fsrs_stability || 0;
      stats.totalReviews += card.review_count || 0;
    });

    cardStats.forEach((stats, kpId) => {
      const count =
        studyCards?.filter((c) => c.knowledge_point_id === kpId).length || 1;
      stats.avgDifficulty /= count;
      stats.avgStability /= count;
    });

    const { data: progressData, error: progressError } = await supabase
      .from("learning_path_progress")
      .select("node_id, time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    if (progressError) {
      logger.warn("Failed to fetch progress data:", progressError);
    }

    const nodeTimeSpent = new Map<string, number>();
    (progressData || []).forEach((p) => {
      nodeTimeSpent.set(p.node_id, p.time_spent || 0);
    });

    const totalCompletedTime = Array.from(nodeTimeSpent.values()).reduce(
      (sum, t) => sum + t,
      0,
    );
    const completedNodeCount = nodeTimeSpent.size;
    const avgTimePerNode =
      completedNodeCount > 0 ? totalCompletedTime / completedNodeCount : 30;

    const userSpeedMultiplier =
      completedNodeCount >= 3
        ? Math.min(Math.max(30 / avgTimePerNode, 0.5), 2.0)
        : avgLearningSpeed;

    const estimates = nodes.map((node) => {
      const baseTime = node.estimated_time || 30;

      let difficultyMultiplier = 1.0;
      let confidence: "low" | "medium" | "high" = "medium";

      if (node.knowledge_point_id && cardStats.has(node.knowledge_point_id)) {
        const stats = cardStats.get(node.knowledge_point_id)!;
        difficultyMultiplier = 0.8 + stats.avgDifficulty * 0.15;
        confidence = stats.totalReviews >= 5 ? "high" : "medium";
      } else {
        confidence = "low";
        difficultyMultiplier = 1.2;
      }

      const estimatedTime = Math.round(
        baseTime * difficultyMultiplier * userSpeedMultiplier,
      );

      return {
        node_id: node.id,
        title: node.title,
        base_time: baseTime,
        difficulty_multiplier: Math.round(difficultyMultiplier * 100) / 100,
        user_speed_multiplier: Math.round(userSpeedMultiplier * 100) / 100,
        estimated_time: estimatedTime,
        confidence,
      };
    });

    return estimates;
  }

  async getLearningRecommendations(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<
    {
      type: "weak_point" | "review_needed" | "prerequisite_gap" | "milestone";
      priority: "high" | "medium" | "low";
      node_id?: string;
      title: string;
      description: string;
      action?: string;
    }[]
  > {
    const path = await this.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const nodes = path.nodes || [];
    const recommendations: {
      type: "weak_point" | "review_needed" | "prerequisite_gap" | "milestone";
      priority: "high" | "medium" | "low";
      node_id?: string;
      title: string;
      description: string;
      action?: string;
    }[] = [];

    const progress = await this.getPathProgress(supabase, pathId, userId);

    if (progress.progress_percentage < 50 && progress.pending_nodes > 0) {
      const nextNode = nodes.find((n) => n.status === "pending");
      if (nextNode) {
        recommendations.push({
          type: "milestone",
          priority: "high",
          node_id: nextNode.id,
          title: "继续学习下一个知识点",
          description: `当前进度 ${progress.progress_percentage}%，建议继续学习「${nextNode.title}」`,
          action: "start_learning",
        });
      }
    }

    const knowledgePointIds = nodes
      .filter((n) => n.knowledge_point_id)
      .map((n) => n.knowledge_point_id);

    if (knowledgePointIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from("study_cards")
        .select(
          "id, knowledge_point_id, fsrs_state, fsrs_stability, next_review, review_count",
        )
        .eq("user_id", userId)
        .in("knowledge_point_id", knowledgePointIds);

      if (cardsError) {
        logger.warn("Failed to fetch cards for recommendations:", cardsError);
      }

      const now = new Date();
      const weakKnowledgePoints = new Map<
        string,
        { stability: number; reviewCount: number }
      >();
      const reviewNeededPoints = new Map<string, Date>();

      (cards || []).forEach((card) => {
        if (card.fsrs_stability < 3 && card.review_count >= 2) {
          weakKnowledgePoints.set(card.knowledge_point_id, {
            stability: card.fsrs_stability,
            reviewCount: card.review_count,
          });
        }

        if (card.next_review && new Date(card.next_review) <= now) {
          reviewNeededPoints.set(
            card.knowledge_point_id,
            new Date(card.next_review),
          );
        }
      });

      weakKnowledgePoints.forEach((data, kpId) => {
        const node = nodes.find((n) => n.knowledge_point_id === kpId);
        if (node && node.status !== "completed") {
          recommendations.push({
            type: "weak_point",
            priority: "high",
            node_id: node.id,
            title: `加强薄弱知识点：${node.title}`,
            description: `该知识点记忆稳定性较低 (${data.stability.toFixed(1)})，建议增加复习频率`,
            action: "review",
          });
        }
      });

      reviewNeededPoints.forEach((reviewDate, kpId) => {
        const node = nodes.find((n) => n.knowledge_point_id === kpId);
        if (node) {
          const daysOverdue = Math.floor(
            (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          recommendations.push({
            type: "review_needed",
            priority: daysOverdue > 3 ? "high" : "medium",
            node_id: node.id,
            title: `复习到期：${node.title}`,
            description:
              daysOverdue > 0
                ? `该知识点已过期 ${daysOverdue} 天，建议立即复习`
                : "该知识点今日需要复习",
            action: "review",
          });
        }
      });
    }

    const inProgressNodes = nodes.filter((n) => n.status === "in_progress");
    for (const node of inProgressNodes) {
      const incompletePrereqs = node.prerequisites.filter((prereqId) => {
        const prereqNode = nodes.find((n) => n.id === prereqId);
        return prereqNode && prereqNode.status !== "completed";
      });

      if (incompletePrereqs.length > 0) {
        const prereqTitles = incompletePrereqs
          .map((id) => nodes.find((n) => n.id === id)?.title)
          .filter(Boolean)
          .join("、");

        recommendations.push({
          type: "prerequisite_gap",
          priority: "high",
          node_id: node.id,
          title: `前置知识未完成：${node.title}`,
          description: `请先完成前置知识点：${prereqTitles}`,
          action: "complete_prerequisites",
        });
      }
    }

    const milestoneNodes = nodes.filter((n) => n.is_milestone);
    for (const milestone of milestoneNodes) {
      if (milestone.status === "pending") {
        const prereqNodes = nodes.filter((n) =>
          milestone.prerequisites.includes(n.id),
        );
        const completedPrereqs = prereqNodes.filter(
          (n) => n.status === "completed",
        ).length;
        const totalPrereqs = prereqNodes.length;

        if (totalPrereqs > 0 && completedPrereqs === totalPrereqs) {
          recommendations.push({
            type: "milestone",
            priority: "medium",
            node_id: milestone.id,
            title: `里程碑已就绪：${milestone.title}`,
            description: "所有前置知识点已完成，可以开始学习这个里程碑",
            action: "start_learning",
          });
        }
      }
    }

    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return recommendations.slice(0, 10);
  }

  async createLearningPathMainTask(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { count } = await supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 0)
      .is("deleted_at", null);

    const { data: nodes } = await supabase
      .from("learning_path_nodes")
      .select("estimated_time")
      .eq("path_id", pathId);

    const totalEstimatedTime =
      nodes?.reduce((sum, n) => sum + (n.estimated_time || 0), 0) || 0;

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: `[学习路径] ${path.title}`,
        description: path.description || path.goal || "学习路径任务",
        queue_level: 0,
        position: count ?? 0,
        estimated_duration: totalEstimatedTime,
        task_type: "learning",
        status: "pending",
        scheduled_start: options?.scheduled_start,
        scheduled_end: options?.scheduled_end,
        context: JSON.stringify({
          type: "learning_path",
          path_id: pathId,
          path_title: path.title,
        }),
      })
      .select("id")
      .single();

    if (taskError) {
      logger.error("createLearningPathMainTask error:", taskError);
      throw new AppError("创建主任务失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    return task.id;
  }

  async convertNodeToSubtask(
    supabase: SupabaseClient,
    parentTaskId: string,
    nodeId: string,
    userId: string,
    position: number,
  ): Promise<string> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        title,
        description,
        estimated_time,
        knowledge_point_id,
        order_index,
        learning_paths!inner(user_id)
      `,
      )
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      throw new AppError("节点不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      throw new AppError("无权访问此节点", 403, ErrorCodes.FORBIDDEN);
    }

    const { data: subtask, error: subtaskError } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: parentTaskId,
        title: node.title,
        description: node.description,
        status: "pending",
        priority: node.order_index,
        position: position,
        estimated_duration: node.estimated_time,
        learning_path_node_id: node.id,
      })
      .select("id")
      .single();

    if (subtaskError) {
      logger.error("convertNodeToSubtask error:", subtaskError);
      throw new AppError("创建子任务失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    return subtask.id;
  }

  async convertNodeToTask(
    supabase: SupabaseClient,
    nodeId: string,
    userId: string,
    options?: {
      queue_level?: number;
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        title,
        description,
        estimated_time,
        knowledge_point_id,
        order_index,
        learning_paths!inner(user_id)
      `,
      )
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      throw new AppError("节点不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      throw new AppError("无权访问此节点", 403, ErrorCodes.FORBIDDEN);
    }

    const { count } = await supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", options?.queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: `[学习] ${node.title}`,
        description: node.description,
        queue_level: options?.queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: node.estimated_time,
        knowledge_point_id: node.knowledge_point_id,
        task_type: "learning",
        status: "pending",
        scheduled_start: options?.scheduled_start,
        scheduled_end: options?.scheduled_end,
        context: `学习路径节点 #${node.order_index + 1}`,
      })
      .select("id")
      .single();

    if (taskError) {
      logger.error("convertNodeToTask error:", taskError);
      throw new AppError("创建任务失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    await supabase.from("task_knowledge_points").insert({
      task_id: task.id,
      knowledge_point_id: node.knowledge_point_id,
      is_primary: true,
      relevance_score: 100,
    });

    return task.id;
  }

  async autoSchedulePath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      daily_minutes?: number;
    },
  ): Promise<{
    main_task_id: string;
    subtask_ids: string[];
    total_tasks: number;
    estimated_days: number;
  }> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .in("status", ["pending", "in_progress"])
      .order("order_index", { ascending: true });

    if (nodesError) {
      logger.error("autoSchedulePath nodes error:", nodesError);
      throw nodesError;
    }

    if (!nodes || nodes.length === 0) {
      return {
        main_task_id: "",
        subtask_ids: [],
        total_tasks: 0,
        estimated_days: 0,
      };
    }

    const dailyMinutes =
      options?.daily_minutes ?? path.daily_minutes_target ?? 30;
    const startDate = options?.start_date
      ? new Date(options.start_date)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const knowledgePointToNodeMap = new Map<string, string>();
    nodes.forEach((node) => {
      if (node.knowledge_point_id) {
        knowledgePointToNodeMap.set(node.knowledge_point_id, node.id);
      }
    });

    const nodeDependencies = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (node.prerequisites && node.prerequisites.length > 0) {
        const nodePrereqs = node.prerequisites
          .map((kpId: string) => knowledgePointToNodeMap.get(kpId))
          .filter((id: string | undefined): id is string => !!id);
        if (nodePrereqs.length > 0) {
          nodeDependencies.set(node.id, nodePrereqs);
        }
      }
    });

    const completedNodes = new Set<string>();
    const scheduledNodes = new Set<string>();

    const { data: timeSlots, error: slotsError } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", userId)
      .eq("is_available", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotsError) {
      logger.error("autoSchedulePath time slots error:", slotsError);
    }

    const getAvailableSlots = (
      date: Date,
    ): Array<{
      start: Date;
      end: Date;
      duration: number;
    }> => {
      const dayOfWeek = date.getDay();

      if (!timeSlots || timeSlots.length === 0) {
        const defaultStart = new Date(date);
        defaultStart.setHours(9, 0, 0, 0);
        const defaultEnd = new Date(date);
        defaultEnd.setHours(21, 0, 0, 0);
        return [
          {
            start: defaultStart,
            end: defaultEnd,
            duration: 12 * 60,
          },
        ];
      }

      const slots = timeSlots.filter(
        (slot) => slot.day_of_week === null || slot.day_of_week === dayOfWeek,
      );

      return slots.map((slot) => {
        const [startHour, startMin] = slot.start_time.split(":").map(Number);
        const [endHour, endMin] = slot.end_time.split(":").map(Number);
        const start = new Date(date);
        start.setHours(startHour, startMin, 0, 0);
        const end = new Date(date);
        end.setHours(endHour, endMin, 0, 0);
        return {
          start,
          end,
          duration: (end.getTime() - start.getTime()) / (1000 * 60),
        };
      });
    };

    const canScheduleNode = (nodeId: string): boolean => {
      const deps = nodeDependencies.get(nodeId);
      if (!deps || deps.length === 0) return true;
      return deps.every(
        (depId: string) =>
          completedNodes.has(depId) || scheduledNodes.has(depId),
      );
    };

    let currentDate = new Date(startDate);
    let currentDayMinutes = 0;
    let currentSlotIndex = 0;
    let currentSlots = getAvailableSlots(currentDate);
    let estimatedDays = 1;
    let finalScheduledEnd: Date | null = null;

    const topologicalSort = (
      nodesToSort: LearningPathNode[],
    ): LearningPathNode[] => {
      const result: LearningPathNode[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();
      const nodeMap = new Map(nodesToSort.map((n) => [n.id, n]));

      const visit = (nodeId: string): boolean => {
        if (visited.has(nodeId)) return true;
        if (visiting.has(nodeId)) return false;

        visiting.add(nodeId);
        const node = nodeMap.get(nodeId);
        if (node && node.prerequisites) {
          for (const depId of node.prerequisites) {
            if (!visit(depId)) return false;
          }
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
        if (node) result.push(node);
        return true;
      };

      for (const node of nodesToSort) {
        visit(node.id);
      }

      return result;
    };

    const sortedNodes = topologicalSort(nodes);

    for (const node of sortedNodes) {
      if (!canScheduleNode(node.id)) {
        const pendingDeps = (node.prerequisites || []).filter(
          (depId: string) =>
            !completedNodes.has(depId) && !scheduledNodes.has(depId),
        );
        logger.warn(
          `Node ${node.id} has unmet dependencies: ${pendingDeps.join(", ")}`,
        );
        continue;
      }

      const nodeDuration = node.estimated_time ?? 30;

      if (
        currentSlots.length === 0 ||
        currentSlotIndex >= currentSlots.length
      ) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDayMinutes = 0;
        currentSlotIndex = 0;
        currentSlots = getAvailableSlots(currentDate);
        estimatedDays++;
      }

      let remainingDuration = nodeDuration;
      let scheduledStart: Date | null = null;
      let scheduledEnd: Date | null = null;

      while (remainingDuration > 0) {
        if (currentSlotIndex >= currentSlots.length) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDayMinutes = 0;
          currentSlotIndex = 0;
          currentSlots = getAvailableSlots(currentDate);
          estimatedDays++;
        }

        const slot = currentSlots[currentSlotIndex];
        if (!slot) break;

        const availableMinutes = slot.duration - currentDayMinutes;

        if (availableMinutes <= 0) {
          currentSlotIndex++;
          currentDayMinutes = 0;
          continue;
        }

        if (!scheduledStart) {
          scheduledStart = new Date(
            slot.start.getTime() + currentDayMinutes * 60 * 1000,
          );
        }

        const allocatedMinutes = Math.min(availableMinutes, remainingDuration);
        currentDayMinutes += allocatedMinutes;
        remainingDuration -= allocatedMinutes;

        scheduledEnd = new Date(
          slot.start.getTime() + currentDayMinutes * 60 * 1000,
        );

        if (currentDayMinutes >= slot.duration) {
          currentSlotIndex++;
          currentDayMinutes = 0;
        }

        if (currentDayMinutes >= dailyMinutes) {
          currentSlotIndex++;
          currentDayMinutes = 0;
        }
      }

      if (scheduledStart && scheduledEnd) {
        finalScheduledEnd = scheduledEnd;
        scheduledNodes.add(node.id);
      }
    }

    const mainTaskId = await this.createLearningPathMainTask(
      supabase,
      pathId,
      userId,
      {
        scheduled_start: startDate.toISOString(),
        scheduled_end: finalScheduledEnd?.toISOString(),
      },
    );

    const subtaskIds: string[] = [];
    let position = 0;

    for (const node of sortedNodes) {
      if (scheduledNodes.has(node.id)) {
        const subtaskId = await this.convertNodeToSubtask(
          supabase,
          mainTaskId,
          node.id,
          userId,
          position,
        );
        subtaskIds.push(subtaskId);
        position++;
      }
    }

    return {
      main_task_id: mainTaskId,
      subtask_ids: subtaskIds,
      total_tasks: subtaskIds.length,
      estimated_days: estimatedDays,
    };
  }

  async syncProgressWithTask(
    supabase: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<{
    node_updated: boolean;
    path_progress: LearningPathProgressSummary | null;
    path_completed: boolean;
  }> {
    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (taskError || !task) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (task.status !== "completed") {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    if (!task.knowledge_point_id) {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        knowledge_point_id,
        status,
        learning_paths!inner(user_id)
      `,
      )
      .eq("knowledge_point_id", task.knowledge_point_id)
      .eq("status", "in_progress")
      .single();

    if (nodeError || !node) {
      const { data: pendingNode } = await supabase
        .from("learning_path_nodes")
        .select(
          `
          id,
          path_id,
          knowledge_point_id,
          status,
          learning_paths!inner(user_id)
        `,
        )
        .eq("knowledge_point_id", task.knowledge_point_id)
        .eq("status", "pending")
        .single();

      if (!pendingNode) {
        return {
          node_updated: false,
          path_progress: null,
          path_completed: false,
        };
      }

      const pathData = Array.isArray(pendingNode.learning_paths)
        ? pendingNode.learning_paths[0]
        : pendingNode.learning_paths;
      if (!pathData || pathData.user_id !== userId) {
        return {
          node_updated: false,
          path_progress: null,
          path_completed: false,
        };
      }

      await this.updateNodeStatus(
        supabase,
        pendingNode.path_id,
        pendingNode.id,
        userId,
        {
          status: "completed",
          time_spent: task.actual_duration ?? task.estimated_duration,
          progress_percentage: 100,
        },
      );

      const progress = await this.getPathProgress(
        supabase,
        pendingNode.path_id,
        userId,
      );

      return {
        node_updated: true,
        path_progress: progress,
        path_completed: progress.progress_percentage === 100,
      };
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    await this.updateNodeStatus(supabase, node.path_id, node.id, userId, {
      status: "completed",
      time_spent: task.actual_duration ?? task.estimated_duration,
      progress_percentage: 100,
    });

    const progress = await this.getPathProgress(supabase, node.path_id, userId);

    return {
      node_updated: true,
      path_progress: progress,
      path_completed: progress.progress_percentage === 100,
    };
  }

  async getCrossGraphProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<Record<string, LearningPathProgressSummary>> {
    const { data: nodes, error } = await supabase
      .from("learning_path_nodes")
      .select("id, status, estimated_time, graph_id")
      .eq("path_id", pathId);

    if (error || !nodes || nodes.length === 0) {
      return {};
    }

    const { data: progressData } = await supabase
      .from("learning_path_progress")
      .select("node_id, time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    const nodeTimeSpent = new Map<string, number>();
    (progressData || []).forEach((p) => {
      nodeTimeSpent.set(p.node_id, p.time_spent || 0);
    });

    const graphNodes = new Map<string, {
      total: number;
      completed: number;
      in_progress: number;
      pending: number;
      skipped: number;
      totalTimeSpent: number;
    }>();

    for (const node of nodes) {
      const graphId = node.graph_id ?? "unknown";
      if (!graphNodes.has(graphId)) {
        graphNodes.set(graphId, {
          total: 0, completed: 0, in_progress: 0,
          pending: 0, skipped: 0, totalTimeSpent: 0,
        });
      }
      const stats = graphNodes.get(graphId)!;
      stats.total++;
      stats.totalTimeSpent += nodeTimeSpent.get(node.id) ?? 0;

      switch (node.status) {
        case "completed": stats.completed++; break;
        case "in_progress": stats.in_progress++; break;
        case "skipped": stats.skipped++; break;
        default: stats.pending++;
      }
    }

    const result: Record<string, LearningPathProgressSummary> = {};
    graphNodes.forEach((stats, graphId) => {
      result[graphId] = {
        total_nodes: stats.total,
        completed_nodes: stats.completed,
        in_progress_nodes: stats.in_progress,
        pending_nodes: stats.pending,
        skipped_nodes: stats.skipped,
        total_time_spent: stats.totalTimeSpent,
        progress_percentage: stats.total > 0
          ? Math.round((stats.completed / stats.total) * 100)
          : 0,
      };
    });

    return result;
  }

  async getGraphMeta(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<{ title: string; description: string | null } | null> {
    const { data } = await supabase
      .from("knowledge_graphs")
      .select("title, description")
      .eq("id", graphId)
      .single();

    return data as { title: string; description: string | null } | null;
  }

  async generateAndSavePath(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    options: {
      target_goal?: string;
      target_knowledge_point_id?: string;
      learning_style: string;
      daily_time_minutes: number;
      current_knowledge?: string;
      provider?: string;
      model?: string;
      save_path?: boolean;
      path_title?: string;
    },
  ): Promise<LearningPathResult> {
    const {
      target_goal,
      target_knowledge_point_id,
      learning_style,
      daily_time_minutes,
      current_knowledge,
      provider: providerType,
      model,
      save_path,
      path_title,
    } = options;

    const { nodes, edges } = await graphService.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    if (nodes.length === 0) {
      throw new AppError("图谱中没有节点", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const graphMeta = await this.getGraphMeta(supabase, graphId);

    const progressMap = await buildProgressMap(supabase, userId, nodes);
    const { parentMap, childMap } = buildDependencyMaps(nodes, edges);

    let stages: LearningPathStage[];
    let suggestions: string[];
    let aiGenerated = false;

    if (target_goal) {
      const aiResult = await generateAIPath(
        supabase,
        userId,
        graphId,
        nodes,
        edges,
        progressMap,
        parentMap,
        childMap,
        target_goal,
        learning_style,
        daily_time_minutes,
        current_knowledge,
        graphMeta?.title || "",
        providerType,
        model,
      );
      stages = aiResult.stages;
      suggestions = aiResult.suggestions;
      aiGenerated = true;
    } else {
      const ruleResult = generateRulePath(
        nodes,
        edges,
        progressMap,
        parentMap,
        childMap,
        target_knowledge_point_id,
        daily_time_minutes,
      );
      stages = ruleResult.stages;
      suggestions = ruleResult.suggestions;
    }

    const todayPlan = buildTodayPlan(stages, daily_time_minutes);
    const totalEstimatedTime = stages.reduce(
      (sum, s) => sum + s.estimatedTime,
      0,
    );
    const completedCount = stages.filter((s) => s.isCompleted).length;
    const estimatedDays = Math.ceil(totalEstimatedTime / daily_time_minutes);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + estimatedDays);

    const weeklyProgress = calculateWeeklyProgress(
      daily_time_minutes,
      totalEstimatedTime,
    );

    const learningPath: LearningPathResult = {
      graphId,
      graphTitle: graphMeta?.title || "未命名图谱",
      totalNodes: nodes.length,
      completedNodes: completedCount,
      estimatedTotalTime: totalEstimatedTime,
      stages,
      todayPlan,
      predictions: {
        completionDate: completionDate.toISOString(),
        weeklyProgress,
        recommendedDailyTime: Math.min(
          60,
          Math.ceil(totalEstimatedTime / 14),
        ),
      },
      suggestions,
      aiGenerated,
      targetGoal: target_goal,
    };

    if (save_path) {
      const validStages = stages.filter((stage) => {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            stage.nodeId,
          );
        return isUuid;
      });

      if (validStages.length === 0) {
        throw new AppError(
          "AI 生成的学习路径无法匹配到图谱中的知识点，请重试",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const savedPath = await this.createLearningPath(
        supabase,
        userId,
        {
          title: path_title || `${graphMeta?.title || "图谱"}学习路径`,
          goal: target_goal,
          source_graph_id: graphId,
          total_estimated_time: totalEstimatedTime,
          ai_generated: aiGenerated,
          daily_minutes_target: daily_time_minutes,
          nodes: validStages.map((stage, index) => ({
            knowledge_point_id: stage.nodeId,
            order_index: index,
            title: stage.nodeTitle,
            description: stage.reason,
            estimated_time: stage.estimatedTime,
            is_milestone: stage.priority === "high",
            prerequisites: stage.prerequisites.filter((id) =>
              uuidPattern.test(id),
            ),
          })),
        },
      );

      learningPath.id = savedPath.id;
      learningPath.savedPath = savedPath;
    }

    return learningPath;
  }
}

export const learningPathService = new LearningPathService();
