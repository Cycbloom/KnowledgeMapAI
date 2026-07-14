import { test, expect } from './fixtures';
import { authedRequest, navigateAndWaitForAuth } from './utils/auth';

test.describe('协作功能测试', () => {
  test('应该能够显示首页', async ({ authenticatedPage: page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该能够创建新图谱', async ({ authenticatedPage: page }) => {
    // App Action: 通过 API 创建图谱（比 UI 点击更快更稳定）
    const createRes = await authedRequest(page, 'POST', '/api/graphs', {
      title: '测试协作图谱',
    });
    expect(createRes.ok, `创建图谱失败: HTTP ${createRes.status}`).toBe(true);
    const graph = createRes.body as { id: string };
    expect(graph.id).toBeTruthy();

    try {
      // 导航到图谱页面,验证画布可见
      await navigateAndWaitForAuth(page, `/graph/${graph.id}`);
      await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      // 清理: 永久删除图谱,避免污染测试库
      await authedRequest(page, 'DELETE', `/api/graphs/${graph.id}/permanent`);
    }
  });

  test('应该能够在图谱页面显示分享按钮', async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 15000,
    });

    // 分享按钮: 通过 title 属性定位,兼容中英文 locale
    // zh-CN: title="分享图谱"; en-US: title="Share Graph"
    const shareButton = page
      .locator('button[title*="分享"], button[title*="Share"]')
      .first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
  });

  test('应该能够打开分享对话框', async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 15000,
    });

    // 点击分享按钮
    const shareButton = page
      .locator('button[title*="分享"], button[title*="Share"]')
      .first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    // 验证分享对话框出现（ShareModal header 硬编码为 "分享图谱"）
    const dialog = page.getByText('分享图谱', { exact: true }).first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});
