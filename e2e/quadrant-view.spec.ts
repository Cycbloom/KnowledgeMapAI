import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { authedRequest, navigateAndWaitForAuth } from "./utils/auth";

/**
 * 通过 API 创建测试节点（1 root + 3 leaf），用于象限视图测试。
 *
 * 创建 root + leaf 节点，使 computeRegions 按级别分组生成 2 个区域
 * （"根节点" 和 "叶节点"），且节点在象限视图中可见（core 级别被过滤）。
 */
async function createNodesForQuadrant(
  page: Page,
  graphId: string,
): Promise<void> {
  const rootId = crypto.randomUUID();
  const nodes = [
    { id: rootId, title: "测试根节点", level: "root", content: "根节点内容" },
    ...Array.from({ length: 3 }, (_, i) => ({
      title: `测试叶节点${i + 1}`,
      level: "leaf" as const,
      content: `叶节点${i + 1}内容`,
      parentId: rootId,
    })),
  ];
  await authedRequest(page, "POST", "/api/v1/auto-graph/save-nodes", {
    graph_id: graphId,
    nodes,
  });
}

/**
 * 切换到象限视图。
 *
 * GraphToolbar 的视图模式位于"视图 / View"下拉菜单内，
 * 需先点击下拉按钮展开菜单，再点击"象限 / Quadrant"菜单项。
 * 桌面端使用 i18n 标签（en-US: "View" / "Quadrant"）。
 */
async function switchToQuadrantView(page: Page): Promise<void> {
  const viewDropdown = page.getByRole("button", { name: /^视图$|^View$/ });
  await viewDropdown.click();
  const quadrantItem = page.getByRole("button", { name: /^象限$|^Quadrant$/ });
  await quadrantItem.click();
  await page.waitForTimeout(500);
}

/**
 * 切换到思维导图视图。
 */
async function switchToMindmapView(page: Page): Promise<void> {
  const viewDropdown = page.getByRole("button", { name: /^视图$|^View$/ });
  await viewDropdown.click();
  const mindmapItem = page.getByRole("button", {
    name: /^思维导图$|^Mind Map$/,
  });
  await mindmapItem.click();
  await page.waitForTimeout(500);
}

test.describe("象限视图测试", () => {
  test.beforeEach(async ({ page }) => {
    // 抑制 GraphEditor 首次访问引导浮层（driver.js tour）。
    // 该浮层的 overlay 会拦截画布上节点的点击事件，导致测试超时。
    await page.addInitScript(() => {
      localStorage.setItem("graph-editor-onboarding-complete", "true");
    });
  });

  test("应该能够打开图谱并切换到象限视图", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    // MindMapCanvas 与 QuadrantCanvas 的 <svg> 均使用 width="100%" height="100%"，
    // 工具栏 lucide 图标使用固定尺寸（如 width="20"），以此精确定位画布 SVG。
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const quadrantSvg = page.locator('svg[width="100%"][height="100%"]');
    await expect(quadrantSvg).toBeVisible({ timeout: 5000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("象限视图应该显示区域和节点", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const svg = page.locator('svg[width="100%"][height="100%"]');
    await expect(svg).toBeVisible({ timeout: 5000 });
    const circles = svg.locator("circle");
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够点击节点", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const node = page.locator("g[data-node-id]").first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click();
    await page.waitForTimeout(300);

    await expect(node).toBeVisible();

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够拖拽原点", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const origin = page.locator("[data-origin]");
    await expect(origin).toBeVisible({ timeout: 5000 });
    const boundingBox = await origin.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2 + 50,
        boundingBox.y + boundingBox.height / 2 + 50,
      );
      await page.mouse.up();

      await expect(origin).toBeVisible();
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够使用缩放控制", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    // QuadrantCanvas 的缩放指示器使用硬编码中文 "缩放: NN%"
    const zoomIndicator = page.locator("text=/缩放.*%/");
    await expect(zoomIndicator).toBeVisible({ timeout: 5000 });

    // QuadrantCanvas 底部右侧有 3 个缩放按钮（放大、缩小、重置）
    const zoomButtons = page.locator(
      ".absolute.bottom-4.right-4 button:has(svg)",
    );
    const buttonCount = await zoomButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);

    await zoomButtons.nth(0).click();
    await page.waitForTimeout(200);

    await zoomButtons.nth(1).click();
    await page.waitForTimeout(200);

    await zoomButtons.nth(2).click();
    await page.waitForTimeout(200);

    await expect(zoomIndicator).toBeVisible();

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够使用鼠标滚轮缩放", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const svg = page.locator('svg[width="100%"][height="100%"]');
    await expect(svg).toBeVisible({ timeout: 5000 });
    const boundingBox = await svg.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2,
      );

      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(200);

      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(200);

      await expect(svg).toBeVisible();
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够拖拽画布", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const svg = page.locator('svg[width="100%"][height="100%"]');
    await expect(svg).toBeVisible({ timeout: 5000 });
    const boundingBox = await svg.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      const startX = boundingBox.x + 100;
      const startY = boundingBox.y + 100;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 100);
      await page.mouse.up();

      await expect(svg).toBeVisible();
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("象限视图应该正确显示节点状态", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page.locator("g[data-node-id]").first().waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    const nodes = page.locator("g[data-node-id]");
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    const firstNode = nodes.first();
    const circle = firstNode.locator("circle");
    const hasCircle = await circle.count();
    expect(hasCircle).toBeGreaterThan(0);

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够从象限视图切换回其他视图", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 创建节点以确保 MindMapCanvas 渲染 <svg>（无节点时显示空状态 div，无 SVG）
    await createNodesForQuadrant(page, testGraph.id);
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await page
      .locator('svg[width="100%"][height="100%"]')
      .waitFor({ timeout: 15000 });

    await switchToQuadrantView(page);

    await switchToMindmapView(page);

    await expect(page.locator('svg[width="100%"][height="100%"]')).toBeVisible({
      timeout: 5000,
    });

    await expect(page).not.toHaveURL(/login/);
  });
});
