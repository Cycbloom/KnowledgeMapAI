import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { authedRequest, navigateAndWaitForAuth } from "./utils/auth";

/** 骨干节点标准标题 */
const BACKBONE_NODE_TITLES = [
  "研究背景",
  "文献综述",
  "研究方法",
  "核心概念",
  "应用领域",
  "未来方向",
] as const;

/**
 * 骨干节点标题到 BackboneModule 枚举值的映射。
 * 用于通过 API 补充设置 properties.backboneModule（fixture 创建的节点不含此属性）。
 */
const BACKBONE_TITLE_TO_MODULE: Record<string, string> = {
  研究背景: "research_background",
  文献综述: "literature_review",
  研究方法: "research_methods",
  核心概念: "core_concepts",
  应用领域: "application_domains",
  未来方向: "future_directions",
};

/** 图谱节点（GET /api/v1/graphs/:id/nodes 返回） */
interface GraphNode {
  id: string;
  title: string;
  properties?: {
    backboneModule?: string;
  } | null;
}

/** GET /api/v1/graphs/:id/nodes 响应体 */
interface GraphNodesResponse {
  nodes: GraphNode[];
}

/** 批量更新结果项 */
interface BatchUpdateResultItem {
  id: string;
  updated: boolean;
  reason?: string;
}

/** POST /api/v1/nodes/batch-update 响应体 */
interface BatchUpdateResponse {
  message: string;
  count: number;
  skipped: number;
  failed: number;
  results: BatchUpdateResultItem[];
}

