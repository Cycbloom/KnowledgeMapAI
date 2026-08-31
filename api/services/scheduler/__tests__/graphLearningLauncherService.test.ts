import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockSupabase,
  type MockSupabaseClient,
} from "../../../../tests/helpers/mockFactories";

// 学习路径生成依赖 AI 服务，测试中 mock 掉（规则路径无需 AI，但 generateAndSavePath 需 AI provider）
vi.mock("../../study/learningPathService", () => ({
  learningPathService: {
    generateAndSavePath: vi.fn().mockResolvedValue({
      savedPath: { id: "path-1", title: "学习路径" },
    }),
  },
}));

import { learningPathService } from "../../study/learningPathService";
import { graphLearningLauncherService } from "../graphLearningLauncherService";

/**
 * 构造一个按表名返回数据的 mock supabase（用于多步查询）。
 * from 的每次调用都返回独立的 chain，data 来自 dataByFrom[table]。
 */
function buildMockSupabase(dataByFrom: Record<string, unknown>): MockSupabaseClient {
  const client = createMockSupabase() as unknown as MockSupabaseClient;
  const inner = client as unknown as MockSupabaseClient;

  inner.from.mockImplementation((table: string) => {
    const data = dataByFrom[table] ?? null;
    const chainClient = createMockSupabase({ data }) as unknown as MockSupabaseClient;
    return chainClient._queryChain;
  });

  return client;
}

// 真实 smartTaskLinker.getOrCreateTaskForGraph 需要的 graph 数据
const graphRow = {
  id: "graph-1",
  title: "测试图谱",
  task_id: "graph-task-1",
  user_id: "user-1",
};

const graphNodes = [
  { knowledge_point_id: "kp-a", knowledge_points: [{ id: "kp-a", title: "A" }] },
  { knowledge_point_id: "kp-b", knowledge_points: [{ id: "kp-b", title: "B" }] },
];

const existingSubtasks = [
  {
    id: "st-a",
    title: "A",
    knowledge_point_id: "kp-a",
    learning_path_node_id: null,
    learning_state: "learning",
    position: 0,
    status: "pending",
  },
  {
    id: "st-b",
    title: "B",
    knowledge_point_id: "kp-b",
    learning_path_node_id: null,
    learning_state: "learning",
    position: 1,
    status: "pending",
  },
];

describe("GraphLearningLauncherService (S2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无 active 路径时自动生成路径，并将子任务按路径顺序重排", async () => {
    const supabase = buildMockSupabase({
      knowledge_graphs: graphRow, // smartTaskLinker 读取图谱
      graph_nodes: graphNodes, // smartTaskLinker 读取节点
      task_subtasks: existingSubtasks, // syncSubtasksForNodes 查询 + 后续重排
      learning_paths: null, // 无 active 路径 → 自动生成
      learning_path_nodes: [
        { id: "pn-b", knowledge_point_id: "kp-b", order_index: 0 },
        { id: "pn-a", knowledge_point_id: "kp-a", order_index: 1 },
      ],
    });

    const result = await graphLearningLauncherService.startLearningForGraph(
      supabase as never,
      "user-1",
      "graph-1",
      { daily_minutes: 30 },
    );

    expect(learningPathService.generateAndSavePath).toHaveBeenCalled();
    expect(result.graphTaskId).toBe("graph-task-1");
    expect(result.pathId).toBe("path-1");
    expect(result.pathReused).toBe(false);
    expect(result.totalTasks).toBe(2);
  });

  it("存在 active 路径时复用，不重复生成", async () => {
    const supabase = buildMockSupabase({
      knowledge_graphs: graphRow,
      graph_nodes: graphNodes,
      task_subtasks: existingSubtasks,
      learning_paths: { id: "path-exist", title: "已有路径" },
      learning_path_nodes: [
        { id: "pn-b", knowledge_point_id: "kp-b", order_index: 0 },
        { id: "pn-a", knowledge_point_id: "kp-a", order_index: 1 },
      ],
    });

    const result = await graphLearningLauncherService.startLearningForGraph(
      supabase as never,
      "user-1",
      "graph-1",
    );

    expect(learningPathService.generateAndSavePath).not.toHaveBeenCalled();
    expect(result.pathId).toBe("path-exist");
    expect(result.pathReused).toBe(true);
    expect(result.totalTasks).toBe(2);
  });
});