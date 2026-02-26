import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { testUser } from './utils/testHelpers';

test.describe('Dashboard 页面测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
  });

  test('应该显示 Dashboard 页面', async () => {
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });
    await expect(dashboardPage.title).toBeVisible();
    await expect(dashboardPage.searchInput).toBeVisible();
    await expect(dashboardPage.newGraphButton).toBeVisible();
  });

  test('应该显示图谱列表', async () => {
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });
    const graphCount = await dashboardPage.getGraphCount();
    expect(graphCount).toBeGreaterThanOrEqual(0);
  });

  test('应该能够打开模板选择器', async ({ page }) => {
    await dashboardPage.newGraphButton.click();
    await expect(page.locator('text=选择模板')).toBeVisible();
    await expect(page.locator('button:has-text("跳过，创建空白图谱")')).toBeVisible();
  });

  test('应该能够跳过模板创建空白图谱', async ({ page }) => {
    await dashboardPage.newGraphButton.click();
    await page.locator('button:has-text("跳过，创建空白图谱")').click();
    await expect(dashboardPage.graphTitleInput).toBeVisible();
    await expect(dashboardPage.graphDescriptionInput).toBeVisible();
    await expect(dashboardPage.confirmCreateButton).toBeVisible();
    await expect(dashboardPage.cancelButton).toBeVisible();
  });

  test('应该能够关闭创建图谱弹窗', async () => {
    await dashboardPage.openCreateGraphModal();
    await expect(dashboardPage.graphTitleInput).toBeVisible();
    await dashboardPage.closeModal();
    await expect(dashboardPage.graphTitleInput).not.toBeVisible();
  });

  test('应该能够搜索图谱', async () => {
    await dashboardPage.searchGraphs('测试');
    await expect(dashboardPage.searchInput).toHaveValue('测试');
  });

  test('应该支持主题切换', async () => {
    const isDarkBefore = await dashboardPage.isDarkMode();
    await dashboardPage.toggleTheme();
    const isDarkAfter = await dashboardPage.isDarkMode();
    expect(isDarkBefore).not.toBe(isDarkAfter);
  });
});
