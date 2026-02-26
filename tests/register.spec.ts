import { test, expect } from '@playwright/test';
import { RegisterPage } from './pages/RegisterPage';

test.describe('注册功能测试', () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });

  test('应该显示注册页面', async () => {
    await expect(registerPage.nameInput).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.registerButton).toBeVisible();
    await expect(registerPage.loginLink).toBeVisible();
  });

  test('应该显示页面标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '注册' })).toBeVisible();
  });

  test('应该验证必填字段', async ({ page }) => {
    await registerPage.registerButton.click();
    await expect(page.locator('input[name="name"]:invalid, input[name="name"][required]')).toBeVisible();
  });

  test('应该能够导航到登录页面', async ({ page }) => {
    await registerPage.clickLogin();
    await expect(page).toHaveURL(/\/login/);
  });

  test('应该支持主题切换', async () => {
    const isDarkBefore = await registerPage.isDarkMode();
    await registerPage.toggleTheme();
    const isDarkAfter = await registerPage.isDarkMode();
    expect(isDarkBefore).not.toBe(isDarkAfter);
  });
});
