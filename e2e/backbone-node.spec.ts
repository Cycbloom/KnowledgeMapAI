import { test, expect } from "./fixtures";
import { GraphPage } from "./pages/GraphPage";

test.describe("专题研究图谱骨干节点测试", () => {
  let graphPage: GraphPage;

  // 通过 authenticatedPage fixture 完成登录（替代原 loginAsTestUser 调用）。
  // GraphPage 仍在此处初始化,以便各测试复用同一实例。
  test.beforeEach(async ({ authenticatedPage: page }) => {
    graphPage = new GraphPage(page);
  });

  test("应该能够创建专题研究图谱并验证骨干节点标题标准化", async ({ page }) => {
    const graphTitle = `专题研究测试_${Date.now()}`;

    await graphPage.navigateToHome();

    const newButton = page
      .locator('button:has-text("新建"), button:has-text("创建")')
      .first();
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();

    const titleInput = page
      .locator('input[placeholder*="标题"], input[name="title"]')
      .first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill(graphTitle);

    const topicResearchOption = page
      .locator(
        'button:has-text("专题研究"), [data-template="topic_research"]',
      )
      .first();
    await expect(topicResearchOption).toBeVisible({ timeout: 3000 });
    await topicResearchOption.click();

    const createButton = page
      .locator('button:has-text("创建"), button[type="submit"]')
      .first();
    await createButton.click();

    await page.waitForURL(/\/graph\/.*/, { timeout: 15000 });

    await expect(page).not.toHaveURL(/login/);

    await page.waitForLoadState("networkidle");

    const backboneNodeTitles = [
      "研究背景",
      "文献综述",
      "研究方法",
      "核心概念",
      "应用领域",
      "未来方向",
    ];

    for (const title of backboneNodeTitles) {
      const node = page.locator(`text="${title}"`).first();
      await expect(node).toBeVisible({ timeout: 5000 });
    }
  });

  test("应该显示骨干节点专属图标", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const backboneNode = page
      .locator('text="研究背景", text="文献综述", text="核心概念"')
      .first();
    await expect(backboneNode).toBeVisible({ timeout: 5000 });

    const parentElement = backboneNode.locator("xpath=..");
    const iconElement = parentElement
      .locator('svg, [class*="icon"]')
      .first();
    await expect(iconElement).toBeVisible({ timeout: 3000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该禁止修改骨干节点标题", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const backboneNode = page
      .locator('text="研究背景", text="文献综述", text="核心概念"')
      .first();
    await expect(backboneNode).toBeVisible({ timeout: 5000 });
    await backboneNode.click();

    await page.waitForTimeout(500);

    const editButton = page.locator('button:has-text("编辑")').first();
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();

    const titleInput = page
      .locator('input[placeholder*="节点标题"], input[value]')
      .first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    const isReadOnly = await titleInput.getAttribute("readonly");
    const hasDisabledStyle = await titleInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.cursor === "not-allowed" ||
        el.classList.contains("cursor-not-allowed") ||
        el.hasAttribute("disabled")
      );
    });
    // 骨干节点标题应该被禁止修改（通过 readonly 或 disabled 样式）
    expect(isReadOnly !== null || hasDisabledStyle).toBe(true);

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该通过 API 保护机制阻止骨干节点标题修改", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const backboneNode = page
      .locator('text="研究背景", text="文献综述", text="核心概念"')
      .first();
    await expect(backboneNode).toBeVisible({ timeout: 5000 });

    const nodeId = await backboneNode.getAttribute("data-node-id");
    expect(nodeId).not.toBeNull();

    if (nodeId) {
      const response = await page.request.patch(`/api/nodes/${nodeId}`, {
        data: {
          title: "修改后的标题",
        },
      });

      expect(response.status()).toBe(403);

      const body = await response.json().catch(() => ({}));
      expect(body.message || body.error || "").toContain("骨干节点");
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该显示兼容性检查提示并支持自动标准化", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const compatibilityChecker = page.locator("text=骨干节点兼容性检查");
    await expect(compatibilityChecker).toBeVisible({ timeout: 5000 });

    const autoFixButton = page.locator('button:has-text("自动修复")');
    await expect(autoFixButton).toBeVisible({ timeout: 3000 });
    await autoFixButton.click();

    await page.waitForTimeout(2000);

    const successMessage = page.locator("text=成功修复, text=已成功修复");
    await expect(successMessage).toBeVisible({ timeout: 5000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在批量操作中跳过骨干节点标题修改", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const backboneNode = page
      .locator('text="研究背景", text="文献综述", text="核心概念"')
      .first();
    await expect(backboneNode).toBeVisible({ timeout: 5000 });

    const nodeId = await backboneNode.getAttribute("data-node-id");
    expect(nodeId).not.toBeNull();

    if (nodeId) {
      const response = await page.request.post("/api/nodes/batch-update", {
        data: {
          nodes: [
            {
              id: nodeId,
              title: "批量修改的标题",
            },
          ],
        },
      });

      expect([200, 207, 403]).toContain(response.status());

      if (response.status() === 207 || response.status() === 200) {
        const body = await response.json().catch(() => ({}));
        const bodyStr = JSON.stringify(body);
        const hasSkipMessage =
          bodyStr.includes("跳过") || bodyStr.includes("骨干节点");
        expect(hasSkipMessage).toBe(true);
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该正确显示骨干节点的 backboneModule 属性", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const backboneNode = page
      .locator('text="研究背景", text="文献综述", text="核心概念"')
      .first();
    await expect(backboneNode).toBeVisible({ timeout: 5000 });

    const nodeElement = await backboneNode.evaluateHandle((el) => {
      let current = el;
      while (current && !current.getAttribute("data-node-id")) {
        current = current.parentElement;
      }
      return current;
    });

    const backboneModule = await nodeElement.getAttribute(
      "data-backbone-module",
    );
    expect(backboneModule).not.toBeNull();

    const validModules = [
      "research_background",
      "literature_review",
      "research_methods",
      "core_concepts",
      "application_domains",
      "future_directions",
    ];

    if (backboneModule) {
      expect(validModules).toContain(backboneModule);
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在忽略兼容性检查后正常使用图谱", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const compatibilityChecker = page.locator("text=骨干节点兼容性检查");
    await expect(compatibilityChecker).toBeVisible({ timeout: 5000 });

    const ignoreButton = page.locator('button:has-text("忽略")');
    await expect(ignoreButton).toBeVisible({ timeout: 3000 });
    await ignoreButton.click();

    await page.waitForTimeout(500);

    // 检查器应该关闭
    await expect(compatibilityChecker).not.toBeVisible({ timeout: 1000 });

    const graphCanvas = page
      .locator('canvas, [data-testid="graph-canvas"], .graph-container')
      .first();
    await expect(graphCanvas).toBeVisible({ timeout: 3000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在大纲视图中显示骨干节点图标", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const outlineButton = page
      .locator("button")
      .filter({ hasText: /大纲|目录/ });
    await expect(outlineButton).toBeVisible({ timeout: 3000 });
    await outlineButton.click();

    const outlinePanel = page.locator(
      '[class*="outline"], [class*="sidebar"]',
    );
    await expect(outlinePanel).toBeVisible({ timeout: 5000 });

    const backboneNodeInOutline = outlinePanel.locator(
      'text="研究背景", text="文献综述", text="研究方法", text="核心概念", text="应用领域", text="未来方向"',
    );
    await expect(backboneNodeInOutline.first()).toBeVisible({
      timeout: 3000,
    });

    const backboneNodeElement = backboneNodeInOutline.first();
    const parentElement = backboneNodeElement.locator("xpath=..");

    const iconElement = parentElement
      .locator('svg, [class*="icon"]')
      .first();
    await expect(iconElement).toBeVisible({ timeout: 3000 });

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在大纲视图中显示骨干节点悬停提示", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    await expect(graphLink).toBeVisible({ timeout: 5000 });
    await graphLink.click();
    await page.waitForLoadState("networkidle");

    const outlineButton = page
      .locator("button")
      .filter({ hasText: /大纲|目录/ });
    await expect(outlineButton).toBeVisible({ timeout: 3000 });
    await outlineButton.click();

    const outlinePanel = page.locator(
      '[class*="outline"], [class*="sidebar"]',
    );
    await expect(outlinePanel).toBeVisible({ timeout: 5000 });

    const backboneNodeInOutline = outlinePanel.locator(
      'text="研究背景", text="文献综述", text="研究方法", text="核心概念", text="应用领域", text="未来方向"',
    );
    await expect(backboneNodeInOutline.first()).toBeVisible({
      timeout: 3000,
    });

    const backboneNodeElement = backboneNodeInOutline.first();
    const parentElement = backboneNodeElement.locator("xpath=..");

    const iconElement = parentElement
      .locator('svg, [class*="icon"]')
      .first();
    await expect(iconElement).toBeVisible({ timeout: 3000 });
    await iconElement.hover();

    await page.waitForTimeout(500);

    const tooltip = page.locator(
      '[role="tooltip"], [class*="tooltip"]',
    );
    await expect(tooltip).toBeVisible({ timeout: 2000 });

    await expect(page).not.toHaveURL(/login/);
  });
});
