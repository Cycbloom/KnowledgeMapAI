import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { testUser } from './utils/testHelpers';

test.describe('登录功能测试 (POM)', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('应该显示登录页面', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
  });

  test('应该能够成功登录', async ({ page }) => {
    await loginPage.login(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible({ timeout: 10000 });
  });

  test('应该显示登录错误信息', async () => {
    await loginPage.login('wrong@example.com', 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('应该能够导航到注册页面', async ({ page }) => {
    await loginPage.clickRegister();
    await expect(page).toHaveURL(/\/register/);
  });

  test('应该支持主题切换', async () => {
    const isDarkBefore = await loginPage.isDarkMode();
    await loginPage.toggleTheme();
    const isDarkAfter = await loginPage.isDarkMode();
    expect(isDarkBefore).not.toBe(isDarkAfter);
  });
});
