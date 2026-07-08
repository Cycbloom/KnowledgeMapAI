import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth";
import { GraphPage } from "./pages/GraphPage";

test.describe("象限视图测试", () => {
  let graphPage: GraphPage;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    graphPage = new GraphPage(page);
  });

  test("应该能够打开图谱并切换到象限视图", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"], button[aria-label*="象限"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const quadrantCanvas = page.locator(
      'svg, [data-testid="quadrant-canvas"], .quadrant-view',
    );
    await expect(quadrantCanvas).toBeVisible({ timeout: 5000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("象限视图应该显示区域和节点", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const svg = page.locator("svg");
    await expect(svg).toBeVisible({ timeout: 5000 });
    const circles = svg.locator("circle");
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够折叠和展开区域", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const regionHeader = page.locator("[data-region-id]").first();
    await expect(regionHeader).toBeVisible({ timeout: 5000 });
    await regionHeader.click();
    await page.waitForTimeout(300);

    await expect(regionHeader).toBeVisible();

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够点击节点", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const node = page.locator("[data-node-id]").first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click();
    await page.waitForTimeout(300);

    await expect(node).toBeVisible();

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够拖拽原点", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

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

  test("应该能够使用缩放控制", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const zoomIndicator = page.locator("text=/缩放.*%/");
    await expect(zoomIndicator).toBeVisible({ timeout: 5000 });

    const buttons = page.locator("button").filter({
      has: page.locator("svg"),
    });
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);

    await buttons.nth(0).click();
    await page.waitForTimeout(200);

    await buttons.nth(1).click();
    await page.waitForTimeout(200);

    await buttons.nth(2).click();
    await page.waitForTimeout(200);

    await expect(zoomIndicator).toBeVisible();

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够使用鼠标滚轮缩放", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const svg = page.locator("svg");
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

  test("应该能够拖拽画布", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const svg = page.locator("svg");
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

  test("象限视图应该正确显示节点状态", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const nodes = page.locator("[data-node-id]");
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    const firstNode = nodes.first();
    const circle = firstNode.locator("circle");
    const hasCircle = await circle.count();
    expect(hasCircle).toBeGreaterThan(0);

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够从象限视图切换回其他视图", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const viewModeSelector = page.locator(
      'button:has-text("象限"), [data-view-mode="quadrant"]',
    );
    await expect(viewModeSelector).toBeVisible({ timeout: 5000 });
    await viewModeSelector.click();
    await page.waitForTimeout(500);

    const mindmapSelector = page.locator(
      'button:has-text("思维导图"), button:has-text("脑图"), [data-view-mode="mindmap"]',
    );
    await expect(mindmapSelector).toBeVisible({ timeout: 5000 });
    await mindmapSelector.click();
    await page.waitForTimeout(500);

    await expect(page.locator("svg")).toBeVisible({ timeout: 5000 });

    await expect(page).not.toHaveURL(/login/);
  });
});
