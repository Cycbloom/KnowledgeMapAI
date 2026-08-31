/**
 * 学习/答题跳转 URL 统一构建工具。
 * 供子任务行与概览 Tab 复用，避免散落拼接。
 */

const buildQuery = (params: Record<string, string>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

const withGraph = (graphId?: string): { graph_id?: string } =>
  graphId ? { graph_id: graphId } : {};

/** 学习材料（学习模式阅读） */
export const learningMaterialUrl = (nodeId: string, graphId?: string): string =>
  `/learning${buildQuery({ node_id: nodeId, ...withGraph(graphId) })}`;

/** 学习中心，打开该知识点 */
export const studyCenterUrl = (nodeId: string, graphId?: string): string =>
  `/study${buildQuery({ node_id: nodeId, ...withGraph(graphId) })}`;

/** 为单个知识点创建题目 */
export const createQuizForKp = (nodeId: string, graphId?: string): string =>
  `/study${buildQuery({
    node_id: nodeId,
    view: "quizzes",
    create: "1",
    ...withGraph(graphId),
  })}`;

/** 面向多个知识点创建测验（用户在图内自选），跳转图谱级创建流程 */
export const createQuizForGraph = (graphId?: string): string =>
  `/study${buildQuery({
    view: "quizzes",
    create: "1",
    ...withGraph(graphId),
  })}`;

/** 为多个知识点创建跨知识点测验 */
export const createQuizForKps = (kpIds: string[], graphId?: string): string =>
  `/study${buildQuery({
    node_ids: kpIds.join(","),
    create: "1",
    ...withGraph(graphId),
  })}`;