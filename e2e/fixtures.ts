import { test as base, expect, type Page } from "@playwright/test";
import { authedRequest, loginAsOwner } from "./utils/auth";

/**
 * 测试图谱数据（由 testGraph fixture 通过 API 创建）。
 */
type TestGraph = {
  id: string;
  title: string;
};

/**
 * 自定义 Fixtures 类型。
 */
type CustomFixtures = {
  authenticatedPage: Page;
  testGraph: TestGraph;
  topicResearchGraph: TestGraph;
  cleanDb: void;
};

/**
 * 专题研究图谱的骨干节点标准标题。
 */
const BACKBONE_NODE_TITLES = [
  "研究背景",
  "文献综述",
  "研究方法",
  "核心概念",
  "应用领域",
  "未来方向",
];

/**
 * 通过 API 创建带骨干节点的专题研究图谱。
 *
 * 1. POST /api/graphs（template_type: "topic_research"）创建图谱 + 模块配置
 * 2. POST /api/auto-graph/save-nodes 保存 root + 6 个 core 骨干节点
 */
async function createTopicResearchGraph(
  page: Page,
  title: string,
): Promise<TestGraph> {
  // 步骤 1: 创建图谱
  const createRes = await authedRequest(page, "POST", "/api/graphs", {
    title,
    template_type: "topic_research",
  });
  expect(
    createRes.ok,
    `创建专题研究图谱失败: HTTP ${createRes.status}`,
  ).toBe(true);
  const graph = createRes.body as TestGraph;

  // 步骤 2: 保存骨干节点（1 root + 6 core）
  const rootId = crypto.randomUUID();
  const nodes = [
    { id: rootId, title, level: "root", content: `${title}的根节点` },
    ...BACKBONE_NODE_TITLES.map((nodeTitle) => ({
      title: nodeTitle,
      level: "core" as const,
      content: `${nodeTitle}的内容`,
      parentId: rootId,
    })),
  ];

  const saveRes = await authedRequest(
    page,
    "POST",
    "/api/auto-graph/save-nodes",
    { graph_id: graph.id, nodes },
  );
  expect(
    saveRes.ok,
    `保存骨干节点失败: HTTP ${saveRes.status}`,
  ).toBe(true);

  return graph;
}

export const test = base.extend<CustomFixtures>({
  /**
   * 已登录的 Page。
   *
   * 通过导航到 `/` 触发无感知会话（恢复/创建专属用户），等待认证 API 请求返回 200。
   */
  authenticatedPage: async ({ page }, use) => {
    await loginAsOwner(page);
    await page.waitForLoadState("load");
    await use(page);
  },

  /**
   * 通过 API 创建的测试图谱（无模板）。
   *
   * App Action 模式:用 API 做准备（快），用 UI 做断言（真实）。
   * 依赖 `authenticatedPage` 以复用登录后的 token。
   *
   * 测试结束后永久删除图谱,避免污染测试库。
   */
  testGraph: async ({ authenticatedPage: page }, use) => {
    const title = `测试图谱_${Date.now()}`;
    const response = await authedRequest(page, "POST", "/api/graphs", {
      title,
    });
    expect(
      response.ok,
      `创建测试图谱失败: HTTP ${response.status}`,
    ).toBe(true);
    const graph = response.body as TestGraph;
    await use(graph);
    // 清理:永久删除（DELETE /api/graphs/:id/permanent 直接物理删除）。
    await authedRequest(page, "DELETE", `/api/graphs/${graph.id}/permanent`);
  },

  /**
   * 通过 API 创建的专题研究图谱（含骨干节点）。
   *
   * App Action 模式:用 API 创建图谱 + 骨干节点,跳过 UI 创建流程。
   * 测试结束后永久删除图谱。
   */
  topicResearchGraph: async ({ authenticatedPage: page }, use) => {
    const title = `专题研究测试_${Date.now()}`;
    const graph = await createTopicResearchGraph(page, title);
    await use(graph);
    // 清理:永久删除图谱（关联的节点和模块通过 CASCADE 自动删除）。
    await authedRequest(page, "DELETE", `/api/graphs/${graph.id}/permanent`);
  },

  /**
   * 占位 fixture:当前开发环境不自动清库。
   */
  cleanDb: async ({}, use) => {
    await use(undefined);
  },
});

export { expect };
