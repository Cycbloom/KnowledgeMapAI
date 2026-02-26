import { test, expect } from '@playwright/test';

test.describe('登录功能测试', () => {
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该显示登录页面', async ({ page }) => {
    await expect(page).toHaveTitle(/Knowledge Map AI/);
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
    await expect(page.getByText('邮箱')).toBeVisible();
    await expect(page.getByText('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('应该能够成功登录', async ({ page }) => {
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();
  });

  test('应该显示登录错误信息', async ({ page }) => {
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.bg-red-100, .dark\\:bg-red-900\\/30')).toBeVisible();
  });

  test('应该验证必填字段', async ({ page }) => {
    await page.click('button[type="submit"]');

    await expect(page.locator('input[name="email"]')).toBeFocused();
  });

  test('应该能够导航到注册页面', async ({ page }) => {
    await page.click('a[href="/register"]');

    await expect(page).toHaveURL(/\/register/);
  });

  test('应该支持主题切换', async ({ page }) => {
    const themeButton = page.locator('button[title*="切换"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    await expect(page.locator('.dark')).toHaveCount(1);
  });
});
