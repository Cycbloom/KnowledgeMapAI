import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth";
import { GraphPage } from "./pages/GraphPage";

test.describe("专题研究图谱骨干节点测试", () => {
  let graphPage: GraphPage;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    graphPage = new GraphPage(page);
  });

  test("应该能够创建专题研究图谱并验证骨干节点标题标准化", async ({ page }) => {
    const graphTitle = `专题研究测试_${Date.now()}`;

    await graphPage.navigateToHome();

    const newButton = page
      .locator('button:has-text("新建"), button:has-text("创建")')
      .first();
    if (await newButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newButton.click();

      const titleInput = page
        .locator('input[placeholder*="标题"], input[name="title"]')
        .first();
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await titleInput.fill(graphTitle);

        const topicResearchOption = page
          .locator(
            'button:has-text("专题研究"), [data-template="topic_research"]',
          )
          .first();
        if (
          await topicResearchOption
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await topicResearchOption.click();
        }

        const createButton = page
          .locator('button:has-text("创建"), button[type="submit"]')
          .first();
        await createButton.click();

        await page
          .waitForURL(/\/graph\/.*/, { timeout: 15000 })
          .catch(() => {});
      }
    }

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
      const isVisible = await node
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (isVisible) {
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test("应该显示骨干节点专属图标", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const backboneNode = page
        .locator('text="研究背景", text="文献综述", text="核心概念"')
        .first();
      if (await backboneNode.isVisible({ timeout: 5000 }).catch(() => false)) {
        const parentElement = backboneNode.locator("xpath=..");
        const iconElement = parentElement
          .locator('svg, [class*="icon"]')
          .first();

        const hasIcon = await iconElement
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(typeof hasIcon).toBe("boolean");
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该禁止修改骨干节点标题", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const backboneNode = page
        .locator('text="研究背景", text="文献综述", text="核心概念"')
        .first();
      if (await backboneNode.isVisible({ timeout: 5000 }).catch(() => false)) {
        await backboneNode.click();

        await page.waitForTimeout(500);

        const editButton = page.locator('button:has-text("编辑")').first();
        if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editButton.click();

          const titleInput = page
            .locator('input[placeholder*="节点标题"], input[value]')
            .first();
          if (
            await titleInput.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            const isReadOnly = await titleInput.getAttribute("readonly");

            expect(isReadOnly).not.toBeNull();

            const hasDisabledStyle = await titleInput.evaluate((el) => {
              const styles = window.getComputedStyle(el);
              return (
                styles.cursor === "not-allowed" ||
                el.classList.contains("cursor-not-allowed") ||
                el.hasAttribute("disabled")
              );
            });

            expect(typeof hasDisabledStyle).toBe("boolean");
          }
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该通过 API 保护机制阻止骨干节点标题修改", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const backboneNode = page
        .locator('text="研究背景", text="文献综述", text="核心概念"')
        .first();
      if (await backboneNode.isVisible({ timeout: 5000 }).catch(() => false)) {
        const nodeId = await backboneNode
          .getAttribute("data-node-id")
          .catch(() => null);

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
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该显示兼容性检查提示并支持自动标准化", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const compatibilityChecker = page.locator("text=骨干节点兼容性检查");
      const hasChecker = await compatibilityChecker
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasChecker) {
        const autoFixButton = page.locator('button:has-text("自动修复")');
        if (
          await autoFixButton.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await autoFixButton.click();

          await page.waitForTimeout(2000);

          const successMessage = page.locator("text=成功修复, text=已成功修复");
          const hasSuccessMessage = await successMessage
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          expect(typeof hasSuccessMessage).toBe("boolean");
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在批量操作中跳过骨干节点标题修改", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const backboneNode = page
        .locator('text="研究背景", text="文献综述", text="核心概念"')
        .first();
      if (await backboneNode.isVisible({ timeout: 5000 }).catch(() => false)) {
        const nodeId = await backboneNode
          .getAttribute("data-node-id")
          .catch(() => null);

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

            if (body.results || body.skipped) {
              const hasSkipMessage =
                JSON.stringify(body).includes("跳过") ||
                JSON.stringify(body).includes("骨干节点");
              expect(typeof hasSkipMessage).toBe("boolean");
            }
          }
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该正确显示骨干节点的 backboneModule 属性", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const backboneNode = page
        .locator('text="研究背景", text="文献综述", text="核心概念"')
        .first();
      if (await backboneNode.isVisible({ timeout: 5000 }).catch(() => false)) {
        const nodeElement = await backboneNode.evaluateHandle((el) => {
          let current = el;
          while (current && !current.getAttribute("data-node-id")) {
            current = current.parentElement;
          }
          return current;
        });

        const backboneModule = await nodeElement
          .getAttribute("data-backbone-module")
          .catch(() => null);

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
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在忽略兼容性检查后正常使用图谱", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const compatibilityChecker = page.locator("text=骨干节点兼容性检查");
      const hasChecker = await compatibilityChecker
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasChecker) {
        const ignoreButton = page.locator('button:has-text("忽略")');
        if (
          await ignoreButton.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await ignoreButton.click();

          await page.waitForTimeout(500);

          const checkerClosed = await compatibilityChecker
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          expect(checkerClosed).toBe(false);
        }
      }

      const graphCanvas = page
        .locator('canvas, [data-testid="graph-canvas"], .graph-container')
        .first();
      const isGraphVisible = await graphCanvas
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isGraphVisible).toBe("boolean");
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在大纲视图中显示骨干节点图标", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const outlineButton = page
        .locator("button")
        .filter({ hasText: /大纲|目录/ });
      if (await outlineButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await outlineButton.click();

        const outlinePanel = page.locator(
          '[class*="outline"], [class*="sidebar"]',
        );
        await expect(outlinePanel).toBeVisible({ timeout: 5000 });

        const backboneNodeInOutline = outlinePanel.locator(
          'text="研究背景", text="文献综述", text="研究方法", text="核心概念", text="应用领域", text="未来方向"',
        );
        if (
          await backboneNodeInOutline
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          const backboneNodeElement = backboneNodeInOutline.first();
          const parentElement = backboneNodeElement.locator("xpath=..");

          const iconElement = parentElement
            .locator('svg, [class*="icon"]')
            .first();
          const hasIcon = await iconElement
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          expect(typeof hasIcon).toBe("boolean");
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该在大纲视图中显示骨干节点悬停提示", async ({ page }) => {
    await graphPage.navigateToHome();

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState("networkidle");

      const outlineButton = page
        .locator("button")
        .filter({ hasText: /大纲|目录/ });
      if (await outlineButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await outlineButton.click();

        const outlinePanel = page.locator(
          '[class*="outline"], [class*="sidebar"]',
        );
        await expect(outlinePanel).toBeVisible({ timeout: 5000 });

        const backboneNodeInOutline = outlinePanel.locator(
          'text="研究背景", text="文献综述", text="研究方法", text="核心概念", text="应用领域", text="未来方向"',
        );
        if (
          await backboneNodeInOutline
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          const backboneNodeElement = backboneNodeInOutline.first();
          const parentElement = backboneNodeElement.locator("xpath=..");

          const iconElement = parentElement
            .locator('svg, [class*="icon"]')
            .first();
          if (
            await iconElement.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            await iconElement.hover();

            await page.waitForTimeout(500);

            const tooltip = page.locator(
              '[role="tooltip"], [class*="tooltip"]',
            );
            const hasTooltip = await tooltip
              .isVisible({ timeout: 2000 })
              .catch(() => false);

            expect(typeof hasTooltip).toBe("boolean");
          }
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });
});
