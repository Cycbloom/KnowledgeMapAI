import { test as base, expect, type Page } from "@playwright/test";
import { loginAsTestUser, waitForAuthReady } from "./utils/auth";

/**
 * 测试图谱数据（由 testGraph fixture 通过 API 创建）。
 */
type TestGraph = {
  id: string;
  title: string;
};

/**
 * 自定义 Fixtures 类型。
 *
 * - `authenticatedPage`:已登录测试用户的 Page（复用 utils/auth 的 UI 登录流程）。
 * - `testGraph`:通过 API 创建的测试图谱（App Action 模式,比 UI 创建更快）,
 *   测试结束自动永久删除。
 * - `cleanDb`:占位 fixture,预留给需要清理全局状态的测试。
 */
type CustomFixtures = {
  authenticatedPage: Page;
  testGraph: TestGraph;
  cleanDb: void;
};

export const test = base.extend<CustomFixtures>({
  /**
   * 已登录的 Page。
   *
   * 使用 UI 登录流程（与 utils/auth.loginAsTestUser 一致）以贴近真实用户场景。
   * 登录后等待网络空闲,确保后续断言稳定。
   *
   * 额外等待 auth session 恢复完成（通过 waitForAuthReady 轮询认证 API），
   * 防止后续页面导航时 React 应用在 session 恢复前发出无 Authorization
   * header 的 API 请求（401 竞态）。
   */
  authenticatedPage: async ({ page }, use) => {
    await loginAsTestUser(page);
    await waitForAuthReady(page);
    await use(page);
  },

  /**
   * 通过 API 创建的测试图谱。
   *
   * App Action 模式:用 API 做准备（快），用 UI 做断言（真实）。
   * 依赖 `authenticatedPage` 以复用登录后的 cookie（page.request 共享 page 的 cookie）。
   *
   * 测试结束后永久删除图谱,避免污染测试库。
   */
  testGraph: async ({ authenticatedPage: page }, use) => {
    const title = `测试图谱_${Date.now()}`;
    const response = await page.request.post("/api/graphs", {
      data: { title },
    });
    expect(
      response.ok(),
      `创建测试图谱失败: HTTP ${response.status()}`,
    ).toBe(true);
    const graph = (await response.json()) as TestGraph;
    await use(graph);
    // 清理:永久删除（DELETE /api/graphs/:id/permanent 直接物理删除）。
    await page.request.delete(`/api/graphs/${graph.id}/permanent`);
  },

  /**
   * 占位 fixture:当前开发环境不自动清库。
   *
   * 需要清库的测试可显式依赖此 fixture,后续可在内部实现全局清理逻辑
   * （例如调用 /api/data/reset 或批量删除测试用户数据）。
   */
  cleanDb: async ({}, use) => {
    await use(undefined);
  },
});

export { expect };
