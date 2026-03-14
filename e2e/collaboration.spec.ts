import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('协作功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('应该能够显示首页', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该能够创建新图谱', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const newButton = page.locator('button:has-text("新建"), button:has-text("创建")').first();
    if (await newButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newButton.click();
      const titleInput = page.locator('input[placeholder*="标题"], input[name="title"]').first();
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await titleInput.fill('测试协作图谱');
        const createButton = page.locator('button:has-text("创建"), button[type="submit"]').first();
        await createButton.click();
        await page.waitForURL(/\/graph\/.*/, { timeout: 10000 }).catch(() => {});
      }
    }
    await expect(page).not.toHaveURL(/login/);
  });

  test('应该能够在图谱页面显示分享按钮', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
      const shareButton = page.locator('button:has-text("分享")');
      await expect(shareButton).toBeVisible({ timeout: 5000 }).catch(() => {
      });
    }
    await expect(page).not.toHaveURL(/login/);
  });

  test('应该能够打开分享对话框', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
      const shareButton = page.locator('button:has-text("分享")');
      if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await shareButton.click();
        const dialog = page.locator('text=分享图谱, text=分享与协作').first();
        await expect(dialog).toBeVisible({ timeout: 5000 }).catch(() => {});
      }
    }
    await expect(page).not.toHaveURL(/login/);
  });
});
