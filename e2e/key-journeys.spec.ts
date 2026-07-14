import { test, expect } from "./fixtures";
import { authedRequest } from "./utils/auth";

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
    // 登录后不应停留在 /login（Dashboard 现直接挂载在 / 路由）
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 仪表板应显示图谱相关内容（Dashboard 标题,兼容中英文 locale）
    await expect(
      page.getByText(/My Knowledge Graphs|我的知识图谱/).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应能打开已有图谱并显示画布", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 直接导航到 testGraph fixture 创建的图谱
    await page.goto(`/graph/${testGraph.id}`);
    await page.waitForLoadState("load");

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
    const createRes = await authedRequest(page, "POST", "/api/nodes", {
      graph_id: testGraph.id,
      title: nodeTitle,
      content: "冒烟测试节点内容",
    });
    expect(createRes.ok, `创建节点失败: HTTP ${createRes.status}`).toBe(true);
    const node = createRes.body as { id: string; title: string };
    expect(node.id).toBeTruthy();
    expect(node.title).toBe(nodeTitle);

    // 通过 GET 验证节点已持久化
    const getRes = await authedRequest(page, "GET", `/api/nodes/${node.id}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as { title: string; graph_id: string };
    expect(fetched.title).toBe(nodeTitle);
    expect(fetched.graph_id).toBe(testGraph.id);
  });

  test("应能通过 API 创建笔记并验证出现在笔记列表", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // App Action:通过 API 创建笔记
    const noteTitle = `冒烟笔记_${Date.now()}`;
    const createRes = await authedRequest(page, "POST", "/api/notes", {
      title: noteTitle,
      content: `关联图谱: ${testGraph.title}`,
      type: "note",
      tags: ["冒烟测试"],
    });
    expect(createRes.ok, `创建笔记失败: HTTP ${createRes.status}`).toBe(true);
    const note = createRes.body as { id: string; title: string };
    expect(note.id).toBeTruthy();
    expect(note.title).toBe(noteTitle);

    // 通过列表 API 验证笔记可被检索
    const listRes = await authedRequest(
      page,
      "GET",
      `/api/notes?search=${encodeURIComponent(noteTitle)}`,
    );
    expect(listRes.ok).toBe(true);
    type NoteListItem = { id: string; title: string };
    const list = listRes.body as
      | NoteListItem[]
      | { items?: NoteListItem[]; data?: NoteListItem[] };
    const items: NoteListItem[] = Array.isArray(list)
      ? list
      : (list.items ?? list.data ?? []);
    const found = items.some((n) => n.id === note.id);
    expect(found, "创建的笔记未出现在列表中").toBe(true);

    // 清理:删除笔记
    await authedRequest(page, "DELETE", `/api/notes/${note.id}`);
  });
});
