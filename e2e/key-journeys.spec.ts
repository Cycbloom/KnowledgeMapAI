import { test, expect } from "./fixtures";

/**
 * 关键用户旅程冒烟测试。
 *
 * 目标:用最少的用例覆盖核心用户流程（登录 → 创建图谱 → 添加节点 → 创建笔记）,
 * 确保关键路径不回归。
 *
 * 策略:
 * - 登录:通过 `authenticatedPage` fixture（UI 登录,贴近真实用户）。
 * - 图谱准备:通过 `testGraph` fixture（API 创建,App Action 模式,更快）。
 * - 断言:优先使用 UI 断言验证关键可见元素;数据层用 API 验证。
 */
test.describe("关键用户旅程冒烟测试", () => {
  test("登录后应跳转到仪表板并显示图谱列表区", async ({
    authenticatedPage: page,
  }) => {
    // 登录后应跳转到 /dashboard（Home 组件重定向到 /dashboard）
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 仪表板应显示"新建"图谱入口
    const newGraphButton = page
      .locator('button:has-text("新建"), button:has-text("创建")')
      .first();
    await expect(newGraphButton).toBeVisible({ timeout: 10000 });
  });

  test("应能通过 UI 创建空图谱并跳转到图谱编辑器", async ({
    authenticatedPage: page,
  }) => {
    const graphTitle = `冒烟测试_UI创建_${Date.now()}`;

    await page
      .locator('button:has-text("新建"), button:has-text("创建")')
      .first()
      .click();

    const titleInput = page
      .locator('input[placeholder*="标题"], input[name="title"]')
      .first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(graphTitle);

    // 不选模板,创建空图谱
    await page
      .locator('button:has-text("创建"), button[type="submit"]')
      .first()
      .click();

    // 应跳转到图谱编辑器页面
    await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });

    // 画布容器应可见（data-tour="canvas" 是 GraphEditor 的画布根节点）
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 10000,
    });

    // 清理:通过 API 永久删除该图谱
    const graphId = page.url().match(/\/graph\/([a-f0-9-]+)/)?.[1];
    if (graphId) {
      await page.request.delete(`/api/graphs/${graphId}/permanent`);
    }
  });

  test("应能打开已有图谱并显示画布", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 直接导航到 testGraph fixture 创建的图谱
    await page.goto(`/graph/${testGraph.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(new RegExp(`/graph/${testGraph.id}`), {
      timeout: 10000,
    });

    // 画布容器应可见
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test("应能通过 API 创建节点并验证", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // App Action:通过 API 创建节点（比 UI 拖拽更快更稳定）
    const nodeTitle = `冒烟节点_${Date.now()}`;
    const createResponse = await page.request.post("/api/nodes", {
      data: {
        graph_id: testGraph.id,
        title: nodeTitle,
        content: "冒烟测试节点内容",
      },
    });
    expect(
      createResponse.ok(),
      `创建节点失败: HTTP ${createResponse.status()}`,
    ).toBe(true);
    const node = await createResponse.json();
    expect(node.id).toBeTruthy();
    expect(node.title).toBe(nodeTitle);

    // 通过 GET 验证节点已持久化
    const getResponse = await page.request.get(`/api/nodes/${node.id}`);
    expect(getResponse.ok()).toBe(true);
    const fetched = await getResponse.json();
    expect(fetched.title).toBe(nodeTitle);
    expect(fetched.graph_id).toBe(testGraph.id);
  });

  test("应能通过 API 创建笔记并验证出现在笔记列表", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // App Action:通过 API 创建笔记
    const noteTitle = `冒烟笔记_${Date.now()}`;
    const createResponse = await page.request.post("/api/notes", {
      data: {
        title: noteTitle,
        content: `关联图谱: ${testGraph.title}`,
        type: "note" as const,
        tags: ["冒烟测试"],
      },
    });
    expect(
      createResponse.ok(),
      `创建笔记失败: HTTP ${createResponse.status()}`,
    ).toBe(true);
    const note = await createResponse.json();
    expect(note.id).toBeTruthy();
    expect(note.title).toBe(noteTitle);

    // 通过列表 API 验证笔记可被检索
    const listResponse = await page.request.get(
      `/api/notes?search=${encodeURIComponent(noteTitle)}`,
    );
    expect(listResponse.ok()).toBe(true);
    const list = await listResponse.json();
    const items = Array.isArray(list) ? list : (list.items ?? list.data ?? []);
    const found = items.some(
      (n: { id: string; title: string }) => n.id === note.id,
    );
    expect(found, "创建的笔记未出现在列表中").toBe(true);

    // 清理:删除笔记
    await page.request.delete(`/api/notes/${note.id}`);
  });
});