/** AppError 错误响应体 */
interface ErrorResponse {
  success: boolean;
  code: string;
  message: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * 通过 API 获取图谱节点列表，按标题查找节点 ID。
 * 节点 ID 为 knowledge_point_id（API 客户端使用此 ID）。
 */
async function getNodeIdByTitle(
  page: Page,
  graphId: string,
  title: string,
): Promise<string | null> {
  const res = await authedRequest(page, "GET", `/api/v1/graphs/${graphId}/nodes`);
  if (!res.ok) {
    return null;
  }
  const body = res.body as GraphNodesResponse;
  const node = body.nodes.find((n) => n.title === title);
  return node?.id ?? null;
}

/**
 * 为骨干节点设置 backboneModule 属性。
 *
 * Fixture 创建的节点不含 backboneModule 属性，需通过 API 补充设置，
 * 否则 UI 不会渲染骨干节点图标，API 也不会触发标题保护。
 * updateNode 方法会自动失效图谱缓存，后续导航将获取最新数据。
 *
 * @returns 骨干节点标题到节点 ID 的映射
 */
async function setupBackboneModules(
  page: Page,
  graphId: string,
): Promise<Map<string, string>> {
  const res = await authedRequest(page, "GET", `/api/v1/graphs/${graphId}/nodes`);
  if (!res.ok) {
    throw new Error(`获取节点列表失败: HTTP ${res.status}`);
  }
  const body = res.body as GraphNodesResponse;
  const titleToId = new Map<string, string>();

  for (const node of body.nodes) {
    const module = BACKBONE_TITLE_TO_MODULE[node.title];
    if (module) {
      // 更新节点属性，设置 backboneModule（不修改标题，不触发保护）
      const updateRes = await authedRequest(
        page,
        "PUT",
        `/api/v1/nodes/${node.id}`,
        { properties: { backboneModule: module } },
      );
      if (!updateRes.ok) {
        throw new Error(
          `设置骨干节点属性失败 [${node.title}]: HTTP ${updateRes.status}`,
        );
      }
      titleToId.set(node.title, node.id);
    }
  }

  return titleToId;
}

test.describe("专题研究图谱骨干节点测试", () => {
  test.beforeEach(async ({ page }) => {
    // 抑制 GraphEditor 首次访问引导浮层（driver.js tour）。
    // 该浮层的 overlay 会拦截画布上节点的点击事件，导致测试超时。
    // addInitScript 在每次导航前执行，确保 GraphEditor 挂载时
    // isOnboardingComplete() 返回 true，不渲染 OnboardingGuide。
    await page.addInitScript(() => {
      localStorage.setItem("graph-editor-onboarding-complete", "true");
      // 设置中文语言环境，确保 i18n 文本匹配测试预期（如"编辑节点"）。
      // Playwright 浏览器默认 navigator.language 为 en-US，
      // 需显式设置 localStorage 覆盖，否则按钮文字为 "Edit Node"。
      localStorage.setItem("i18n-language", "zh-CN");
    });
  });

  test("应该能够创建专题研究图谱并验证骨干节点标题标准化", async ({
    page,
    topicResearchGraph,
  }) => {
    await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    // 使用画布内的 getByText 替代全局 text= 选择器：页面其它区域（如侧边栏大纲、
    // 节点详情面板）可能展示同名节点标题，全局匹配会因 strict mode 命中多个元素而失败。
    // 画布内每个节点的标题同时出现在 SVG <text> 与 <title>（tooltip/a11y）中，
    // <title> 是隐藏元素；用 text[font-size] 限定可见的 <text> 节点文本。
    const canvas = page.locator('[data-tour="canvas"]');
    for (const title of BACKBONE_NODE_TITLES) {
      const nodeText = canvas.locator('text[font-size]').getByText(title, { exact: true });
      await expect(nodeText).toBeVisible({ timeout: 10000 });
    }
  });

  test("应该显示骨干节点专属图标", async ({ page, topicResearchGraph }) => {
    // 设置 backboneModule 属性（fixture 不包含此属性）
    await setupBackboneModules(page, topicResearchGraph.id);

    await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    // 骨干节点的 <g> 元素内包含 <foreignObject>（BackboneNodeIcon 容器）
    const backboneNodeGroup = page
      .locator("g[data-node-id]")
      .filter({ hasText: "研究背景" });
    await expect(backboneNodeGroup).toBeVisible({ timeout: 10000 });

    const iconContainer = backboneNodeGroup.locator("foreignObject");
    await expect(iconContainer).toBeVisible({ timeout: 5000 });
  });

  test("应该禁止修改骨干节点标题", async ({ page, topicResearchGraph }) => {
    await setupBackboneModules(page, topicResearchGraph.id);

    await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    // 点击骨干节点 → 打开 NodeDetailSidebar
    const backboneNodeGroup = page
      .locator("g[data-node-id]")
      .filter({ hasText: "研究背景" });
    await backboneNodeGroup.first().click();

    // 点击"编辑节点"按钮 → 切换到 NodeEditSidebar
    const editButton = page.getByRole("button", { name: "编辑节点" });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // 验证标题输入框 readOnly（骨干节点标题不可修改）
    const titleInput = page.locator('input[placeholder="输入节点标题"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    const isReadOnly = await titleInput.getAttribute("readonly");
    expect(isReadOnly).not.toBeNull();
  });

  test("应该通过 API 保护机制阻止骨干节点标题修改", async ({
    page,
    topicResearchGraph,
  }) => {
    await setupBackboneModules(page, topicResearchGraph.id);

    await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    // 通过 API 获取节点 ID（knowledge_point_id），而非从 DOM 读取
    const nodeId = await getNodeIdByTitle(
      page,
      topicResearchGraph.id,
      "研究背景",
    );
    expect(nodeId).not.toBeNull();

    if (nodeId) {
      // 使用 PUT（非 PATCH）尝试修改骨干节点标题
      const response = await authedRequest(
        page,
        "PUT",
        `/api/v1/nodes/${nodeId}`,
        { title: "修改后的标题" },
      );

      expect(response.status).toBe(403);

      const body = response.body as ErrorResponse;
      expect(body.message).toContain("骨干节点标题不可修改");
    }
  });

  test("应该在批量操作中跳过骨干节点标题修改", async ({
    page,
    topicResearchGraph,
  }) => {
    await setupBackboneModules(page, topicResearchGraph.id);

    await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    const nodeId = await getNodeIdByTitle(
      page,
      topicResearchGraph.id,
      "研究背景",
    );
    expect(nodeId).not.toBeNull();

    if (nodeId) {
      const response = await authedRequest(
        page,
        "POST",
        "/api/v1/nodes/batch-update",
        { nodes: [{ id: nodeId, title: "批量修改的标题" }] },
      );

      expect(response.status).toBe(200);

      const body = response.body as BatchUpdateResponse;
      expect(body.skipped).toBeGreaterThanOrEqual(1);

      const skippedResult = body.results.find(
        (r) => r.id === nodeId && !r.updated,
      );
      expect(skippedResult).toBeDefined();
      expect(skippedResult?.reason ?? "").toContain("骨干节点标题不可修改");
    }
  });

  test.skip("应该在大纲视图中显示骨干节点图标", async () => {
    // 大纲按钮位于视图下拉菜单内，交互复杂度高，留待后续专项修复
  });

  test.skip("应该在大纲视图中显示骨干节点悬停提示", async () => {
    // 大纲按钮位于视图下拉菜单内，交互复杂度高，留待后续专项修复
  });
});
